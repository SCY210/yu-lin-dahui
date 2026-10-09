import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

/** Local D1 adapter: one SQLite transaction per batch, foreign keys enabled.
 * It models rollback and uniqueness, not the remote Worker's network/limits. */
export function sqliteD1() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8'));
  for (const { tag } of journal.entries) sql.exec(readFileSync(`drizzle/${tag}.sql`, 'utf8'));
  let failure = null;
  function execute(query, args, mode) {
    if (failure?.(query)) throw new Error('Injected database failure');
    const statement = sql.prepare(query);
    if (mode === 'first') return statement.get(...args) ?? null;
    if (mode === 'all') return { results: statement.all(...args), success: true, meta: {} };
    const result = statement.run(...args);
    return { results: [], success: true, meta: { changes: Number(result.changes) } };
  }
  function prepare(query, args = []) {
    return {
      query, args,
      bind(...values) { return prepare(query, values); },
      async first() { return execute(query, args, 'first'); },
      async all() { return execute(query, args, 'all'); },
      async run() { return execute(query, args, 'run'); },
    };
  }
  const db = {
    prepare,
    async batch(queries) {
      sql.exec('BEGIN');
      try {
        const results = queries.map(({ query, args }) => execute(query, args, /^\s*SELECT\b/i.test(query) ? 'all' : 'run'));
        sql.exec('COMMIT');
        return results;
      } catch (error) {
        sql.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return { sql, db, injectFailure(predicate) { failure = predicate; }, close() { sql.close(); } };
}
