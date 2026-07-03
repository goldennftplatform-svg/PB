/**
 * Raw lottery helpers (no IDL) — devnet program 8xdCoGh7...
 */
const crypto = require('crypto');
const {
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} = require('@solana/web3.js');

const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const LOTTERY_PDA = new PublicKey('ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb');

function disc(name) {
  const h = crypto.createHash('sha256');
  h.update(name);
  return Buffer.from(h.digest().slice(0, 8));
}

const IX = {
  enterUsd: disc('global:enter_lottery_with_usd_value'),
  updateTickets: disc('global:update_participant_tickets'),
  initializeLottery: disc('global:initialize_lottery'),
  closeLottery: disc('global:close_lottery'),
  takeSnapshot: Buffer.from([183, 210, 251, 68, 140, 132, 191, 140]),
  setWinners: disc('global:set_winners'),
  payoutWinners: disc('global:payout_winners'),
  configureTiming: disc('global:configure_timing'),
};

function readLotteryFields(data) {
  const jackpotLamports = Number(data.readBigUInt64LE(8));
  const lastSnapshot = Number(data.readBigInt64LE(24));
  const baseIntervalSec = Number(data.readBigUInt64LE(32));
  const fastIntervalSec = Number(data.readBigUInt64LE(40));
  let admin = '';
  for (const off of [66, 88, 90]) {
    try {
      const pk = new PublicKey(data.subarray(off, off + 32));
      if (pk.toBase58().length >= 32) {
        admin = pk.toBase58();
        break;
      }
    } catch {
      /* try next offset */
    }
  }
  let snapshotSeed = 0n;
  try {
    snapshotSeed = data.readBigUInt64LE(122);
  } catch {
    /* layout variance on older deploys */
  }
  const seedStr = snapshotSeed.toString();
  let pepeBallCount = data[data.length - 1];
  if (pepeBallCount < 1 || pepeBallCount > 30) {
    pepeBallCount = snapshotSeed > 0n ? Number(snapshotSeed % 30n) + 1 : 0;
  }
  const totalParticipants = 0;
  const totalTickets = 0;
  return {
    jackpotSol: jackpotLamports / LAMPORTS_PER_SOL,
    jackpotLamports,
    lastSnapshot,
    baseIntervalSec,
    fastIntervalSec,
    admin,
    totalParticipants,
    totalTickets,
    snapshotSeed: seedStr,
    pepeBallCount,
    isOdd: pepeBallCount >= 1 && pepeBallCount <= 30 ? pepeBallCount % 2 === 1 : null,
  };
}

async function fetchLottery(connection) {
  const info = await connection.getAccountInfo(LOTTERY_PDA);
  if (!info) throw new Error('Lottery PDA not found');
  return { info, fields: readLotteryFields(info.data) };
}

async function makeEntry(connection, wallet, usdCents) {
  const [participantPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('participant'), LOTTERY_PDA.toBuffer(), wallet.publicKey.toBuffer()],
    LOTTERY_PROGRAM_ID
  );
  const amt = Buffer.alloc(8);
  amt.writeBigUInt64LE(BigInt(usdCents), 0);
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: participantPDA, isWritable: true, isSigner: false },
      { pubkey: wallet.publicKey, isWritable: true, isSigner: true },
      { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    ],
    data: Buffer.concat([IX.enterUsd, amt]),
  });
  const sig = await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function updateParticipantTickets(connection, wallet, ticketCount, usdCents) {
  const [participantPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('participant'), LOTTERY_PDA.toBuffer(), wallet.publicKey.toBuffer()],
    LOTTERY_PROGRAM_ID
  );
  const body = Buffer.alloc(12);
  body.writeUInt32LE(ticketCount, 0);
  body.writeBigUInt64LE(BigInt(usdCents), 4);
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: participantPDA, isWritable: true, isSigner: false },
      { pubkey: wallet.publicKey, isWritable: false, isSigner: true },
    ],
    data: Buffer.concat([IX.updateTickets, body]),
  });
  const sig = await connection.sendTransaction(tx, [wallet], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function tryEnterOrUpdate(connection, wallet, usdCents) {
  const [participantPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from('participant'), LOTTERY_PDA.toBuffer(), wallet.publicKey.toBuffer()],
    LOTTERY_PROGRAM_ID
  );
  const info = await connection.getAccountInfo(participantPDA);
  const { ticketsFromUsdCents } = require('./eligibility-tiers');
  const tickets = ticketsFromUsdCents(usdCents);
  if (tickets <= 0) throw new Error(`USD cents ${usdCents} below entry threshold`);
  if (!info) return makeEntry(connection, wallet, usdCents);
  return updateParticipantTickets(connection, wallet, tickets, usdCents);
}

