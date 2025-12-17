// Test Pump.fun Integration on Devnet
// Simulates token purchases and tests auto-entry flow

const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getOrCreateAssociatedTokenAccount, createTransferInstruction, TOKEN_PROGRAM_ID, getMint } = require('@solana/spl-token');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const TOKEN_MINT = new PublicKey('CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');

class PumpFunIntegrationTester {
    constructor(connection, lotteryProgram, tokenMint) {
        this.connection = connection;
        this.lotteryProgram = lotteryProgram;
        this.tokenMint = tokenMint;
    }

    /**
     * Simulate a Pump.fun purchase
     * In real Pump.fun, user buys tokens with SOL
     * Here we simulate by transferring tokens to a buyer
     */
    async simulatePumpFunPurchase(buyerKeypair, solAmount) {
        console.log(`\n💰 Simulating Pump.fun Purchase`);
        console.log(`   Buyer: ${buyerKeypair.publicKey.toString().substring(0, 8)}...`);
        console.log(`   SOL Amount: ${solAmount} SOL\n`);

        // Get current token price (simulated - in real scenario, get from DEX)
        const tokenPrice = await this.getTokenPrice();
        const usdValue = solAmount * 100; // Assume $100/SOL for testing
        const tokenAmount = Math.floor((usdValue / tokenPrice) * 1e9); // Convert to token units

        console.log(`   Token Price: $${tokenPrice.toFixed(6)} per token`);
        console.log(`   USD Value: $${usdValue.toFixed(2)}`);
        console.log(`   Token Amount: ${(tokenAmount / 1e9).toLocaleString()} tokens\n`);

        // Get or create buyer's token account
        const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
            this.connection,
            buyerKeypair,
            this.tokenMint,
            buyerKeypair.publicKey
        );

