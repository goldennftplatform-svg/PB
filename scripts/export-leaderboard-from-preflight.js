#!/usr/bin/env node
/**
 * Merge devnet/game-day-preflight-report.json → site/assets/leaderboard.json
 * Genesis page reads the latest draw automatically (free GitHub Pages — no backend).
 *
 *   node scripts/export-leaderboard-from-preflight.js
 *   node scripts/export-leaderboard-from-preflight.js --label "Mainnet Draw #1"
 *   node scripts/export-leaderboard-from-preflight.js --label "Draw #2" --genesis
 *
 * Then: git add site/assets/leaderboard.json site/assets/genesis-flow.json && git push
 * Live: https://goldennftplatform-svg.github.io/PB/genesis/
 */

const fs = require('fs');
const path = require('path');

const REPORT = path.join(__dirname, '..', 'devnet', 'game-day-preflight-report.json');
const BOARD = path.join(__dirname, '..', 'site', 'assets', 'leaderboard.json');
const GENESIS_FLOW = path.join(__dirname, '..', 'site', 'assets', 'genesis-flow.json');
const INFO_SITE = 'https://goldennftplatform-svg.github.io/PB';

function shortAddr(a) {
  if (!a || a.length < 12) return a || '—';
  return a.slice(0, 4) + '…' + a.slice(-4);
}

function main() {
  const label =
    process.argv.find((a) => a.startsWith('--label='))?.split('=')[1] ||
    process.argv[process.argv.indexOf('--label') + 1] ||
    'Draw';
  const pinGenesis = process.argv.includes('--genesis');

  if (!fs.existsSync(REPORT)) {
    console.error('Missing', REPORT);
    console.error('Run: node scripts/run-game-day-preflight.js');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const snap = report.phases?.snapshot;
  const winners = report.phases?.winners;
  const payout = report.phases?.solPayout;

  if (!snap?.isOdd || !winners?.main) {
    console.error('Report is not an ODD payout — nothing to add.');
    process.exit(1);
  }

  let board = { version: 1, milestones: [], draws: [], rollovers: [], legends: [] };
  if (fs.existsSync(BOARD)) {
    board = JSON.parse(fs.readFileSync(BOARD, 'utf8'));
  }

  const id = `draw-${Date.now()}`;
  const draw = {
    id,
    roundLabel: label,
    network: report.network || 'devnet',
    date: (report.at || new Date().toISOString()).slice(0, 10),
    outcome: 'ODD_PAYOUT',
    pepeCount: snap.pepe,
    seed: snap.seed,
    participants: snap.participants,
    totalTickets: winners.totalTickets,
    winningTicketIndex: winners.winningTicketIndex,
    jackpotSol: payout ? payout.mainSol * 2 + payout.minorSolEach * 8 : null,
    lore: `Verified ODD payout — Pepe ${snap.pepe}, ticket #${winners.winningTicketIndex}.`,
    mainWinner: {
      wallet: winners.main,
      alias: '',
      sol: payout?.mainSol,
      tx: payout?.tx,
    },
    minors: (winners.minors || []).map((w) => ({
      wallet: w,
      sol: payout?.minorSolEach,
    })),
    links: {
      snapshot: snap.tx,
      setWinners: winners.setWinnersTx,
      solPayout: payout?.tx,
      onChainPayout: report.phases?.onChainPayout?.tx,
    },
  };

  board.draws = board.draws || [];
  board.draws.push(draw);

  const exists = board.legends?.some((l) => l.wallet === winners.main);
  if (!exists) {
    board.legends = board.legends || [];
    board.legends.unshift({
      rank: board.legends.length + 1,
      wallet: winners.main,
      alias: '',
      title: `${label} — main winner`,
      drawId: id,
      solWon: payout?.mainSol,
      network: report.network || 'devnet',
      quote: `Pepe ${snap.pepe} · ticket #${winners.winningTicketIndex}`,
    });
    board.legends.forEach((l, i) => {
      l.rank = i + 1;
    });
  }

  board.updatedAt = new Date().toISOString();
  fs.writeFileSync(BOARD, JSON.stringify(board, null, 2), 'utf8');

  if (pinGenesis && fs.existsSync(GENESIS_FLOW)) {
    const flow = JSON.parse(fs.readFileSync(GENESIS_FLOW, 'utf8'));
    flow.drawId = id;
    fs.writeFileSync(GENESIS_FLOW, JSON.stringify(flow, null, 2) + '\n', 'utf8');
    console.log('✅ Genesis flow pinned to draw:', id);
  }

  console.log('✅ Leaderboard updated:', BOARD);
  console.log('   Main:', shortAddr(winners.main), payout?.mainSol?.toFixed(4), 'SOL');
  console.log('   Push site/ to refresh GitHub Pages (free — no extra hosting).');
  console.log('   Genesis proof:', INFO_SITE + '/genesis/');
  console.log('   Hall of Fame:', INFO_SITE + '/leaderboard/');
}

main();
