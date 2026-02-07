#!/usr/bin/env bun

import { mkdir, readdir, rm, copyFile } from 'node:fs/promises';
import path from 'node:path';

function printHelp() {
  console.log(`Usage: bun ./script/convert-aws-files-to-parquet.js [options]

Options:
  --bucket <name>       S3 bucket (default: synpuf-omop)
  --prefix <prefix>     S3 prefix (default: cmsdesynpuf1k/)
  --cache-dir <path>    Local source cache dir (default: ./script/.cache/aws-source)
  --out-dir <path>      Output parquet dir (default: ./script/parquet)
  --skip-download       Skip aws s3 cp and only convert local cached files
  --keep-source         Keep cache-dir as-is (default behavior cleans cache before download)
  --limit <n>           Convert at most N files
  --help                Show this help

Requirements:
  - aws CLI in PATH
  - duckdb CLI in PATH
`);
}

function parseArgs(argv) {
  const args = {
    bucket: 'synpuf-omop',
    prefix: 'cmsdesynpuf1k/',
    cacheDir: './script/.cache/aws-source',
    outDir: './script/parquet',
    skipDownload: false,
    keepSource: false,
    limit: 0,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if ((arg === '--help') || (arg === '-h')) {
      printHelp();
      process.exit(0);
    } else if (arg === '--bucket' && next) {
      args.bucket = next;
      i += 1;
    } else if (arg === '--prefix' && next) {
      args.prefix = next;
      i += 1;
    } else if (arg === '--cache-dir' && next) {
      args.cacheDir = next;
      i += 1;
    } else if (arg === '--out-dir' && next) {
      args.outDir = next;
      i += 1;
    } else if (arg === '--limit' && next) {
      args.limit = Number(next);
      i += 1;
    } else if (arg === '--skip-download') {
      args.skipDownload = true;
    } else if (arg === '--keep-source') {
      args.keepSource = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.limit) || args.limit < 0) {
    throw new Error('--limit must be a non-negative number');
  }

  return args;
}

function run(command, cmdArgs, options = {}) {
  const proc = Bun.spawnSync([command, ...cmdArgs], {
    cwd: options.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = new TextDecoder().decode(proc.stdout || new Uint8Array());
  const stderr = new TextDecoder().decode(proc.stderr || new Uint8Array());

  if (proc.exitCode !== 0) {
    throw new Error(`${command} ${cmdArgs.join(' ')} failed\n${stderr || stdout}`);
  }

  return { stdout, stderr };
}

function decompressToFile(srcPath, outPath) {
  if (/\.bz2$/i.test(srcPath)) {
    run('sh', ['-c', `bzip2 -dc '${srcPath.replaceAll("'", "'\\''")}' > '${outPath.replaceAll("'", "'\\''")}'`]);
    return;
  }
  if (/\.(gz|gzip)$/i.test(srcPath)) {
    run('sh', ['-c', `gzip -dc '${srcPath.replaceAll("'", "'\\''")}' > '${outPath.replaceAll("'", "'\\''")}'`]);
    return;
  }
  if (/\.zst$/i.test(srcPath)) {
    run('sh', ['-c', `zstd -dc '${srcPath.replaceAll("'", "'\\''")}' > '${outPath.replaceAll("'", "'\\''")}'`]);
    return;
  }
  throw new Error(`Unsupported compressed input: ${srcPath}`);
}

async function listFilesRecursive(rootDir) {
  const out = [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(fullPath)));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function stripKnownExtensions(fileName) {
  let base = fileName;
  base = base.replace(/\.(csv|txt)$/i, '');
  base = base.replace(/\.(gz|gzip|bz2|zst)$/i, '');
  base = base.replace(/\.(csv|txt)$/i, '');
  return base;
}

function sqlString(value) {
  return String(value).replaceAll("'", "''");
}

async function main() {
  const args = parseArgs(process.argv);

  // Check required tools early.
  run('aws', ['--version']);
  run('duckdb', ['--version']);

  await mkdir(args.cacheDir, { recursive: true });
  await mkdir(args.outDir, { recursive: true });

  const normalizedPrefix = args.prefix.endsWith('/') ? args.prefix : `${args.prefix}/`;
  const sourceUri = `s3://${args.bucket}/${normalizedPrefix}`;

  if (!args.skipDownload) {
    if (!args.keepSource) {
      await rm(args.cacheDir, { recursive: true, force: true });
      await mkdir(args.cacheDir, { recursive: true });
    }

    console.log(`Downloading ${sourceUri} -> ${args.cacheDir}`);
    run('aws', ['s3', 'cp', '--recursive', '--no-sign-request', sourceUri, args.cacheDir]);
  }

  const tempDir = path.join(args.cacheDir, '.tmp_plaintext');
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  const allFiles = await listFilesRecursive(args.cacheDir);
  let sourceFiles = allFiles.filter((file) => /\.(csv|txt|parquet)(\.(gz|gzip|bz2|zst))?$/i.test(file));

  if (args.limit > 0) {
    sourceFiles = sourceFiles.slice(0, args.limit);
  }

  if (sourceFiles.length === 0) {
    throw new Error(`No supported source files found in ${args.cacheDir}`);
  }

  let converted = 0;
  for (const srcPath of sourceFiles) {
    const rel = path.relative(args.cacheDir, srcPath);
    const relDir = path.dirname(rel);
    const srcBaseName = path.basename(srcPath);
    const base = stripKnownExtensions(srcBaseName);
    const outDir = path.join(args.outDir, relDir);
    const outPath = path.join(outDir, `${base}.parquet`);

    await mkdir(outDir, { recursive: true });

    if (/\.parquet$/i.test(srcPath)) {
      await copyFile(srcPath, outPath);
      converted += 1;
      console.log(`Copied parquet: ${rel}`);
      continue;
    }

    let csvInputPath = srcPath;
    if (/\.(gz|gzip|bz2|zst)$/i.test(srcPath)) {
      const plainName = `${base}.csv`;
      csvInputPath = path.join(tempDir, plainName);
      decompressToFile(srcPath, csvInputPath);
    }

    const inEsc = sqlString(path.resolve(csvInputPath));
    const outEsc = sqlString(path.resolve(outPath));
    const sql = `COPY (SELECT * FROM read_csv_auto('${inEsc}', SAMPLE_SIZE=-1, IGNORE_ERRORS=true, ALL_VARCHAR=true, HEADER=true, STRICT_MODE=false, DELIM=',')) TO '${outEsc}' (FORMAT PARQUET, COMPRESSION ZSTD);`;

    run('duckdb', ['-batch', '-c', sql]);
    converted += 1;
    console.log(`Converted: ${rel} -> ${path.relative(args.outDir, outPath)}`);
  }

  await rm(tempDir, { recursive: true, force: true });
  console.log(`Done. Converted ${converted} files to parquet in ${args.outDir}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
