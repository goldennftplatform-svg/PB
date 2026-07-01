/** Edit before deploy — public only, no secrets */
window.PEPEBALL_CONFIG = {
  siteName: "PEPEBALL Info",
  tagline: "Hold tokens. Win SOL. ODD = payout · EVEN = rollover.",
  playUrl: "https://soflotto.com",
  repoUrl: "https://github.com/goldennftplatform-svg/PB",
  discordUrl: "",
  twitterUrl: "",
  cluster: "devnet",
  devnetBanner: "Devnet rehearsal live — programs deployed, registry wired, launch split done. Orca pools pending.",

  lotteryProgramId: "8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7",
  lotteryPda: "ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb",
  gameRegistryProgramId: "CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR",
  gameRegistryPda: "7KTFqUTfV93BtU4koWV1VGgcDENrNPm1dvxr1KWrxbCQ",
  pepballTokenProgramId: "HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR",
  taxHarvestProgramId: "Em261K95h8M48f52iuu5YSaTJXJTs1pqjZpRCPYFqXRx",
  lpManagerProgramId: "G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG",

  /** Devnet sim mints (registered in game-registry — not mainnet) */
  devnetMints: {
    master: "9WyzZroviTB6xrxpRfE6EsZASHhUKXMkq5wX8ENESjze",
    pumpShell: "22YmQgPK8jPHWJXHTXMpj9jWvvdXtN8rvVPwH8uusk4A",
    trixYang: "JE522iGcCgfcVpxEcFuegx1oTRwJgfJEemxviD8cXeGr",
    trixBridge: "HsTDmh6kScRrXHqLcp1JUmEZvYTTiLBZ2T7okJdW9Yt1",
  },

  tiers: [
    { usd: 20, tickets: 1 },
    { usd: 100, tickets: 2 },
    { usd: 500, tickets: 4 },
  ],
  payoutSplit: { main: 60, secondaryEach: 4, secondaryCount: 8, rollover: 6, dev: 2 },
  memeCallout: "Rare bonus rounds only — meme bags split like SOL jackpot.",

  devnetChecklist: [
    { label: "All 5 programs on devnet", done: true },
    { label: "Game registry initialized + mints registered", done: true },
    { label: "Launch emulation (5% sim buy / 95% LP split)", done: true },
    { label: "Orca SOL pools (OG, Pump, TRiX)", done: false },
    { label: "Holdings snapshot + draw test", done: false },
    { label: "Registry seal (devnet dry-run only)", done: false },
  ],
};
