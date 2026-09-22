import { EventEmitter } from 'node:events'
import type { BrowserWindow } from 'electron'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DesktopAttention } from '../src/attention.ts'

const native = await vi.hoisted(async () => {
  return {
    dock: {
      bounce: vi.fn((type: string) => (type === 'critical' ? 42 : 17)),
      cancelBounce: vi.fn(),
      setBadge: vi.fn(),
    },
  }
})

vi.mock('electron', () => ({
  app: { dock: native.dock },
}))

afterEach(() => {
  vi.clearAllMocks()
})

function mockWindow(focused = false, destroyed = false) {
  return Object.assign(new EventEmitter(), {
    focused,
    isFocused() { return this.focused },
    isDestroyed() { return destroyed },
    flashFrame: vi.fn(),
  }) as unknown as BrowserWindow & { focused: boolean; flashFrame: ReturnType<typeof vi.fn> }
}

describe('DesktopAttention on macOS (darwin)', () => {
  it('triggers critical bounce and badge on approval when window is in background', () => {
    const attention = new DesktopAttention('darwin')
    const win = mockWindow(false)

    attention.notify('approval', win)

    expect(native.dock.setBadge).toHaveBeenCalledWith('•')
    expect(native.dock.bounce).toHaveBeenCalledWith('critical')
  })

  it('triggers informational bounce and badge on finish when window is in background', () => {
    const attention = new DesktopAttention('darwin')
    const win = mockWindow(false)

    attention.notify('finish', win)

    expect(native.dock.setBadge).toHaveBeenCalledWith('•')
    expect(native.dock.bounce).toHaveBeenCalledWith('informational')
  })

  it('stays completely silent when the window is already focused', () => {
    const attention = new DesktopAttention('darwin')
    const win = mockWindow(true)

    attention.notify('approval', win)
    attention.notify('finish', win)

    expect(native.dock.setBadge).not.toHaveBeenCalled()
    expect(native.dock.bounce).not.toHaveBeenCalled()
  })

  it('cancels active bounce and clears badge when clear() is called', () => {
    const attention = new DesktopAttention('darwin')
    const win = mockWindow(false)

    attention.notify('approval', win)
    expect(native.dock.bounce).toHaveBeenCalledWith('critical')

    attention.clear(win)

    expect(native.dock.cancelBounce).toHaveBeenCalledWith(42)
    expect(native.dock.setBadge).toHaveBeenCalledWith('')
  })

  it('replaces active bounce when another notification arrives before clear', () => {
    const attention = new DesktopAttention('darwin')
    const win = mockWindow(false)

    attention.notify('finish', win)
    expect(native.dock.bounce).toHaveBeenCalledWith('informational')

    attention.notify('approval', win)
    expect(native.dock.cancelBounce).toHaveBeenCalledWith(17)
    expect(native.dock.bounce).toHaveBeenCalledWith('critical')
  })
})

describe('DesktopAttention on Windows (win32)', () => {
  it('flashes frame on notify and clears on clear', () => {
    const attention = new DesktopAttention('win32')
    const win = mockWindow(false)

    attention.notify('approval', win)
    expect(win.flashFrame).toHaveBeenCalledWith(true)

    attention.clear(win)
    expect(win.flashFrame).toHaveBeenCalledWith(false)
  })
})
