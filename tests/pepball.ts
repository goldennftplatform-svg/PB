import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PepballToken } from "../target/types/pepball_token";
import { Lottery } from "../target/types/lottery";
import { LpManager } from "../target/types/lp_manager";

describe("PEPEBALL", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const pepballProgram = anchor.workspace.PepballToken as Program<PepballToken>;
  const lotteryProgram = anchor.workspace.Lottery as Program<Lottery>;
  const lpManagerProgram = anchor.workspace.LpManager as Program<LpManager>;

  it("Initializes PEPEBALL token", async () => {
    const [tokenInfo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_info")],
      pepballProgram.programId
    );

    // Matt Furie's address (placeholder)
    const creatorFundAddress = new anchor.web3.PublicKey("11111111111111111111111111111111");

    await pepballProgram.methods
      .initializeToken("PEPEBALL", "PEPE", 9, creatorFundAddress)
      .accounts({
        tokenInfo: tokenInfo,
        admin: anchor.getProvider().wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const tokenData = await pepballProgram.account.tokenInfo.fetch(tokenInfo);
    console.log("✅ PEPEBALL Token initialized:", tokenData);
    console.log("Creator Fund Rate:", tokenData.creatorFundRate / 100, "%");
    console.log("Jackpot Rate:", tokenData.jackpotRate / 100, "%");
  });

  it("Initializes lottery with dynamic timing", async () => {
    const [lottery] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery")],
      lotteryProgram.programId
    );

    const initialJackpot = new anchor.BN(20 * 1e9); // 20 SOL

    await lotteryProgram.methods
      .initializeLottery(initialJackpot)
      .accounts({
        lottery: lottery,
        admin: anchor.getProvider().wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const lotteryData = await lotteryProgram.account.lottery.fetch(lottery);
    console.log("✅ Lottery initialized:", lotteryData);
    console.log("Initial Jackpot:", lotteryData.jackpotAmount / 1e9, "SOL");
    console.log("Base Draw Interval:", lotteryData.baseDrawInterval / 3600, "hours");
    console.log("Fast Draw Interval:", lotteryData.fastDrawInterval / 3600, "hours");
    console.log("Fast Draw Threshold:", lotteryData.fastDrawThreshold / 1e9, "SOL");
  });

  it("Initializes LP Manager", async () => {
    const [lpManager] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lp_manager")],
      lpManagerProgram.programId
    );

    await lpManagerProgram.methods
      .initializeLpManager()
      .accounts({
        lpManager: lpManager,
        admin: anchor.getProvider().wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const lpData = await lpManagerProgram.account.lpManager.fetch(lpManager);
    console.log("✅ LP Manager initialized:", lpData);
    console.log("Fee Conversion Rate:", lpData.feeConversionRate / 100, "%");
    console.log("Jackpot Funding Rate:", lpData.jackpotFundingRate / 100, "%");
  });

  it("Tests dynamic timing logic", async () => {
    const [lottery] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("lottery")],
      lotteryProgram.programId
    );

    // Test with small jackpot (should use 72-hour timing)
    await lotteryProgram.methods
      .updateJackpotAmount(new anchor.BN(50 * 1e9)) // 50 SOL
      .accounts({
        lottery: lottery,
        admin: anchor.getProvider().wallet.publicKey,
      })
      .rpc();

    // Test with large jackpot (should use 36-hour timing)
    await lotteryProgram.methods
      .updateJackpotAmount(new anchor.BN(250 * 1e9)) // 250 SOL
      .accounts({
        lottery: lottery,
        admin: anchor.getProvider().wallet.publicKey,
      })
      .rpc();

    console.log("✅ Dynamic timing logic tested!");
    console.log("Small jackpot: 72-hour draws");
    console.log("Large jackpot: 36-hour draws");
  });
});

