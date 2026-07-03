/**
 * Initialize game-registry on devnet (raw ix encoding — no workspace IDL required).
 *
 *   node scripts/initialize-game-registry-devnet.js
 *   node scripts/initialize-game-registry-devnet.js --seal
 *
 * Env: JACKPOT_SOL_DEST, ANCHOR_WALLET, RPC_URL
 */

const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const TRIO_FILE = path.join(__dirname, '..', 'devnet', 'trio-mints.json');
const PROGRAM_ID = new PublicKey('CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR');

const IX = {
  initialize_registry: Buffer.from([189, 181, 20, 17, 174, 57, 249, 59]),
  register_mints: Buffer.from([248, 75, 147, 21, 233, 3, 231, 167]),
  seal_registry: Buffer.from([112, 60, 81, 31, 43, 253, 246, 48]),
};

const PROGRAM_IDS = {
  lottery: '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7',
  pepball_token: 'HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR',
  tax_harvest: 'Em261K95h8M48f52iuu5YSaTJXJTs1pqjZpRCPYFqXRx',
  lp_manager: 'G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG',
};

function loadWallet() {
  const walletPath =
    process.env.ANCHOR_WALLET ||
    path.join(process.env.USERPROFILE || process.env.HOME, 'pepeball-game-day', 'private', 'deployer-keypair.json');
  if (!fs.existsSync(walletPath)) {
    console.error('Wallet not found:', walletPath);
    process.exit(1);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
}

function loadTrio() {
  if (!fs.existsSync(TRIO_FILE)) {
    console.error('Missing', TRIO_FILE);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(TRIO_FILE, 'utf8'));
}

function pkBuf(addr) {
  return new PublicKey(addr).toBuffer();
}

function decodeRegistry(data) {
  const body = data.subarray(8);
  let o = 0;
  const readPk = () => {
    const p = new PublicKey(body.subarray(o, o + 32)).toBase58();
    o += 32;
    return p;
  };
  const admin = readPk();
  const bump = body[o]; o += 1;
  const sealed = body[o] === 1; o += 1;
  const mintsRegistered = body[o] === 1; o += 1;
  const masterMint = readPk();
  const pumpShellMint = readPk();
  const trixYangMint = readPk();
  const trixYinMint = readPk();
  const trixBridgeMint = readPk();
  o += 16;
  const jackpotSolDest = readPk();
  return { admin, bump, sealed, mintsRegistered, masterMint, pumpShellMint, trixYangMint, trixYinMint, trixBridgeMint, jackpotSolDest };
}

async function sendIx(connection, payer, ix) {
  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'confirmed' });
  return sig;
}

async function main() {
  const shouldSeal = process.argv.includes('--seal');
  const rpc = process.env.RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpc, 'confirmed');
  const payer = loadWallet();
  const trio = loadTrio();

  const [registryPda] = PublicKey.findProgramAddressSync([Buffer.from('game_registry')], PROGRAM_ID);
  const jackpotDest = new PublicKey(process.env.JACKPOT_SOL_DEST || payer.publicKey.toBase58());

  console.log('\n═══ game-registry devnet init ═══\n');
  console.log('Admin:', payer.publicKey.toBase58());
  console.log('Balance:', ((await connection.getBalance(payer.publicKey)) / 1e9).toFixed(4), 'SOL');
  console.log('Registry PDA:', registryPda.toBase58());
  console.log('Jackpot dest:', jackpotDest.toBase58());

  let reg = null;
  const info = await connection.getAccountInfo(registryPda);
  if (info?.data?.length > 8) {
    reg = decodeRegistry(info.data);
    console.log('\nRegistry already initialized.');
  }

  if (!reg) {
    console.log('\n→ initialize_registry...');
    const data = Buffer.concat([
      IX.initialize_registry,
      jackpotDest.toBuffer(),
      pkBuf(PROGRAM_IDS.lottery),
      pkBuf(PROGRAM_IDS.pepball_token),
      pkBuf(PROGRAM_IDS.tax_harvest),
      pkBuf(PROGRAM_IDS.lp_manager),
    ]);
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: registryPda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const sig = await sendIx(connection, payer, ix);
    console.log('  tx:', sig);
    reg = decodeRegistry((await connection.getAccountInfo(registryPda)).data);
  }

  if (!reg.mintsRegistered) {
    console.log('\n→ register_mints...');
    const master = trio.mints.master_mint;
    const data = Buffer.concat([
      IX.register_mints,
      pkBuf(master),
      pkBuf(trio.mints.pump_shell_mint),
      pkBuf(trio.mints.trix_yang_mint),
      pkBuf(master),
      pkBuf(trio.mints.trix_bridge_mint),
    ]);
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: registryPda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });
    const sig = await sendIx(connection, payer, ix);
    console.log('  tx:', sig);
    reg = decodeRegistry((await connection.getAccountInfo(registryPda)).data);
  } else {
    console.log('\nMints already registered.');
  }

  if (shouldSeal && !reg.sealed) {
    console.log('\n→ seal_registry...');
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: registryPda, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      ],
      data: IX.seal_registry,
    });
    const sig = await sendIx(connection, payer, ix);
    console.log('  tx:', sig);
    reg = decodeRegistry((await connection.getAccountInfo(registryPda)).data);
  }

  console.log('\n═══ Registry state ═══');
  console.log('  sealed:', reg.sealed);
  console.log('  mints_registered:', reg.mintsRegistered);
  console.log('  master_mint:', reg.masterMint);
  console.log('  pump_shell:', reg.pumpShellMint);
  console.log('  trix_yang:', reg.trixYangMint);
  console.log('  trix_bridge:', reg.trixBridgeMint);
  console.log('  jackpot_sol_dest:', reg.jackpotSolDest);
  console.log('\nVITE_GAME_REGISTRY_PDA=' + registryPda.toBase58());
  console.log('      node scripts/devnet-proof-status.js\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
