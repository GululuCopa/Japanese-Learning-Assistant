import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AttachmentImage } from '../../src/renderer/components/AttachmentImage'
import { ApiProvider } from '../../src/renderer/state/api'
import { MINI_PNG_BASE64 } from '../fixtures/prd-cases'
import { createFakeApi } from '../helpers/fake-api'

describe('AttachmentImage', () => {
  it('renders optimistic staged bytes immediately', () => {
    const { api } = createFakeApi()
    render(
      <ApiProvider api={api}>
        <AttachmentImage
          attachmentId="pending"
          mimeType="image/png"
          dataBase64={MINI_PNG_BASE64}
          alt="staged"
        />
      </ApiProvider>,
    )
    expect(screen.getByAltText('staged')).toBeInTheDocument()
    expect(api.attachments.read).not.toHaveBeenCalled()
  })

  it('loads persisted attachments by id without exposing a path', async () => {
    const { api } = createFakeApi()
    render(
      <ApiProvider api={api}>
        <AttachmentImage attachmentId="att-0" mimeType="image/png" alt="stored" />
      </ApiProvider>,
    )
    expect(screen.getByText('加载图片…')).toBeInTheDocument()
    expect(await screen.findByAltText('stored')).toBeInTheDocument()
    expect(api.attachments.read).toHaveBeenCalledWith('att-0')
    await waitFor(() => expect(api.attachments.read).toHaveBeenCalledTimes(1))
  })
})
