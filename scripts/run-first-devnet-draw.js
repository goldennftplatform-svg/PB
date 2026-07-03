/**
 * First devnet draw: fund wallets → enter lottery → take_snapshot → report on-chain data.
 * Usage: node scripts/run-first-devnet-draw.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} = require('@solana/web3.js');
const { loadKeypair } = require('./lib/game-day-wallet');

const RPC_URL = process.env.SOLANA_RPC || process.env.RPC_URL || clusterApiUrl('devnet');
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const LOTTERY_PDA = new PublicKey('ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb');
const OUT = path.join(
  __dirname,
  '..',
  'devnet',
  process.env.DRAW_REPORT_FILE || (process.env.SCALE === '2' ? 'scaled-draw-report.json' : 'first-draw-report.json')
);
const ENTRY_COUNT = Number(process.env.ENTRY_COUNT || (process.env.SCALE === '2' ? '28' : '10'));
const FUND_SOL = Number(process.env.FUND_SOL || '0.08');

const TAKE_SNAPSHOT_DISC = Buffer.from([183, 210, 251, 68, 140, 132, 191, 140]);

function enterDiscriminator() {
  const h = crypto.createHash('sha256');
  h.update('global:enter_lottery_with_usd_value');
  return Buffer.from(h.digest().slice(0, 8));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readLotteryFields(data) {
  const jackpotLamports = Number(data.readBigUInt64LE(8));
  const lastSnapshot = Number(data.readBigInt64LE(24));
  const baseIntervalSec = Number(data.readBigUInt64LE(32));
  const fastIntervalSec = Number(data.readBigUInt64LE(40));
  const admin = new PublicKey(data.subarray(90, 122)).toBase58();
  const pepeBallCount = data[data.length - 1];
  const rolloverCount = data[data.length - 2];
  let snapshotSeed = 0n;
  try {
    snapshotSeed = data.readBigUInt64LE(122);
  } catch {
    /* layout variance */
  }
  return {
    jackpotSol: jackpotLamports / LAMPORTS_PER_SOL,
    lastSnapshot,
    baseIntervalSec,
    fastIntervalSec,
    admin,
    pepeBallCount,
    rolloverCount,
    snapshotSeed: snapshotSeed.toString(),
  };
}

async function makeEntry(connection, wallet, usdCents) {
  const [participantPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('participant'), LOTTERY_PDA.toBuffer(), wallet.publicKey.toBuffer()],
    LOTTERY_PROGRAM_ID
  );
  const ixData = Buffer.concat([
    enterDiscriminator(),
    (() => {
      const b = Buffer.alloc(8);
      b.writeBigUInt64LE(BigInt(usdCents), 0);
      return b;
    })(),
  ]);
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: participantPDA, isWritable: true, isSigner: false },
      { pubkey: wallet.publicKey, isWritable: false, isSigner: true },
      { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    ],
    data: ixData,
  });
  const sig = await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function takeSnapshot(connection, admin) {
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: admin.publicKey, isWritable: false, isSigner: true },
    ],
    data: TAKE_SNAPSHOT_DISC,
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function indexRoundWinners(connection, seedStr, cutoffUnix) {
  const seed = BigInt(seedStr || '0');
  const accs = await connection.getProgramAccounts(LOTTERY_PROGRAM_ID, {
    filters: [{ dataSize: 92 }],
  });
  const rows = [];
  for (const { account } of accs) {
    const d = account.data;
    const lottery = new PublicKey(d.subarray(8, 40));
    if (!lottery.equals(LOTTERY_PDA)) continue;
    const entryTime = Number(d.readBigInt64LE(84));
    if (entryTime < cutoffUnix) continue;
    rows.push({
      wallet: new PublicKey(d.subarray(40, 72)).toBase58(),
      tickets: d.readUInt32LE(72),
      usdCents: Number(d.readBigUInt64LE(76)),
    });
  }
  rows.sort((a, b) => a.wallet.localeCompare(b.wallet));
  const totalTickets = rows.reduce((s, r) => s + r.tickets, 0);
  const winIdx = totalTickets > 0 ? Number(seed % BigInt(totalTickets)) : null;
  let winner = null;
  let cum = 0;
  for (const r of rows) {
    const start = cum;
    cum += r.tickets;
    if (winIdx != null && winIdx >= start && winIdx < cum) {
      winner = { ...r, ticketIndex: winIdx };
      break;
    }
  }
  return { participants: rows.length, totalTickets, winningTicketIndex: winIdx, winner, rows };
}

