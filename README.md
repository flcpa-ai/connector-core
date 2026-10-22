# connector-core

The capability contract and the governance code shared by FLCPA.AI's marketplace connectors —
read-only integrations that land a client's accounting or commerce data in their own warehouse
dataset, under consent, with lineage and data-quality checks.

A connector implements `list`, `pull` and `health` over whatever it already has. A gateway in
front of several of them then adds nothing of its own.

Published as `@flcpa-ai/connector-core`. The scope makes it obvious in an import line where the
code comes from, and keeps it from colliding with an unrelated package of the same name.

## Why A Package First

A shared *service* was the original plan. In practice what the connectors shared was **copied
code**: several files had drifted into byte-identical duplicates, and others differed only in
whether they said "company" or "org".

A package fixes that duplication without redeploying working apps. It also pins down the
`list` / `pull` / `health` contract, so a gateway built later has something to implement rather
than something to invent.

## What Is Here

| Module | What It Holds | Where It Came From |
| --- | --- | --- |
| `contract.ts` | `ConnectorAdapter` (`list`, `pull`, `health`), the `Capabilities` descriptor, and `assertWritesOff` | New |
| `money.ts` | Exact decimal money arithmetic in BigInt minor units | Consolidated from identical copies |
| `crypto.ts` | AES-256-GCM encryption for OAuth tokens at rest | Consolidated from identical copies |
| `dataset.ts` | BigQuery dataset naming, `<prefix><tenant>`, fixed at first connect | Consolidated; "company"/"org" generalised to "tenant" |
| `catalog.ts` | Data-catalog *types* and validation, plus a configurable `minimize` | Types ported; each platform keeps its own catalog content |
| `lineage.ts` | Extraction-run and quality-check record types | Consolidated from the connectors' schemas |
| `guard.ts` | The read-only scan a connector runs in CI | Generalised from the connectors' own guards |

## What Is Deliberately Not Here

Left out of v0.1 with a reason, not forgotten:

- **Staff sign-in** — nearly identical across connectors, but it imports a web framework and each
  app's own config. Moving it would make this package depend on a framework. It belongs in a
  later framework-specific entry point, and the duplication costs almost nothing meanwhile.
- **The tenant registry** — coupled to each app's ORM client and to platform entities that
  genuinely are not the same shape.
- **`brand.ts` and the catalog contents** — per-app by design. Their *types* are here; their
  values stay with the app, which is what makes the two brands possible.

## Read-Only v1, Writes Declared And Off

Every adapter declares its write operations and every one of them is `enabled: false`. That is
the rule every connector follows, which each had previously expressed in its own way — an empty
scope allowlist in one, a CI guard in another. Expressing it as data means one definition instead
of several conventions.

`assertWritesOff` and `capabilityProblems` make it checkable, and each connector calls them where it builds its adapter. A write operation may only
be enabled with a `decision` naming the `DECISIONS.md` row that authorises it; the guard fails the
build otherwise.

## Using It

The connectors install this from git, so there is no private npm registry to run:

```bash
npm install github:flcpa-ai/connector-core#v0.1.1
```

Pin a tag, never a branch. **Use `v0.1.1` or later**: `v0.1.0` relied on `prepare` building
`dist/` at install time, so with `ignore-scripts` set it installed cleanly and then failed every
import. `dist/` is committed from `v0.1.1` on, so the package works either way — and CI fails if
`dist/` is stale, which means **running `npm run build` and committing `dist/` with any change to
`src/`**.

```ts
import { parseMoney, formatMoney } from "@flcpa-ai/connector-core/money";
import type { ConnectorAdapter, Capabilities } from "@flcpa-ai/connector-core";
```

## Checks

- `npm run check:package` — src/ imports only `node:` built-ins, every module stays self-contained, and there are no runtime dependencies.
- `npm test` — `node:test`, no test framework to install.
- `npm run typecheck`, `npm run build`.
- `npm run check` runs all four, as CI does.

Node 22.12 or newer; CI runs 24.
