import React, { useState, useEffect } from 'react'
import {
    ConnectionProvider,
    WalletProvider,
    useWallet,
} from '@solana/wallet-adapter-react'
import {
    clusterApiUrl,
    Connection,
    PublicKey,
    Transaction,
    SystemProgram,
    LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import {
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getMint,
} from '@solana/spl-token'
import { usePaymentStatus } from './usePaymentStatus'
import { useCountdown } from './useCountdown'
import { FluxPayConfig, Payment } from './types'

// ── Token config ───────────────────────────────────────────────────────────────

type Token = 'SOL' | 'USDC' | 'USDT'

const TOKEN_MINTS: Record<Exclude<Token, 'SOL'>, Record<string, string>> = {
    USDC: {
        devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    },
    USDT: {
        devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // no real USDT on devnet
        'mainnet-beta': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },
}

const TOKEN_DECIMALS: Record<Token, number> = {
    SOL: 9,
    USDC: 6,
    USDT: 6,
}

// ── QR Code ───────────────────────────────────────────────────────────────────

function QRCode({ value }: { value: string }) {
    const [src, setSrc] = useState<string>('')
    useEffect(() => {
        setSrc(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`)
    }, [value])
    return src
        ? <img src={src} alt="QR Code" width={180} height={180} style={{ background: '#fff', padding: 12, borderRadius: 12 }} />
        : <div style={{ width: 180, height: 180, background: '#1a1a2e', borderRadius: 12 }} />
}

// ── Token Selector ─────────────────────────────────────────────────────────────

function TokenSelector({
    selected, onSelect,
}: {
    selected: Token; onSelect: (t: Token) => void
}) {
    const tokens: { token: Token; icon: string; label: string }[] = [
        { token: 'SOL', icon: '◎', label: 'SOL' },
        { token: 'USDC', icon: '$', label: 'USDC' },
        { token: 'USDT', icon: '$', label: 'USDT' },
    ]

    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{
                fontSize: 10, letterSpacing: '0.1em', color: '#555570',
                marginBottom: 8, textTransform: 'uppercase',
            }}>Pay with</div>
            <div style={{ display: 'flex', gap: 8 }}>
                {tokens.map(({ token, icon, label }) => (
                    <button
                        key={token}
                        onClick={() => onSelect(token)}
                        style={{
                            flex: 1, padding: '10px 8px',
                            background: selected === token ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${selected === token ? 'rgba(124,92,252,0.6)' : '#1e1e35'}`,
                            borderRadius: 10, cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            transition: 'all 0.15s',
                        }}
                    >
                        <span style={{
                            fontSize: 18, fontWeight: 700,
                            color: selected === token ? '#a78bfa' : '#555570',
                        }}>{icon}</span>
                        <span style={{
                            fontSize: 11, fontWeight: 600,
                            color: selected === token ? '#a78bfa' : '#8888aa',
                            letterSpacing: '0.05em',
                        }}>{label}</span>
                        {selected === token && (
                            <span style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: '#7c5cfc', display: 'block',
                            }} />
                        )}
                    </button>
                ))}
            </div>
        </div>
    )
}

// ── Wallet Pay Tab ─────────────────────────────────────────────────────────────

