/**
 * Sell project tokens for SOL via Orca Whirlpool (devnet rehearsal pools).
 */
const { address } = require('@solana/kit');
const { setRpc, setDefaultFunder, setPayerFromBytes, swap, WhirlpoolDeployment } = require('@orca-so/whirlpools');
const { clusterApiUrl } = require('@solana/web3.js');

const WSOL = 'So11111111111111111111111111111111111111112';

async function sellTokensForSol({ walletSecret, tokenMint, poolAddress, amountRaw, slippageBps = 300 }, attempt = 0) {
  const rpcUrl = process.env.SOLANA_RPC || process.env.RPC_URL || clusterApiUrl('devnet');
  try {
    await setRpc(rpcUrl);
    const signer = await setPayerFromBytes(walletSecret);
    setDefaultFunder(signer);

    const result = await swap(
      { inputAmount: BigInt(amountRaw), mint: address(tokenMint) },
      address(poolAddress),
      { whirlpoolDeployment: WhirlpoolDeployment.devnet, slippageToleranceBps: slippageBps }
    );
    const sig = await result.callback();
    return { sig, quote: result.quote ?? result.instructions?.quote };
  } catch (e) {
    const is429 = String(e?.message || e).includes('429') || e?.context?.statusCode === 429;
    if (is429 && attempt < 5) {
      const wait = Number(e?.context?.headers?.get?.('retry-after') || 12) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      return sellTokensForSol({ walletSecret, tokenMint, poolAddress, amountRaw, slippageBps }, attempt + 1);
    }
    throw e;
  }
}

module.exports = { sellTokensForSol, WSOL };