async function closeLotteryRaw(connection, admin) {
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: admin.publicKey, isWritable: true, isSigner: true },
    ],
    data: IX.closeLottery,
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function initializeLotteryRaw(
  connection,
  admin,
  jackpotLamports,
  entryMinCents,
  tier2MinCents,
  tier3MinCents
) {
  const body = Buffer.alloc(32);
  body.writeBigUInt64LE(BigInt(jackpotLamports), 0);
  body.writeBigUInt64LE(BigInt(entryMinCents), 8);
  body.writeBigUInt64LE(BigInt(tier2MinCents), 16);
  body.writeBigUInt64LE(BigInt(tier3MinCents), 24);
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: admin.publicKey, isWritable: true, isSigner: true },
      { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    ],
    data: Buffer.concat([IX.initializeLottery, body]),
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
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
    data: IX.takeSnapshot,
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function configureTiming(connection, admin, baseSec, fastSec, fastThresholdLamports) {
  const body = Buffer.alloc(24);
  body.writeBigUInt64LE(BigInt(baseSec), 0);
  body.writeBigUInt64LE(BigInt(fastSec), 8);
  body.writeBigUInt64LE(BigInt(fastThresholdLamports), 16);
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: admin.publicKey, isWritable: false, isSigner: true },
    ],
    data: Buffer.concat([IX.configureTiming, body]),
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function setWinnersRaw(connection, admin, mainWinner, minorWinners) {
  const minorBuf = Buffer.alloc(4 + minorWinners.length * 32);
  minorBuf.writeUInt32LE(minorWinners.length, 0);
  minorWinners.forEach((w, i) => w.toBuffer().copy(minorBuf, 4 + i * 32));
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: admin.publicKey, isWritable: false, isSigner: true },
    ],
    data: Buffer.concat([IX.setWinners, mainWinner.toBuffer(), minorBuf]),
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function payoutWinnersRaw(connection, admin) {
  const tx = new Transaction().add({
    programId: LOTTERY_PROGRAM_ID,
    keys: [
      { pubkey: LOTTERY_PDA, isWritable: true, isSigner: false },
      { pubkey: admin.publicKey, isWritable: false, isSigner: true },
    ],
    data: IX.payoutWinners,
  });
  const sig = await connection.sendTransaction(tx, [admin], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return sig;
}

async function getParticipants(connection) {
  const accs = await connection.getProgramAccounts(LOTTERY_PROGRAM_ID, {
    filters: [{ dataSize: 92 }],
  });
  const rows = [];
  for (const { account } of accs) {
    const d = account.data;
    const lottery = new PublicKey(d.subarray(8, 40));
    if (!lottery.equals(LOTTERY_PDA)) continue;
    rows.push({
      wallet: new PublicKey(d.subarray(40, 72)),
      ticketCount: d.readUInt32LE(72),
      usdValue: Number(d.readBigUInt64LE(76)),
      entryTime: Number(d.readBigInt64LE(84)),
    });
  }
  return rows;
}

function calculateWinners(participants, seedStr) {
  const seed = BigInt(seedStr || '0');
  const sorted = [...participants].sort((a, b) =>
    a.wallet.toBase58().localeCompare(b.wallet.toBase58())
  );
  const totalTickets = sorted.reduce((s, p) => s + p.ticketCount, 0);
  const winIdx = totalTickets > 0 ? Number(seed % BigInt(totalTickets)) : 0;
  let cum = 0;
  let mainWinner = sorted[0]?.wallet;
  for (const p of sorted) {
    const start = cum;
    cum += p.ticketCount;
    if (winIdx >= start && winIdx < cum) {
      mainWinner = p.wallet;
      break;
    }
  }
  const pool = sorted.filter((p) => !p.wallet.equals(mainWinner));
  const minorWinners = [];
  let s = seed;
  for (let i = 0; i < Math.min(8, pool.length); i++) {
    s = (s * 1103515245n + 12345n) % (2n ** 32n);
    const idx = Number(s % BigInt(pool.length));
    minorWinners.push(pool[idx].wallet);
    pool.splice(idx, 1);
  }
  return { mainWinner, minorWinners, totalTickets, winIdx };
}

function calcPayoutLamports(jackpotLamports) {
  const jackpot = BigInt(jackpotLamports);
  const main = jackpot / 2n;
  const minorEach = (jackpot * 2n) / 5n / 8n;
  const house = jackpot / 10n;
  return { main, minorEach, house, total: jackpot };
}

async function sendSolPayouts(connection, payer, jackpotLamports, mainWinner, minorWinners) {
  const payerBal = await connection.getBalance(payer.publicKey);
  const reserve = Math.floor(0.01 * LAMPORTS_PER_SOL);
  const available = Math.min(jackpotLamports, payerBal - reserve);
  if (available <= reserve) {
    throw new Error(`Payout wallet too low: ${(payerBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  }
  const { main, minorEach } = calcPayoutLamports(available);
  const tx = new Transaction();
  tx.add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: mainWinner,
      lamports: Number(main),
    })
  );
  for (const w of minorWinners) {
    if (minorEach <= 0n) break;
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: w,
        lamports: Number(minorEach),
      })
    );
  }
  const sig = await connection.sendTransaction(tx, [payer], { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  return { sig, mainSol: Number(main) / LAMPORTS_PER_SOL, minorSol: Number(minorEach) / LAMPORTS_PER_SOL, paidLamports: available };
}

module.exports = {
  LOTTERY_PROGRAM_ID,
  LOTTERY_PDA,
  readLotteryFields,
  fetchLottery,
  closeLotteryRaw,
  initializeLotteryRaw,
  makeEntry,
  updateParticipantTickets,
  tryEnterOrUpdate,
  takeSnapshot,
  configureTiming,
  setWinnersRaw,
  payoutWinnersRaw,
  getParticipants,
  calculateWinners,
  calcPayoutLamports,
  sendSolPayouts,
};
