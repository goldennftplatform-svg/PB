const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

function privateDir() {
  return (
    process.env.GAME_DAY_WALLET_DIR ||
    path.join(process.env.USERPROFILE || process.env.HOME, 'pepeball-game-day', 'private')
  );
}

function loadKeypair(role) {
  const walletPath = path.join(privateDir(), `${role}-keypair.json`);
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Missing ${role} wallet: ${walletPath}\nRun: node scripts/game-day-create-wallet.js ${role}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8'))));
}

module.exports = { loadKeypair, privateDir };
