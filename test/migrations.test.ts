// @vitest-environment node
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { applyMigration, migrationFiles } from './sqlite-db'

describe('0003_stacks_position migration', () => {
  function seeded() {
    const db = new DatabaseSync(':memory:')
    const files = migrationFiles()
    const target = files.indexOf('0003_stacks_position.sql')
    expect(target).toBeGreaterThan(-1)
    files.slice(0, target).forEach((file) => applyMigration(db, file))
    db.exec(
      `INSERT INTO lists (id, user_id, name, created_at, updated_at) VALUES ('l1','u1','W',1,1),('l2','u2','W',1,1)`,
    )
    const insert = db.prepare(
      `INSERT INTO list_items (id, list_id, client_id, title, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
    )
    insert.run('a', 'l1', 'a', 'Oldest', 'unresolved', 100, 100)
    insert.run('b', 'l1', 'b', 'Newest', 'unresolved', 300, 300)
    insert.run('c', 'l1', 'c', 'Middle', 'purchased', 200, 250)
    insert.run('d', 'l1', 'd', 'Tie A', 'unresolved', 200, 200)
    insert.run('x', 'l2', 'x', 'Other list', 'unresolved', 50, 50)
    applyMigration(db, files[target])
    return db
  }

  it('adds position and purchased_at columns and the index', () => {
    const db = seeded()
    const columns = db
      .prepare(`PRAGMA table_info(list_items)`)
      .all()
      .map((row) => row.name)
    expect(columns).toContain('position')
    expect(columns).toContain('purchased_at')
    const indexes = db
      .prepare(`PRAGMA index_list(list_items)`)
      .all()
      .map((row) => row.name)
    expect(indexes).toContain('list_items_list_position_idx')
  })

  it('backfills positions per list, newest first, 0-based, ties by id', () => {
    const db = seeded()
    const rows = db
      .prepare(
        `SELECT id, position FROM list_items WHERE list_id='l1' ORDER BY position`,
      )
      .all()
    expect(rows.map((row) => row.id)).toEqual(['b', 'c', 'd', 'a'])
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2, 3])
    expect(
      db.prepare(`SELECT position FROM list_items WHERE id='x'`).get()
        ?.position,
    ).toBe(0)
  })

  it('backfills purchased_at from updated_at for got items only', () => {
    const db = seeded()
    const rows = db
      .prepare(`SELECT id, purchased_at FROM list_items ORDER BY id`)
      .all()
    expect(
      Object.fromEntries(rows.map((row) => [row.id, row.purchased_at])),
    ).toEqual({
      a: null,
      b: null,
      c: 250,
      d: null,
      x: null,
    })
  })

  it('is listed in the drizzle journal', async () => {
    const journal = (await import('../drizzle/meta/_journal.json')).default
    expect(
      journal.entries.map((entry: { tag: string }) => entry.tag),
    ).toContain('0003_stacks_position')
  })
})

describe('0004_sticker_sheet migration', () => {
  function seeded() {
    const db = new DatabaseSync(':memory:')
    const files = migrationFiles()
    const target = files.indexOf('0004_sticker_sheet.sql')
    expect(target).toBeGreaterThan(-1)
    files.slice(0, target).forEach((file) => applyMigration(db, file))
    db.exec(
      `INSERT INTO lists (id, user_id, name, created_at, updated_at) VALUES ('l1','u1','W',1,1),('l2','u2','W',1,1)`,
    )
    const insert = db.prepare(
      `INSERT INTO categories (id, list_id, name, created_at) VALUES (?,?,?,?)`,
    )
    insert.run('c3', 'l1', 'desk', 300)
    insert.run('c1', 'l1', 'fits', 100)
    insert.run('c2', 'l1', 'football', 200)
    insert.run('c4', 'l1', 'gifts', 400)
    insert.run('b', 'l1', 'tie-b', 500)
    insert.run('a', 'l1', 'tie-a', 500)
    insert.run('x', 'l2', 'other', 50)
    applyMigration(db, files[target])
    return db
  }

  it('backfills tag colours blue → green → red by creation order per list', () => {
    const db = seeded()
    const rows = db
      .prepare(`SELECT id, color FROM categories ORDER BY id`)
      .all()
    expect(Object.fromEntries(rows.map((row) => [row.id, row.color]))).toEqual(
      {
        c1: 'blue',
        c2: 'green',
        c3: 'red',
        c4: 'blue',
        a: 'green',
        b: 'red',
        x: 'blue',
      },
    )
  })

  it('adds share toggles that default on, and the claims table', () => {
    const db = seeded()
    const list = db
      .prepare(`SELECT share_prices, share_claims FROM lists WHERE id='l1'`)
      .get()
    expect(list).toEqual({ share_prices: 1, share_claims: 1 })
    const columns = db
      .prepare(`PRAGMA table_info(claims)`)
      .all()
      .map((row) => row.name)
    expect(columns).toEqual(['id', 'item_id', 'claimer_id', 'created_at'])
    const indexes = db
      .prepare(`PRAGMA index_list(claims)`)
      .all()
      .map((row) => [row.name, row.unique])
    expect(indexes).toContainEqual(['claims_item_id_idx', 1])
  })

  it('is listed in the drizzle journal', async () => {
    const journal = (await import('../drizzle/meta/_journal.json')).default
    expect(
      journal.entries.map((entry: { tag: string }) => entry.tag),
    ).toContain('0004_sticker_sheet')
  })
})
