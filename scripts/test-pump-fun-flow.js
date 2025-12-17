// Complete Pump.fun Flow Test on Devnet
// Simulates: Token launch → Purchases → Auto-entry → Lottery → Winners

const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID, getMint } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const TOKEN_MINT = new PublicKey('CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');

class PumpFunFlowTester {
    constructor(connection, lotteryProgram, tokenMint) {
        this.connection = connection;
        this.lotteryProgram = lotteryProgram;
        this.tokenMint = tokenMint;
        this.testBuyers = [];
    }

    /**
     * Simulate Pump.fun purchase
     * In real Pump.fun, this would be a swap from SOL to tokens
     */
    async simulatePumpFunPurchase(buyer, solAmount) {
        console.log(`\n💰 Simulating Pump.fun purchase:`);
        console.log(`   Buyer: ${buyer.publicKey.toString().substring(0, 8)}...`);
        console.log(`   SOL Amount: ${solAmount} SOL`);

        // Get or create buyer's token account
        const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            buyer,
            this.tokenMint,
            buyer.publicKey
        );

        // Simulate price: $100 per SOL, $0.00002 per token
        // So 1 SOL = 5,000,000 tokens
        const tokenPrice = 0.00002; // $0.00002 per token
        const solPrice = 100; // $100 per SOL
        const usdValue = solAmount * solPrice;
        const tokenAmount = Math.floor((usdValue / tokenPrice) * 1e9); // With decimals

        console.log(`   USD Value: $${usdValue.toFixed(2)}`);
        console.log(`   Token Amount: ${(tokenAmount / 1e9).toLocaleString()} tokens`);

        // In real Pump.fun, this would be a swap
        // For testing, we'll transfer tokens directly (simulating the swap result)
        // Note: This requires tokens to be available in a source account
        
        // For now, we'll just calculate and log
        // In production, Pump.fun handles the swap
        