        // In real Pump.fun, tokens come from the LP pool
        // For testing, we'll transfer from admin wallet
        const adminWalletPath = process.env.ANCHOR_WALLET || 
            path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        const adminKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(adminWalletPath, 'utf8')))
        );

        const adminTokenAccount = await getAssociatedTokenAddress(
            this.tokenMint,
            adminKeypair.publicKey
        );

        // Transfer tokens to buyer (simulating Pump.fun purchase)
        const transferIx = createTransferInstruction(
            adminTokenAccount,
            buyerTokenAccount.address,
            adminKeypair.publicKey,
            tokenAmount,
            [],
            TOKEN_PROGRAM_ID
        );

        const tx = new anchor.web3.Transaction().add(transferIx);
        const signature = await this.connection.sendTransaction(tx, [adminKeypair]);
        await this.connection.confirmTransaction(signature, 'confirmed');

        console.log(`   ✅ Tokens transferred!`);
        console.log(`   Transaction: ${signature.substring(0, 20)}...\n`);

        return {
            buyer: buyerKeypair.publicKey,
            tokenAmount,
            usdValue,
            transaction: signature
        };
    }

    /**
     * Test auto-entry after purchase
     */
    async testAutoEntry(purchase) {
        console.log(`🎰 Testing Auto-Entry for Purchase\n`);

        // Check if buyer qualifies ($20+ USD)
        if (purchase.usdValue < 20) {
            console.log(`   ⚠️  Purchase value $${purchase.usdValue.toFixed(2)} is below $20 minimum\n`);
            return false;
        }

        console.log(`   ✅ Purchase qualifies: $${purchase.usdValue.toFixed(2)} >= $20.00\n`);

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

        // Check if participant account exists
        const accountInfo = await this.connection.getAccountInfo(participantPDA);
        const isNew = !accountInfo || accountInfo.lamports === 0;

        try {
            if (isNew) {
                // New participant - enter lottery
                console.log(`   📝 Entering lottery as new participant...\n`);
                const usdValueCents = Math.floor(purchase.usdValue * 100);
                
                const tx = await this.lotteryProgram.methods
                    .enterLotteryWithUsdValue(new anchor.BN(usdValueCents))
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: purchase.buyer,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([purchase.buyer])
                    .rpc();

                console.log(`   ✅ Entered lottery!`);
                console.log(`   Transaction: ${tx.substring(0, 20)}...\n`);
                return true;
            } else {
                // Existing participant - update tickets
                console.log(`   📝 Updating existing participant...\n`);
                const ticketCount = this.calculateTickets(purchase.usdValue);
                const usdValueCents = Math.floor(purchase.usdValue * 100);
                
                const tx = await this.lotteryProgram.methods
                    .updateParticipantTickets(ticketCount, new anchor.BN(usdValueCents))
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: purchase.buyer,
                    })
                    .signers([purchase.buyer])
                    .rpc();

                console.log(`   ✅ Updated tickets!`);
                console.log(`   Transaction: ${tx.substring(0, 20)}...\n`);
                return true;
            }
        } catch (error) {
            console.error(`   ❌ Auto-entry failed: ${error.message}\n`);
            return false;
        }
    }

    /**
     * Get current token price (simulated)
     * In production, fetch from Jupiter/Raydium
     */
    async getTokenPrice() {
        // Simulated price - in production, use Jupiter API
        // For testing, use a fixed price
        return 0.000020; // $0.000020 per token (1M tokens = $20)
    }

    /**
     * Calculate tickets from USD value
     */
    calculateTickets(usdValue) {
        if (usdValue >= 500) return 10;
        if (usdValue >= 100) return 4;
        if (usdValue >= 20) return 1;
        return 0;
    }

    /**
     * Full test flow: Purchase → Auto-Entry → Verify
     */
    async runFullTest() {
        console.log('🧪 Pump.fun Integration Test\n');
        console.log('='.repeat(70) + '\n');

        // Create test buyer
        const buyer = Keypair.generate();
        console.log(`✅ Test Buyer: ${buyer.publicKey.toString()}\n`);

        // Fund buyer with SOL
        const adminWalletPath = process.env.ANCHOR_WALLET || 
            path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
        const adminKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(adminWalletPath, 'utf8')))
        );

        console.log('💰 Funding test buyer...\n');
        const fundTx = await this.connection.requestAirdrop(
            buyer.publicKey,
            1 * LAMPORTS_PER_SOL
        );
        await this.connection.confirmTransaction(fundTx, 'confirmed');
        console.log('   ✅ Buyer funded with 1 SOL\n');

        // Test different purchase amounts
        const testPurchases = [
            { sol: 0.1, description: '$10 purchase (below minimum)' },
            { sol: 0.2, description: '$20 purchase (minimum)' },
            { sol: 0.5, description: '$50 purchase' },
            { sol: 1.0, description: '$100 purchase (bonus tickets)' },
            { sol: 5.0, description: '$500 purchase (max tickets)' },
        ];

        const results = [];

        for (const test of testPurchases) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`Test: ${test.description}`);
            console.log('='.repeat(70));

            try {
                // Simulate purchase
                const purchase = await this.simulatePumpFunPurchase(buyer, test.sol);

                // Test auto-entry
                const entered = await this.testAutoEntry(purchase);

                results.push({
                    test: test.description,
                    usdValue: purchase.usdValue,
                    qualified: purchase.usdValue >= 20,
                    entered: entered,
                    success: entered && purchase.usdValue >= 20
                });
            } catch (error) {
                console.error(`❌ Test failed: ${error.message}\n`);
                results.push({
                    test: test.description,
                    error: error.message,
                    success: false
                });
            }
        }

        // Summary
        console.log('\n' + '='.repeat(70));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(70) + '\n');

        results.forEach((result, i) => {
            if (result.error) {
                console.log(`${i + 1}. ${result.test}`);
                console.log(`   ❌ Error: ${result.error}\n`);
            } else {
                console.log(`${i + 1}. ${result.test}`);
                console.log(`   USD Value: $${result.usdValue.toFixed(2)}`);
                console.log(`   Qualified: ${result.qualified ? '✅' : '❌'} (needs $20+)`);
                console.log(`   Entered: ${result.entered ? '✅' : '❌'}`);
                console.log(`   Status: ${result.success ? '✅ PASS' : '❌ FAIL'}\n`);
            }
        });

        // Check lottery state
        console.log('📊 Final Lottery State:\n');
        try {
            const [lotteryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('lottery')],
                LOTTERY_PROGRAM_ID
            );
            const lottery = await this.lotteryProgram.account.lottery.fetch(lotteryPDA);
            console.log(`   Total Participants: ${lottery.totalParticipants}`);
            console.log(`   Total Tickets: ${lottery.totalTickets}`);
            console.log(`   Status: ${lottery.isActive ? '✅ Active' : '❌ Inactive'}\n`);
        } catch (error) {
            console.error(`   ❌ Failed to fetch lottery: ${error.message}\n`);
        }

        return results;
    }
}

async function main() {
    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
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

    // Load program
    let lotteryProgram;
    try {
        lotteryProgram = anchor.workspace.Lottery;
    } catch (e) {
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (!fs.existsSync(idlPath)) {
            console.error('❌ IDL not found! Run: anchor build');
            process.exit(1);
        }
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
    }

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Token Mint: ${TOKEN_MINT.toString()}`);
    console.log(`✅ Lottery Program: ${LOTTERY_PROGRAM_ID.toString()}\n`);

    const tester = new PumpFunIntegrationTester(connection, lotteryProgram, TOKEN_MINT);
    await tester.runFullTest();
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { PumpFunIntegrationTester };

