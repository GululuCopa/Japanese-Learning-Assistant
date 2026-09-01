import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { appliedMigrationVersions, openDatabase } from '../src/main/database/client'
import { AppRepositories } from '../src/main/database/repositories'
import { tempDir } from './helpers/app'

describe('database migrations and repositories', () => {
  it('migrates a fresh database and reopens cleanly', () => {
    const dir = tempDir('jla-db-')
    const file = path.join(dir, 'app.sqlite')
    const first = openDatabase(file)
    expect(appliedMigrationVersions(first)).toContain(1)
    first.close()
    const second = openDatabase(file)
    expect(appliedMigrationVersions(second)).toEqual([1])
    const repos = new AppRepositories(second)
    repos.createConversation({
      id: 'c1',
      title: '测试',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    })
    expect(repos.getConversation('c1')?.title).toBe('测试')
    second.close()
    expect(fs.existsSync(file)).toBe(true)
  })
})
