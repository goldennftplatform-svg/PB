/**
 * Verify a keypair file matches expected game-day role (never prints secret key).
 *
 * Usage:
 *   node scripts/game-day-verify-wallet.js jackpot_tax C:\secure\pepeball-game-day\private\jackpot_tax-keypair.json
 *   node scripts/game-day-verify-wallet.js admin
 *     (reads path from game-day-wallets/public-registry.json if present)
 *
 * Also checks address against env:
 *   VITE_TAX_RECIPIENT (jackpot_tax), ADMIN expected from constants via registry
 */

const fs = require('fs');
const path = require('path');
const { Keypair, PublicKey } = require('@solana/web3.js');
const { getRpcConnection } = require('./lib/get-rpc-connection');

const LAMPORTS_PER_SOL = 1e9;

function toReadablePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') return '';
  let p = inputPath.trim().replace(/^"+|"+$/g, '');
  if (p.match(/^[A-Za-z]:[\\/]/)) {
    const drive = p[0].toLowerCase();
    const rest = p.slice(2).replace(/\\/g, '/');
    p = '/mnt/' + drive + rest;
  }
  return p;
}

function loadRegistry() {
  const registryPath = path.resolve(__dirname, '..', 'game-day-wallets', 'public-registry.json');
  if (!fs.existsSync(registryPath)) return null;
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

function defaultKeypairPath(role) {
  const home = process.env.USERPROFILE || process.env.HOME;
  const dir = process.env.GAME_DAY_WALLET_DIR || path.join(home, 'pepeball-game-day', 'private');
  return path.join(dir, `${role}-keypair.json`);
}

function getExpectedAddress(role, registry) {
  const fromRegistry = registry?.wallets?.[role]?.address;
  if (fromRegistry) return fromRegistry;

  if (role === 'jackpot_tax') {
    return process.env.VITE_TAX_RECIPIENT || process.env.TAX_RECIPIENT_ADDRESS || null;
  }
  return null;
}

async function main() {
  const role = process.argv[2];
  let keypairPath = process.argv[3];

  if (!role) {
    console.error('Usage: node scripts/game-day-verify-wallet.js <role> [path-to-keypair.json]');
    process.exit(1);
  }

  if (!keypairPath) {
    keypairPath = defaultKeypairPath(role);
  } else {
    keypairPath = toReadablePath(keypairPath) || keypairPath;
  }

  if (!path.isAbsolute(keypairPath)) {
    keypairPath = path.resolve(process.cwd(), keypairPath);
  }

  if (!fs.existsSync(keypairPath)) {
    console.error('Keypair not found:', keypairPath);
    process.exit(1);
  }

  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf8')))
  );
  const address = keypair.publicKey.toBase58();
  const registry = loadRegistry();
  const expected = getExpectedAddress(role, registry);

  console.log('');
  console.log('Game-day wallet verification');
  console.log('  Role:           ', role);
  console.log('  Keypair file:   ', keypairPath);
  console.log('  Address:        ', address);
  console.log('  Expected:       ', expected || '(not set in registry/env — set before funding)');
  console.log('  Match expected? ', expected ? (address === expected ? 'YES' : 'NO') : 'N/A');

  const repoRoot = path.resolve(__dirname, '..');
  if (keypairPath.startsWith(repoRoot + path.sep)) {
    console.log('');
    console.warn('WARNING: Keypair is INSIDE the repo. Move to GAME_DAY_WALLET_DIR outside the repo.');
  }

  try {
    const connection = await getRpcConnection();
    const balance = await connection.getBalance(new PublicKey(address));
    console.log('  On-chain SOL:   ', (balance / LAMPORTS_PER_SOL).toFixed(6));
  } catch (e) {
    console.log('  On-chain SOL:    (RPC check failed)', e.message);
  }

  console.log('');
  if (expected && address !== expected) {
    console.error('FAIL — keypair does not match expected address. Do NOT fund until fixed.');
    process.exit(1);
  }
  console.log('OK — pubkey verified. Secret was NOT printed.');
  console.log('Safe to fund ONLY after you have backed up the keypair file yourself.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
