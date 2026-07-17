import * as anchor from '@coral-xyz/anchor'
import { Program, AnchorProvider } from '@coral-xyz/anchor'
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js'
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import idl from './idl/fluxpay_escrow.json'

// ── Config ───────────────────────────────────────────────────────────────────

// Program ID is read from the IDL itself (Anchor 0.31.x convention) — this
// keeps the widget in lockstep with whatever program the IDL was generated
// from, rather than risking a hardcoded ID drifting out of sync.
const PROGRAM_ID = new PublicKey((idl as any).address)

/**
 * A minimal read-only "wallet" for Anchor's Program/Provider, used only for
 * fetching account data and building (unsigned) instructions. It never
 * signs anything — actual signing happens through the customer's real
 * wallet-adapter connection (Phantom/Solflare/etc), via sendTransaction.
 *
 * Anchor's AnchorProvider requires a wallet-shaped object even for reads,
 * so this stands in without ever being asked to produce a real signature.
 */
class ReadOnlyWallet {
    publicKey = PublicKey.default
    async signTransaction<T>(tx: T): Promise<T> {
        throw new Error('ReadOnlyWallet cannot sign — use the connected wallet instead')
    }
    async signAllTransactions<T>(txs: T[]): Promise<T[]> {
        throw new Error('ReadOnlyWallet cannot sign — use the connected wallet instead')
    }
}

function getReadOnlyProgram(connection: Connection): Program<any> {
    const provider = new AnchorProvider(connection, new ReadOnlyWallet() as any, {
        commitment: 'confirmed',
    })
    return new Program(idl as anchor.Idl, provider) as Program<any>
}

// ── PDA derivation (mirrors backend's escrow.ts exactly) ─────────────────────

/**
 * Same sha256(paymentUuid) mapping used on the backend (see fluxpay
 * backend's src/services/escrow.ts) — MUST stay identical on both sides,
 * since it's how the widget and backend agree on which on-chain escrow
 * corresponds to a given payment_id.
 */
async function paymentIdToBytes(paymentUuid: string): Promise<number[]> {
    const encoder = new TextEncoder()
    const data = encoder.encode(paymentUuid)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource)
    return Array.from(new Uint8Array(hashBuffer))
}

export async function getEscrowPda(paymentUuid: string): Promise<PublicKey> {
    const paymentIdBytes = await paymentIdToBytes(paymentUuid)
    const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('escrow'), Buffer.from(paymentIdBytes)],
        PROGRAM_ID
    )
    return pda
}

export async function getVaultAta(escrowPda: PublicKey, usdcMint: PublicKey): Promise<PublicKey> {
    return getAssociatedTokenAddress(usdcMint, escrowPda, true)
}

// ── Amount verification ───────────────────────────────────────────────────────

/**
 * Independently reads the escrow's on-chain `amount` and compares it to what
 * the widget is about to charge the customer, BEFORE building a transaction
 * for them to sign.
 *
 * Why this matters: the widget's `amountUsdc` normally comes from the
 * backend's API response. If that response were ever tampered with in
 * transit (compromised CDN, MITM, etc.), this check catches a mismatch
 * against the immutable on-chain source of truth before the customer signs
 * anything — rather than trusting the API response blindly.
 */
export async function verifyEscrowAmount(
    connection: Connection,
    paymentUuid: string,
    expectedAmountUsdc: number
): Promise<{ ok: boolean; onChainAmount: number }> {
    const program = getReadOnlyProgram(connection)
    const escrowPda = await getEscrowPda(paymentUuid)

    const escrow = await (program.account as any).escrow.fetch(escrowPda)
    const onChainAmountBaseUnits: anchor.BN = escrow.amount
    const onChainAmountUsdc = onChainAmountBaseUnits.toNumber() / 1_000_000

    // Small epsilon for floating point comparison — amounts are in whole
    // cents at minimum, so anything beyond 1/100th of a cent difference
    // indicates a real mismatch, not rounding noise.
    const ok = Math.abs(onChainAmountUsdc - expectedAmountUsdc) < 0.00001

    return { ok, onChainAmount: onChainAmountUsdc }
}

// ── Deposit instruction ────────────────────────────────────────────────────────

/**
 * Builds the (unsigned) deposit() instruction for the customer's connected
 * wallet to sign. Does NOT send the transaction — the caller (CheckoutModal)
 * adds this instruction to a Transaction alongside a recent blockhash and
 * fee payer, then sends it via wallet-adapter's sendTransaction, exactly
 * like the existing SOL-transfer code path.
 */
export async function buildDepositInstruction(params: {
    connection: Connection
    paymentUuid: string
    depositorPublicKey: PublicKey
    usdcMint: PublicKey
}): Promise<TransactionInstruction> {
    const { connection, paymentUuid, depositorPublicKey, usdcMint } = params

    const program = getReadOnlyProgram(connection)
    const paymentIdBytes = await paymentIdToBytes(paymentUuid)
    const escrowPda = await getEscrowPda(paymentUuid)
    const vaultAta = await getVaultAta(escrowPda, usdcMint)
    const depositorTokenAccount = await getAssociatedTokenAddress(usdcMint, depositorPublicKey)

    // .instruction() only builds the instruction object — it does not
    // require a real signer, since no signature is produced at this step.
    const ix: TransactionInstruction = await (program.methods as any)
        .deposit(paymentIdBytes)
        .accounts({
            escrow: escrowPda,
            vault: vaultAta,
            depositorTokenAccount,
            usdcMint,
            depositor: depositorPublicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction()

    return ix
}