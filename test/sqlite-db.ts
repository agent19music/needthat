import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from '#/db/schema'

const MIGRATIONS = join(import.meta.dirname, '..', 'drizzle')

export function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

export function applyMigration(db: DatabaseSync, file: string) {
  const text = readFileSync(join(MIGRATIONS, file), 'utf8')
  for (const statement of text.split('--> statement-breakpoint')) {
    if (statement.trim()) db.exec(statement)
  }
}

/** In-memory SQLite with the real migrations, exposed through drizzle like D1. */
export function createTestDb(upTo?: string) {
  const sqlite = new DatabaseSync(':memory:')
  for (const file of migrationFiles()) {
    applyMigration(sqlite, file)
    if (upTo && file.startsWith(upTo)) break
  }
  const db = drizzle(
    async (query, params, method) => {
      const statement = sqlite.prepare(query)
      const values = params as Array<string | number | null>
      if (method === 'run') {
        statement.run(...values)
        return { rows: [] }
      }
      statement.setReturnArrays(true)
      if (method === 'get') {
        const row = statement.get(...values)
        return { rows: (row ?? undefined) as unknown as Array<unknown> }
      }
      return {
        rows: statement.all(...values) as unknown as Array<Array<unknown>>,
      }
    },
    { schema },
  )
  return { sqlite, db }
}
