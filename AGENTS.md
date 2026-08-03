<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Ayasofia Sweet — Project Rules

Canonical source of truth: `docs/technical-spec.md`. If anything in this file
conflicts with the spec, the spec wins. Read the spec before starting work.

## Scope discipline

Work on **one roadmap phase item at a time** (see spec §13). Never implement
more than a single feature per session unless the user explicitly asks you to
stretch scope. When in doubt, finish the current task, commit, and ask.

## Order writes and idempotency

Every code path that creates or modifies an order **must** generate and pass
an `idempotencyKey` (spec §12). This is the guardrail that prevents a
retried network call or offline-sync replay from duplicating a sale. If you
write order-persistence logic that omits the key, you have introduced a bug.

## Role-based access control (RBAC)

Authorization is enforced **server-side**, not hidden behind UI. A user with
the `cashier` role must never be able to:

- read margin or ingredient-cost data,
- edit product prices,
- access the admin dashboard

even by calling a server action directly. Every server action that touches
restricted data must check the caller's role before executing, regardless of
what the UI chooses to show or hide. This is a hard requirement from spec §12.

## Money representation

Prices are stored as `numeric(10,2)` in Postgres (exact decimal, no
rounding risk) and returned by Drizzle as strings. All arithmetic in
`lib/pricing.ts` converts to integer minor units (agorot) at the boundary,
computes, and converts back only for display or before writing. Never do
arithmetic directly on the numeric-as-string values, and never let a raw
JS float touch a price calculation.

## When the spec doesn't answer a question

Look up the closest section in `docs/technical-spec.md` first. If it is
silent, prefer the simpler pattern that keeps operational overhead low
(single-branch shop, modular monolith, no distributed complexity — spec §4).
