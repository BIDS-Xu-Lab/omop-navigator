import * as duckdb from '@duckdb/duckdb-wasm';
import duckdbWasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import duckdbWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdbWasmEh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import duckdbWorkerEh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

export class DuckDBService {
  constructor() {
    this.db = null;
    this.worker = null;
    this.currentFileName = null;
    this.initialized = false;
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

    this.initialized = true;
  }

  async attachOmopSqlite(file) {
    await this.init();

    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    await this.db.registerFileBuffer(file.name, fileBuffer);

    const conn = await this.db.connect();
    try {
      await conn.query('INSTALL sqlite;');
      await conn.query('LOAD sqlite;');

      try {
        await conn.query('DETACH omop;');
      } catch {
        // No previous attachment.
      }

      await conn.query(
        `ATTACH '${escapeSqlLiteral(file.name)}' AS omop (TYPE SQLITE, READ_ONLY);`,
      );

      this.currentFileName = file.name;
    } finally {
      await conn.close();
    }
  }

  async runSql(sql, maxRows = 200) {
    await this.init();

    const conn = await this.db.connect();
    try {
      const result = await conn.query(sql);
      const rows = result.toArray().map((row) => row.toJSON());
      const columns = result.schema.fields.map((field) => field.name);

      return {
        columns,
        rows: rows.slice(0, maxRows),
        rowCount: rows.length,
        truncated: rows.length > maxRows,
      };
    } finally {
      await conn.close();
    }
  }

  async listOmopTables(maxRows = 500) {
    return this.runSql(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_catalog = 'omop'
       ORDER BY table_name
       LIMIT ${Number(maxRows) || 500};`,
      maxRows,
    );
  }
}

export const duckdbService = new DuckDBService();
