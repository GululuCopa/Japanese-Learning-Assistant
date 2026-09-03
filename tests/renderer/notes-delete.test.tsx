import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotesPage } from '../../src/renderer/pages/NotesPage'
import { ApiProvider } from '../../src/renderer/state/api'
import { createFakeApi } from '../helpers/fake-api'

describe('notes delete messaging', () => {
  it('warns that the current Vault markdown will be removed and shows the result', async () => {
    const user = userEvent.setup()
    const { api, notes } = createFakeApi()
    notes.push({
      id: 'n1',
      kind: 'word',
      duplicateKey: '構う',
      title: '構う',
      payload: { reading: 'かまう' },
      translation: '理会',
      createdAt: '2026-09-01T00:00:03.000Z',
      updatedAt: '2026-09-01T00:00:03.000Z',
    })
    render(
      <ApiProvider api={api}>
        <NotesPage />
      </ApiProvider>,
    )
    expect(await screen.findByRole('heading', { name: '構う' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '删除' }))
    expect(screen.getByText(/当前配置的 Obsidian Vault/)).toBeInTheDocument()
    const confirmButtons = screen.getAllByRole('button', { name: '删除' })
    await user.click(confirmButtons[confirmButtons.length - 1]!)
    await waitFor(() => expect(api.notes.delete).toHaveBeenCalledWith('n1'))
    expect(await screen.findByText('已删除笔记。')).toBeInTheDocument()
    expect(notes).toHaveLength(0)
  })

  it('keeps the note and shows an error when Obsidian deletion fails', async () => {
    const user = userEvent.setup()
    const { api, notes } = createFakeApi()
    notes.push({
      id: 'n1',
      kind: 'word',
      duplicateKey: '構う',
      title: '構う',
      payload: { reading: 'かまう' },
      translation: '理会',
      createdAt: '2026-09-01T00:00:03.000Z',
      updatedAt: '2026-09-01T00:00:03.000Z',
    })
    api.notes.delete = vi.fn(async () => {
      throw new Error('没有删除 Obsidian 文件的权限。请检查当前 Vault 文件夹权限后重试。')
    })
    render(
      <ApiProvider api={api}>
        <NotesPage />
      </ApiProvider>,
    )
    expect(await screen.findByRole('heading', { name: '構う' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '删除' }))
    const confirmButtons = screen.getAllByRole('button', { name: '删除' })
    await user.click(confirmButtons[confirmButtons.length - 1]!)
    expect(
      await screen.findByText('没有删除 Obsidian 文件的权限。请检查当前 Vault 文件夹权限后重试。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '構う' })).toBeInTheDocument()
    expect(notes).toHaveLength(1)
  })
})
