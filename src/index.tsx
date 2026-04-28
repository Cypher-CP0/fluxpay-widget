import React from 'react'
import { createRoot } from 'react-dom/client'
import { CheckoutRoot } from './CheckoutModal'
import { FluxPayConfig } from './types'

// Inject styles into document head
function injectStyles(css: string) {
  if (document.getElementById('fluxpay-styles')) return
  const style = document.createElement('style')
  style.id = 'fluxpay-styles'
  style.textContent = css
  document.head.appendChild(style)
}

const STYLES = `
  .fp-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .fp-modal {
    background: #0f0f11; border: 1px solid #2a2a35; border-radius: 16px;
    padding: 32px; width: 100%; max-width: 420px; color: #fff;
    box-shadow: 0 25px 60px rgba(0,0,0,0.5);
  }
  .fp-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 24px;
  }
  .fp-title { font-size: 18px; font-weight: 600; }
  .fp-close {
    background: none; border: none; color: #888; font-size: 22px;
    cursor: pointer; padding: 0; line-height: 1;
  }
  .fp-amount { text-align: center; margin-bottom: 24px; }
  .fp-amount-value { font-size: 36px; font-weight: 700; color: #a78bfa; }
  .fp-amount-label { color: #888; font-size: 14px; margin-top: 4px; }
  .fp-tabs { display: flex; gap: 8px; margin-bottom: 24px; }
  .fp-tab {
    flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #2a2a35;
    background: none; color: #888; cursor: pointer; font-size: 14px; transition: all 0.2s;
  }
  .fp-tab.active { background: #1e1b4b; border-color: #a78bfa; color: #a78bfa; }
  .fp-qr-container { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .fp-qr { background: #fff; padding: 12px; border-radius: 12px; }
  .fp-address-box {
    background: #1a1a24; border: 1px solid #2a2a35; border-radius: 8px;
    padding: 12px; width: 100%; box-sizing: border-box;
  }
  .fp-address-label { font-size: 11px; color: #888; margin-bottom: 6px; }
  .fp-address-row { display: flex; align-items: center; gap: 8px; }
  .fp-address-text {
    font-family: monospace; font-size: 12px; color: #ccc;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
  }
  .fp-copy-btn {
    background: #2a2a35; border: none; color: #a78bfa; padding: 6px 12px;
    border-radius: 6px; cursor: pointer; font-size: 12px; white-space: nowrap;
  }
  .fp-wallet-btn {
    width: 100%; padding: 14px; background: #a78bfa; color: #fff;
    border: none; border-radius: 10px; font-size: 16px; font-weight: 600;
    cursor: pointer; margin-bottom: 12px; transition: background 0.2s;
  }
  .fp-wallet-btn:hover { background: #9061f9; }
  .fp-wallet-btn:disabled { background: #4a4a6a; cursor: not-allowed; }
  .fp-timer { text-align: center; color: #888; font-size: 13px; margin-top: 16px; }
  .fp-timer span { color: #f59e0b; font-weight: 600; }
  .fp-status { text-align: center; padding: 24px 0; }
  .fp-status-icon { font-size: 48px; margin-bottom: 12px; }
  .fp-status-text { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
  .fp-status-sub { color: #888; font-size: 14px; }
  .fp-spinner {
    width: 40px; height: 40px; border: 3px solid #2a2a35;
    border-top-color: #a78bfa; border-radius: 50%;
    animation: fp-spin 0.8s linear infinite; margin: 0 auto 16px;
  }
  @keyframes fp-spin { to { transform: rotate(360deg); } }
`

let globalConfig: FluxPayConfig | null = null
let rootContainer: HTMLDivElement | null = null
let reactRoot: ReturnType<typeof createRoot> | null = null

function unmount() {
  if (reactRoot) {
    reactRoot.unmount()
    reactRoot = null
  }
  if (rootContainer) {
    document.body.removeChild(rootContainer)
    rootContainer = null
  }
}

const FluxPay = {
  // Call once with your config
  init(config: FluxPayConfig) {
    globalConfig = config
    injectStyles(STYLES)
  },

  // Call with a payment_id to open the checkout modal
  open(paymentId: string, config?: FluxPayConfig) {
    const cfg = config ?? globalConfig
    if (!cfg) {
      throw new Error('FluxPay: call FluxPay.init(config) before FluxPay.open()')
    }

    injectStyles(STYLES)
    unmount()

    rootContainer = document.createElement('div')
    rootContainer.id = 'fluxpay-root'
    document.body.appendChild(rootContainer)

    reactRoot = createRoot(rootContainer)
    reactRoot.render(
      React.createElement(CheckoutRoot, {
        paymentId,
        config: cfg,
        onClose: unmount,
      })
    )
  },

  close() {
    unmount()
  },
}

export default FluxPay

// Also expose on window for script tag usage
if (typeof window !== 'undefined') {
  ; (window as any).FluxPay = FluxPay
}
