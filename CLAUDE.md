# connector-core: Instructions for Claude

The shared package behind FLCPA.AI's marketplace connectors. This repository is public; the
connectors that use it, and the decisions about them, are not. Keep operational detail about
those systems out of this repo — see the note at the end.

## Ground Rules

- **This package never talks to a platform API.** It holds the contract, the shared governance
  code and the guards. Every HTTP call to Intuit, Zoho or Shopify stays in the connector repo
  that owns that platform.
- **No web framework, no ORM, no cloud SDK as a dependency.** The only runtime imports allowed
  are `node:` built-ins. That is what lets all three connectors install this without an
  argument about versions, and it is why `staff-auth` and `registry` are not here (see README).
- **Every module is self-contained.** No relative imports except in `index.ts`. The connector
  repos run tests and scripts under `node --experimental-strip-types`, which loads one file at a
  time, and the house style already follows this.
- **Money is never a float.** `money.ts` works in BigInt minor units. Nothing here may parse a
  money amount into a `number`.
- **Write capabilities are declared and off.** A `WriteOperation` may only have `enabled: true`
  with a `decision` naming the hub `DECISIONS.md` row that authorises it. `capabilityProblems`
  and `assertWritesOff` enforce this; do not weaken them, and call `assertWritesOff` where a
  connector builds its adapter so a mistake fails at startup.
- **Never report a partial result as complete.** `PullResult` carries its failed checks and a
  `partial` status for exactly this reason. Do not let a caller sum rows without seeing them.

## Conventions

- ESM, `"type": "module"`, Node 22.12+.
- Relative imports in `index.ts` use `.js` extensions, which is what an emitting ESM TypeScript
  package needs. Tests and scripts import source with `.ts` extensions, which is what
  `--experimental-strip-types` needs. Two tsconfigs exist for exactly this reason — see the
  comments in `tsconfig.json` and `tsconfig.build.json`.
- Tests are `node:test` with `node:assert/strict`. No test framework.
- Title Case on headings.
- Bump the version and tag it when a connector needs to pin a new release.

## When Changing The Contract

`contract.ts` is consumed by three apps. A breaking change to it means three PRs, so:

1. Add, don't repurpose. A new optional field beats a changed meaning.
2. Say in the PR body which connectors need a follow-up change, and open the hub `STATUS.md`
   item for each.
3. A change to what `list`, `pull`, `health` or `status` mean is a decision, not an implementation
   detail — it needs a row in the hub's `DECISIONS.md` first.

## This Repository Is Public

The connectors that depend on this package are private, and so are the decisions about them.
Keep that boundary:

- Describe what a module does and why it exists, not which connector lacked it.
- Do not name a system's weaknesses, open gaps or unreleased fixes here — a comment that reads
  as a note to a colleague reads very differently in a public repo.
- Per-connector plans, adoption order and anything operational belong in the internal
  documentation, not in this README, these comments, or a commit message.

The test: would this sentence help an attacker decide where to look? If so, it goes internal.
