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
    console.log(`💰 Balance: ${balance / 1e9} SOL\n`);

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
      console.log(`   Participants: ${existingLottery.totalParticipants.toNumber()}\n`);
      console.log("✅ Ready to use!");
      return;
    } catch (e) {
      console.log("📝 Lottery not initialized, proceeding...\n");
    }

    // Initialize lottery
    const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL

    console.log(`🚀 Initializing lottery with ${initialJackpot.toNumber() / 1e9} SOL initial jackpot...\n`);

    try {
      // Anchor needs seeds to be passed when PDA is a signer
      // The seeds are specified in the Rust constraint: seeds = [b"lottery"]
      const tx = await lotteryProgram.methods
        .initializeLottery(initialJackpot)
        .accounts({
          lottery: lotteryPDA,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([])
        .rpc();

      console.log(`✅ Transaction Signature: ${tx}`);
      console.log(`🔗 Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

      // Wait for confirmation
      await provider.connection.confirmTransaction(tx, "confirmed");
      console.log("✅ Transaction confirmed!\n");
      console.log("✅ Transaction confirmed!\n");

      // Verify initialization
      const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);

      console.log("🎉 Lottery Successfully Initialized!");
      console.log("📊 Lottery State:");
      console.log(`   Jackpot: ${lottery.jackpotAmount.toNumber() / 1e9} SOL`);
      console.log(`   Carry-over: ${lottery.carryOverAmount.toNumber() / 1e9} SOL`);
      console.log(`   Base Snapshot Interval: ${lottery.baseSnapshotInterval.toNumber() / 3600} hours`);
      console.log(`   Fast Snapshot Interval: ${lottery.fastSnapshotInterval.toNumber() / 3600} hours`);
      console.log(`   Fast Mode Threshold: ${lottery.fastModeThreshold.toNumber() / 1e9} SOL`);
      console.log(`   Active: ${lottery.isActive}`);
      console.log(`   Participants: ${lottery.totalParticipants.toNumber()}\n`);

      // Verify values
      expect(lottery.jackpotAmount.toNumber()).to.equal(initialJackpot.toNumber());
      expect(lottery.carryOverAmount.toNumber()).to.equal(0);
      expect(lottery.isActive).to.be.true;
      expect(lottery.admin.toString()).to.equal(admin.publicKey.toString());

      console.log("✅ All validations passed!\n");
      console.log("✅ Ready for testing!");

    } catch (error: any) {
      console.error("❌ Error:", error.message);
      if (error.logs) {
        console.error("\n📋 Program logs:");
        error.logs.forEach((log: string) => console.error("   ", log));
      }
      throw error;
    }
  });
});

