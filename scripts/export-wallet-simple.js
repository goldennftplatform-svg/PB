// Simple Wallet Export - Exports current wallet safely
const { Keypair } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const EXPECTED_ADMIN_ADDRESS = 'Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ';

function exportWallet() {
    console.log('\n🔐 Exporting Wallet...\n');

    // Get wallet path
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');

    if (!fs.existsSync(walletPath)) {
        console.error('❌ Wallet file not found at: ' + walletPath);
        console.error('\n💡 Make sure your wallet file exists, or set ANCHOR_WALLET environment variable.');
        process.exit(1);
    }

    // Read and export
    try {
        const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        const address = keypair.publicKey.toString();

        // Create backup directory
        const backupDir = path.join(__dirname, '..', 'wallet-backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        // Export files
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const backupFile = path.join(backupDir, `wallet-backup-${timestamp}.json`);
        const infoFile = path.join(backupDir, `wallet-info-${timestamp}.txt`);

        // Save keypair
        fs.writeFileSync(backupFile, JSON.stringify(secretKey, null, 2));

        // Save info
        const info = [
            'WALLET BACKUP INFORMATION',
            '='.repeat(50),
            '',
            'Export Date: ' + new Date().toISOString(),
            'Wallet Address: ' + address,
            'Expected Admin: ' + EXPECTED_ADMIN_ADDRESS,
            'Is Admin Wallet: ' + (address === EXPECTED_ADMIN_ADDRESS ? 'YES ✅' : 'NO ❌'),
            '',
            'Backup File: ' + backupFile,
            'Info File: ' + infoFile,
            '',
            '⚠️  SECURITY:',
            '  - Keep these files SECURE and PRIVATE',
            '  - Never share or commit to git',
            '  - Store in password manager or encrypted storage',
            '  - Delete after secure backup',
            '',
            'To restore:',
            '  Copy ' + path.basename(backupFile) + ' to ~/.config/solana/id.json',
            '',
            'To verify:',
            '  solana address'
        ].join('\n');

        fs.writeFileSync(infoFile, info);

        console.log('✅ Wallet exported successfully!\n');
        console.log('📁 Files created:');
        console.log('   Backup: ' + backupFile);
        console.log('   Info:   ' + infoFile);
        console.log('');
        console.log('📋 Wallet Details:');
        console.log('   Address: ' + address);
        console.log('   Is Admin: ' + (address === EXPECTED_ADMIN_ADDRESS ? '✅ YES' : '❌ NO'));
        console.log('');
        console.log('🔒 IMPORTANT:');
        console.log('   - These files contain your PRIVATE KEY');
        console.log('   - Store them securely');
        console.log('   - Delete after backup');
        console.log('');

    } catch (error) {
        console.error('❌ Error exporting wallet:', error.message);
        process.exit(1);
    }
}

exportWallet();

