# @fluxpay/widget ⚡

Embeddable Solana payment widget for [FluxPay](https://github.com/Cypher-CP0/fluxpay). Drop one script tag on your site and get a full crypto checkout flow — wallet connect, QR code, and real-time payment status.

Built for [Colosseum Hackathon 2026](https://colosseum.org).

---

## Demo



https://github.com/user-attachments/assets/fb6b8181-5bc4-400e-9692-95fa102433a8



---

## How it works


<img width="2879" height="3338" alt="diagram-export-28-04-2026-13_02_59" src="https://github.com/user-attachments/assets/ca54c380-6b28-4f29-a6d4-03e50df59e9b" />
[Link To FlowChart](https://app.eraser.io/workspace/z35BCDaVw5haoEzWbcEY?origin=share)

No page redirects. No wallet SDK required on the merchant's side. Works on any website regardless of framework.

---

## Features

- **Wallet Connect** — supports any Solana wallet (Phantom, Solflare, Backpack, etc.) via Wallet Standard
- **One-click payment** — user connects wallet, clicks Pay, approves in Phantom. Done.
- **QR Code fallback** — users can also scan and pay from a mobile wallet
- **Real-time status** — polls backend every 3 seconds, updates UI automatically
- **Status transitions** — Pending → Detected → Converting → Confirmed with live UI
- **Countdown timer** — shows payment expiry window
- **Self-contained** — React + wallet adapter bundled inside, no dependencies for merchant
- **Works anywhere** — plain HTML, React, Vue, Shopify, WordPress, anything

---

## Usage

### Script tag (any website)

```html
<script src="https://cdn.fluxpay.io/fluxpay.js"></script>

<script>
  FluxPay.init({
    apiUrl: 'https://api.fluxpay.io',
    apiKey: 'fp_live_...',
    onSuccess: (payment) => {
      console.log('Payment confirmed!', payment.payment_id)
      // redirect, show success page, etc.
    },
    onExpired: () => console.log('Payment expired'),
    onError: (err) => console.log('Error:', err.message),
  })
</script>

<button onclick="FluxPay.open('PAYMENT_ID')">
  Pay with Crypto
</button>
```

### npm / bundler

```bash
npm install @fluxpay/widget
```

```js
import FluxPay from '@fluxpay/widget'

FluxPay.init({
  apiUrl: 'https://api.fluxpay.io',
  apiKey: 'fp_live_...',
  onSuccess: (payment) => console.log('done', payment),
})

FluxPay.open('PAYMENT_ID')
```

---

## API

### `FluxPay.init(config)`

Call once on page load.

| Option | Type | Required | Description |
|---|---|---|---|
| `apiUrl` | string | ✅ | Your FluxPay backend URL |
| `apiKey` | string | ✅ | Merchant API key (`fp_live_...`) |
| `onSuccess` | function | ❌ | Called when payment completes |
| `onExpired` | function | ❌ | Called when payment expires |
| `onError` | function | ❌ | Called on error |

### `FluxPay.open(paymentId)`

Opens the checkout modal for a given payment ID. Get the payment ID by calling `POST /api/payments/create` on your backend first.

### `FluxPay.close()`

Programmatically closes the modal.

---

## Integration flow

Your backend creates the payment, your frontend opens the widget:

```js
// 1. Create payment on your backend (server-side or via API call)
const res = await fetch('https://api.fluxpay.io/api/payments/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'fp_live_...',
  },
  body: JSON.stringify({
    order_id: 'order_123',
    amount_usdc: 25.00,
  }),
})
const { payment_id } = await res.json()

// 2. Open the widget with the payment ID
FluxPay.open(payment_id)
```

---

## Payment status flow

```
pending → detected → swapping → completed ✅
                              → failed ❌
pending → expired ⏱️
```

The widget handles all status transitions automatically.

---

## Project structure

```
fluxpay-widget/
├── src/
│   ├── index.tsx              ← entry point, exposes FluxPay.init() + FluxPay.open()
│   ├── CheckoutModal.tsx      ← main modal UI (wallet connect + QR code + status)
│   ├── usePaymentStatus.ts    ← polls backend every 3s for payment status
│   ├── useCountdown.ts        ← countdown timer hook
│   └── types.ts               ← shared TypeScript types
├── dist/
│   ├── fluxpay.js             ← IIFE bundle (script tag usage)
│   └── fluxpay.esm.js         ← ESM bundle (npm/bundler usage)
├── rollup.config.js
├── tsconfig.json
└── package.json
```

---

## Local development

```bash
git clone https://github.com/Cypher-CP0/fluxpay-widget.git
cd fluxpay-widget

npm install
npm run build        # builds dist/fluxpay.js
```

To test locally, serve the folder and open test.html:
```bash
npx serve .
# open http://localhost:8080/test.html
```

Make sure your [FluxPay backend](https://github.com/Cypher-CP0/fluxpay) is running.

---

## Stack

| Layer | Choice |
|---|---|
| UI | React 18 |
| Wallet | @solana/wallet-adapter (Wallet Standard) |
| Bundler | Rollup |
| Language | TypeScript |
| Output | IIFE (script tag) + ESM (npm) |

---

## Related

- [fluxpay](https://github.com/Cypher-CP0/fluxpay) — backend API, Helius webhooks, Jupiter swap
