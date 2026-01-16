// Quick balance checker
const { Connection, Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'https://api.devnet.solana.com';

async function checkBalance() {
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    const connection = new Connection(RPC_URL, 'confirmed');
    const balance = await connection.getBalance(adminKeypair.publicKey);
    
    console.log(`\n💰 Wallet Balance Check\n`);
    console.log(`Address: ${adminKeypair.publicKey.toString()}`);
    console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);
    
    if (balance < 35 * 1e9) {
        console.log(`⚠️  Need at least 35 SOL for 100 wallets`);
        console.log(`   Transfer SOL to: ${adminKeypair.publicKey.toString()}\n`);
    } else {
        console.log(`✅ Sufficient balance for speed run!\n`);
    }
}

checkBalance().catch(console.error);
