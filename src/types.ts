export type PaymentStatus =
    | 'pending'
    | 'detected'
    | 'swapping'
    | 'completed'
    | 'expired'
    | 'failed'

export interface Payment {
    payment_id: string
    order_id: string
    deposit_address: string
    amount_usdc: string
    token_received: string | null
    amount_received: string | null
    status: PaymentStatus
    expires_at: string
    created_at: string
}

export interface FluxPayConfig {
    apiUrl: string      // your backend URL e.g. https://api.fluxpay.io
    apiKey: string      // merchant's fp_live_... key
    onSuccess?: (payment: Payment) => void
    onExpired?: () => void
    onError?: (err: Error) => void
}
