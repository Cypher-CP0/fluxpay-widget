import { useState, useEffect } from 'react'

export function useCountdown(expiresAt: string | null) {
    const [secondsLeft, setSecondsLeft] = useState<number>(0)

    useEffect(() => {
        if (!expiresAt) return

        const calc = () => {
            const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
            setSecondsLeft(Math.max(0, diff))
        }

        calc()
        const interval = setInterval(calc, 1000)
        return () => clearInterval(interval)
    }, [expiresAt])

    const minutes = Math.floor(secondsLeft / 60)
    const seconds = secondsLeft % 60
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    const isExpired = secondsLeft === 0

    return { secondsLeft, display, isExpired }
}
