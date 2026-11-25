import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA_SQL } from './schema.js';

export type SqliteDb = DatabaseSync;

const transactionDepth = new WeakMap<SqliteDb, number>();

export function createDatabase(dbPath: string): SqliteDb {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath, {
    enableForeignKeyConstraints: true,
    timeout: 5000,
  });

  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);

  return db;
}

export function runInTransaction<T>(db: SqliteDb, fn: () => T): T {
  const depth = transactionDepth.get(db) ?? 0;

  if (depth === 0) {
    db.exec('BEGIN IMMEDIATE');
    transactionDepth.set(db, 1);
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // Ignore rollback errors if the transaction was already aborted by SQLite
      }
      throw err;
    } finally {
      transactionDepth.set(db, 0);
    }
  }

  const savepoint = `sp_${depth}`;
  db.exec(`SAVEPOINT ${savepoint}`);
  transactionDepth.set(db, depth + 1);
  try {
    const result = fn();
    db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    return result;
  } catch (err) {
    try {
      db.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      db.exec(`RELEASE SAVEPOINT ${savepoint}`);
    } catch {
      // Ignore savepoint rollback errors
    }
    throw err;
  } finally {
    transactionDepth.set(db, depth);
  }
}
