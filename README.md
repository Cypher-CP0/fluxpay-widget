# @fluxpay-widget/sdk

Drop-in Solana checkout widget. Accept SOL, USDC, and USDT with built-in wallet connect (Phantom, Solflare, Backpack) and QR code fallback. SOL payments are auto-swapped to USDC via Jupiter on the backend — your merchant wallet only ever receives stablecoins.

## Install

```bash
npm install @fluxpay-widget/sdk
```

`react` and `react-dom` (>=17) must already be present in your app as peer dependencies.

## Quick start

```ts
import FluxPay from '@fluxpay-widget/sdk'

FluxPay.init({
  apiUrl: 'https://api.fluxpay.io',
  apiKey: 'fp_live_YOUR_KEY_HERE',
  network: 'mainnet-beta', // or 'devnet' while testing
  onSuccess: (payment) => {
    console.log('Payment confirmed', payment)
  },
  onExpired: () => console.log('Payment expired'),
  onError: (err) => console.log('Payment error', err),
})

async function checkout(orderId: string, amountUsdc: number) {
  const res = await fetch('/api/create-payment', {
    method: 'POST',
    body: JSON.stringify({ order_id: orderId, amount_usdc: amountUsdc }),
  })
  const { payment_id } = await res.json()
  FluxPay.open(payment_id)
}
```

`/api/create-payment` is a route on **your own backend** that calls FluxPay's `POST /api/payments/create` using your secret API key — keep that key server-side, never in the browser.

## Script tag (no build step)

```html
<script src="https://cdn.jsdelivr.net/npm/@fluxpay-widget/sdk/dist/fluxpay.js"></script>
<script>
  FluxPay.init({ apiUrl: '...', apiKey: '...', network: 'mainnet-beta' })
  FluxPay.open(payment_id)
</script>
```

## API

### `FluxPay.init(config)`

| Field | Type | Required | Description |
|---|---|---|---|
| `apiUrl` | `string` | yes | Your FluxPay backend URL |
| `apiKey` | `string` | yes | Merchant `fp_live_...` key |
| `network` | `'devnet' \| 'mainnet-beta'` | no | Defaults to `mainnet-beta` |
| `onSuccess` | `(payment: Payment) => void` | no | Called when payment status becomes `completed` |
| `onExpired` | `() => void` | no | Called when the payment window expires |
| `onError` | `(err: Error) => void` | no | Called on payment failure |

### `FluxPay.open(paymentId, config?)`

Opens the checkout modal for an existing `payment_id`. `config` is optional if `FluxPay.init()` was already called.

### `FluxPay.close()`

Closes the modal programmatically.

## Wallet support

Wallets are auto-detected via `@solana/wallet-adapter-wallets` — Phantom, Solflare, and Backpack currently. Only wallets actually installed in the user's browser are shown; nothing is hardcoded.

## License

MIT
