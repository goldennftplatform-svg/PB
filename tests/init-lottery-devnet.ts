import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lottery } from "../target/types/lottery";
import { expect } from "chai";

describe("Initialize Lottery on Devnet", () => {
  // Configure provider for devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Use workspace - Anchor should handle the IDL properly
  const lotteryProgram = anchor.workspace.Lottery as Program<Lottery>;
  const admin = provider.wallet;

  it("Initializes lottery on devnet", async () => {
    console.log("🎰 Initializing Lottery on Devnet\n");
    console.log("=".repeat(60) + "\n");

    console.log(`✅ Admin: ${admin.publicKey.toString()}`);
    console.log(`✅ Program: ${lotteryProgram.programId.toString()}\n`);

    // Check balance
    const balance = await provider.connection.getBalance(admin.publicKey);
    console.log(`💰 Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    if (balance < 1e9) {
      console.log("⚠️  Warning: Low balance! You may need more SOL for transactions.\n");
    }

    // Derive PDA with bump
    const [lotteryPDA, bump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery")],
      lotteryProgram.programId
    );

    console.log(`📝 Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`   Bump: ${bump}\n`);

    // Check if already initialized
    try {
      const existingLottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
      console.log("⚠️  Lottery already initialized!");
      console.log("📊 Current State:");
      console.log(`   Jackpot: ${existingLottery.jackpotAmount.toNumber() / 1e9} SOL`);
      console.log(`   Carry-over: ${existingLottery.carryOverAmount.toNumber() / 1e9} SOL`);
      console.log(`   Active: ${existingLottery.isActive}`);
      console.log(`   Participants: ${existingLottery.totalParticipants.toNumber()}`);
      console.log(`   Total Snapshots: ${existingLottery.totalSnapshots.toNumber()}`);
      console.log(`   Base Snapshot Interval: ${existingLottery.baseSnapshotInterval.toNumber() / 3600} hours`);
      console.log(`   Fast Snapshot Interval: ${existingLottery.fastSnapshotInterval.toNumber() / 3600} hours`);
      console.log(`   Fast Mode Threshold: ${existingLottery.fastModeThreshold.toNumber() / 1e9} SOL`);
      console.log(`   Fees Collected: ${existingLottery.feesCollected.toNumber() / 1e9} SOL`);
      console.log(`   Is Fast Mode: ${existingLottery.isFastMode}\n`);
      console.log("✅ Ready to use!");
      return;
    } catch (e) {
      console.log("📝 Lottery not initialized, proceeding with initialization...\n");
    }

    // Initialize lottery
    const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL

    console.log(`🚀 Initializing lottery with ${initialJackpot.toNumber() / 1e9} SOL initial jackpot...\n`);

    try {
      // Anchor automatically derives PDA from seeds specified in Rust constraint
      // The Rust code has: seeds = [b"lottery"], bump
      // So Anchor will derive the PDA and sign with it automatically
      const tx = await lotteryProgram.methods
        .initializeLottery(initialJackpot)
        .accounts({
          lottery: lotteryPDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any) // Type assertion to bypass strict type checking for PDA
        .signers([])
        .rpc();

      console.log(`✅ Transaction Signature: ${tx}`);
      console.log(`🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
      console.log(`🔗 Solscan: https://solscan.io/tx/${tx}?cluster=devnet\n`);

      // Wait for confirmation
      await provider.connection.confirmTransaction(tx, "confirmed");
      console.log("✅ Transaction confirmed!\n");

      // Small delay to ensure account is updated
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify initialization
      const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);

      console.log("🎉 Lottery Successfully Initialized!");
      console.log("📊 Lottery State:");
      console.log(`   Jackpot: ${lottery.jackpotAmount.toNumber() / 1e9} SOL`);
      console.log(`   Carry-over: ${lottery.carryOverAmount.toNumber() / 1e9} SOL`);
      console.log(`   Base Snapshot Interval: ${lottery.baseSnapshotInterval.toNumber() / 3600} hours (72h)`);
      console.log(`   Fast Snapshot Interval: ${lottery.fastSnapshotInterval.toNumber() / 3600} hours (48h)`);
      console.log(`   Fast Mode Threshold: ${lottery.fastModeThreshold.toNumber() / 1e9} SOL (200 SOL)`);
      console.log(`   Active: ${lottery.isActive ? "✅ Yes" : "❌ No"}`);
      console.log(`   Participants: ${lottery.totalParticipants.toNumber()}`);
      console.log(`   Total Snapshots: ${lottery.totalSnapshots.toNumber()}`);
      console.log(`   Fees Collected: ${lottery.feesCollected.toNumber() / 1e9} SOL`);
      console.log(`   Is Fast Mode: ${lottery.isFastMode ? "✅ Yes" : "❌ No"}`);
      console.log(`   Admin: ${lottery.admin.toString()}\n`);

      // Verify values
      expect(lottery.jackpotAmount.toNumber()).to.equal(initialJackpot.toNumber());
      expect(lottery.carryOverAmount.toNumber()).to.equal(0);
      expect(lottery.isActive).to.be.true;
      expect(lottery.admin.toString()).to.equal(admin.publicKey.toString());
      expect(lottery.baseSnapshotInterval.toNumber()).to.equal(72 * 60 * 60); // 72 hours
      expect(lottery.fastSnapshotInterval.toNumber()).to.equal(48 * 60 * 60); // 48 hours
      expect(lottery.fastModeThreshold.toNumber()).to.equal(200 * 1e9); // 200 SOL

      console.log("✅ All validations passed!\n");
      console.log("💡 NEXT STEPS:");
      console.log("   1. Get participants to enter lottery (need 9+ for snapshot)");
      console.log("   2. Test lottery entry: node scripts/test-lottery-entry.js");
      console.log("   3. Configure test timing: node scripts/configure-test-timing.js 1");
      console.log("   4. Trigger snapshot: node scripts/trigger-snapshot.js");
      console.log("   5. Test payout: node scripts/test-payout-flow.js\n");
      console.log("✅ Ready for testing!");

    } catch (error: any) {
      console.error("❌ Error:", error.message);
      if (error.logs) {
        console.error("\n📋 Program logs:");
        error.logs.forEach((log: string) => console.error("   ", log));
      }
      if (error.error) {
        console.error("\n📋 Error details:", JSON.stringify(error.error, null, 2));
      }
      throw error;
    }
  });
});

