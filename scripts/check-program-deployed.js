#!/usr/bin/env node
/**
 * Check if the lottery program (and optionally PDA) exist on mainnet.
 * Usage: node scripts/check-program-deployed.js
 * Uses RPC_URL or HELIUS_RPC_URL or public mainnet RPC.
 */

const { Connection, PublicKey } = require('@solana/web3.js');

const LOTTERY_PROGRAM_ID = '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7';
const LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

function clusterFromRpc(rpc) {
  if (!rpc) return 'unknown';
  if (rpc.includes('devnet')) return 'devnet';
  if (rpc.includes('testnet')) return 'testnet';
  return 'mainnet';
}

async function main() {
  const rpc = process.env.RPC_URL || process.env.HELIUS_RPC_URL || 'https://api.mainnet.solana.com';
  const connection = new Connection(rpc, 'confirmed');
  const cluster = clusterFromRpc(rpc);

  console.log('RPC:', rpc.replace(/\/\/[^@]+@/, '//***@'));
  console.log('Cluster:', cluster);
  console.log('');

  const programId = new PublicKey(LOTTERY_PROGRAM_ID);
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo) {
    console.log('Lottery Program:', LOTTERY_PROGRAM_ID);
    console.log('  Status: DEPLOYED on', cluster);
    console.log('  Executable:', programInfo.executable);
    console.log('  Owner:', programInfo.owner.toBase58());
    console.log('  Lamports:', programInfo.lamports);
  } else {
    console.log('Lottery Program:', LOTTERY_PROGRAM_ID);
    console.log('  Status: NOT FOUND on', cluster, '(not deployed or wrong cluster)');
  }

  console.log('');

  const pda = new PublicKey(LOTTERY_PDA);
  const pdaInfo = await connection.getAccountInfo(pda);
  if (pdaInfo) {
    const isLotteryPda = pdaInfo.owner.toBase58() === LOTTERY_PROGRAM_ID;
    console.log('Game Snapshot (PDA):', LOTTERY_PDA);
    console.log('  Status:', isLotteryPda ? 'EXISTS (lottery state)' : 'Account exists but not owned by lottery program');
    console.log('  Owner:', pdaInfo.owner.toBase58());
    console.log('  Data length:', pdaInfo.data.length, 'bytes');
  } else {
    console.log('Game Snapshot (PDA):', LOTTERY_PDA);
    console.log('  Status: NOT FOUND (program not used yet or wrong PDA)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
