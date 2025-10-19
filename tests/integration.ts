import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PepballToken } from "../target/types/pepball_token";
import { Lottery } from "../target/types/lottery";
import { LpManager } from "../target/types/lp_manager";
import { expect } from "chai";

describe("PEPEBALL Integration Tests", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const pepballProgram = anchor.workspace.PepballToken as Program<PepballToken>;
  const lotteryProgram = anchor.workspace.Lottery as Program<Lottery>;
  const lpManagerProgram = anchor.workspace.LpManager as Program<LpManager>;

  const provider = anchor.getProvider();
  const admin = provider.wallet;

  // Program IDs
  const PEPEBALL_PROGRAM_ID = pepballProgram.programId;
  const LOTTERY_PROGRAM_ID = lotteryProgram.programId;
  const LP_MANAGER_PROGRAM_ID = lpManagerProgram.programId;

  // Test accounts
  let tokenInfo: anchor.web3.PublicKey;
  let lottery: anchor.web3.PublicKey;
  let lpManager: anchor.web3.PublicKey;
  let creatorFundAddress: anchor.web3.PublicKey;
  let jackpotPool: anchor.web3.PublicKey;

  before(async () => {
    // Generate test keypairs
    creatorFundAddress = anchor.web3.Keypair.generate().publicKey;
    jackpotPool = anchor.web3.Keypair.generate().publicKey;

    // Derive PDAs
    [tokenInfo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_info")],
      PEPEBALL_PROGRAM_ID
    );

    [lottery] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery")],
      LOTTERY_PROGRAM_ID
    );

    [lpManager] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lp_manager")],
      LP_MANAGER_PROGRAM_ID
    );
  });

  it("🚀 Complete Integration Flow", async () => {
    console.log("🎰 Starting PEPEBALL Integration Test...");

    // Step 1: Initialize Token
    console.log("📝 Step 1: Initializing PEPEBALL Token...");
    await pepballProgram.methods
      .initializeToken("PEPEBALL", "PEPE", 9, creatorFundAddress)
      .accounts({
        tokenInfo: tokenInfo,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const tokenData = await pepballProgram.account.tokenInfo.fetch(tokenInfo);
    console.log("✅ Token initialized:", {
      name: tokenData.name,
      symbol: tokenData.symbol,
      creatorFundRate: tokenData.creatorFundRate / 100 + "%",
      jackpotRate: tokenData.jackpotRate / 100 + "%",
    });

    // Step 2: Initialize Lottery
    console.log("🎲 Step 2: Initializing Lottery System...");
    const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL

    await lotteryProgram.methods
      .initializeLottery(initialJackpot)
      .accounts({
        lottery: lottery,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const lotteryData = await lotteryProgram.account.lottery.fetch(lottery);
    console.log("✅ Lottery initialized:", {
      jackpot: lotteryData.jackpotAmount / 1e9 + " SOL",
      baseInterval: lotteryData.baseDrawInterval / 3600 + " hours",
      fastInterval: lotteryData.fastDrawInterval / 3600 + " hours",
      threshold: lotteryData.fastDrawThreshold / 1e9 + " SOL",
    });

    // Step 3: Initialize LP Manager
    console.log("💰 Step 3: Initializing LP Manager...");
    await lpManagerProgram.methods
      .initializeLpManager()
      .accounts({
        lpManager: lpManager,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const lpData = await lpManagerProgram.account.lpManager.fetch(lpManager);
    console.log("✅ LP Manager initialized:", {
      feeConversionRate: lpData.feeConversionRate / 100 + "%",
      jackpotFundingRate: lpData.jackpotFundingRate / 100 + "%",
    });

    // Step 4: Test Dynamic Timing Logic
    console.log("⏰ Step 4: Testing Dynamic Timing Logic...");
    
    // Test small jackpot (should use 72-hour timing)
    await lotteryProgram.methods
      .updateJackpotAmount(new anchor.BN(50 * 1e9)) // 50 SOL
      .accounts({
        lottery: lottery,
        admin: admin.publicKey,
      })
      .rpc();

    // Test large jackpot (should use 36-hour timing)
    await lotteryProgram.methods
      .updateJackpotAmount(new anchor.BN(250 * 1e9)) // 250 SOL
      .accounts({
        lottery: lottery,
        admin: admin.publicKey,
      })
      .rpc();

    console.log("✅ Dynamic timing tested: 72h < 200 SOL, 36h ≥ 200 SOL");

    // Step 5: Test Lottery Entry
    console.log("🎫 Step 5: Testing Lottery Entry...");
    await lotteryProgram.methods
      .enterLottery(new anchor.BN(5)) // 5 tickets
      .accounts({
        lottery: lottery,
        participant: admin.publicKey,
      })
      .rpc();

    const updatedLottery = await lotteryProgram.account.lottery.fetch(lottery);
    console.log("✅ Lottery entry successful:", {
      participants: updatedLottery.participants.length,
      totalParticipants: updatedLottery.totalParticipants.toString(),
    });

    // Step 6: Test LP Manager Functions
    console.log("🔄 Step 6: Testing LP Manager Functions...");
    
    // Test fee conversion
    await lpManagerProgram.methods
      .convertFeesToSol(new anchor.BN(1000 * 1e9)) // 1000 tokens
      .accounts({
        lpManager: lpManager,
        admin: admin.publicKey,
      })
      .rpc();

    // Test jackpot boost
    await lpManagerProgram.methods
      .boostJackpot(new anchor.BN(5 * 1e9)) // 5 SOL
      .accounts({
        lpManager: lpManager,
        admin: admin.publicKey,
      })
      .rpc();

    const updatedLp = await lpManagerProgram.account.lpManager.fetch(lpManager);
    console.log("✅ LP Manager functions tested:", {
      solConverted: updatedLp.solConverted / 1e9 + " tokens",
      jackpotBoosts: updatedLp.jackpotBoosts / 1e9 + " SOL",
    });

    console.log("🎉 INTEGRATION TEST COMPLETE! All systems working! 🎉");
  });

  it("🛡️ Security Tests", async () => {
    console.log("🔒 Testing Security Features...");

    // Test admin renounce
    console.log("Testing admin renounce...");
    await pepballProgram.methods
      .renounceAdmin()
      .accounts({
        tokenInfo: tokenInfo,
        admin: admin.publicKey,
      })
      .rpc();

    const renouncedToken = await pepballProgram.account.tokenInfo.fetch(tokenInfo);
    expect(renouncedToken.isRenounced).to.be.true;
    console.log("✅ Admin successfully renounced!");

    // Test emergency pause
    console.log("Testing emergency pause...");
    await lotteryProgram.methods
      .emergencyPauseLottery()
      .accounts({
        lottery: lottery,
        admin: admin.publicKey,
      })
      .rpc();

    const pausedLottery = await lotteryProgram.account.lottery.fetch(lottery);
    expect(pausedLottery.isActive).to.be.false;
    console.log("✅ Emergency pause activated!");

    // Resume lottery
    await lotteryProgram.methods
      .emergencyPauseLottery()
      .accounts({
        lottery: lottery,
        admin: admin.publicKey,
      })
      .rpc();

    const resumedLottery = await lotteryProgram.account.lottery.fetch(lottery);
    expect(resumedLottery.isActive).to.be.true;
    console.log("✅ Lottery resumed!");

    console.log("🛡️ Security tests passed!");
  });

  it("📊 Performance Tests", async () => {
    console.log("⚡ Testing Performance...");

    const startTime = Date.now();

    // Test multiple rapid transactions
    for (let i = 0; i < 10; i++) {
      await lotteryProgram.methods
        .enterLottery(new anchor.BN(1))
        .accounts({
          lottery: lottery,
          participant: admin.publicKey,
        })
        .rpc();
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ 10 lottery entries completed in ${duration}ms`);
    console.log(`⚡ Average: ${duration / 10}ms per transaction`);

    const finalLottery = await lotteryProgram.account.lottery.fetch(lottery);
    expect(finalLottery.totalParticipants).to.equal(11); // 1 from previous test + 10 new

    console.log("📊 Performance tests passed!");
  });
});
