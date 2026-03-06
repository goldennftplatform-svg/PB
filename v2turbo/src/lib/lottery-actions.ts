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

// First 8 bytes of sha256("global:take_snapshot") — must match program
const TAKE_SNAPSHOT_DISCRIMINATOR = new Uint8Array([
  183, 210, 251, 68, 140, 132, 191, 140,
]);

export function getLotteryPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('lottery')],
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
    data: Buffer.from(TAKE_SNAPSHOT_DISCRIMINATOR),
  });

  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash;
  tx.feePayer = admin;
  return tx;
}
