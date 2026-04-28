import React, { useState, useEffect } from 'react'
import {
    ConnectionProvider,
    WalletProvider,
    useWallet,
} from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { usePaymentStatus } from './usePaymentStatus'
import { useCountdown } from './useCountdown'
import { FluxPayConfig, Payment } from './types'
import { useWalletModal, WalletModalProvider } from '@solana/wallet-adapter-react-ui'

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = `
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
  .fp-amount {
    text-align: center; margin-bottom: 24px;
  }
  .fp-amount-value {
    font-size: 36px; font-weight: 700; color: #a78bfa;
  }
  .fp-amount-label { color: #888; font-size: 14px; margin-top: 4px; }
  .fp-tabs {
    display: flex; gap: 8px; margin-bottom: 24px;
  }
  .fp-tab {
    flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #2a2a35;
    background: none; color: #888; cursor: pointer; font-size: 14px;
    transition: all 0.2s;
  }
  .fp-tab.active {
    background: #1e1b4b; border-color: #a78bfa; color: #a78bfa;
  }
  .fp-qr-container {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
  }
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
  .fp-timer {
    text-align: center; color: #888; font-size: 13px; margin-top: 16px;
  }
  .fp-timer span { color: #f59e0b; font-weight: 600; }
  .fp-status {
    text-align: center; padding: 24px 0;
  }
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

// ── QR Code (inline, no external lib) ────────────────────────────────────────

function QRCode({ value }: { value: string }) {
    const [src, setSrc] = useState<string>('')

    useEffect(() => {
        // Use a QR code API — no dependency needed
        setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`)
    }, [value])

    return src
        ? <img src={src} alt="QR Code" width={180} height={180} className="fp-qr" />
        : <div style={{ width: 180, height: 180, background: '#1a1a24', borderRadius: 12 }} />
}

// ── Wallet Pay Tab ────────────────────────────────────────────────────────────

