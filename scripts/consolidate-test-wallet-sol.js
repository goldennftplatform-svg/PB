// Scan test wallets and consolidate SOL to admin wallet
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, sendAndConfirmTransaction, SystemProgram, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');
const MIN_RESERVE = 0.01 * LAMPORTS_PER_SOL; // Keep 0.01 SOL for fees

async function consolidateTestWalletSol() {
    console.log('💰 Consolidating Test Wallet SOL\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}\n`);

    // Load test wallets
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found!');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    // Scan all wallets and get balances
    console.log('🔍 Scanning wallet balances...\n');
    const walletBalances = [];
    let totalAvailable = 0;

    for (const walletInfo of walletsInfo) {
        try {
            // Load wallet keypair
            const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
            const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
            
            const balance = await connection.getBalance(walletKeypair.publicKey);
            const available = Math.max(0, balance - MIN_RESERVE);
            
            walletBalances.push({
                id: walletInfo.id,
                publicKey: walletKeypair.publicKey.toString(),
                balance: balance / LAMPORTS_PER_SOL,
                available: available / LAMPORTS_PER_SOL,
                keypair: walletKeypair
            });

            totalAvailable += available;

            if (available > 0) {
                console.log(`   Wallet ${walletInfo.id}: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL (${(available / LAMPORTS_PER_SOL).toFixed(4)} available)`);
            }
        } catch (error) {
            console.error(`   ❌ Error loading wallet ${walletInfo.id}: ${error.message}`);
        }
    }

    console.log(`\n💰 Total available: ${(totalAvailable / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

    if (totalAvailable === 0) {
        console.log('⚠️  No SOL available to consolidate!\n');
        return;
    }

    // Transfer SOL from each wallet to admin
    console.log('💸 Transferring SOL to admin wallet...\n');
    let totalTransferred = 0;
    let successCount = 0;
    let failCount = 0;

    for (const wallet of walletBalances) {
        if (wallet.available <= 0) {
            continue; // Skip wallets with no available SOL
        }

        try {
            const transferAmount = wallet.available * LAMPORTS_PER_SOL;
            
            const transaction = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: wallet.keypair.publicKey,
                    toPubkey: adminKeypair.publicKey,
                    lamports: transferAmount,
                })
            );

            const signature = await sendAndConfirmTransaction(
                connection,
                transaction,
                [wallet.keypair],
                { commitment: 'confirmed' }
            );

            totalTransferred += transferAmount;
            successCount++;
            console.log(`   ✅ Wallet ${wallet.id}: Transferred ${(transferAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
            console.log(`      Signature: ${signature.substring(0, 20)}...`);

        } catch (error) {
            failCount++;
            console.error(`   ❌ Wallet ${wallet.id}: Transfer failed - ${error.message}`);
        }
    }

    // Check final admin balance
    const finalBalance = await connection.getBalance(adminKeypair.publicKey);
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 SUMMARY:');
    console.log(`   Wallets scanned: ${walletBalances.length}`);
    console.log(`   Successful transfers: ${successCount}`);
    console.log(`   Failed transfers: ${failCount}`);
    console.log(`   Total transferred: ${(totalTransferred / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log(`   Admin balance: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
    console.log('='.repeat(70) + '\n');
}

if (require.main === module) {
    consolidateTestWalletSol()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { consolidateTestWalletSol };

