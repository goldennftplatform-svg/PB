/**
 * Devnet proof status — trio mints + program deployment check.
 * Run: node scripts/devnet-proof-status.js
 */

const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');

const TRIO_FILE = path.join(__dirname, '..', 'devnet', 'trio-mints.json');
const LP_POOLS_FILE = path.join(__dirname, '..', 'devnet', 'lp-pools.json');

const PROGRAMS = {
      game_registry: 'CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR',
  lottery: '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7',
  pepball_token: 'HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR',
  tax_harvest: 'Em261K95h8M48f52iuu5YSaTJXJTs1pqjZpRCPYFqXRx',
  lp_manager: 'G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG',
};

async function checkProgram(connection, name, id) {
  try {
    const pk = new PublicKey(id);
    const info = await connection.getAccountInfo(pk);
    const ok = info?.executable === true;
    return { name, id, ok, dataLen: info?.data?.length ?? 0, skipped: false };
  } catch (e) {
    return { name, id, ok: false, dataLen: 0, skipped: true, error: e.message };
  }
}

async function main() {
  const rpc = process.env.RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpc, 'confirmed');

  console.log('\n═══ PEPEBALL devnet proof status ═══\n');
  console.log('RPC:', rpc);
  console.log('Rules: ODD = payout · EVEN = rollover\n');

  if (fs.existsSync(TRIO_FILE)) {
    const trio = JSON.parse(fs.readFileSync(TRIO_FILE, 'utf8'));
    console.log('Trio mints (sim Pump + TRiX + master):');
    for (const [k, v] of Object.entries(trio.mints)) {
      console.log(`  ${k}: ${v}`);
      console.log(`    https://solscan.io/token/${v}?cluster=devnet`);
    }
    console.log('');
  } else {
    console.log('⚠️  No trio mints yet. Run: node scripts/create-devnet-trio-mints.js\n');
  }

  console.log('Programs:');
  let allDeployed = true;
  for (const [name, id] of Object.entries(PROGRAMS)) {
    const r = await checkProgram(connection, name, id);
    if (r.skipped) {
      console.log(`  ⚠️  ${name}: invalid placeholder ID — deploy will assign real program id`);
    } else {
      console.log(`  ${r.ok ? '✅' : '❌'} ${name}: ${id}${r.ok ? '' : ' (not deployed — anchor deploy)'}`);
    }
    if (!r.ok && !r.skipped) allDeployed = false;
  }

  console.log('\nEligibility math: node scripts/verify-combined-eligibility.js');
  console.log('\nDeploy programs (WSL/Linux recommended):');
  console.log('  anchor build');
  console.log('  anchor deploy --program-name game_registry --provider.cluster devnet');
  console.log('  anchor deploy --program-name tax_harvest --provider.cluster devnet');
  console.log('\nRegistry init:');
  console.log('  node scripts/initialize-game-registry-devnet.js');
  console.log('\nLP pools:');
  if (fs.existsSync(LP_POOLS_FILE)) {
    const lp = JSON.parse(fs.readFileSync(LP_POOLS_FILE, 'utf8'));
    for (const [key, p] of Object.entries(lp.pools ?? {})) {
      console.log(`  ✅ ${p.pair ?? key}: ${p.orca_whirlpool}`);
      console.log(`     https://solscan.io/account/${p.orca_whirlpool}?cluster=devnet`);
    }
    console.log('\n  Create more: node scripts/devnet-create-orca-pools.js');
  } else {
    console.log('  ⚠️  No devnet/lp-pools.json — run: node scripts/devnet-create-orca-pools.js');
    console.log('  Plan: docs/LIQUIDITY_PAIRING_PLAN.md');
  }
  console.log('');

  if (allDeployed && fs.existsSync(TRIO_FILE)) {
    console.log('✅ Ready for initialize-game-registry-devnet.js + optional seal.\n');
  } else {
    console.log('Next: fund deployer SOL → anchor deploy missing programs → registry init.\n');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
