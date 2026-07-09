# bounty-scan

Public-info bounty scanner (no sign-ups, no claims, no PRs to target projects).

## What it does

- Scrapes publicly accessible pages (currently IssueHunt OSS issues list + per-issue pages).
- Produces a Markdown shortlist with payout-evidence snippets and next-step suggestions.

## Usage

From repo root:

```bash
node tools/bounty-scan/scan.mjs
```

Optional:

- `--max N` (default: 10)
- `--pages N` (default: 1)
- `--out <path>` (write Markdown output to file)

Example:

```bash
node tools/bounty-scan/scan.mjs --pages 2 --max 10 --out reports/bounty-scan/scan-$(date +%F).md
```

## Notes

- This tool only scans and evaluates feasibility. It must not create accounts, accept tasks, or submit PRs to target repos.
