// Import Admin Wallet from Seed Phrase
// This script imports your seed phrase and sets it up as the admin wallet

const { Keypair } = require('@solana/web3.js');
const { derivePath } = require('ed25519-hd-key');
const { mnemonicToSeedSync } = require('bip39');
const fs = require('fs');
const path = require('path');

const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

// Your seed phrase words
const SEED_PHRASE = [
    'exchange',
    'tired',
    'crush',
    'funny',
    'become',
    'cheap',
    'tumble',
    'bone',
    'seven',
    'wasp',
    'horse',
    'stairs'
];

function importAdminWallet() {
    console.log('\n' + '='.repeat(70));
    console.log('  🔐 IMPORT ADMIN WALLET FROM SEED PHRASE');
    console.log('='.repeat(70) + '\n');

    try {
        // Convert mnemonic to seed
        const seed = mnemonicToSeedSync(SEED_PHRASE.join(' '));
        
        // Derive keypair using Solana's derivation path (m/44'/501'/0'/0')
        const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
        
        // Create keypair from derived seed
        const keypair = Keypair.fromSeed(derivedSeed);
        const address = keypair.publicKey.toString();

        console.log('✅ Seed phrase imported successfully!\n');
        console.log('📋 Wallet Details:');
        console.log('   Address: ' + address);
        console.log('   Expected: ' + EXPECTED_ADMIN_ADDRESS);
        console.log('   Match: ' + (address === EXPECTED_ADMIN_ADDRESS ? '✅ YES' : '❌ NO'));
        console.log('');

        if (address !== EXPECTED_ADMIN_ADDRESS) {
            console.log('⚠️  WARNING: Address does not match expected admin address!');
            console.log('   This might be the wrong seed phrase or derivation path.');
            console.log('   Continuing anyway...\n');
        }

        // Create backup directory
        const backupDir = path.join(__dirname, '..', 'wallet-backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Export keypair in Solana JSON format
        const secretKeyArray = Array.from(keypair.secretKey);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        
        const backupFile = path.join(backupDir, `admin-wallet-imported-${timestamp}.json`);
        const infoFile = path.join(backupDir, `admin-wallet-info-${timestamp}.txt`);

        // Save keypair
        fs.writeFileSync(backupFile, JSON.stringify(secretKeyArray, null, 2));

        // Save info
        const info = [
            'ADMIN WALLET IMPORTED FROM SEED PHRASE',
            '='.repeat(50),
            '',
            'Import Date: ' + new Date().toISOString(),
            'Wallet Address: ' + address,
            'Expected Admin: ' + EXPECTED_ADMIN_ADDRESS,
            'Matches: ' + (address === EXPECTED_ADMIN_ADDRESS ? 'YES ✅' : 'NO ❌'),
            '',
            'Backup File: ' + backupFile,
            'Info File: ' + infoFile,
            '',
            '⚠️  SECURITY:',
            '  - Keep these files SECURE and PRIVATE',
            '  - Never share or commit to git',
            '  - Store in password manager or encrypted storage',
            '',
            'To use this wallet:',
            '  1. Copy the JSON file to: ~/.config/solana/id.json',
            '  2. Or set: ANCHOR_WALLET=/path/to/admin-wallet-imported-*.json',
            '',
            'To verify:',
            '  solana address',
            '  Should show: ' + address
        ].join('\n');

        fs.writeFileSync(infoFile, info);

        // Also create a copy in the default location (with backup of existing)
        const defaultWalletPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        const defaultWalletDir = path.dirname(defaultWalletPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(defaultWalletDir)) {
            fs.mkdirSync(defaultWalletDir, { recursive: true });
        }

        // Backup existing wallet if it exists
        if (fs.existsSync(defaultWalletPath)) {
            const existingBackup = path.join(backupDir, `old-wallet-backup-${timestamp}.json`);
            fs.copyFileSync(defaultWalletPath, existingBackup);
            console.log('📦 Backed up existing wallet to: ' + existingBackup);
        }

        // Copy new admin wallet to default location
        fs.copyFileSync(backupFile, defaultWalletPath);
        console.log('✅ Admin wallet set as default wallet!');
        console.log('   Location: ' + defaultWalletPath);
        console.log('');

        console.log('📁 Files Created:');
        console.log('   Admin Wallet: ' + backupFile);
        console.log('   Info File:    ' + infoFile);
        console.log('   Default Wallet: ' + defaultWalletPath);
        console.log('');

        console.log('✅ Setup Complete!');
        console.log('');
        console.log('💡 Next Steps:');
        console.log('   1. Verify: solana address (should show: ' + address + ')');
        console.log('   2. Get devnet SOL: solana airdrop 2');
        console.log('   3. Run scripts: node scripts/check-lottery-status.js');
        console.log('');

    } catch (error) {
        console.error('❌ Error importing wallet:', error.message);
        console.error('');
        console.error('💡 Make sure you have the required packages:');
        console.error('   npm install bip39 ed25519-hd-key');
        process.exit(1);
    }
}

importAdminWallet();

