/* D1Lite: Cloudflare D1's API (prepare/bind/run/first/all/batch) over Node's
 * built-in SQLite. Used by the harnesses, and the first piece of the platform
 * adapter an AWS/Node deployment of the worker would need. */
import { DatabaseSync } from 'node:sqlite';

function fix(v) { if (v === undefined) return null; if (typeof v === 'boolean') return v ? 1 : 0; if (typeof v === 'object' && v !== null) return JSON.stringify(v); return v; }
export class D1Lite {
  constructor(file) { this.db = new DatabaseSync(file || ':memory:'); this.log = []; this.delay = 0; }  // delay (ms) after every read, before its answer returns: two requests started together both read before either writes
  prepare(sql) { return new D1Stmt(this, sql); }
  // D1 runs a batch as one transaction: every statement applies, or (on an error) none does
  async batch(stmts) { this.db.exec('BEGIN'); try { const out = []; for (const s of stmts) out.push(s._runSync()); this.db.exec('COMMIT'); return out; } catch (e) { try { this.db.exec('ROLLBACK'); } catch (x) {} throw e; } }
  async exec(sql) { this.db.exec(sql); return { count: 1 }; }
}
class D1Stmt {
  constructor(d1, sql) { this.d1 = d1; this.sql = sql; this.args = []; }
  bind(...a) { const s = new D1Stmt(this.d1, this.sql); s.args = a.map(fix); return s; }
  _st() { this.d1.log.push(this.sql.slice(0, 80)); return this.d1.db.prepare(this.sql); }
  async run() { const r = this._runSync(); if (this.d1.delay && /^\s*(SELECT|WITH)/i.test(this.sql)) await new Promise(res => setTimeout(res, this.d1.delay)); return r; }
  _runSync() {
    const st = this._st();
    if (/^\s*(SELECT|WITH)/i.test(this.sql)) { const rows = st.all(...this.args); return { success: true, results: rows.map(plain), meta: { changes: 0 } }; }
    const r = st.run(...this.args);
    return { success: true, results: [], meta: { changes: Number(r.changes) || 0, last_row_id: Number(r.lastInsertRowid) || 0 } };
  }
  async first(col) { const row = this._st().get(...this.args); if (this.d1.delay) await new Promise(r => setTimeout(r, this.d1.delay)); if (!row) return null; const p = plain(row); return col ? p[col] : p; }
  async all() { const rows = this._st().all(...this.args); if (this.d1.delay) await new Promise(r => setTimeout(r, this.d1.delay)); return { success: true, results: rows.map(plain), meta: {} }; }
  async raw() { return this._st().all(...this.args).map(r => Object.values(plain(r))); }
}
function plain(row) { const o = {}; for (const k of Object.keys(row)) { const v = row[k]; o[k] = typeof v === 'bigint' ? Number(v) : v; } return o; }
