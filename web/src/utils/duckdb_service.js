import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdbWasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdbWorkerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function sanitizeIdentifier(name) {
  const cleaned = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'table_data';
}

async function readSqliteHeader(file) {
  const headerBytes = new Uint8Array(await file.slice(0, 100).arrayBuffer());
  const signature = new TextDecoder().decode(headerBytes.slice(0, 16));
  return {
    signature,
    writeVersion: headerBytes[18],
    readVersion: headerBytes[19],
  };
}

export class DuckDBService {
  constructor() {
    this.db = null;
    this.conn = null;
    this.worker = null;
    this.currentFileName = null;
    this.currentRegisteredName = null;
    this.currentParquetTables = [];
    this.initialized = false;
    this.lastAttachDebug = [];
  }

  pushAttachDebug(step, detail = {}) {
    const entry = {
      ts: new Date().toISOString(),
      step,
      detail,
    };
    this.lastAttachDebug.push(entry);
    if (this.lastAttachDebug.length > 80) {
      this.lastAttachDebug.shift();
    }
    console.info('[DuckDBService][attach]', entry);
  }

  buildAttachError(message, cause) {
    const debugTail = this.lastAttachDebug.slice(-20);
    const causeText = cause?.message || String(cause || '');
    return new Error(
      `${message}${causeText ? `: ${causeText}` : ''}\nattach_debug=${JSON.stringify(debugTail)}`,
    );
  }