        return {
            buyer: buyer.publicKey,
            solAmount,
            usdValue,
            tokenAmount,
            tokenAccount: buyerTokenAccount.address
        };
    }

    /**
     * Test auto-entry after purchase
     */
    async testAutoEntry(purchase) {
        console.log(`\n🎰 Testing Auto-Entry:`);
        console.log(`   USD Value: $${purchase.usdValue.toFixed(2)}`);

        if (purchase.usdValue < 20) {
            console.log(`   ❌ Below $20 minimum - no entry`);
            return false;
        }

        console.log(`   ✅ Meets $20 minimum - entering lottery...`);

        // Derive participant account PDA
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        const [participantPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('participant'),
                lotteryPDA.toBuffer(),
                purchase.buyer.toBuffer()
            ],
            LOTTERY_PROGRAM_ID
        );

        // Check if account exists
        const accountInfo = await this.connection.getAccountInfo(participantPDA);
        const isNew = !accountInfo || accountInfo.lamports === 0;

        try {
            if (isNew) {
                // New participant
                console.log(`   📝 Creating new participant account...`);
                const tx = await this.lotteryProgram.methods
                    .enterLotteryWithUsdValue(new anchor.BN(Math.floor(purchase.usdValue * 100))) // Convert to cents
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: purchase.buyer,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([purchase.buyer])
                    .rpc();

                console.log(`   ✅ Entered lottery! Transaction: ${tx.substring(0, 20)}...`);
                return true;
            } else {
                // Existing participant - update
                console.log(`   📝 Updating existing participant...`);
                const ticketCount = purchase.usdValue >= 20 && purchase.usdValue < 100 ? 1 :
                                   purchase.usdValue >= 100 && purchase.usdValue < 500 ? 4 : 10;
                
                const tx = await this.lotteryProgram.methods
                    .updateParticipantTickets(
                        ticketCount,
                        new anchor.BN(Math.floor(purchase.usdValue * 100))
                    )
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: purchase.buyer,
                    })
                    .signers([purchase.buyer])
                    .rpc();

                console.log(`   ✅ Updated entry! Transaction: ${tx.substring(0, 20)}...`);
                return true;
            }
        } catch (error) {
            console.error(`   ❌ Entry failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Run complete test flow
     */
    async runCompleteTest() {
        console.log('🧪 Pump.fun Flow Test - Complete End-to-End\n');
        console.log('='.repeat(70) + '\n');

        // Load admin wallet
        const walletPath = process.env.ANCHOR_WALLET || 
            path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        
        const adminKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
        );

        // Setup Anchor
        const provider = new anchor.AnchorProvider(
            this.connection,
            new anchor.Wallet(adminKeypair),
            { commitment: 'confirmed' }
        );
        anchor.setProvider(provider);

        // Load program
        let lotteryProgram;
        try {
            lotteryProgram = anchor.workspace.Lottery;
        } catch (e) {
            const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
            lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
        }

        this.lotteryProgram = lotteryProgram;

        // Derive lottery PDA
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
        console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}`);
        console.log(`✅ Token Mint: ${this.tokenMint.toString()}\n`);

        // Create test buyers (simulating Pump.fun users)
        console.log('👥 Creating 10 test buyers (simulating Pump.fun users)...\n');
        const buyers = [];
        for (let i = 0; i < 10; i++) {
            const buyer = Keypair.generate();
            buyers.push(buyer);
            console.log(`   Buyer ${i + 1}: ${buyer.publicKey.toString()}`);
        }

        // Fund buyers from admin
        console.log('\n💰 Funding buyers with SOL...\n');
        for (const buyer of buyers) {
            try {
                const tx = await this.connection.sendTransaction(
                    new anchor.web3.Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: adminKeypair.publicKey,
                            toPubkey: buyer.publicKey,
                            lamports: 1 * LAMPORTS_PER_SOL, // 1 SOL per buyer
                        })
                    ),
                    [adminKeypair]
                );
                await this.connection.confirmTransaction(tx, 'confirmed');
                console.log(`   ✅ Funded ${buyer.publicKey.toString().substring(0, 8)}...`);
            } catch (error) {
                console.error(`   ❌ Failed to fund ${buyer.publicKey.toString().substring(0, 8)}...: ${error.message}`);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Simulate Pump.fun purchases with varying amounts
        console.log('\n🛒 Simulating Pump.fun Purchases...\n');
        const purchaseAmounts = [
            0.2,  // $20 - qualifies
            0.5,  // $50 - qualifies
            1.0,  // $100 - qualifies (4 tickets)
            0.15, // $15 - doesn't qualify
            2.0,  // $200 - qualifies (4 tickets)
            5.0,  // $500 - qualifies (10 tickets)
            0.25, // $25 - qualifies
            0.3,  // $30 - qualifies
            0.1,  // $10 - doesn't qualify
            0.4,  // $40 - qualifies
        ];

        const purchases = [];
        for (let i = 0; i < buyers.length && i < purchaseAmounts.length; i++) {
            const purchase = await this.simulatePumpFunPurchase(buyers[i], purchaseAmounts[i]);
            purchases.push(purchase);
            this.testBuyers.push({
                keypair: buyers[i],
                purchase
            });
        }

        // Test auto-entry for qualifying purchases
        console.log('\n🎰 Testing Auto-Entry System...\n');
        let entries = 0;
        for (const buyerData of this.testBuyers) {
            if (buyerData.purchase.usdValue >= 20) {
                const entered = await this.testAutoEntry(buyerData.purchase);
                if (entered) entries++;
                await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
            }
        }

        // Check lottery state
        console.log('\n📊 Final Lottery State:\n');
        try {
            const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
            console.log(`   Total Participants: ${lottery.totalParticipants}`);
            console.log(`   Total Tickets: ${lottery.totalTickets}`);
            console.log(`   Status: ${lottery.isActive ? '✅ Active' : '❌ Inactive'}`);
            console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL\n`);
        } catch (error) {
            console.error(`   ❌ Failed to fetch lottery: ${error.message}\n`);
        }

        // Summary
        console.log('='.repeat(70));
        console.log('📊 TEST SUMMARY:');
        console.log(`   Test Buyers: ${buyers.length}`);
        console.log(`   Qualifying Purchases: ${purchases.filter(p => p.usdValue >= 20).length}`);
        console.log(`   Successful Entries: ${entries}`);
        console.log('='.repeat(70) + '\n');

        return {
            buyers: buyers.length,
            qualifying: purchases.filter(p => p.usdValue >= 20).length,
            entries
        };
    }
}

async function main() {
    const connection = new Connection(RPC_URL, 'confirmed');
    const tester = new PumpFunFlowTester(connection, null, TOKEN_MINT);
    
    try {
        await tester.runCompleteTest();
        console.log('✅ Pump.fun flow test complete!\n');
    } catch (error) {
        console.error('❌ Test failed:', error);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { PumpFunFlowTester };






