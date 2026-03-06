/**
 * Build lottery program instructions for admin (trigger snapshot, etc.).
 * Transactions are signed by the connected wallet (Phantom).
 */
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

// First 8 bytes of sha256("global:...") — must match program
const TAKE_SNAPSHOT_DISCRIMINATOR = new Uint8Array([
  183, 210, 251, 68, 140, 132, 191, 140,
]);
const SET_WINNERS_DISCRIMINATOR = new Uint8Array([
  96, 110, 12, 157, 13, 102, 230, 153,
]);
const PAYOUT_WINNERS_DISCRIMINATOR = new Uint8Array([
  189, 152, 120, 77, 73, 31, 193, 149,
]);

export function getLotteryPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('lottery')],
    programId
  );
  return pda;
}

/**
 * Build a transaction that calls take_snapshot. Admin wallet must sign.
 */
export async function buildTakeSnapshotTx(
  rpcUrl: string,
  programId: string,
  adminPubkey: string
): Promise<Transaction> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const program = new PublicKey(programId);
  const lotteryPda = getLotteryPda(program);
  const admin = new PublicKey(adminPubkey);

  const ix = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: lotteryPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: false },
    ],
    data: TAKE_SNAPSHOT_DISCRIMINATOR,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin;
  return tx;
}

/**
 * Build a transaction that calls set_winners. Admin wallet must sign.
 * mainWinner: base58 string. minorWinners: 1–8 base58 strings.
 */
export async function buildSetWinnersTx(
  rpcUrl: string,
  programId: string,
  adminPubkey: string,
  mainWinner: string,
  minorWinners: string[]
): Promise<Transaction> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const program = new PublicKey(programId);
  const lotteryPda = getLotteryPda(program);
  const admin = new PublicKey(adminPubkey);
  const main = new PublicKey(mainWinner);
  const minors = minorWinners.slice(0, 8).map((s) => new PublicKey(s));

  const data = new Uint8Array(8 + 32 + 4 + minors.length * 32);
  data.set(SET_WINNERS_DISCRIMINATOR, 0);
  data.set(main.toBytes(), 8);
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(40, minors.length, true);
  minors.forEach((p, i) => data.set(p.toBytes(), 44 + i * 32));

  const ix = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: lotteryPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin;
  return tx;
}

/**
 * Build a transaction that calls payout_winners. Admin wallet must sign.
 */
export async function buildPayoutWinnersTx(
  rpcUrl: string,
  programId: string,
  adminPubkey: string
): Promise<Transaction> {
  const connection = new Connection(rpcUrl, 'confirmed');
  const program = new PublicKey(programId);
  const lotteryPda = getLotteryPda(program);
  const admin = new PublicKey(adminPubkey);

  const ix = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: lotteryPda, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: false },
    ],
    data: PAYOUT_WINNERS_DISCRIMINATOR,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin;
  return tx;
}
