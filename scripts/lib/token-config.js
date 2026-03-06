/**
 * Token and jackpot config for scripts. Read from env so you can pivot to a new
 * token without redeploying the lottery program. Same wallet can be tax recipient
 * for both test and production token.
 *
 * Set for new token:
 *   PEPEBALL_MINT or VITE_PEPEBALL_MINT  — token CA
 *   TAX_RECIPIENT_ADDRESS or VITE_TAX_RECIPIENT — where tax lands (jackpot wallet)
 *   TOKEN_TAX_BPS (e.g. 250 = 2.5%)
 *   TOKEN_DECIMALS (e.g. 6 or 9)
 */
const defaultMint = '3X36yhq35MJnt2JjwodeFDfv2MFPb99RC53yUyNrpump';
const defaultTaxRecipient = 'FjbPunNH9dveGmNZMPaAwCpZWRYQKP1hqJH8Ua3yVyje';

module.exports = {
  TOKEN_MINT_ADDRESS: process.env.PEPEBALL_MINT || process.env.VITE_PEPEBALL_MINT || defaultMint,
  TAX_RECIPIENT_ADDRESS: process.env.TAX_RECIPIENT_ADDRESS || process.env.VITE_TAX_RECIPIENT || defaultTaxRecipient,
  JACKPOT_SOL_DESTINATION_MAINNET: process.env.JACKPOT_SOL_DESTINATION_MAINNET || process.env.VITE_TAX_RECIPIENT || defaultTaxRecipient,
  TOKEN_TAX_BPS: Number(process.env.TOKEN_TAX_BPS || process.env.VITE_TOKEN_TAX_BPS || '250'),
  TOKEN_DECIMALS: parseInt(process.env.TOKEN_DECIMALS || process.env.VITE_TOKEN_DECIMALS || '6', 10) || 6,
};