function WalletPayTab({
    depositAddress,
    amountSol,
    network,
    onSent,
}: {
    depositAddress: string
    amountSol: number
    network: 'devnet' | 'mainnet-beta'
    onSent: () => void
}) {
    const { publicKey, sendTransaction, connected, select, connect, wallets, disconnect, wallet } = useWallet()
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showWallets, setShowWallets] = useState(false)
    const [connecting, setConnecting] = useState(false)

    // When wallet is selected, automatically connect.
    //
    // On the first select after the modal mounts there is a race in
    // @solana/wallet-adapter-react: `select(walletName)` updates the
    // `wallet` state but the WalletContext's internal `adapter` reference
    // is not always in place by the time this effect re-runs and calls
    // `connect()`. The hook's `connect` then throws
    // `WalletNotSelectedError` and the popup never opens; clicking again
    // succeeds because the second pass sees a fully-registered adapter.
    //
    // Retry once after a short delay on `WalletNotSelectedError` so the
    // first click works the same as subsequent ones. Other errors
    // (rejected, timed out, …) bubble up unchanged.
    useEffect(() => {
        if (!(wallet && !connected && connecting)) return
        let cancelled = false
        let retryTimer: ReturnType<typeof setTimeout> | null = null

        const tryConnect = async (retried: boolean): Promise<void> => {
            try {
                await connect()
                if (!cancelled) setConnecting(false)
            } catch (err: any) {
                if (cancelled) return
                if (!retried && err?.name === 'WalletNotSelectedError') {
                    retryTimer = setTimeout(() => {
                        retryTimer = null
                        void tryConnect(true)
                    }, 200)
                    return
                }
                setError(err?.message ?? 'Failed to connect')
                setConnecting(false)
            }
        }

        void tryConnect(false)

        return () => {
            cancelled = true
            if (retryTimer !== null) clearTimeout(retryTimer)
        }
    }, [wallet, connected, connecting])

    const handleSelectWallet = (walletName: any) => {
        setError(null)
        setConnecting(true)
        select(walletName)
        setShowWallets(false)
    }

    const handlePay = async () => {
        if (!publicKey) return
        setSending(true)
        setError(null)
        try {
            const connection = new Connection(clusterApiUrl(network), 'confirmed')
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: new PublicKey(depositAddress),
                    lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
                })
            )
            const { blockhash } = await connection.getLatestBlockhash()
            transaction.recentBlockhash = blockhash
            transaction.feePayer = publicKey
            const sig = await sendTransaction(transaction, connection)
            await connection.confirmTransaction(sig, 'confirmed')
            onSent()
        } catch (err: any) {
            setError(err.message ?? 'Transaction failed')
        } finally {
            setSending(false)
        }
    }

    // Show wallet list
    if (showWallets) {
        return (
            <div>
                <p style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
                    Select your wallet:
                </p>
                {wallets.length === 0 && (
                    <p style={{ color: '#f87171', fontSize: 13 }}>
                        No wallets detected. Please install Phantom or Solflare.
                    </p>
                )}
                {wallets.map((wallet) => (
                    <button
                        key={wallet.adapter.name}
                        className="fp-wallet-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
                        onClick={() => handleSelectWallet(wallet.adapter.name)}
                    >
                        <img src={wallet.adapter.icon} width={24} height={24} style={{ borderRadius: 4 }} />
                        {wallet.adapter.name}
                    </button>
                ))}
                <button
                    onClick={() => setShowWallets(false)}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 13, marginTop: 8 }}
                >
                    ← Back
                </button>
            </div>
        )
    }

    if (!connected) {
        return (
            <div>
                <button className="fp-wallet-btn" onClick={() => setShowWallets(true)}>
                    Connect Wallet
                </button>
                <p style={{ color: '#888', fontSize: 13, textAlign: 'center' }}>
                    Supports Phantom, Solflare, Backpack and more
                </p>
            </div>
        )
    }

    return (
        <div>
            <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                Connected: {publicKey?.toBase58().slice(0, 8)}...
                <button
                    onClick={() => { disconnect(); setShowWallets(true) }}
                    style={{ background: 'none', border: 'none', color: '#a78bfa', cursor: 'pointer', fontSize: 13, marginLeft: 8 }}
                >
                    (change)
                </button>
            </p>
            <button className="fp-wallet-btn" onClick={handlePay} disabled={sending}>
                {sending ? 'Sending...' : `Pay ${amountSol.toFixed(4)} SOL`}
            </button>
            {error && (
                <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
                    {error}
                </p>
            )}
        </div>
    )
}

// ── Status Screen ─────────────────────────────────────────────────────────────

function StatusScreen({ status }: { status: string }) {
    if (status === 'completed') {
        return (
            <div className="fp-status">
                <div className="fp-status-icon">✅</div>
                <div className="fp-status-text">Payment Confirmed</div>
                <div className="fp-status-sub">Your payment has been received</div>
            </div>
        )
    }
    if (status === 'expired') {
        return (
            <div className="fp-status">
                <div className="fp-status-icon">⏱️</div>
                <div className="fp-status-text">Payment Expired</div>
                <div className="fp-status-sub">Please start a new payment</div>
            </div>
        )
    }
    if (status === 'failed') {
        return (
            <div className="fp-status">
                <div className="fp-status-icon">❌</div>
                <div className="fp-status-text">Payment Failed</div>
                <div className="fp-status-sub">Please try again</div>
            </div>
        )
    }
    if (status === 'detected' || status === 'swapping') {
        return (
            <div className="fp-status">
                <div className="fp-spinner" />
                <div className="fp-status-text">
                    {status === 'detected' ? 'Payment Detected' : 'Converting to USDC...'}
                </div>
                <div className="fp-status-sub">Please wait, this takes a few seconds</div>
            </div>
        )
    }
    return null
}

// ── Main Modal ────────────────────────────────────────────────────────────────

