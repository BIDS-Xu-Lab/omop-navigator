#!/usr/bin/env bun

import { Database } from "bun:sqlite";
import { mkdir, readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const TABLES = [
  "person",
  "observation_period",
  "visit_occurrence",
  "condition_occurrence",
  "drug_exposure",
  "procedure_occurrence",
  "measurement",
  "observation",
  "death",
  "payer_plan_period",
  "cdm_source",
];

function parseArgs(argv) {
  const args = {
    db: "./script/omop-sample.sqlite",
    sql: "./script/omop.sql",
    cacheDir: "./script/.cache/synpuf-omop",
    bucket: "synpuf-omop",
    prefix: "",
    sampleSize: 1000,
    skipDownload: false,
    keepFiles: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--db" && next) {
      args.db = next;
      i += 1;
    } else if (arg === "--sql" && next) {
      args.sql = next;
      i += 1;
    } else if (arg === "--cache-dir" && next) {
      args.cacheDir = next;
      i += 1;
    } else if (arg === "--bucket" && next) {
      args.bucket = next;
      i += 1;
    } else if (arg === "--prefix" && next) {
      args.prefix = next;
      i += 1;
    } else if (arg === "--sample-size" && next) {
      args.sampleSize = Number(next);
      i += 1;
    } else if (arg === "--skip-download") {
      args.skipDownload = true;
    } else if (arg === "--keep-files") {
      args.keepFiles = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(args.sampleSize) || args.sampleSize <= 0) {
    throw new Error("--sample-size must be a positive number");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: bun ./script/generate-omop-mockup-db.js [options]

Options:
  --db <path>           output sqlite path (default: ./script/omop-sample.sqlite)
  --sql <path>          OMOP schema sql path (default: ./script/omop.sql)
  --cache-dir <path>    download/cache directory (default: ./script/.cache/synpuf-omop)
  --bucket <name>       S3 bucket name (default: synpuf-omop)
  --prefix <prefix>     S3 prefix, e.g. cmsdesynpuf1k/
  --sample-size <n>     number of patients to keep (default: 1000)
  --skip-download       do not call aws s3 cp, only load from cache-dir
  --keep-files          keep downloaded files after db generation
  --help                show this help
`);
}

function runCommand(command, args, opts = {}) {
  const proc = Bun.spawnSync([command, ...args], {
    cwd: opts.cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(proc.stdout).trim();
  const stderr = new TextDecoder().decode(proc.stderr).trim();

  if (proc.exitCode !== 0) {
    const details = stderr || stdout || `exit code ${proc.exitCode}`;
    throw new Error(`Failed: ${command} ${args.join(" ")}\n${details}`);
  }

  return { stdout, stderr };
}

function detectAwsPrefix(bucket) {
  const { stdout } = runCommand("aws", ["s3", "ls", "--no-sign-request", `s3://${bucket}/`]);
  const prefixes = stdout
    .split("\n")
    .map((line) => line.match(/\s+PRE\s+(.+)$/)?.[1] ?? "")
    .filter(Boolean);

  if (prefixes.length === 0) {
    throw new Error(`No prefixes found in s3://${bucket}/`);
  }

  const explicit1k = prefixes.find((p) => /(^|[_-])(1k|1000)([_-]|\/|$)/i.test(p));
  return explicit1k ?? prefixes[0];
}

async function ensureCleanDir(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

async function listFilesRecursive(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(fullPath)));
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function stripCompressionExt(filename) {
  return filename
    .replace(/\.(csv|txt)$/i, "")
    .replace(/\.(gz|gzip|bz2)$/i, "")
    .replace(/\.(csv|txt)$/i, "");
}

function normalizeTableName(filename) {
  const base = path.basename(filename);
  const stripped = stripCompressionExt(base).toLowerCase();
  const noPrefix = stripped.replace(/^cdm_/, "");
  return noPrefix.replace(/[^a-z0-9_]/g, "");
}

function mapFilesToTables(files) {
  const tableFiles = new Map(TABLES.map((t) => [t, []]));

  for (const file of files) {
    if (!/\.(csv|txt)(\.(gz|gzip|bz2))?$/i.test(file)) {
      continue;
    }

    const normalized = normalizeTableName(file);
    for (const table of TABLES) {
      if (
        normalized === table ||
        normalized === `cdm_${table}` ||
        normalized.endsWith(`_${table}`) ||
        normalized.startsWith(`${table}_`)
      ) {
        tableFiles.get(table).push(file);
      }
    }
  }

  return tableFiles;
}

async function readCompressedText(filePath) {
  if (/\.bz2$/i.test(filePath)) {
    const { stdout } = runCommand("bzip2", ["-dc", filePath]);
    return stdout;
  }

  if (/\.(gz|gzip)$/i.test(filePath)) {
    const compressed = await readFile(filePath);
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    return await new Response(stream).text();
  }

  return await readFile(filePath, "utf8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };

  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushCell();
    } else if (ch === "\n") {
      pushCell();
      pushRow();
    } else if (ch === "\r") {
      // skip
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    pushCell();
    pushRow();
  }

  if (rows.length === 0) {
    return { header: [], records: [] };
  }

  const [header, ...records] = rows;
  const cleanedRecords = records.filter((record) => record.some((v) => v !== ""));
  return { header, records: cleanedRecords };
}

function pickSamplePersonIds(personRows, personIdKey, sampleSize) {
  const ids = [];
  for (const row of personRows) {
    const id = row[personIdKey];
    if (!id) continue;
    ids.push(id);
  }

  if (ids.length <= sampleSize) {
    return new Set(ids);
  }

  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return new Set(ids.slice(0, sampleSize));
}

function findHeaderIndex(header, targetName) {
  const lower = targetName.toLowerCase();
  return header.findIndex((h) => h.toLowerCase() === lower);
}

function castValue(value, targetType) {
  if (value === "") return null;

  if (/INT/i.test(targetType)) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  if (/REAL|FLOA|DOUB|NUM/i.test(targetType)) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  return value;
}

function getTableInfo(db, tableName) {
  return db.query(`PRAGMA table_info(${tableName})`).all();
}

function createInserter(db, tableName, tableInfo, sourceHeader) {
  const sourceMap = new Map(sourceHeader.map((col, idx) => [col.toLowerCase(), idx]));
  const columns = tableInfo.filter((col) => sourceMap.has(col.name.toLowerCase()));

  if (columns.length === 0) {
    return null;
  }

  const sql = `INSERT OR IGNORE INTO ${tableName} (${columns.map((c) => c.name).join(", ")}) VALUES (${columns.map(() => "?").join(",")})`;
  const stmt = db.query(sql);

  return {
    run(record) {
      const values = columns.map((col) => {
        const idx = sourceMap.get(col.name.toLowerCase());
        return castValue(record[idx] ?? "", col.type);
      });
      const result = stmt.run(...values);
      return result.changes > 0;
    },
  };
}

async function loadCsvRows(filePath) {
  const text = await readCompressedText(filePath);
  return parseCsv(text);
}

async function main() {
  const args = parseArgs(process.argv);

  await mkdir(path.dirname(args.db), { recursive: true });
  await mkdir(args.cacheDir, { recursive: true });
  await rm(args.db, { force: true });
  await rm(`${args.db}-wal`, { force: true });
  await rm(`${args.db}-shm`, { force: true });

  const prefix = args.prefix || detectAwsPrefix(args.bucket);
  const selectedPrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;

  console.log(`Using bucket: s3://${args.bucket}/${selectedPrefix}`);

  if (!args.skipDownload) {
    await ensureCleanDir(args.cacheDir);
    runCommand("aws", [
      "s3",
      "cp",
      "--recursive",
      "--no-sign-request",
      `s3://${args.bucket}/${selectedPrefix}`,
      args.cacheDir,
    ]);
  }

  const files = await listFilesRecursive(args.cacheDir);
  if (files.length === 0) {
    throw new Error(`No files found in cache dir: ${args.cacheDir}`);
  }

  const tableFiles = mapFilesToTables(files);

  const personFiles = tableFiles.get("person") || [];
  if (personFiles.length === 0) {
    throw new Error("Could not find person table file in downloaded data.");
  }

  const sql = await readFile(args.sql, "utf8");
  const db = new Database(args.db, { create: true });
  db.exec(sql);

  let selectedPersonIds = new Set();

  db.exec("BEGIN TRANSACTION");
  try {
    const personTableInfo = getTableInfo(db, "person");

    const personRowsAll = [];
    let personHeader = null;

    for (const personFile of personFiles) {
      const { header, records } = await loadCsvRows(personFile);
      if (!personHeader) personHeader = header;
      personRowsAll.push(...records);
    }

    const personIdIndex = findHeaderIndex(personHeader ?? [], "person_id");
    if (personIdIndex < 0) {
      throw new Error("person_id column not found in person file.");
    }

    selectedPersonIds = pickSamplePersonIds(
      personRowsAll.map((r) => ({ person_id: r[personIdIndex] })),
      "person_id",
      args.sampleSize,
    );

    const personInserter = createInserter(db, "person", personTableInfo, personHeader ?? []);
    if (!personInserter) {
      throw new Error("No overlapping person columns between CSV and schema.");
    }

    let insertedPersons = 0;
    let ignoredPersonDuplicates = 0;
    for (const record of personRowsAll) {
      const id = record[personIdIndex];
      if (!selectedPersonIds.has(id)) continue;
      if (personInserter.run(record)) {
        insertedPersons += 1;
      } else {
        ignoredPersonDuplicates += 1;
      }
    }

    console.log(`Inserted person rows: ${insertedPersons} (ignored duplicates: ${ignoredPersonDuplicates})`);

    for (const table of TABLES.filter((t) => t !== "person")) {
      const filesForTable = tableFiles.get(table) || [];
      if (filesForTable.length === 0) {
        console.log(`Skip table (no source file): ${table}`);
        continue;
      }

      const tableInfo = getTableInfo(db, table);
      let inserted = 0;
      let ignoredDuplicates = 0;

      for (const filePath of filesForTable) {
        const { header, records } = await loadCsvRows(filePath);
        const inserter = createInserter(db, table, tableInfo, header);
        if (!inserter) continue;

        const personIdCol = findHeaderIndex(header, "person_id");

        for (const record of records) {
          if (personIdCol >= 0) {
            const personId = record[personIdCol];
            if (!selectedPersonIds.has(personId)) continue;
          }
          if (inserter.run(record)) {
            inserted += 1;
          } else {
            ignoredDuplicates += 1;
          }
        }
      }

      console.log(`Inserted ${table}: ${inserted} (ignored duplicates: ${ignoredDuplicates})`);
    }

    db.exec("COMMIT");
    // Ensure the exported sqlite file is non-WAL so browser readers can open it as a single file.
    db.exec("PRAGMA wal_checkpoint(FULL);");
    db.exec("PRAGMA journal_mode=DELETE;");
    db.exec("VACUUM;");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    db.close();
  }

  if (!args.keepFiles) {
    const exists = await stat(args.cacheDir).then(() => true).catch(() => false);
    if (exists) {
      await rm(args.cacheDir, { recursive: true, force: true });
    }
  }

  console.log(`SQLite database generated at: ${args.db}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
