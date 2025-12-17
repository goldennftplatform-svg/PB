// Fund test wallets with SOL
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, sendAndConfirmTransaction, SystemProgram, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');

async function fundTestWallets() {
    console.log('💰 Funding Test Wallets with SOL\n');
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
        console.error('❌ Test wallets not found! Run create-test-wallets.js first');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    const SOL_PER_WALLET = 2; // 2 SOL per wallet
    const totalNeeded = SOL_PER_WALLET * walletsInfo.length;

    console.log(`💰 Funding each wallet with ${SOL_PER_WALLET} SOL`);
    console.log(`   Total needed: ${totalNeeded} SOL\n`);

    // Check admin balance
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin balance: ${(adminBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

    if (adminBalance < totalNeeded * LAMPORTS_PER_SOL) {
        console.log('⚠️  Not enough SOL! Requesting airdrop...\n');
        
        // Request airdrop for admin
        const airdropAmount = Math.max(10, totalNeeded + 5) * LAMPORTS_PER_SOL;
        try {
            console.log('   Requesting airdrop...');
            const sig = await connection.requestAirdrop(
                adminKeypair.publicKey,
                airdropAmount
            );
            console.log(`   Transaction: ${sig}`);
            console.log('   Waiting for confirmation...');
            await connection.confirmTransaction(sig, 'confirmed');
            
            // Wait a bit and check balance
            await new Promise(resolve => setTimeout(resolve, 2000));
            const newBalance = await connection.getBalance(adminKeypair.publicKey);
            console.log(`✅ Airdropped ${(airdropAmount / LAMPORTS_PER_SOL).toFixed(2)} SOL`);
            console.log(`   New balance: ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
        } catch (e) {
            console.error('❌ Airdrop failed:', e.message);
            console.log('   Please manually airdrop SOL to admin wallet\n');
            console.log(`   Run: solana airdrop ${totalNeeded + 5} ${adminKeypair.publicKey.toString()} --url devnet\n`);
        }
    }

    // Fund each wallet
    console.log('📤 Funding wallets...\n');
    
    for (let i = 0; i < walletsInfo.length; i++) {
        const walletInfo = walletsInfo[i];
        const walletPubkey = new PublicKey(walletInfo.publicKey);
        
        try {
            // Check if already funded
            const balance = await connection.getBalance(walletPubkey);
            if (balance >= SOL_PER_WALLET * LAMPORTS_PER_SOL) {
                console.log(`⏭️  Wallet ${walletInfo.id} already funded (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL)`);
                continue;
            }

            // Transfer SOL
            const transferIx = SystemProgram.transfer({
                fromPubkey: adminKeypair.publicKey,
                toPubkey: walletPubkey,
                lamports: SOL_PER_WALLET * LAMPORTS_PER_SOL,
            });

            const tx = new Transaction().add(transferIx);
            const signature = await sendAndConfirmTransaction(
                connection,
                tx,
                [adminKeypair],
                { commitment: 'confirmed' }
            );

            console.log(`✅ Wallet ${walletInfo.id}: Funded ${SOL_PER_WALLET} SOL`);
            console.log(`   ${walletPubkey.toString()}`);
            console.log(`   TX: ${signature}\n`);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error(`❌ Wallet ${walletInfo.id} failed:`, error.message);
        }
    }

    console.log('✅ Funding complete!\n');
}

if (require.main === module) {
    fundTestWallets()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { fundTestWallets };

