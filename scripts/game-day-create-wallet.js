/**
 * Create a game-day wallet keypair OUTSIDE the git repo (default).
 *
 * Usage:
 *   node scripts/game-day-create-wallet.js jackpot_tax
 *   node scripts/game-day-create-wallet.js admin --update-registry
 *   node scripts/game-day-create-wallet.js deployer --dry-run
 *
 * Roles (SEC OP): cold_master | deployer | jackpot_tax | admin | fee_consolidation |
 *   floor_buy_ops | lp_ops | trix_launch_yang | trix_launch_yin | trix_launch_bridge
 *
 * Output (default): %USERPROFILE%/pepeball-game-day/private/<role>-keypair.json
 * Override: set GAME_DAY_WALLET_DIR=C:\secure\pepeball-private
 *
 * NEVER commits keypairs. Repo only gets public addresses via optional registry update.
 */

const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const VALID_ROLES = new Set([
  'cold_master',
  'deployer',
  'jackpot_tax',
  'admin',
  'fee_consolidation',
  'floor_buy_ops',
  'lp_ops',
  'trix_launch_yang',
  'trix_launch_yin',
  'trix_launch_bridge',
  // legacy aliases
  'pump_shell_treasury',
  'pepeball_core_treasury',
]);

const DRY_RUN = process.argv.includes('--dry-run');
const UPDATE_REGISTRY = process.argv.includes('--update-registry');

function getRole() {
  const role = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
  if (!role || !VALID_ROLES.has(role)) {
    console.error('Usage: node scripts/game-day-create-wallet.js <role> [--update-registry] [--dry-run]');
    console.error('Roles:', [...VALID_ROLES].join(', '));
    process.exit(1);
  }
  return role;
}

function getPrivateDir() {
  if (process.env.GAME_DAY_WALLET_DIR) {
    return path.resolve(process.env.GAME_DAY_WALLET_DIR);
  }
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    console.error('Set GAME_DAY_WALLET_DIR to a folder OUTSIDE the repo.');
    process.exit(1);
  }
  return path.join(home, 'pepeball-game-day', 'private');
}

function saveKeypair(keypair, filePath) {
  const arr = Array.from(keypair.secretKey);
  fs.writeFileSync(filePath, JSON.stringify(arr), 'utf8');
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* Windows may not support chmod */
  }
}

function updatePublicRegistry(role, address) {
  const registryPath = path.resolve(__dirname, '..', 'game-day-wallets', 'public-registry.json');
  const examplePath = path.resolve(__dirname, '..', 'game-day-wallets', 'public-registry.example.json');

  if (!fs.existsSync(registryPath)) {
    if (!fs.existsSync(examplePath)) {
      console.warn('No public-registry.json — copy game-day-wallets/public-registry.example.json first.');
      return;
    }
    fs.copyFileSync(examplePath, registryPath);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (!registry.wallets?.[role]) {
    console.warn(`Role "${role}" not in registry template — add address manually:`, address);
    return;
  }
  registry.wallets[role].address = address;
  registry.wallets[role].verifiedAt = null;
  registry.wallets[role].funded = false;
  registry.createdAt = registry.createdAt || new Date().toISOString();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
  console.log('Updated game-day-wallets/public-registry.json (address only, file is gitignored).');
}

function main() {
  const role = getRole();
  const privateDir = getPrivateDir();
  const outPath = path.join(privateDir, `${role}-keypair.json`);

  const repoRoot = path.resolve(__dirname, '..');
  if (outPath.startsWith(repoRoot + path.sep) || outPath === repoRoot) {
    console.error('Refusing to write keypair inside repo:', outPath);
    console.error('Set GAME_DAY_WALLET_DIR to a path outside', repoRoot);
    process.exit(1);
  }

  if (fs.existsSync(outPath)) {
    console.error('Keypair already exists:', outPath);
    console.error('Delete or rename it first, or pick a different GAME_DAY_WALLET_DIR.');
    process.exit(1);
  }

  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();

  console.log('');
  console.log('PEPEBALL game-day wallet');
  console.log('  Role:    ', role);
  console.log('  Address: ', address);
  console.log('  Output:  ', outPath);
  console.log('');

  if (DRY_RUN) {
    console.log('[DRY-RUN] No files written.');
    console.log('Next: run without --dry-run, then:');
    console.log('  node scripts/game-day-verify-wallet.js', role, outPath);
    return;
  }

  fs.mkdirSync(privateDir, { recursive: true });
  saveKeypair(keypair, outPath);

  console.log('Keypair saved OUTSIDE repo.');
  console.log('');
  console.log('BEFORE funding — you MUST:');
  console.log('  1. Back up', outPath, 'to YOUR secure storage (Phantom import, vault, etc.)');
  console.log('  2. Verify: node scripts/game-day-verify-wallet.js', role, outPath);
  console.log('  3. Set Vercel/env to this PUBLIC address only');
  console.log('  4. Never commit the .json keypair file');
  console.log('');

  if (UPDATE_REGISTRY) {
    updatePublicRegistry(role, address);
  } else {
    console.log('Optional: re-run with --update-registry to write address to local public-registry.json');
  }
}

main();
