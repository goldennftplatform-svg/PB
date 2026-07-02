/** Edit before deploy — public only, no secrets */
window.PEPEBALL_CONFIG = {
  siteName: "PEPEBALL Info",
  tagline: "Hold the coins. Win SOL. ODD pays — EVEN rolls.",
  heroPitch:
    "The on-chain Powerball for Solana degens: your meme bags are the ticket. The prize is pure SOL. Every draw is provable. Every payout is on Solscan.",
  playUrl: "https://pb-n7kx.vercel.app",
  repoUrl: "https://github.com/goldennftplatform-svg/PB",
  discordUrl: "",
  twitterUrl: "",
  cluster: "devnet",
  devnetBanner:
    "Devnet rehearsal — hardened lottery live, game-day admin wired, ODD payout + round ledger tested. Mainnet uses fresh wallets.",

  lotteryProgramId: "8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7",
  lotteryPda: "ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb",
  gameRegistryProgramId: "CKPXLmT1JZnSuG6QuswUDsVcBt8wCAkyXRyQsNyBKQnR",
  gameRegistryPda: "7KTFqUTfV93BtU4koWV1VGgcDENrNPm1dvxr1KWrxbCQ",
  pepballTokenProgramId: "HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR",
  taxHarvestProgramId: "Em261K95h8M48f52iuu5YSaTJXJTs1pqjZpRCPYFqXRx",
  lpManagerProgramId: "G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG",

  /** Public game-day wallets (mainnet — verify before funding) */
  publicWallets: {
    admin: "DMj1qD5UXYW2AwxdhVwd6AsNL1RamRnEYRDmi3qad1Zw",
    jackpotTax: "7Acz6hVJUGoBkiHX8MEUno1YcZg7cdMSg9Rm65Ksu997",
  },

  devnetMints: {
    master: "9WyzZroviTB6xrxpRfE6EsZASHhUKXMkq5wX8ENESjze",
    pumpShell: "22YmQgPK8jPHWJXHTXMpj9jWvvdXtN8rvVPwH8uusk4A",
    trixYang: "JE522iGcCgfcVpxEcFuegx1oTRwJgfJEemxviD8cXeGr",
    trixBridge: "HsTDmh6kScRrXHqLcp1JUmEZvYTTiLBZ2T7okJdW9Yt1",
  },

  tokenTaxBps: 250,
  tokenTaxLabel: "2.5% on trades → jackpot bankroll",

  tiers: [
    { usd: 20, tickets: 1, label: "Entry" },
    { usd: 100, tickets: 2, label: "Mid" },
    { usd: 500, tickets: 4, label: "Max" },
  ],

  /** SOL jackpot split (every ODD payout round) */
  solPayoutSplit: { main: 50, minorEach: 5, minorCount: 8, house: 10 },

  /** Meme callout bonus split (% of fixed token stash — rare rounds only) */
  memePayoutSplit: { main: 60, minorEach: 4, minorCount: 8, rollover: 6, dev: 2 },

  pillars: [
    {
      title: "SOL jackpot, not more bags",
      body: "Winners get lamports from a dedicated treasury wallet. Your tokens qualify you — the prize is real SOL you can spend anywhere.",
    },
    {
      title: "ODD pays · EVEN rolls",
      body: "Pepe ball count 1–30 on-chain. Odd = payout round. Even = rollover — jackpot stays, hype builds, next draw hits harder.",
    },
    {
      title: "Round ledger — no fuzzy math",
      body: "Each draw locks a fixed SOL commitment. Rare meme bonuses use a fixed token count. Price pumps don't silently change what you promised to pay.",
    },
    {
      title: "2.5% tax feeds the pot",
      body: "Every trade drips to the jackpot wallet. LP fees can be harvested manually. Transparent, on-chain, auditable.",
    },
  ],

  talkingPoints: [
    "Hold $20+ combined across game mints — you're in. No separate ticket purchase.",
    "Smart money spreads holdings: $500 total = 4 tickets max, any mix of coins.",
    "Combined USD snapshot — can't game one thin pool for 12 tickets.",
    "Admin can't rug snapshot: hardened program requires game-day admin key.",
    "Every payout tx on Solscan. Verify before you trust.",
    "Rare meme callout rounds: bonus token bags on ODD — SOL prize every time.",
  ],

  memeCallout:
    "Rare bonus rounds only — admin enables per round. Fixed token stash split by %, not USD. SOL jackpot unchanged.",

  devnetChecklist: [
    { label: "5 Anchor programs on devnet", done: true },
    { label: "Lottery hardened + game-day admin (DMj1…)", done: true },
    { label: "ODD payout preflight + SOL to winners", done: true },
    { label: "Round ledger + public export", done: true },
    { label: "Game registry + sim mints registered", done: true },
    { label: "Live app — devnet stats + draw replay", done: true },
    { label: "Orca SOL pools (full 6-pool plan)", done: false },
    { label: "Tax drip end-to-end on game-day wallets", done: false },
    { label: "Mainnet SEC OP wallets + registry seal", done: false },
  ],

  mediaKit: {
    headline: "PEPEBALL — Solana's on-chain Powerball",
    subhead: "Hold meme coins. Win SOL. Provably fair. Built for the culture.",
    hashtags: ["#PEPEBALL", "#Solana", "#OnChainLottery", "#ODDPays"],
    soundbiteOdd: "ODD pays. EVEN rolls. Pepe decides.",
    soundbiteSol: "Your bags get you in. Winners walk away with SOL.",
    logoPath: "assets/pepe-ball.png",
    note: "Drop your video/audio links in community page config when ready.",
  },
};