async function parseSnapshotTx(connection, sig) {
  const tx = await connection.getTransaction(sig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  const logs = tx?.meta?.logMessages ?? [];
  const joined = logs.join('\n');
  const participants = joined.match(/Total Participants:\s*(\d+)/i)?.[1];
  const tickets = joined.match(/Total Tickets:\s*(\d+)/i)?.[1];
  const seed = joined.match(/Snapshot Seed:\s*(\d+)/i)?.[1];
  return { logs, participants, tickets, seed };
}

async function main() {
  const roundStartUnix = Math.floor(Date.now() / 1000) - 60;
  console.log(`\n═══ Devnet draw test (${ENTRY_COUNT} entry txs) ═══\n`);
  const connection = new Connection(RPC_URL, 'confirmed');
  const admin = loadKeypair('deployer');

  const beforeInfo = await connection.getAccountInfo(LOTTERY_PDA);
  if (!beforeInfo) throw new Error('Lottery PDA not found');
  const before = readLotteryFields(beforeInfo.data);

  console.log('RPC:', RPC_URL);
  console.log('Admin (deployer):', admin.publicKey.toBase58());
  console.log('Lottery PDA:', LOTTERY_PDA.toBase58());
  console.log('Jackpot before:', before.jackpotSol.toFixed(2), 'SOL');
  console.log('On-chain admin:', before.admin);
  console.log('Last snapshot:', before.lastSnapshot ? new Date(before.lastSnapshot * 1000).toISOString() : '—');
  console.log('');

  const baseAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000];
  const entryAmounts = Array.from({ length: ENTRY_COUNT }, (_, i) => baseAmounts[i % baseAmounts.length]);
  const entryRows = [];

  console.log(`── Step 1: ${ENTRY_COUNT} entries (2× scale) ──`);
  for (let i = 0; i < entryAmounts.length; i++) {
    const wallet = Keypair.generate();
    try {
      const fundTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: admin.publicKey,
          toPubkey: wallet.publicKey,
          lamports: Math.floor(FUND_SOL * LAMPORTS_PER_SOL),
        })
      );
      const fundSig = await connection.sendTransaction(fundTx, [admin]);
      await connection.confirmTransaction(fundSig, 'confirmed');
      await sleep(900);
      const sig = await makeEntry(connection, wallet, entryAmounts[i]);
      console.log(`  ✅ ${i + 1}/${ENTRY_COUNT} $${(entryAmounts[i] / 100).toFixed(0)} — ${sig.slice(0, 16)}…`);
      entryRows.push({ wallet: wallet.publicKey.toBase58(), usdCents: entryAmounts[i], tx: sig });
      await sleep(700);
    } catch (e) {
      console.log(`  ⚠️  ${i + 1}/${ENTRY_COUNT} failed: ${e.message.split('\n')[0]}`);
      entryRows.push({ wallet: wallet.publicKey.toBase58(), error: e.message });
    }
  }

  const okEntries = entryRows.filter((r) => r.tx).length;
  console.log(`\nEntries OK: ${okEntries}/${ENTRY_COUNT}\n`);
  if (okEntries < 9) {
    throw new Error(`Need 9+ entries, got ${okEntries}`);
  }

  await sleep(2000);

  console.log('── Step 2: take_snapshot (the draw) ──');
  let snapshotSig;
  try {
    snapshotSig = await takeSnapshot(connection, admin);
    console.log('  ✅ Snapshot tx:', snapshotSig);
    console.log(`  https://solscan.io/tx/${snapshotSig}?cluster=devnet\n`);
  } catch (e) {
    console.error('  ❌ Snapshot failed:', e.message);
    if (e.logs) e.logs.forEach((l) => console.error('   ', l));
    throw e;
  }

  const txParse = await parseSnapshotTx(connection, snapshotSig);
  const afterInfo = await connection.getAccountInfo(LOTTERY_PDA);
  const after = readLotteryFields(afterInfo.data);

  const pepe = after.pepeBallCount;
  let isOdd = pepe >= 1 && pepe <= 30 ? pepe % 2 === 1 : null;
  const seedFromChain = after.snapshotSeed !== '0' ? after.snapshotSeed : txParse.seed;
  let pepeDerived = null;
  if (seedFromChain) {
    pepeDerived = Number(BigInt(seedFromChain) % 30n) + 1;
    if (isOdd == null) isOdd = pepeDerived % 2 === 1;
  }

  const indexed = await indexRoundWinners(connection, seedFromChain, roundStartUnix);

  if (pepe >= 1 && pepe <= 30) {
    console.log(`🎲 Pepe ball count: ${pepe} → ${isOdd ? 'ODD (payout round)' : 'EVEN (rollover)'}`);
  } else if (pepeDerived != null) {
    console.log(`🎲 Pepe (from seed): ${pepeDerived} → ${isOdd ? 'ODD' : 'EVEN'}`);
  }

  const report = {
    network: 'devnet',
    scale: ENTRY_COUNT,
    at: new Date().toISOString(),
    rpc: RPC_URL,
    lotteryPda: LOTTERY_PDA.toBase58(),
    programId: LOTTERY_PROGRAM_ID.toBase58(),
    admin: admin.publicKey.toBase58(),
    entryTxCount: okEntries,
    entries: entryRows,
    snapshotTx: snapshotSig,
    snapshotLogs: txParse.logs,
    onChainParticipants: txParse.participants,
    onChainTickets: txParse.tickets,
    before,
    after,
    pepeBallCount: pepeDerived ?? pepe,
    snapshotSeed: seedFromChain,
    isOdd,
    outcome: isOdd === true ? 'ODD_PAYOUT' : isOdd === false ? 'EVEN_ROLLOVER' : 'UNKNOWN',
    winnerIndex: indexed,
    solscan: `https://solscan.io/tx/${snapshotSig}?cluster=devnet`,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  console.log('\n── On-chain summary ──');
  console.log('Entry txs:', okEntries);
  console.log('Participants (snapshot log):', txParse.participants);
  console.log('Tickets (snapshot log):', txParse.tickets);
  console.log('Jackpot after:', after.jackpotSol.toFixed(2), 'SOL');
  console.log('Snapshot seed:', seedFromChain || '—');
  console.log('Outcome:', report.outcome);
  if (indexed.winner) {
    console.log('Winning ticket index:', indexed.winningTicketIndex);
    console.log('Winner wallet:', indexed.winner.wallet);
  }
  console.log('Report:', OUT);
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
