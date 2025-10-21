# 🎰 PEPEBALL - Powerball Lottery Token 🎰

> **8-bit meets South Park meets PEPE** - A revolutionary lottery token with creator fund and dynamic timing

## 🐸 Overview

PEPEBALL is a Powerball-inspired lottery token built on Solana that combines the best of DeFi mechanics with lottery functionality. It features a perpetual creator fund for Matt Furie (PEPE creator), dynamic jackpot timing, and SOL payouts to protect token holders.

## ✨ Key Features

### 🎯 Token Economics
- **Total Supply**: 1,000,000,000 PEPEBALL
- **Tax Rate**: 2.5% on all transactions
  - **Creator Fund**: 0.05% → Matt Furie (perpetual)
  - **Jackpot Pool**: 2.45% → Lottery funding
- **LP Management**: 85% instant renounce + burnt LP, 15% for jackpot funding

### 🎲 Lottery Mechanics
- **Dynamic Timing**:
  - `< 200 SOL`: 72-hour draws
  - `≥ 200 SOL`: 36-hour draws
- **Winner Distribution**:
  - 1 Main Winner: 60% of jackpot
  - 5 Minor Winners: 8% each (40% total)
- **Payouts**: SOL (not tokens) to protect price
- **Auto-funding**: 40% of jackpot + 80% of fees sold for SOL

### 🛡️ Security Features
- **Anti-Rug**: Instant renounce + burnt LP
- **Fire-alarm Admin**: Emergency access only
- **Price Protection**: SOL payouts prevent token dumps
- **Transparency**: All transactions on-chain

## 🏗️ Architecture

### Smart Contracts

1. **PEPEBALL Token** (`pepball-token`)
   - Tax mechanics (2.5% total)
   - Creator fund distribution (0.05%)
   - Jackpot funding (2.45%)
   - Admin renounce functionality

2. **Lottery System** (`lottery`)
   - Dynamic timing based on jackpot size
   - Winner selection algorithm
   - SOL payout mechanism
   - Participant management

3. **LP Manager** (`lp-manager`)
   - Automatic SOL conversion (80% of fees)
   - Jackpot funding logic
   - Emergency withdrawal functions

### Frontend
- **Theme**: 8-bit/South Park aesthetic with heavy PEPE/Pink PEPE elements
- **Features**: Lottery participation, jackpot tracking, real-time updates
- **Responsive**: Mobile-friendly design

## 🚀 Getting Started

### Prerequisites
- Rust 1.90.0+
- Solana CLI 1.18.0+
- Anchor Framework
- Node.js (for frontend)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/pepball.git
   cd pepball
   ```

2. **Install dependencies**
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Install Solana CLI
   sh -c "$(curl -sSfL https://release.solana.com/v1.18.0/install)"
   
   # Install Anchor
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   ```

3. **Build the contracts**
   ```bash
   anchor build
   ```

4. **Run tests**
   ```bash
   anchor test
   ```

5. **Deploy to localnet**
   ```bash
   anchor deploy
   ```

## 📊 Token Distribution

```
Total Supply: 1,000,000,000 PEPEBALL
├── 85% Burnt LP (850,000,000) - Instant renounce
├── 15% Jackpot LP (150,000,000) - Funds lottery
└── Tax Distribution (2.5% on transactions)
    ├── 0.05% → Matt Furie Creator Fund
    └── 2.45% → Jackpot Pool
```

## 🎰 Lottery Rules

### Entry Requirements
- Hold PEPEBALL tokens
- Connect Solana wallet
- Pay gas fees

### Draw Schedule
- **Small Jackpots** (< 200 SOL): Every 72 hours
- **Large Jackpots** (≥ 200 SOL): Every 36 hours
- **Auto-trigger**: When 20 SOL minimum reached

### Winner Selection
- **Random Selection**: Chainlink VRF integration
- **Fair Distribution**: Weighted by token holdings
- **SOL Payouts**: Protects token price

## 🔧 Configuration

### Environment Variables
```bash
# Solana Cluster
SOLANA_CLUSTER=devnet  # or mainnet, localnet

# Program IDs
PEPEBALL_PROGRAM_ID=PEPEBALL111111111111111111111111111111111111
LOTTERY_PROGRAM_ID=LOTTERY111111111111111111111111111111111111
LP_MANAGER_PROGRAM_ID=LPMANAGER111111111111111111111111111111111
```

### Creator Fund Address
```rust
// Matt Furie's address (placeholder - update with actual address)
let creator_fund_address = "11111111111111111111111111111111";
```

## 🧪 Testing

Run the test suite:
```bash
anchor test
```

Test coverage includes:
- Token initialization
- Tax distribution
- Lottery mechanics
- Dynamic timing
- LP management
- Emergency functions

## 🚀 Deployment

### Local Development
```bash
anchor deploy --provider.cluster localnet
```

### Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Mainnet
```bash
anchor deploy --provider.cluster mainnet
```

## 📈 Roadmap

### Phase 1: Core Launch ✅
- [x] Smart contracts development
- [x] Basic frontend
- [x] Testing suite
- [x] Local deployment

### Phase 2: Pump.Fun Launch 🚧
- [ ] Pump.Fun integration
- [ ] Marketing materials
- [ ] Community setup
- [ ] Token launch

### Phase 3: Advanced Features 🔮
- [ ] Chainlink VRF integration
- [ ] Advanced UI/UX
- [ ] Mobile app
- [ ] Cross-chain support

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐸 Community

- **Discord**: [Join our community](https://discord.gg/pepball)
- **Twitter**: [@PEPEBALLToken](https://twitter.com/pepballtoken)
- **Telegram**: [PEPEBALL Official](https://t.me/pepballofficial)

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Always do your own research before investing.

## 🙏 Acknowledgments

- **Matt Furie**: Creator of PEPE
- **Solana Foundation**: For the amazing blockchain
- **Anchor Team**: For the development framework
- **PEPE Community**: For the inspiration

---

**Built with ❤️ for the PEPE community**

*PEPEBALL - Where memes meet money* 🐸💰

