import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { MIGRATIONS } from './migrations'

export type SqliteDatabase = Database.Database

export function openDatabase(filePath: string): SqliteDatabase {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const db = new Database(filePath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  migrate(db)
  return db
}

export function migrate(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => Number((row as { version: number }).version)),
  )

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) {
      continue
    }
    const run = db.transaction(() => {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
        migration.version,
        new Date().toISOString(),
      )
    })
    run()
  }
}

export function appliedMigrationVersions(db: SqliteDatabase): number[] {
  return db
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all()
    .map((row) => Number((row as { version: number }).version))
}
