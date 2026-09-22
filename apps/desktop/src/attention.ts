/** Desktop application attention controller for Dock badge and bounce effects. */
import { app, type BrowserWindow } from 'electron'
import type { DesktopAttentionKind } from './ipc.ts'

/** Manages native window attention and macOS Dock reminders for background events. */
export class DesktopAttention {
  private activeBounceId: number | undefined

  constructor(private readonly platform: string = process.platform) {}

  /**
   * Request native attention for an event occurring while the window may be in the background.
   * @param kind - Whether the event is an urgent approval or an informational finish.
   * @param window - Primary application window to inspect for focus and frame flashing.
   */
  notify(kind: DesktopAttentionKind, window: BrowserWindow): void {
    if (window.isDestroyed() || window.isFocused()) return
    try {
      if (this.platform === 'darwin') {
        app.dock?.setBadge('•')
        if (this.activeBounceId !== undefined) {
          app.dock?.cancelBounce(this.activeBounceId)
          this.activeBounceId = undefined
        }
        const bounceType = kind === 'approval' ? 'critical' : 'informational'
        this.activeBounceId = app.dock?.bounce(bounceType)
      } else if (this.platform === 'win32') {
        window.flashFrame?.(true)
      }
    } catch (error) {
      console.warn('desktop attention: native notification unavailable', error)
    }
  }

  /**
   * Clear active native attention, badges, and bounce states.
   * @param window - Optional window to clear taskbar frame flashing.
   */
  clear(window?: BrowserWindow): void {
    try {
      if (this.platform === 'darwin') {
        if (this.activeBounceId !== undefined) {
          app.dock?.cancelBounce(this.activeBounceId)
          this.activeBounceId = undefined
        }
        app.dock?.setBadge('')
      }
      if (this.platform === 'win32' && window !== undefined && !window.isDestroyed()) {
        window.flashFrame?.(false)
      }
    } catch (error) {
      console.warn('desktop attention: could not clear attention', error)
    }
  }
}
