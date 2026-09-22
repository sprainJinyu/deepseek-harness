/** Bridge session completion and approval notifications to native desktop attention. */
import { useEffect, useRef } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

export interface DesktopAttentionProps {
  useSessionStatus: PropsRuntime<'root'>['useSessionStatus']
}

interface DesktopAttentionCarrier {
  readonly attention?: {
    notify(kind: 'approval' | 'finish'): Promise<void>
    clear(): Promise<void>
  }
}

/**
 * Projects session activity and pending approvals into native desktop attention
 * (such as macOS Dock badge and bounce) when the window is in the background.
 */
export function DesktopAttention({ useSessionStatus }: DesktopAttentionProps): null {
  const statuses = useSessionStatus(s => s)
  const prevRef = useRef<Map<string, { running?: boolean | undefined; pendingKind?: string | undefined }>>(new Map())
  const initialMount = useRef(true)

  useEffect(() => {
    const carrier = (globalThis as unknown as { dshDesktop?: DesktopAttentionCarrier }).dshDesktop
    if (carrier?.attention === undefined) return

    // Avoid firing notifications on initial hydration
    if (initialMount.current) {
      initialMount.current = false
      const initialMap = new Map<string, { running?: boolean | undefined; pendingKind?: string | undefined }>()
      for (const [id, status] of statuses) {
        initialMap.set(id, { running: status.running, pendingKind: status.pendingInteraction?.kind })
      }
      prevRef.current = initialMap
      return
    }

    let hasNewApproval = false
    let hasFinished = false

    for (const [id, status] of statuses) {
      const prev = prevRef.current.get(id)
      const currentPendingKind = status.pendingInteraction?.kind
      if (currentPendingKind === 'approval' || currentPendingKind === 'question' || currentPendingKind === 'plan-review') {
        if (prev?.pendingKind !== currentPendingKind) {
          hasNewApproval = true
        }
      }
      if (prev?.running === true && status.running === false) {
        hasFinished = true
      }
    }

    const nextMap = new Map<string, { running?: boolean | undefined; pendingKind?: string | undefined }>()
    for (const [id, status] of statuses) {
      nextMap.set(id, { running: status.running, pendingKind: status.pendingInteraction?.kind })
    }
    prevRef.current = nextMap

    // Only notify if document is in background (hidden)
    if (document.hidden) {
      if (hasNewApproval) {
        void carrier.attention.notify('approval')
      } else if (hasFinished) {
        void carrier.attention.notify('finish')
      }
    }
  }, [statuses])

  useEffect(() => {
    const carrier = (globalThis as unknown as { dshDesktop?: DesktopAttentionCarrier }).dshDesktop
    if (carrier?.attention === undefined) return

    const handleClear = () => {
      if (!document.hidden) {
        void carrier.attention?.clear()
      }
    }

    document.addEventListener('visibilitychange', handleClear)
    window.addEventListener('focus', handleClear)
    return () => {
      document.removeEventListener('visibilitychange', handleClear)
      window.removeEventListener('focus', handleClear)
    }
  }, [])

  return null
}
