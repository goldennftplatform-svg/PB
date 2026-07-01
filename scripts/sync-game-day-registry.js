/**
 * Write public addresses from game-day keypairs → game-day-wallets/public-registry.json
 * Never writes secrets. Run after creating wallets:
 *   node scripts/sync-game-day-registry.js
 */

const fs = require('fs');
const path = require('path');
const { loadKeypair, privateDir } = require('./lib/game-day-wallet');

const REGISTRY_DIR = path.join(__dirname, '..', 'game-day-wallets');
const EXAMPLE = path.join(REGISTRY_DIR, 'public-registry.example.json');
const OUT = path.join(REGISTRY_DIR, 'public-registry.json');

const ROLES = [
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
];

function main() {
  if (!fs.existsSync(EXAMPLE)) {
    console.error('Missing template:', EXAMPLE);
    process.exit(1);
  }

  const registry = JSON.parse(fs.readFileSync(EXAMPLE, 'utf8'));
  registry.createdAt = new Date().toISOString();
  registry.network = process.env.SOLANA_CLUSTER || registry.network || 'mainnet-beta';

  console.log('\nSync game-day public registry');
  console.log('  Key dir:', privateDir());
  console.log('  Output:', OUT);
  console.log('');

  for (const role of ROLES) {
    if (!registry.wallets[role]) continue;
    try {
      const kp = loadKeypair(role);
      registry.wallets[role].address = kp.publicKey.toBase58();
      registry.wallets[role].verifiedAt = new Date().toISOString();
      console.log(`  ✅ ${role}: ${registry.wallets[role].address}`);
    } catch {
      console.log(`  —  ${role}: (no keypair yet)`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(registry, null, 2));
  console.log('\nWrote', OUT);
  console.log('Next: node scripts/game-day-verify-wallet.js <role> for each funded wallet\n');
}

main();
