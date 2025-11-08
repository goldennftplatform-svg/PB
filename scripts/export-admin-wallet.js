// Safe Admin Wallet Export Script
// This script helps you export your admin wallet safely

const { Keypair, PublicKey } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise(resolve => rl.question(prompt, resolve));
}

async function exportAdminWallet() {
    console.log('\n' + '='.repeat(70));
    console.log('  🔐 SAFE ADMIN WALLET EXPORT');
    console.log('='.repeat(70) + '\n');

    console.log('⚠️  SECURITY WARNING:');
    console.log('   - Private keys are SENSITIVE information');
    console.log('   - Never share them with anyone');
    console.log('   - Store backups securely (password manager, encrypted file)');
    console.log('   - This export is for backup purposes only\n');

    // Check default location
    const defaultPath = path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    console.log('📁 Checking default wallet location...');
    console.log('   Path: ' + defaultPath);
    
    let walletPath = defaultPath;
    let keypair;
    let found = false;

    if (fs.existsSync(defaultPath)) {
        try {
            const secretKey = JSON.parse(fs.readFileSync(defaultPath, 'utf8'));
            keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
            const address = keypair.publicKey.toString();
            
            console.log('   ✅ Wallet file found');
            console.log('   Address: ' + address);
            
            if (address === EXPECTED_ADMIN_ADDRESS) {
                console.log('   ✅ MATCHES admin address!\n');
                found = true;
            } else {
                console.log('   ⚠️  Does NOT match admin address');
                console.log('   Expected: ' + EXPECTED_ADMIN_ADDRESS);
                console.log('   Found:    ' + address + '\n');
            }
        } catch (error) {
            console.log('   ❌ Error reading wallet file: ' + error.message + '\n');
        }
    } else {
        console.log('   ❌ Wallet file not found\n');
    }

    // If not found, ask for custom path
    if (!found) {
        console.log('💡 The admin wallet might be in a different location.');
        const useCustom = await question('   Enter custom wallet file path (or press Enter to skip): ');
        
        if (useCustom && useCustom.trim()) {
            walletPath = useCustom.trim();
            if (fs.existsSync(walletPath)) {
                try {
                    const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
                    keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
                    const address = keypair.publicKey.toString();
                    
                    if (address === EXPECTED_ADMIN_ADDRESS) {
                        console.log('   ✅ Found admin wallet!\n');
                        found = true;
                    } else {
                        console.log('   ⚠️  This wallet does not match admin address\n');
                    }
                } catch (error) {
                    console.log('   ❌ Error reading file: ' + error.message + '\n');
                }
            } else {
                console.log('   ❌ File not found\n');
            }
        }
    }

    // If still not found, offer to create it
    if (!found) {
        console.log('❌ Admin wallet not found.');
        console.log('\n💡 Options:');
        console.log('   1. The admin wallet might need to be created');
        console.log('   2. Or you need to import it from another location');
        console.log('   3. Or set ANCHOR_WALLET environment variable\n');
        
        const createNew = await question('   Would you like to create a NEW admin wallet? (yes/no): ');
        
        if (createNew.toLowerCase() === 'yes' || createNew.toLowerCase() === 'y') {
            console.log('\n   ⚠️  WARNING: Creating a new wallet will generate a NEW address!');
            console.log('   This will NOT match the expected admin address.');
            console.log('   You would need to update the frontend whitelist.\n');
            
            const confirm = await question('   Continue anyway? (yes/no): ');
            if (confirm.toLowerCase() === 'yes' || confirm.toLowerCase() === 'y') {
                keypair = Keypair.generate();
                console.log('\n   ✅ New wallet created!');
                console.log('   Address: ' + keypair.publicKey.toString());
                console.log('   ⚠️  This does NOT match the expected admin address!\n');
            } else {
                console.log('\n   ❌ Cancelled.\n');
                rl.close();
                return;
            }
        } else {
            console.log('\n   Please locate your admin wallet file and try again.\n');
            rl.close();
            return;
        }
    }

    // Export the wallet
    if (keypair) {
        const exportDir = path.join(__dirname, '..', 'wallet-backups');
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const exportFile = path.join(exportDir, `admin-wallet-backup-${timestamp}.json`);
        
        // Export in Solana JSON format (array of numbers)
        const secretKeyArray = Array.from(keypair.secretKey);
        fs.writeFileSync(exportFile, JSON.stringify(secretKeyArray, null, 2));

        // Also create a human-readable info file
        const infoFile = path.join(exportDir, `admin-wallet-info-${timestamp}.txt`);
        const info = [
            'ADMIN WALLET BACKUP INFORMATION',
            '='.repeat(50),
            '',
            'Export Date: ' + new Date().toISOString(),
            'Wallet Address: ' + keypair.publicKey.toString(),
            'Expected Admin: ' + EXPECTED_ADMIN_ADDRESS,
            'Matches: ' + (keypair.publicKey.toString() === EXPECTED_ADMIN_ADDRESS ? 'YES ✅' : 'NO ❌'),
            '',
            'File Locations:',
            '  Keypair: ' + exportFile,
            '  Info:    ' + infoFile,
            '',
            '⚠️  SECURITY WARNINGS:',
            '  - Keep this file SECURE and PRIVATE',
            '  - Never share or commit to git',
            '  - Store in password manager or encrypted',
            '  - Delete this file after secure backup',
            '',
            'To restore this wallet:',
            '  1. Copy the JSON file to: ~/.config/solana/id.json',
            '  2. Or set: ANCHOR_WALLET=/path/to/backup.json',
            '',
            'To verify the wallet:',
            '  solana address',
            '  Should show: ' + keypair.publicKey.toString()
        ].join('\n');
        
        fs.writeFileSync(infoFile, info);

        console.log('✅ Wallet exported successfully!\n');
        console.log('📁 Export Location:');
        console.log('   Keypair: ' + exportFile);
        console.log('   Info:    ' + infoFile);
        console.log('');
        console.log('📋 Wallet Information:');
        console.log('   Address: ' + keypair.publicKey.toString());
        console.log('   Matches Admin: ' + (keypair.publicKey.toString() === EXPECTED_ADMIN_ADDRESS ? '✅ YES' : '❌ NO'));
        console.log('');
        console.log('🔒 SECURITY REMINDER:');
        console.log('   - These files contain your PRIVATE KEY');
        console.log('   - Store them securely (password manager, encrypted)');
        console.log('   - Delete after secure backup');
        console.log('   - Never share or commit to git');
        console.log('');
    }

    rl.close();
}

if (require.main === module) {
    exportAdminWallet().catch(error => {
        console.error('❌ Error:', error.message);
        process.exit(1);
    });
}

module.exports = { exportAdminWallet };