  async init() {
    if (this.initialized) return;

    const bundles = {
      mvp: {
        mainModule: duckdbWasm,
        mainWorker: duckdbWorker,
      },
      eh: {
        mainModule: duckdbWasmEh,
        mainWorker: duckdbWorkerEh,
      },
    };

    const bundle = await duckdb.selectBundle(bundles);
    this.worker = new Worker(bundle.mainWorker);
    this.db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), this.worker);
    await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    this.conn = await this.db.connect();

    this.initialized = true;
  }

  async attachOmopSqlite(file) {
    await this.init();
    this.lastAttachDebug = [];

    const normalizedName = String(file?.name || 'omop.sqlite').replace(/[^a-zA-Z0-9._-]/g, '_');
    const registeredName = `upload_${Date.now()}_${normalizedName}`;
    const attachPaths = [registeredName, `/${registeredName}`];

    this.pushAttachDebug('start', {
      fileName: file?.name,
      fileType: file?.type,
      fileSize: file?.size,
      lastModified: file?.lastModified,
      registeredName,
      attachPaths,
    });

    const header = await readSqliteHeader(file);
    this.pushAttachDebug('sqlite_header', header);
    if (header.signature !== 'SQLite format 3\0') {
      throw this.buildAttachError('Uploaded file is not a valid SQLite file');
    }
    if (header.readVersion === 2 || header.writeVersion === 2) {
      throw this.buildAttachError(
        'SQLite WAL mode detected in uploaded file. Please regenerate/convert DB to journal_mode=DELETE',
      );
    }

    const registrationStrategies = [
      {
        name: 'buffer',
        run: async () => {
          const fileBuffer = new Uint8Array(await file.arrayBuffer());
          this.pushAttachDebug('buffer_loaded', { bytes: fileBuffer.byteLength });
          await this.db.registerFileBuffer(registeredName, fileBuffer);
        },
      },
      {
        name: 'handle_direct_io_true',
        run: async () => {
          await this.db.registerFileHandle(
            registeredName,
            file,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            true,
          );
        },
      },
      {
        name: 'handle_direct_io_false',
        run: async () => {
          await this.db.registerFileHandle(
            registeredName,
            file,
            duckdb.DuckDBDataProtocol.BROWSER_FILEREADER,
            false,
          );
        },
      },
    ];

    const failures = [];

    for (const strategy of registrationStrategies) {
      this.pushAttachDebug('strategy_begin', { strategy: strategy.name });
      try {
        try {
          await this.db.dropFile(registeredName);
        } catch {
          // Ignore missing file.
        }

        await strategy.run();
        this.pushAttachDebug('strategy_registered', { strategy: strategy.name });

        try {
          const files = await this.db.globFiles('*');
          this.pushAttachDebug('glob_files', {
            strategy: strategy.name,
            fileCount: files.length,
            hasRegistered: files.some((f) => f.fileName === registeredName),
          });
        } catch (globError) {
          this.pushAttachDebug('glob_files_failed', {
            strategy: strategy.name,
            error: String(globError?.message || globError),
          });
        }

        try {
          await this.conn.query('INSTALL sqlite;');
          await this.conn.query('LOAD sqlite;');

          try {
            await this.conn.query('DETACH omop;');
            this.pushAttachDebug('detach_omop', { strategy: strategy.name, detached: true });
          } catch (detachError) {
            this.pushAttachDebug('detach_omop', {
              strategy: strategy.name,
              detached: false,
              error: String(detachError?.message || detachError),
            });
          }

          let attached = false;
          for (const attachPath of attachPaths) {
            try {
              this.pushAttachDebug('attach_try', { strategy: strategy.name, attachPath });
              await this.conn.query(
                `ATTACH '${escapeSqlLiteral(attachPath)}' AS omop (TYPE SQLITE, READ_ONLY);`,
              );
              attached = true;
              this.pushAttachDebug('attach_ok', { strategy: strategy.name, attachPath });
              break;
            } catch (attachError) {
              this.pushAttachDebug('attach_failed', {
                strategy: strategy.name,
                attachPath,
                error: String(attachError?.message || attachError),
              });
            }
          }

          if (!attached) {
            throw new Error('attach failed for all candidate file paths');
          }

          // Validate by touching sqlite metadata. Some strategies can attach
          // but fail on first real read.
          try {
            const probe = await this.conn.query('SELECT name FROM omop.sqlite_master LIMIT 1;');
            this.pushAttachDebug('probe_ok', {
              strategy: strategy.name,
              rows: probe.toArray().map((r) => r.toJSON()),
            });
          } catch (probeError) {
            this.pushAttachDebug('probe_failed', {
              strategy: strategy.name,
              error: String(probeError?.message || probeError),
            });
            try {
              await this.conn.query('DETACH omop;');
            } catch {
              // ignore
            }
            throw new Error(`attach probe failed: ${String(probeError?.message || probeError)}`);
          }

          try {
            const dbs = await this.conn.query('SHOW DATABASES;');
            this.pushAttachDebug('show_databases', {
              strategy: strategy.name,
              rows: dbs.toArray().map((r) => r.toJSON()),
            });
          } catch (dbsError) {
            this.pushAttachDebug('show_databases_failed', {
              strategy: strategy.name,
              error: String(dbsError?.message || dbsError),
            });
          }

          this.currentFileName = file.name;
          this.currentRegisteredName = registeredName;
          this.pushAttachDebug('attach_success', {
            strategy: strategy.name,
            currentRegisteredName: this.currentRegisteredName,
          });
          return;
        } catch (error) {
          throw error;
        }
      } catch (error) {
        failures.push({
          strategy: strategy.name,
          error: String(error?.message || error),
        });
        this.pushAttachDebug('strategy_failed', {
          strategy: strategy.name,
          error: String(error?.message || error),
        });
      }
    }

    throw this.buildAttachError('Failed to attach SQLite DB after all strategies', failures);
  }

  async resetOmopNamespace() {
    await this.init();
    try {
      await this.conn.query('DETACH omop;');
    } catch {
      // Ignore when omop is not an attached database.
    }
    await this.conn.query('DROP SCHEMA IF EXISTS omop CASCADE;');
    await this.conn.query('CREATE SCHEMA omop;');
  }

  async attachParquetFiles(files) {
    await this.init();
    const selectedFiles = Array.from(files || []).filter(Boolean);
    if (selectedFiles.length === 0) {
      throw new Error('No parquet files selected');
    }

    await this.resetOmopNamespace();
    this.currentParquetTables = [];

    const usedTableNames = new Set();
    const mappings = [];
    const basePrefix = `parquet_upload_${Date.now()}`;

    for (let i = 0; i < selectedFiles.length; i += 1) {
      const file = selectedFiles[i];
      const registeredName = `${basePrefix}_${i}_${String(file.name || 'data.parquet').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const buffer = new Uint8Array(await file.arrayBuffer());
      await this.db.registerFileBuffer(registeredName, buffer);

      let tableName = sanitizeIdentifier(file.name);
      if (usedTableNames.has(tableName)) {
        let n = 2;
        while (usedTableNames.has(`${tableName}_${n}`)) n += 1;
        tableName = `${tableName}_${n}`;
      }
      usedTableNames.add(tableName);

      await this.conn.query(
        `CREATE OR REPLACE VIEW omop.${tableName} AS SELECT * FROM read_parquet('${escapeSqlLiteral(registeredName)}');`,
      );
      mappings.push({
        fileName: file.name,
        registeredName,
        tableName,
      });
    }

    // Touch all created tables once so failure surfaces during load, not later.
    for (const mapping of mappings) {
      await this.conn.query(`SELECT * FROM omop.${mapping.tableName} LIMIT 1;`);
    }

    this.currentFileName = selectedFiles.map((f) => f.name).join(', ');
    this.currentRegisteredName = '';
    this.currentParquetTables = mappings.map((m) => m.tableName);
    return mappings;
  }

  async runSql(sql, maxRows = 200) {
    await this.init();
    const result = await this.conn.query(sql);
    const rows = result.toArray().map((row) => row.toJSON());
    const columns = result.schema.fields.map((field) => field.name);

    return {
      columns,
      rows: rows.slice(0, maxRows),
      rowCount: rows.length,
      truncated: rows.length > maxRows,
    };
  }

  async listOmopTables(maxRows = 500) {
    await this.init();
    const limit = Number(maxRows) || 500;
    const result = await this.conn.query(`SHOW TABLES FROM omop;`);
    const rows = result.toArray().map((row) => row.toJSON());
    const values = rows
      .map((row) => row.name ?? row.table_name ?? Object.values(row)[0])
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .slice(0, limit)
      .map((name) => ({ table_name: name }));

    return {
      columns: ['table_name'],
      rows: values,
      rowCount: values.length,
      truncated: rows.length > limit,
    };
  }
}

export const duckdbService = new DuckDBService();
