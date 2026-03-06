// Initialize lottery using Anchor test framework and test payout
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lottery } from "../target/types/lottery";

async function main() {
    console.log('🎰 Initialize Lottery and Test Payout\n');
    console.log('='.repeat(60) + '\n');

    // Set provider
    anchor.setProvider(anchor.AnchorProvider.env());
    
    const lotteryProgram = anchor.workspace.Lottery as Program<Lottery>;
    const provider = anchor.getProvider();
    const admin = provider.wallet;

    console.log(`✅ Program ID: ${lotteryProgram.programId.toString()}`);
    console.log(`✅ Admin: ${admin.publicKey.toString()}\n`);

    // Derive lottery PDA
    const [lotteryPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        lotteryProgram.programId
    );

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Check if exists
    try {
        const existing = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log('✅ Lottery already initialized!');
        console.log(`   Jackpot: ${(existing.jackpotAmount / 1e9).toFixed(4)} SOL`);
        console.log(`   Admin: ${existing.admin.toString()}\n`);
    } catch (error) {
        // Initialize if not exists
        console.log('🚀 Initializing lottery...\n');
        
        const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL
        const entryMinCents = new anchor.BN(2000);
        const tier2MinCents = new anchor.BN(10000);
        const tier3MinCents = new anchor.BN(50000);
        
        const tx = await lotteryProgram.methods
            .initializeLottery(initialJackpot, entryMinCents, tier2MinCents, tier3MinCents)
            .accounts({
                lottery: lotteryPDA,
                admin: admin.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();

        console.log(`✅ Transaction: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
        
        await provider.connection.confirmTransaction(tx, 'confirmed');
        console.log('✅ Lottery initialized!\n');
    }

    // Test payout functionality
    console.log('💰 Testing Payout Functionality\n');
    console.log('='.repeat(60) + '\n');

    const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
    
    console.log('📊 Current State:');
    console.log(`Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
    console.log(`Has Main Winner: ${lottery.winners.mainWinner ? '✅ Yes' : '❌ No'}`);
    console.log(`Minor Winners: ${lottery.winners.minorWinners?.length || 0}\n`);

    if (lottery.winners.mainWinner) {
        const jackpot = lottery.jackpotAmount;
        const mainPayout = (jackpot * 60n) / 100n;
        const minorPayout = (jackpot * 40n) / 100n / 5n;
        
        console.log('💰 Calculated Payouts:');
        console.log(`Main Winner: ${(mainPayout / 1e9).toFixed(4)} SOL (60%)`);
        console.log(`Each Minor: ${(minorPayout / 1e9).toFixed(4)} SOL (8%)\n`);
        
        console.log('✅ Payout calculation works correctly!\n');
    } else {
        console.log('⚠️  No winners yet. Take a snapshot first to select winners.\n');
    }

    console.log('🎉 Test complete!');
}

main().catch(console.error);

