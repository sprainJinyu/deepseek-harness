// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import { DesktopAttention } from '../src/client/DesktopAttention.tsx'

let hiddenValue = false
const originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden')

beforeEach(() => {
  hiddenValue = false
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hiddenValue,
  })
})

afterEach(() => {
  cleanup()
  if (originalHidden !== undefined) {
    Object.defineProperty(Document.prototype, 'hidden', originalHidden)
  }
  delete (globalThis as Record<string, unknown>).dshDesktop
})

function createAttentionSources() {
  const sessionId = 'session-1' as SessionId
  const statusStore = createSnapshotStore<SessionStatusSnapshot>(
    new Map<SessionId, SessionStatus>([
      [sessionId, { running: true, pendingInteraction: undefined, completionUnread: false }],
    ]),
  )
  return {
    sessionId,
    statusStore,
    props: {
      useSessionStatus: bindSnapshotSelector(statusStore),
    },
  }
}

describe('DesktopAttention', () => {
  it('does not notify on initial mount even if in background', () => {
    hiddenValue = true
    const notify = vi.fn()
    const clear = vi.fn()
    ;(globalThis as Record<string, unknown>).dshDesktop = { attention: { notify, clear } }

    const { props } = createAttentionSources()
    render(<DesktopAttention {...props} />)

    expect(notify).not.toHaveBeenCalled()
  })

  it('notifies "finish" when a running session stops while in background', () => {
    hiddenValue = true
    const notify = vi.fn()
    const clear = vi.fn()
    ;(globalThis as Record<string, unknown>).dshDesktop = { attention: { notify, clear } }

    const { sessionId, statusStore, props } = createAttentionSources()
    render(<DesktopAttention {...props} />)

    act(() => {
      statusStore.set(
        new Map<SessionId, SessionStatus>([
          [sessionId, { running: false, pendingInteraction: undefined, completionUnread: true }],
        ]),
      )
    })

    expect(notify).toHaveBeenCalledWith('finish')
  })

  it('notifies "approval" when an approval interaction arrives while in background', () => {
    hiddenValue = true
    const notify = vi.fn()
    const clear = vi.fn()
    ;(globalThis as Record<string, unknown>).dshDesktop = { attention: { notify, clear } }

    const { sessionId, statusStore, props } = createAttentionSources()
    render(<DesktopAttention {...props} />)

    act(() => {
      statusStore.set(
        new Map<SessionId, SessionStatus>([
          [
            sessionId,
            {
              running: false,
              pendingInteraction: { key: 'app-1', kind: 'approval', sessionId } as unknown as SessionStatus['pendingInteraction'],
              completionUnread: false,
            } as SessionStatus,
          ],
        ]),
      )
    })

    expect(notify).toHaveBeenCalledWith('approval')
  })

  it('stays completely silent when document is not hidden (user looking at window)', () => {
    hiddenValue = false
    const notify = vi.fn()
    const clear = vi.fn()
    ;(globalThis as Record<string, unknown>).dshDesktop = { attention: { notify, clear } }

    const { sessionId, statusStore, props } = createAttentionSources()
    render(<DesktopAttention {...props} />)

    act(() => {
      statusStore.set(
        new Map<SessionId, SessionStatus>([
          [sessionId, { running: false, pendingInteraction: undefined, completionUnread: false }],
        ]),
      )
    })

    expect(notify).not.toHaveBeenCalled()
  })

  it('calls clear() when visibilitychange occurs and document becomes visible', () => {
    hiddenValue = true
    const notify = vi.fn()
    const clear = vi.fn()
    ;(globalThis as Record<string, unknown>).dshDesktop = { attention: { notify, clear } }

    const { props } = createAttentionSources()
    render(<DesktopAttention {...props} />)

    hiddenValue = false
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(clear).toHaveBeenCalled()
  })
})
