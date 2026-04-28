import { useState, useEffect, useRef } from 'react'
import { Payment, PaymentStatus, FluxPayConfig } from './types'

const POLL_INTERVAL = 3000 // 3 seconds

export function usePaymentStatus(
    paymentId: string,
    config: FluxPayConfig
) {
    const [payment, setPayment] = useState<Payment | null>(null)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const TERMINAL_STATES: PaymentStatus[] = ['completed', 'expired', 'failed']

    useEffect(() => {
        if (!paymentId) return

        const poll = async () => {
            try {
                const res = await fetch(`${config.apiUrl}/api/payments/${paymentId}`, {
                    headers: { 'x-api-key': config.apiKey },
                })

                if (!res.ok) throw new Error(`Failed to fetch payment: ${res.status}`)

                const data: Payment = await res.json()
                setPayment(data)

                if (data.status === 'completed') {
                    config.onSuccess?.(data)
                    stopPolling()
                } else if (data.status === 'expired') {
                    config.onExpired?.()
                    stopPolling()
                } else if (data.status === 'failed') {
                    config.onError?.(new Error('Payment failed'))
                    stopPolling()
                }
            } catch (err: any) {
                setError(err.message)
            }
        }

        const stopPolling = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }

        // Poll immediately then every 3 seconds
        poll()
        intervalRef.current = setInterval(poll, POLL_INTERVAL)

        return () => stopPolling()
    }, [paymentId])

    return { payment, error }
}
