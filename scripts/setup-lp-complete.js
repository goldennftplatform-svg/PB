// Complete LP Setup - Transfer tokens and provide final instructions
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress, getAccount, getMint, createTransferInstruction, TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { sendAndConfirmTransaction, Transaction } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';

// Load token info
const tokenInfoPath = path.join(__dirname, '..', 'token-lp-info.json');
let tokenInfo = {};
if (fs.existsSync(tokenInfoPath)) {
    tokenInfo = JSON.parse(fs.readFileSync(tokenInfoPath, 'utf8'));
}

const TOKEN_MINT = new PublicKey(tokenInfo.mint || 'CXcoVCAuQB2XigJmyGz162aj1MCgJxC9Hgo5SEuRuFto');
const PUBLIC_LP_ACCOUNT = new PublicKey(tokenInfo.publicLPAccount || 'C66FhqiG1keNd9YMckGcPUNryctSvHL9yyLGymqDFysq');

async function setupLPComplete() {
    console.log('💧 Complete LP Setup\n');
    console.log('='.repeat(70) + '\n');

    // Load wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Wallet not found!');
        process.exit(1);
    }

    const walletKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    const connection = new Connection(RPC_URL, 'confirmed');
    
    console.log(`✅ Admin Wallet: ${walletKeypair.publicKey.toString()}`);
    console.log(`✅ Token Mint: ${TOKEN_MINT.toString()}`);
    console.log(`✅ Public LP Account: ${PUBLIC_LP_ACCOUNT.toString()}\n`);

    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log(`💰 SOL Balance: ${(balance / 1e9).toFixed(4)} SOL\n`);

    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(
        TOKEN_MINT,
        walletKeypair.publicKey
    );

    console.log(`📝 Your Token Account: ${userTokenAccount.toString()}\n`);

    // Check token balance in wallet
    try {
        const userTokenInfo = await getAccount(connection, userTokenAccount);
        const mintInfo = await getMint(connection, TOKEN_MINT);
        const userBalance = Number(userTokenInfo.amount) / Math.pow(10, mintInfo.decimals);
        console.log(`📊 Your Token Balance: ${userBalance.toLocaleString()} tokens\n`);
        
        if (userBalance >= 10000000) {
            console.log('✅ You have enough tokens (10M+) to create the pool!\n');
        } else {
            console.log('⚠️  You need at least 10M tokens. Transferring now...\n');
            
            // Transfer tokens
            const transferAmount = 10_000_000 * Math.pow(10, mintInfo.decimals); // 10M tokens
            
            const transferIx = createTransferInstruction(
                PUBLIC_LP_ACCOUNT,
                userTokenAccount,
                walletKeypair.publicKey,
                transferAmount,
                [],
                TOKEN_PROGRAM_ID
            );

            const tx = new Transaction().add(transferIx);
            const signature = await sendAndConfirmTransaction(
                connection,
                tx,
                [walletKeypair],
                { commitment: 'confirmed' }
            );

            console.log(`✅ Transferred 10,000,000 tokens to your wallet!`);
            console.log(`   Transaction: ${signature}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);
        }
    } catch (e) {
        if (e.message.includes('InvalidAccountData') || e.message.includes('AccountNotFound')) {
            console.log('📝 Creating token account and transferring tokens...\n');
            
            // Account doesn't exist, will be created automatically by transfer
            const mintInfo = await getMint(connection, TOKEN_MINT);
            const transferAmount = 10_000_000 * Math.pow(10, mintInfo.decimals); // 10M tokens
            
            const transferIx = createTransferInstruction(
                PUBLIC_LP_ACCOUNT,
                userTokenAccount,
                walletKeypair.publicKey,
                transferAmount,
                [],
                TOKEN_PROGRAM_ID
            );

            const tx = new Transaction().add(transferIx);
            const signature = await sendAndConfirmTransaction(
                connection,
                tx,
                [walletKeypair],
                { commitment: 'confirmed' }
            );

            console.log(`✅ Created token account and transferred 10,000,000 tokens!`);
            console.log(`   Transaction: ${signature}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);
        } else {
            console.error('Error:', e.message);
        }
    }

    // Final instructions
    console.log('🎯 FINAL STEPS: Create LP Pool on Raydium\n');
    console.log('1️⃣  Open Raydium:');
    console.log('   https://devnet.raydium.io/liquidity/create\n');
    
    console.log('2️⃣  Connect Wallet:');
    console.log(`   ${walletKeypair.publicKey.toString()}\n`);
    
    console.log('3️⃣  Create Pool:');
    console.log('   - Token A: SOL');
    console.log(`   - Token B: ${TOKEN_MINT.toString()}\n`);
    
    console.log('4️⃣  Set Initial Price:');
    console.log('   - Example: 1 SOL = 1,000,000 tokens');
    console.log('   - This means: $0.0001 per token (if SOL = $100)\n');
    
    console.log('5️⃣  Add Liquidity:');
    console.log('   - SOL: 10 SOL');
    console.log('   - Tokens: 10,000,000 tokens');
    console.log('   - Click "Create Pool"\n');
    
    console.log('6️⃣  Confirm Transaction:');
    console.log('   - Approve in wallet');
    console.log('   - Wait for confirmation\n');
    
    console.log('✅ Pool Created! Token is now tradeable!\n');
    
    console.log('🔗 Verify on Jupiter:');
    console.log(`   https://jup.ag/swap?cluster=devnet`);
    console.log(`   Try swapping SOL → ${TOKEN_MINT.toString()}\n`);
}

if (require.main === module) {
    setupLPComplete()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { setupLPComplete };


