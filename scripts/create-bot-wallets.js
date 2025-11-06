// Create 10 bot wallets for automated testing
// Run with: node scripts/create-bot-wallets.js

const fs = require('fs');
const path = require('path');
const { Keypair } = require('@solana/web3.js');

const BOTS_DIR = path.join(__dirname, '..', 'bots');
const WALLETS_DIR = path.join(BOTS_DIR, 'wallets');

// Create directories if they don't exist
if (!fs.existsSync(BOTS_DIR)) {
    fs.mkdirSync(BOTS_DIR, { recursive: true });
}
if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
}

console.log('🤖 Creating 10 bot wallets using Solana CLI...\n');

const bots = [];
const addresses = [];

for (let i = 1; i <= 10; i++) {
    const walletFile = path.join(WALLETS_DIR, `bot${i}.json`);
    
    try {
        // Generate keypair using @solana/web3.js
        const keypair = Keypair.generate();
        const secretKey = Array.from(keypair.secretKey);
        const publicKey = keypair.publicKey.toString();
        
        // Save keypair as JSON array (Solana format)
        fs.writeFileSync(walletFile, JSON.stringify(secretKey));
        
        // Save public key for reference
        const addressFile = path.join(WALLETS_DIR, `bot${i}-address.txt`);
        fs.writeFileSync(addressFile, publicKey);
        
        bots.push({
            id: i,
            publicKey,
            walletFile: `bots/wallets/bot${i}.json`
        });
        
        addresses.push(publicKey);
        
        console.log(`✅ Bot ${i}: ${publicKey}`);
    } catch (error) {
        console.error(`❌ Failed to create Bot ${i}:`, error.message);
        // Fallback: create empty entry
        bots.push({
            id: i,
            publicKey: 'FAILED',
            walletFile: `bots/wallets/bot${i}.json`
        });
    }
}

// Save bot registry
const registry = {
    created: new Date().toISOString(),
    network: 'devnet',
    bots: bots,
    addresses: addresses
};

fs.writeFileSync(
    path.join(BOTS_DIR, 'registry.json'),
    JSON.stringify(registry, null, 2)
);

// Create addresses file (one per line for easy copy-paste)
fs.writeFileSync(
    path.join(BOTS_DIR, 'addresses.txt'),
    addresses.join('\n')
);

console.log(`\n✅ Created ${bots.length} bot wallets!`);
console.log(`📁 Wallets saved to: ${WALLETS_DIR}`);
console.log(`📋 Registry saved to: ${path.join(BOTS_DIR, 'registry.json')}`);
console.log(`\n💡 Next: Run 'node scripts/fund-bot-wallets.js' to fund them with devnet SOL`);