function WalletPayTab({
    depositAddress, amountSol, amountUsdc, network, selectedToken, onSent,
}: {
    depositAddress: string
    amountSol: number
    amountUsdc: number
    network: 'devnet' | 'mainnet-beta'
    selectedToken: Token
    onSent: () => void
}) {
    const { publicKey, sendTransaction, connected, select, connect, wallets, disconnect, wallet } = useWallet()
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [showWallets, setShowWallets] = useState(false)
    const [connecting, setConnecting] = useState(false)

    useEffect(() => {
        if (wallet && !connected && connecting) {
            connect()
                .then(() => setConnecting(false))
                .catch((err: any) => {
                    setError(err.message ?? 'Failed to connect')
                    setConnecting(false)
                })
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
            const transaction = new Transaction()

            if (selectedToken === 'SOL') {
                // Native SOL transfer
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: publicKey,
                        toPubkey: new PublicKey(depositAddress),
                        lamports: Math.floor(amountSol * LAMPORTS_PER_SOL),
                    })
                )
            } else {
                // SPL token transfer (USDC or USDT)
                const mint = new PublicKey(TOKEN_MINTS[selectedToken][network])
                const amount = Math.floor(amountUsdc * Math.pow(10, TOKEN_DECIMALS[selectedToken]))
                const depositPubkey = new PublicKey(depositAddress)

                // const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
                // const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bsB')

                const fromATA = await getAssociatedTokenAddress(mint, publicKey)
                const toATA = await getAssociatedTokenAddress(mint, depositPubkey)

                console.log('From ATA:', fromATA.toBase58())
                console.log('To ATA:', toATA.toBase58())
                console.log('Amount (base units):', amount)

                // Check if destination ATA exists, create it if not
                // const connection = new Connection(clusterApiUrl(network), 'confirmed')
                let toATAExists = false
                try {
                    const toATAInfo = await connection.getAccountInfo(toATA)
                    toATAExists = !!toATAInfo
                    console.log('Destination ATA exists:', toATAExists)
                } catch (e) {
                    console.log('getAccountInfo failed, assuming ATA does not exist:', e)
                    toATAExists = false
                }
                const toATAInfo = await connection.getAccountInfo(toATA)

                if (!toATAInfo) {
                    // Create the destination ATA
                    // const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token')
                    transaction.add(
                        createAssociatedTokenAccountInstruction(
                            publicKey,   // payer
                            toATA,       // ATA to create
                            depositPubkey, // owner
                            mint         // token mint
                        )
                    )
                }

                transaction.add(
                    createTransferInstruction(fromATA, toATA, publicKey, amount)
                )
            }

            const { blockhash } = await connection.getLatestBlockhash()
            transaction.recentBlockhash = blockhash
            transaction.feePayer = publicKey

            // Simulate the transaction first to get the real error
            try {
                const simulation = await connection.simulateTransaction(transaction)
                console.log('Simulation result:', JSON.stringify(simulation.value, null, 2))
                if (simulation.value.err) {
                    console.error('Simulation error:', simulation.value.err)
                    console.error('Simulation logs:', simulation.value.logs)
                    setError(`Simulation failed: ${JSON.stringify(simulation.value.err)}`)
                    setSending(false)
                    return
                }
            } catch (simErr: any) {
                console.error('Simulation threw:', simErr.message)
            }

            const sig = await sendTransaction(transaction, connection)
            await connection.confirmTransaction(sig, 'confirmed')
            onSent()
        } catch (err: any) {
            console.error('Full error:', err)
            console.error('Error message:', err.message)
            console.error('Error logs:', err.logs)
            setError(err.message ?? 'Transaction failed')
        } finally {
            setSending(false)
        }
    }

    const payLabel = () => {
        if (selectedToken === 'SOL') return `Pay ${amountSol.toFixed(4)} SOL`
        return `Pay $${amountUsdc.toFixed(2)} ${selectedToken}`
    }

    if (showWallets) {
        return (
            <div>
                <p style={{ color: '#8888aa', fontSize: 13, marginBottom: 12 }}>Select your wallet:</p>
                {wallets.length === 0 && (
                    <p style={{ color: '#f87171', fontSize: 13 }}>No wallets detected. Install Phantom or Solflare.</p>
                )}
                {wallets.map(w => (
                    <button key={w.adapter.name} onClick={() => handleSelectWallet(w.adapter.name)}
                        style={{
                            width: '100%', padding: '12px 16px', marginBottom: 8,
                            background: 'rgba(124,92,252,0.08)', border: '1px solid rgba(124,92,252,0.3)',
                            borderRadius: 10, color: '#f0f0ff', fontSize: 14,
                            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        }}
                    >
                        <img src={w.adapter.icon} width={24} height={24} style={{ borderRadius: 6 }} />
                        {w.adapter.name}
                    </button>
                ))}
                <button onClick={() => setShowWallets(false)}
                    style={{ background: 'none', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: 13, marginTop: 8 }}>
                    ← Back
                </button>
            </div>
        )
    }

    if (!connected) {
        return (
            <div>
                <button onClick={() => setShowWallets(true)} style={{
                    width: '100%', padding: '14px',
                    background: 'linear-gradient(135deg, #7c5cfc, #5a3fd4)',
                    border: 'none', borderRadius: 10, color: '#fff',
                    fontSize: 15, fontWeight: 600, marginBottom: 12,
                    boxShadow: '0 0 20px rgba(124,92,252,0.3)', cursor: 'pointer',
                }}>
                    Connect Wallet
                </button>
                <p style={{ color: '#8888aa', fontSize: 13, textAlign: 'center' }}>
                    Supports Phantom, Solflare, Backpack and more
                </p>
                {error && <p style={{ color: '#f87171', fontSize: 12, textAlign: 'center', marginTop: 8 }}>{error}</p>}
            </div>
        )
    }

    return (
        <div>
            <div style={{
                padding: '10px 14px', background: 'rgba(124,92,252,0.08)',
                border: '1px solid rgba(124,92,252,0.2)', borderRadius: 8,
                fontSize: 12, color: '#8888aa', marginBottom: 14,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
                <span>⚡ {publicKey?.toBase58().slice(0, 8)}...{publicKey?.toBase58().slice(-6)}</span>
                <button onClick={() => { disconnect(); setShowWallets(true) }}
                    style={{ background: 'none', border: 'none', color: '#7c5cfc', cursor: 'pointer', fontSize: 12 }}>
                    change
                </button>
            </div>

            {/* No swap badge for USDC/USDT */}
            {selectedToken !== 'SOL' && (
                <div style={{
                    padding: '8px 12px', marginBottom: 12,
                    background: 'rgba(34,211,165,0.08)', border: '1px solid rgba(34,211,165,0.2)',
                    borderRadius: 8, fontSize: 12, color: '#22d3a5',
                    display: 'flex', alignItems: 'center', gap: 6,
                }}>
                    <span>✓</span> Direct payment — no swap fees
                </div>
            )}

            <button onClick={handlePay} disabled={sending} style={{
                width: '100%', padding: '14px',
                background: sending ? '#3a2a8a' : 'linear-gradient(135deg, #7c5cfc, #5a3fd4)',
                border: 'none', borderRadius: 10, color: '#fff',
                fontSize: 15, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 20px rgba(124,92,252,0.3)',
            }}>
                {sending ? 'Sending...' : payLabel()}
            </button>
            {error && <p style={{ color: '#f87171', fontSize: 12, textAlign: 'center', marginTop: 8 }}>{error}</p>}
        </div>
    )
}

// ── Status Screen ──────────────────────────────────────────────────────────────

function StatusScreen({ status }: { status: string }) {
    const configs: Record<string, { icon: string; title: string; sub: string; color: string }> = {
        completed: { icon: '✅', title: 'Payment Confirmed', sub: 'USDC has been sent to merchant', color: '#22d3a5' },
        expired: { icon: '⏱️', title: 'Payment Expired', sub: 'Please start a new payment', color: '#f59e0b' },
        failed: { icon: '❌', title: 'Payment Failed', sub: 'Please try again', color: '#f87171' },
        detected: { icon: '🔍', title: 'Payment Detected', sub: 'Confirming on-chain...', color: '#7c5cfc' },
        swapping: { icon: '⚡', title: 'Converting to USDC', sub: 'Jupiter swap in progress...', color: '#7c5cfc' },
    }
    const cfg = configs[status]
    if (!cfg) return null
    const isProcessing = status === 'detected' || status === 'swapping'

    return (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
            {isProcessing ? (
                <div style={{
                    width: 48, height: 48,
                    border: '3px solid rgba(124,92,252,0.2)',
                    borderTopColor: '#7c5cfc',
                    borderRadius: '50%',
                    animation: 'fp-spin 0.8s linear infinite',
                    margin: '0 auto 16px',
                }} />
            ) : (
                <div style={{ fontSize: 48, marginBottom: 12 }}>{cfg.icon}</div>
            )}
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: cfg.color }}>{cfg.title}</div>
            <div style={{ color: '#8888aa', fontSize: 14 }}>{cfg.sub}</div>
        </div>
    )
}

