import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Lottery } from "../target/types/lottery";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as fs from "fs";

async function main() {
  console.log("🎰 Initializing Lottery on Devnet...\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load wallet
  const walletPath = process.env.ANCHOR_WALLET || `${process.env.HOME}/.config/solana/id.json`;
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  
  anchor.setProvider(provider);
  
  console.log("📋 Admin Wallet:", wallet.publicKey.toString());
  console.log("💰 Balance:", (await connection.getBalance(wallet.publicKey)) / 1e9, "SOL\n");

  // Load program
  const programId = new PublicKey("6xiVoEyfTJNyBPYToahQUXDErTqiZG7zrNs8kKy5yekb");
  
  // Load IDL
  const idlPath = "../target/idl/lottery.json";
  if (!fs.existsSync(idlPath)) {
    throw new Error(`IDL not found at ${idlPath}. Please run 'anchor build' first.`);
  }
  
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new Program(idl as anchor.Idl, programId, provider) as unknown as Program<Lottery>;

  console.log("✅ Program loaded:", programId.toString());

  // Derive PDA
  const [lotteryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("lottery")],
    program.programId
  );

  console.log("🎲 Lottery PDA:", lotteryPDA.toString());

  // Check if already initialized
  try {
    const lotteryAccount = await program.account.lottery.fetch(lotteryPDA);
    console.log("\n⚠️  Lottery already initialized!");
    console.log("📊 Current State:");
    console.log("   Jackpot:", lotteryAccount.jackpotAmount.toNumber() / 1e9, "SOL");
    console.log("   Carry-over:", lotteryAccount.carryOverAmount.toNumber() / 1e9, "SOL");
    console.log("   Active:", lotteryAccount.isActive);
    console.log("   Participants:", lotteryAccount.totalParticipants.toNumber());
    console.log("\n✅ Ready to use!");
    return;
  } catch (e) {
    console.log("📝 Lottery not initialized, proceeding...\n");
  }

  // Initialize lottery
  const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL
  const entryMinCents = new anchor.BN(2000);   // $20 → 1 ticket (use 50 for test: 0.50 USDC)
  const tier2MinCents = new anchor.BN(10000); // $100 → 4 tickets (use 100 for test: 1 USDC)
  const tier3MinCents = new anchor.BN(50000); // $500 → 10 tickets (use 500 for test: 5 USDC)

  console.log("🚀 Initializing lottery with", initialJackpot.toNumber() / 1e9, "SOL initial jackpot...");

  try {
    const tx = await program.methods
      .initializeLottery(initialJackpot, entryMinCents, tier2MinCents, tier3MinCents)
      .accounts({
        lottery: lotteryPDA,
        admin: wallet.publicKey,
      })
      .rpc();

    console.log("✅ Transaction signature:", tx);
    console.log("🔗 View on Solana Explorer:");
    console.log(`   https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Verify initialization
    const lotteryAccount = await program.account.lottery.fetch(lotteryPDA);
    console.log("🎉 Lottery Successfully Initialized!");
    console.log("📊 Lottery State:");
    console.log("   Jackpot:", lotteryAccount.jackpotAmount.toNumber() / 1e9, "SOL");
    console.log("   Carry-over:", lotteryAccount.carryOverAmount.toNumber() / 1e9, "SOL");
    console.log("   Base Snapshot Interval:", lotteryAccount.baseSnapshotInterval.toNumber() / 3600, "hours");
    console.log("   Fast Snapshot Interval:", lotteryAccount.fastSnapshotInterval.toNumber() / 3600, "hours");
    console.log("   Fast Mode Threshold:", lotteryAccount.fastModeThreshold.toNumber() / 1e9, "SOL");
    console.log("   Active:", lotteryAccount.isActive);
    console.log("   Participants:", lotteryAccount.totalParticipants.toNumber());
    console.log("\n✅ Ready for testing!");

  } catch (error: any) {
    console.error("❌ Error initializing lottery:", error.message);
    if (error.logs) {
      console.error("📋 Program logs:");
      error.logs.forEach((log: string) => console.error("   ", log));
    }
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Initialization complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Initialization failed:", error);
    process.exit(1);
  });

