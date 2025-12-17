// Simulate 2 million in revenue by having test wallets enter lottery
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID, getMint } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');

// Program IDs
const TOKEN_MINT = new PublicKey('CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

// Target revenue: $2,000,000
// If token price = $0.0001, need 20 billion tokens worth of entries
// But we'll simulate with USD values directly
const TARGET_REVENUE_USD = 2_000_000; // $2M
const ENTRY_SIZE_USD = 100; // $100 per entry (to reach $2M, need 20,000 entries)
const ENTRIES_PER_WALLET = 800; // 800 entries per wallet = $80,000 per wallet

async function simulateRevenue() {
    console.log('💰 Simulating $2M Revenue\n');
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

    // Setup Anchor
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    const lotteryProgram = anchor.workspace.Lottery;
    if (!lotteryProgram) {
        console.error('❌ Lottery program not found! Run: anchor build');
        process.exit(1);
    }

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`✅ Target Revenue: $${TARGET_REVENUE_USD.toLocaleString()}\n`);

    // Load test wallets
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found! Run create-test-wallets.js first');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    // Calculate entries needed
    // FIXED: Lottery now aggregates by wallet, so wallets can enter multiple times
    // Each entry is $100, need 20,000 entries to reach $2M
    const totalEntriesNeeded = Math.ceil(TARGET_REVENUE_USD / ENTRY_SIZE_USD);
    const entriesPerWallet = Math.ceil(totalEntriesNeeded / walletsInfo.length);
    
    console.log(`📊 Simulation Plan:`);
    console.log(`   Target Revenue: $${TARGET_REVENUE_USD.toLocaleString()}`);
    console.log(`   Entry Size: $${ENTRY_SIZE_USD}`);
    console.log(`   Total Entries Needed: ${totalEntriesNeeded.toLocaleString()}`);
    console.log(`   Wallets: ${walletsInfo.length}`);
    console.log(`   Entries per Wallet: ${entriesPerWallet}`);
    console.log(`   ✅ Lottery now aggregates entries by wallet (unlimited participants!)\n`);

    let totalRevenue = 0;
    let successfulEntries = 0;

    // Each wallet enters multiple times - program will aggregate by wallet
    for (let i = 0; i < walletsInfo.length; i++) {
        const walletInfo = walletsInfo[i];
        const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
        const walletKeypair = Keypair.fromSecretKey(
            Uint8Array.from(walletData.secretKey)
        );

        console.log(`\n👤 Wallet ${walletInfo.id}: ${walletKeypair.publicKey.toString()}`);

        // Enter lottery multiple times (program aggregates by wallet)
        for (let entry = 0; entry < entriesPerWallet; entry++) {
            try {
                const usdValueCents = ENTRY_SIZE_USD * 100; // Convert to cents

                const tx = await lotteryProgram.methods
                    .enterLotteryWithUsdValue(new anchor.BN(usdValueCents))
                    .accounts({
                        lottery: lotteryPDA,
                        participant: walletKeypair.publicKey,
                    })
                    .signers([walletKeypair])
                    .rpc();

                totalRevenue += ENTRY_SIZE_USD;
                successfulEntries++;

                if ((entry + 1) % 100 === 0 || entry === entriesPerWallet - 1) {
                    console.log(`   ✅ Entry ${entry + 1}/${entriesPerWallet} (Total: $${totalRevenue.toLocaleString()})`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                console.error(`   ❌ Entry ${entry + 1} failed:`, error.message);
                // Continue with next entry
            }
        }

        console.log(`   ✅ Wallet ${walletInfo.id} complete: ${entriesPerWallet} entries`);
    }

    console.log(`\n✅ Simulation Complete!`);
    console.log(`   Total Entries: ${successfulEntries.toLocaleString()}`);
    console.log(`   Total Revenue: $${totalRevenue.toLocaleString()}`);
    console.log(`   Target: $${TARGET_REVENUE_USD.toLocaleString()}\n`);

    // Fetch lottery state
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`📊 Lottery State:`);
        console.log(`   Participants: ${lottery.totalParticipants.toNumber().toLocaleString()}`);
        console.log(`   Active Participants: ${lottery.participants.length}`);
        console.log(`   Jackpot: ${(lottery.jackpotAmount.toNumber() / 1e9).toFixed(4)} SOL\n`);
    } catch (e) {
        console.log('   (Could not fetch lottery state)\n');
    }

    console.log('✅ Ready for payout!\n');
}

if (require.main === module) {
    simulateRevenue()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { simulateRevenue };

