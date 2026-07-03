/**
 * Create 4 devnet SPL mints to simulate master + Pump + TRiX trio proof.
 * Saves public addresses to devnet/trio-mints.json (gitignored).
 *
 * Prerequisites:
 *   - solana config set --url devnet
 *   - solana airdrop 2 (if needed)
 *   - ANCHOR_WALLET or default ~/.config/solana/id.json
 *
 * Run: node scripts/create-devnet-trio-mints.js
 */

const fs = require('fs');
const path = require('path');
const { Keypair, Connection, clusterApiUrl } = require('@solana/web3.js');
const { createMint } = require('@solana/spl-token');

const DECIMALS = 6;
const OUT_DIR = path.join(__dirname, '..', 'devnet');
const OUT_FILE = path.join(OUT_DIR, 'trio-mints.json');

function loadPayer() {
  const kpPath =
    process.env.ANCHOR_WALLET ||
    process.env.SOLANA_KEYPAIR ||
    path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'solana', 'id.json');
  if (!fs.existsSync(kpPath)) {
    console.error('Payer keypair not found:', kpPath);
    console.error('Set ANCHOR_WALLET to your devnet keypair path.');
    process.exit(1);
  }
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(kpPath, 'utf8')));
  return Keypair.fromSecretKey(secret);
}

async function main() {
  const rpc = process.env.RPC_URL || clusterApiUrl('devnet');
  const connection = new Connection(rpc, 'confirmed');
  const payer = loadPayer();

  const balance = await connection.getBalance(payer.publicKey);
  console.log('Payer:', payer.publicKey.toBase58());
  console.log('Balance:', (balance / 1e9).toFixed(4), 'SOL');
  if (balance < 0.05 * 1e9) {
    console.error('Need devnet SOL. Run: solana airdrop 2');
    process.exit(1);
  }

  if (fs.existsSync(OUT_FILE)) {
    const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    console.log('\nAlready exists:', OUT_FILE);
    console.log(JSON.stringify(existing.mints, null, 2));
    console.log('\nDelete devnet/trio-mints.json to recreate mints.');
    return;
  }

  console.log('\nCreating 4 devnet mints (6 decimals)...\n');

  const roles = [
    ['master', 'Sim PEPEBALL master (1B taxed token stand-in)'],
    ['pump_shell', 'Sim pump.fun Yang shell'],
    ['trix_yang', 'Sim trix.market Yang'],
    ['trix_bridge', 'Sim trix.market bridge'],
  ];

  const mints = {};
  for (const [role, desc] of roles) {
    const mint = await createMint(connection, payer, payer.publicKey, payer.publicKey, DECIMALS);
    mints[role] = mint.toBase58();
    console.log(`  ${role}: ${mints[role]}`);
    console.log(`    ${desc}`);
  }

  const manifest = {
    network: 'devnet',
    createdAt: new Date().toISOString(),
    payer: payer.publicKey.toBase58(),
    decimals: DECIMALS,
    mints: {
      master_mint: mints.master,
      pump_shell_mint: mints.pump_shell,
      trix_yang_mint: mints.trix_yang,
      trix_yin_mint: mints.master,
      trix_bridge_mint: mints.trix_bridge,
    },
    register_mints_order: [
      'master_mint',
      'pump_shell_mint',
      'trix_yang_mint',
      'trix_yin_mint (= master)',
      'trix_bridge_mint',
    ],
    programs: {
      game_registry: 'CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR',
      lottery: '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7',
      pepball_token: 'HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR',
      tax_harvest: 'Em261K95h8M48f52iuu5YSaTJXJTs1pqjZpRCPYFqXRx',
      lp_manager: 'G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG',
    },
    nextSteps: [
      'anchor build && anchor deploy --provider.cluster devnet',
      'Initialize game-registry with register_mints using addresses above',
      'seal_registry on devnet test only when ready',
      'node scripts/devnet-proof-status.js',
    ],
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\nSaved:', OUT_FILE);
  console.log('\nExplorer (master):', `https://solscan.io/token/${mints.master}?cluster=devnet`);
  console.log('\nFund programs next: anchor deploy --provider.cluster devnet\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