// ── Main Modal ─────────────────────────────────────────────────────────────────

function CheckoutModal({
    paymentId, config, onClose,
}: {
    paymentId: string; config: FluxPayConfig; onClose: () => void
}) {
    const [tab, setTab] = useState<'wallet' | 'qr'>('wallet')
    const [copied, setCopied] = useState(false)
    const [solPrice, setSolPrice] = useState<number | null>(null)
    const [selectedToken, setSelectedToken] = useState<Token>('SOL')
    const { payment, error } = usePaymentStatus(paymentId, config)
    const { display: timerDisplay } = useCountdown(payment?.expires_at ?? null)

    const isTerminal = ['completed', 'expired', 'failed'].includes(payment?.status ?? '')
    const isProcessing = ['detected', 'swapping'].includes(payment?.status ?? '')
    const showActions = !isTerminal && !isProcessing

    // Prefer the price the backend already attached to the payment object
    // (no extra HTTP roundtrip, and matches the price used at payment creation).
    // Fall back to GET /api/price/sol once for backends that don't yet return it.
    useEffect(() => {
        if (payment?.sol_price_usd && payment.sol_price_usd > 0) {
            setSolPrice(payment.sol_price_usd)
            return
        }
        if (solPrice != null) return
        fetch(`${config.apiUrl}/api/price/sol`, { headers: { 'x-api-key': config.apiKey } })
            .then(r => r.json())
            .then(d => { if (d.sol_usd) setSolPrice(d.sol_usd) })
            .catch(() => { })
    }, [payment?.sol_price_usd])

    const amountUsdc = payment ? Number(payment.amount_usdc) : 0
    const amountSol = solPrice && solPrice > 0 ? amountUsdc / solPrice : 0

    const copyAddress = () => {
        if (!payment?.deposit_address) return
        navigator.clipboard.writeText(payment.deposit_address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Display amount based on selected token
    const displayAmount = () => {
        if (selectedToken === 'SOL') return `${amountSol.toFixed(4)} SOL`
        return `$${amountUsdc.toFixed(2)} ${selectedToken}`
    }

    return (
        <div className="fp-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
            <div className="fp-modal">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32,
                            background: 'linear-gradient(135deg, #7c5cfc, #5a3fd4)',
                            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, boxShadow: '0 0 12px rgba(124,92,252,0.4)',
                        }}>⚡</div>
                        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>FluxPay</span>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid #1e1e35',
                        borderRadius: 8, color: '#8888aa', fontSize: 18, cursor: 'pointer',
                        width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>×</button>
                </div>

                {/* Amount */}
                {payment && (
                    <div style={{
                        textAlign: 'center', marginBottom: 24,
                        padding: '16px', background: 'rgba(124,92,252,0.06)',
                        border: '1px solid rgba(124,92,252,0.15)', borderRadius: 12,
                    }}>
                        <div style={{ fontSize: 38, fontWeight: 800, color: '#7c5cfc', letterSpacing: '-0.02em' }}>
                            ${amountUsdc.toFixed(2)}
                        </div>
                        <div style={{ color: '#8888aa', fontSize: 13, marginTop: 4 }}>
                            ≈ {displayAmount()}
                        </div>
                    </div>
                )}

                {/* Status */}
                {(isTerminal || isProcessing) && payment && <StatusScreen status={payment.status} />}

                {/* Payment actions */}
                {showActions && payment && (
                    <>
                        {/* Tabs */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                            {[
                                { key: 'wallet', label: '🔗 Connect Wallet' },
                                { key: 'qr', label: '📷 QR Code' },
                            ].map(t => (
                                <button key={t.key} onClick={() => setTab(t.key as any)}
                                    style={{
                                        flex: 1, padding: '10px', borderRadius: 8, fontSize: 13,
                                        background: tab === t.key ? 'rgba(124,92,252,0.15)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${tab === t.key ? 'rgba(124,92,252,0.5)' : '#1e1e35'}`,
                                        color: tab === t.key ? '#a78bfa' : '#8888aa',
                                        fontWeight: tab === t.key ? 600 : 400, cursor: 'pointer',
                                        transition: 'all 0.15s',
                                    }}
                                >{t.label}</button>
                            ))}
                        </div>

                        {/* Token selector — only show on wallet tab */}
                        {tab === 'wallet' && (
                            <TokenSelector selected={selectedToken} onSelect={setSelectedToken} />
                        )}

                        {tab === 'wallet' && (
                            <WalletPayTab
                                depositAddress={payment.deposit_address}
                                amountSol={amountSol}
                                amountUsdc={amountUsdc}
                                network='devnet'
                                selectedToken={selectedToken}
                                onSent={() => { }}
                            />
                        )}

                        {tab === 'qr' && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                <QRCode value={payment.deposit_address} />
                                <div style={{
                                    background: '#0f0f1a', border: '1px solid #1e1e35',
                                    borderRadius: 8, padding: '12px 14px', width: '100%',
                                }}>
                                    <div style={{ fontSize: 10, letterSpacing: '0.1em', color: '#555570', marginBottom: 6 }}>
                                        DEPOSIT ADDRESS
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{
                                            fontFamily: 'monospace', fontSize: 12, color: '#a78bfa',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                        }}>{payment.deposit_address}</span>
                                        <button onClick={copyAddress} style={{
                                            background: 'rgba(124,92,252,0.15)', border: '1px solid rgba(124,92,252,0.3)',
                                            color: copied ? '#22d3a5' : '#a78bfa', padding: '5px 10px',
                                            borderRadius: 6, cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap',
                                        }}>{copied ? 'Copied!' : 'Copy'}</button>
                                    </div>
                                </div>
                                <p style={{ color: '#8888aa', fontSize: 12, textAlign: 'center', margin: 0 }}>
                                    Send <strong style={{ color: '#f0f0ff' }}>{amountSol.toFixed(4)} SOL</strong> or{' '}
                                    <strong style={{ color: '#f0f0ff' }}>${amountUsdc.toFixed(2)} USDC/USDT</strong>
                                </p>
                            </div>
                        )}

                        {/* Timer */}
                        <div style={{
                            textAlign: 'center', color: '#555570', fontSize: 12, marginTop: 16,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                            <span>⏱</span>
                            Expires in <span style={{ color: '#f59e0b', fontWeight: 600, marginLeft: 4 }}>{timerDisplay}</span>
                        </div>
                    </>
                )}

                {error && <p style={{ color: '#f87171', fontSize: 12, textAlign: 'center', marginTop: 12 }}>{error}</p>}

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #1e1e35' }}>
                    <span style={{ fontSize: 11, color: '#555570', letterSpacing: '0.05em' }}>
                        Powered by <span style={{ color: '#7c5cfc', fontWeight: 600 }}>FluxPay</span> · Solana
                    </span>
                </div>
            </div>
        </div>
    )
}

// ── Root ───────────────────────────────────────────────────────────────────────

export function CheckoutRoot({
    paymentId, config, onClose,
}: {
    paymentId: string; config: FluxPayConfig; onClose: () => void
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