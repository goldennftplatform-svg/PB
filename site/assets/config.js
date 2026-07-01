/** Edit before deploy — public only, no secrets */
window.PEPEBALL_CONFIG = {
  siteName: "PEPEBALL Info",
  tagline: "Hold tokens. Win SOL. ODD = payout · EVEN = rollover.",
  playUrl: "https://soflotto.com",
  repoUrl: "https://github.com/goldennftplatform-svg/PB",
  discordUrl: "",
  twitterUrl: "",
  lotteryProgramId: "8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7",
  lotteryPda: "ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb",
  gameRegistryProgramId: "CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR",
  cluster: "devnet",
  tiers: [
    { usd: 20, tickets: 1 },
    { usd: 100, tickets: 2 },
    { usd: 500, tickets: 4 },
  ],
  payoutSplit: { main: 60, secondaryEach: 4, secondaryCount: 8, rollover: 6, dev: 2 },
  memeCallout: "Rare bonus rounds only — meme bags split like SOL jackpot.",
};
