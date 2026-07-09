#!/usr/bin/env node
/**
 * Minimal public-info scanner.
 * - No login
 * - No claims
 * - No PR submissions to target repos
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";

const ISSUEHUNT_LIST_URL = "https://oss.issuehunt.io/issues";
const ISSUEHUNT_FAQ_URL = "https://issuehunt.io/faq";

function parseArgs(argv) {
  const args = { max: 10, pages: 1, out: null, listHtml: null, faqHtml: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--max") args.max = Number(argv[++i] ?? args.max);
    else if (a === "--pages") args.pages = Number(argv[++i] ?? args.pages);
    else if (a === "--out") args.out = argv[++i] ?? null;
    else if (a === "--list-html") args.listHtml = argv[++i] ?? null;
    else if (a === "--faq-html") args.faqHtml = argv[++i] ?? null;
  }
  if (!Number.isFinite(args.max) || args.max <= 0) args.max = 10;
  if (!Number.isFinite(args.pages) || args.pages <= 0) args.pages = 1;
  return args;
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": "bounty-scan/1.0 (+https://github.com/arakoodev/EdgeChains)",
      accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function stripTags(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tryParseNextData(html) {
  // Variant A: <script id="__NEXT_DATA__" type="application/json">...</script>
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }

  // Variant B: inline assignment __NEXT_DATA__={...};__NEXT_LOADED_PAGES__=...
  const m2 = html.match(/__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*;\s*__NEXT_LOADED_PAGES__/i);
  if (!m2) return null;
  try {
    return JSON.parse(m2[1]);
  } catch {
    return null;
  }
}

function findIssuesArrayInNextData(nextData) {
  const queue = [nextData];
  const seen = new Set();

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);

    if (Array.isArray(node.issues) && node.issues.length) {
      const sample = node.issues[0];
      if (sample && typeof sample === "object" && (typeof sample.number === "number" || typeof sample.issueNumber === "number")) {
        return node.issues;
      }
    }

    for (const v of Object.values(node)) {
      if (v && typeof v === "object") queue.push(v);
    }
  }

  return null;
}

function extractIssuehuntCardsFromNextData(nextData) {
  const issues = findIssuesArrayInNextData(nextData);
  if (!issues) return null;

  return issues
    .map((it) => {
      const owner = it.repositoryOwnerName || it.organization?.login || it.repository?.ownerLogin || null;
      const repo = it.repositoryName || it.repository?.name || null;
      const repoFullName = owner && repo ? `${owner}/${repo}` : null;
      const issueNumber = it.number ?? it.issueNumber ?? null;
      const depositAmount = it.depositAmount ?? it.fundedAmount ?? it.funded ?? it.funded_amount ?? null; // cents
      const prCount = it.pullRequestCount ?? it.prCount ?? it.pullRequestsCount ?? null;

      if (!repoFullName || !owner || !repo || !issueNumber) return null;

      return {
        platform: "IssueHunt",
        title: it.title ? String(it.title) : "(no title)",
        owner,
        repo,
        repoFullName,
        issueNumber: Number(issueNumber),
        issueUrl: `https://oss.issuehunt.io/r/${owner}/${repo}/issues/${issueNumber}`,
        amountUsd: typeof depositAmount === "number" ? depositAmount / 100 : null,
        prCount: typeof prCount === "number" ? prCount : null,
      };
    })
    .filter(Boolean);
}

function extractIssuehuntCards(listHtml) {
  const nextData = tryParseNextData(listHtml);
  if (nextData) {
    const fromNext = extractIssuehuntCardsFromNextData(nextData);
    if (fromNext && fromNext.length) return fromNext;
  }

  // Heuristic fallback: link + nearby $ amount
  const cards = [];
  const re = /href="(\/r\/[^"\/]+\/[^"\/]+\/issues\/\d+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const moneyRe = /(?:\$|&#36;|&dollar;)\s*([0-9]+(?:\.[0-9]{2})?)/i;
  let m;
  while ((m = re.exec(listHtml)) !== null) {
    const path = m[1];
    const titleRaw = stripTags(m[2]);
    if (!path || !titleRaw) continue;

    const context = listHtml.slice(m.index, Math.min(listHtml.length, m.index + 5000));
    const amountMatch = context.match(moneyRe);
    const prMatch = context.match(/(\d+)\s+pull\s+requests?/i);

    const parts = path.split("/");
    const owner = parts[2];
    const repo = parts[3];
    const issueNumber = Number(parts[5]);

    cards.push({
      platform: "IssueHunt",
      title: titleRaw,
      owner,
      repo,
      repoFullName: `${owner}/${repo}`,
      issueNumber,
      issueUrl: `https://oss.issuehunt.io${path}`,
      amountUsd: amountMatch ? Number(amountMatch[1]) : null,
      prCount: prMatch ? Number(prMatch[1]) : null,
    });
  }

  const seen = new Set();
  const uniq = [];
  for (const c of cards) {
    if (seen.has(c.issueUrl)) continue;
    seen.add(c.issueUrl);
    uniq.push(c);
  }
  return uniq;
}

function extractIssuehuntPayoutEvidence(faqHtml) {
  const text = stripTags(faqHtml).toLowerCase();
  if (text.includes("paypal") && text.includes("bank")) {
    return "IssueHunt FAQ mentions payouts via bank or PayPal.";
  }
  if (text.includes("paypal")) return "IssueHunt FAQ mentions PayPal payouts.";
  if (text.includes("bank")) return "IssueHunt FAQ mentions bank payouts.";
  return "IssueHunt FAQ payout method not detected from HTML (site may have changed).";
}

function priorityFrom(card) {
  if ((card.amountUsd ?? 0) >= 200) return "P1";
  if ((card.amountUsd ?? 0) >= 50) return "P2";
  return "P3";
}

function estimateDifficulty(card) {
  if ((card.amountUsd ?? 0) >= 200) return "High (likely large scope)";
  if ((card.prCount ?? 0) >= 3) return "Medium (competition/coordination)";
  return "Medium";
}

function formatMarkdown({ generatedAt, payoutEvidence, candidates }) {
  const lines = [];
  lines.push(`# Bounty Scan (public info)`);
  lines.push("");
  lines.push(`- Generated: ${generatedAt}`);
  lines.push(`- Scope: IssueHunt OSS issues list (no sign-ups / no claims)`);
  lines.push(`- Payout evidence: ${payoutEvidence}`);
  lines.push("");
  lines.push(`## Candidates`);
  lines.push("");

  let i = 0;
  for (const c of candidates) {
    i++;
    lines.push(`${i}. ${c.repoFullName} #${c.issueNumber} - ${c.title}`);
    lines.push(`   - Platform: ${c.platform}`);
    lines.push(`   - Amount: ${c.amountUsd != null ? `$${c.amountUsd.toFixed(2)}` : "Unknown"}`);
    lines.push(`   - Issue: ${c.issueUrl}`);
    lines.push(`   - Active PR/claim: ${c.prCount != null ? `${c.prCount} PR(s) listed` : "Unknown"}`);
    lines.push(`   - Difficulty: ${estimateDifficulty(c)}`);
    lines.push(`   - Priority: ${priorityFrom(c)}`);
    lines.push(`   - Next step: Open the issue page + linked repo; identify a small, standalone subtask before investing.`);
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);

  const [listHtml, faqHtml] = await Promise.all([
    args.listHtml ? Promise.resolve(readFileSync(args.listHtml, "utf8")) : fetchText(ISSUEHUNT_LIST_URL),
    args.faqHtml ? Promise.resolve(readFileSync(args.faqHtml, "utf8")) : fetchText(ISSUEHUNT_FAQ_URL).catch(() => ""),
  ]);

  const payoutEvidence = faqHtml ? extractIssuehuntPayoutEvidence(faqHtml) : "IssueHunt FAQ fetch failed.";
  const cards = extractIssuehuntCards(listHtml);
  const candidates = cards.slice(0, args.max);

  const md = formatMarkdown({
    generatedAt: new Date().toISOString(),
    payoutEvidence,
    candidates,
  });

  if (args.out) {
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, md, "utf8");
  } else {
    process.stdout.write(md);
    process.stdout.write("\n");
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exitCode = 1;
});