function CheckoutModal({
    paymentId,
    config,
    onClose,
}: {
    paymentId: string
    config: FluxPayConfig
    onClose: () => void
}) {
    const [tab, setTab] = useState<'qr' | 'wallet'>('wallet')
    const [copied, setCopied] = useState(false)
    const { payment, error } = usePaymentStatus(paymentId, config)
    const { display: timerDisplay } = useCountdown(payment?.expires_at ?? null)

    const isTerminal = ['completed', 'expired', 'failed'].includes(payment?.status ?? '')
    const isProcessing = ['detected', 'swapping'].includes(payment?.status ?? '')
    const showActions = !isTerminal && !isProcessing

    const copyAddress = () => {
        if (!payment?.deposit_address) return
        navigator.clipboard.writeText(payment.deposit_address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Estimate SOL amount (rough: 1 USDC ≈ 0.006 SOL at $165/SOL)
    // In production fetch live price from your backend
    const amountSol = payment ? Number(payment.amount_usdc) / 165 : 0

    return (
        <div className="fp-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="fp-modal">
                <div className="fp-header">
                    <div className="fp-title">⚡ FluxPay</div>
                    <button className="fp-close" onClick={onClose}>×</button>
                </div>

                {/* Amount */}
                {payment && (
                    <div className="fp-amount">
                        <div className="fp-amount-value">${Number(payment.amount_usdc).toFixed(2)}</div>
                        <div className="fp-amount-label">USDC</div>
                    </div>
                )}

                {/* Status screens */}
                {(isTerminal || isProcessing) && payment && (
                    <StatusScreen status={payment.status} />
                )}

                {/* Payment actions */}
                {showActions && payment && (
                    <>
                        <div className="fp-tabs">
                            <button
                                className={`fp-tab ${tab === 'wallet' ? 'active' : ''}`}
                                onClick={() => setTab('wallet')}
                            >
                                🔗 Connect Wallet
                            </button>
                            <button
                                className={`fp-tab ${tab === 'qr' ? 'active' : ''}`}
                                onClick={() => setTab('qr')}
                            >
                                📷 QR Code
                            </button>
                        </div>

                        {tab === 'wallet' && (
                            <WalletPayTab
                                depositAddress={payment.deposit_address}
                                amountSol={amountSol}
                                network={(process.env.SOLANA_NETWORK as any) ?? 'devnet'}
                                onSent={() => { }} // polling handles the rest
                            />
                        )}

                        {tab === 'qr' && (
                            <div className="fp-qr-container">
                                <QRCode value={payment.deposit_address} />
                                <div className="fp-address-box">
                                    <div className="fp-address-label">Deposit Address</div>
                                    <div className="fp-address-row">
                                        <div className="fp-address-text">{payment.deposit_address}</div>
                                        <button className="fp-copy-btn" onClick={copyAddress}>
                                            {copied ? 'Copied!' : 'Copy'}
                                        </button>
                                    </div>
                                </div>
                                <p style={{ color: '#888', fontSize: 13, textAlign: 'center', margin: 0 }}>
                                    Send exactly <strong style={{ color: '#fff' }}>{amountSol.toFixed(4)} SOL</strong> or{' '}
                                    <strong style={{ color: '#fff' }}>${payment.amount_usdc} USDC</strong> to this address
                                </p>
                            </div>
                        )}

                        <div className="fp-timer">
                            Expires in <span>{timerDisplay}</span>
                        </div>
                    </>
                )}

                {error && (
                    <p style={{ color: '#f87171', fontSize: 13, textAlign: 'center' }}>{error}</p>
                )}
            </div>
        </div>
    )
}

// ── Root with Wallet Provider ─────────────────────────────────────────────────

export function CheckoutRoot({
    paymentId,
    config,
    onClose,
}: {
    paymentId: string
    config: FluxPayConfig
    onClose: () => void
}) {
    const wallets: any[] = []
    const network = 'devnet' as const

    return (
        <ConnectionProvider endpoint={clusterApiUrl(network)}>
            <WalletProvider wallets={wallets} autoConnect={false}>
                <CheckoutModal paymentId={paymentId} config={config} onClose={onClose} />
            </WalletProvider>
        </ConnectionProvider>
    )
}