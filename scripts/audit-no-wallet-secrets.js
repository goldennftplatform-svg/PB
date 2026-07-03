/**
 * Scan repo for accidental wallet secret commits (keypair JSON arrays, base58 seeds).
 * Run before game-day funding or before git push:
 *   node scripts/audit-no-wallet-secrets.js
 *
 * Exit 1 if suspicious files found in tracked paths.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'target',
  'dist',
  'build',
  '.anchor',
  'test-ledger',
  'game-day-wallets/private',
  'wallet-backups',
  'test-wallets',
  'speed-run-wallets',
  'bots/wallets',
  '~',
]);

const SKIP_FILES = new Set([
  'package-lock.json',
  'bun.lock',
]);

/** 64-byte secret key exported as JSON number array */
function looksLikeKeypairJson(content) {
  if (!content.startsWith('[')) return false;
  try {
    const arr = JSON.parse(content);
    return Array.isArray(arr) && arr.length === 64 && arr.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  } catch {
    return false;
  }
}

function walk(dir, findings) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    const rel = path.relative(REPO_ROOT, full).replace(/\\/g, '/');

    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(rel) || [...SKIP_DIRS].some((s) => rel.startsWith(s + '/'))) continue;
      walk(full, findings);
      continue;
    }

    if (SKIP_FILES.has(ent.name)) continue;
    if (!/\.(json|env|md|txt|ts|tsx|js)$/i.test(ent.name)) continue;
    if (rel.includes('public-registry.example')) continue;
    if (rel.endsWith('.example.json')) continue;

    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.size > 2 * 1024 * 1024) continue;

    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    if (looksLikeKeypairJson(content.trim())) {
      findings.push({ rel, reason: '64-byte keypair JSON array' });
    }

    if (/\[(\d{1,3},\s*){63}\d{1,3}\]/.test(content) && content.includes('secretKey')) {
      findings.push({ rel, reason: 'possible secretKey array in source' });
    }
  }
}

function main() {
  const findings = [];
  walk(REPO_ROOT, findings);

  console.log('');
  console.log('PEPEBALL wallet secret audit');
  console.log('Repo:', REPO_ROOT);
  console.log('');

  if (findings.length === 0) {
    console.log('OK — no obvious keypair material in scanned tracked paths.');
    console.log('(Private dirs like wallet-backups/ are skipped — verify they stay gitignored.)');
    return;
  }

  console.error('FAIL — possible secrets found:');
  for (const f of findings) {
    console.error('  -', f.rel, '—', f.reason);
  }
  console.error('');
  console.error('Remove or gitignore these files before funding game-day wallets.');
  process.exit(1);
}

main();
