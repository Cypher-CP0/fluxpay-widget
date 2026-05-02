import React from 'react'
import { createRoot } from 'react-dom/client'
import { CheckoutRoot } from './CheckoutModal'
import { FluxPayConfig } from './types'

function injectStyles(css: string) {
  if (document.getElementById('fluxpay-styles')) return
  const style = document.createElement('style')
  style.id = 'fluxpay-styles'
  style.textContent = css
  document.head.appendChild(style)
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

  .fp-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    animation: fp-fade-in 0.2s ease;
  }
  .fp-modal {
    background: #0f0f1a;
    border: 1px solid #1e1e35;
    border-radius: 20px;
    padding: 28px;
    width: 100%; max-width: 420px;
    color: #f0f0ff;
    box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,92,252,0.1);
    animation: fp-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .fp-loading-overlay {
    position: fixed; inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    z-index: 99999;
    animation: fp-fade-in 0.15s ease;
  }
  .fp-loading-box {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
  .fp-loading-ring {
    width: 48px; height: 48px;
    border: 3px solid rgba(124,92,252,0.2);
    border-top-color: #7c5cfc;
    border-radius: 50%;
    animation: fp-spin 0.7s linear infinite;
  }
  .fp-loading-text {
    color: #8888aa; font-size: 14px;
    font-family: 'DM Sans', sans-serif;
  }
  @keyframes fp-spin { to { transform: rotate(360deg); } }
  @keyframes fp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fp-slide-up {
    from { opacity: 0; transform: translateY(16px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`

let globalConfig: FluxPayConfig | null = null
let rootContainer: HTMLDivElement | null = null
let reactRoot: ReturnType<typeof createRoot> | null = null

function unmount() {
  if (reactRoot) { reactRoot.unmount(); reactRoot = null }
  if (rootContainer) { document.body.removeChild(rootContainer); rootContainer = null }
}

function showLoader() {
  injectStyles(STYLES)
  unmount()
  rootContainer = document.createElement('div')
  rootContainer.id = 'fluxpay-root'
  document.body.appendChild(rootContainer)
  reactRoot = createRoot(rootContainer)
  reactRoot.render(
    React.createElement('div', { className: 'fp-loading-overlay' },
      React.createElement('div', { className: 'fp-loading-box' },
        React.createElement('div', { className: 'fp-loading-ring' }),
        React.createElement('div', { className: 'fp-loading-text' }, 'Preparing checkout...')
      )
    )
  )
}

function showModal(paymentId: string, cfg: FluxPayConfig) {
  if (!rootContainer) {
    rootContainer = document.createElement('div')
    rootContainer.id = 'fluxpay-root'
    document.body.appendChild(rootContainer)
    reactRoot = createRoot(rootContainer)
  }
  reactRoot!.render(
    React.createElement(CheckoutRoot, {
      paymentId,
      config: cfg,
      onClose: unmount,
    })
  )
}

const FluxPay = {
  init(config: FluxPayConfig) {
    globalConfig = config
    injectStyles(STYLES)
  },

  async open(paymentId: string, config?: FluxPayConfig) {
    const cfg = config ?? globalConfig
    if (!cfg) throw new Error('FluxPay: call FluxPay.init(config) before FluxPay.open()')

    // Show loading spinner immediately
    showLoader()

    // Small delay to ensure loader renders before React mounts the full modal
    await new Promise(res => setTimeout(res, 100))

    showModal(paymentId, cfg)
  },

  close() { unmount() },
}

export default FluxPay

if (typeof window !== 'undefined') {
  (window as any).FluxPay = FluxPay
}