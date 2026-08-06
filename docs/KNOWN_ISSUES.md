# Known Issues & Accepted Deviations

Everything here is deliberate, documented, and an **INFO-level** trade-off —
nothing is a silent foot-gun. Each entry links to the decision and says what
"good" would look like.

## T-A2 — `/order` source backfill skipped (Q1=B)

The `/order` ordering surface was retired via a 308 redirect to the digital
menu (see `docs/digital-menu.md`). Customer-origin orders that were created
through the old `/order` path would have been stored as `source = 'POS'` with
`staff_id = NULL` (POS is the column default), so they can't be told apart from
a genuine cashier walk-up that happened to have no staff link.

**Evidence check (read-only):** `SELECT count(*) FILTER (WHERE source='POS' AND
staff_id IS NULL) FROM orders;` → **0 rows** at retirement time. Because there
were **no** rows on the discriminator, the optional backfill to
`source = 'DIGITAL_MENU'` was **skipped** — there was nothing to migrate, so no
transaction was run. If any such rows appear later, backfill them in a single
transaction (set `source='DIGITAL_MENU'` where `source='POS' AND staff_id IS
NULL`) and rerun reports.

**"Good":** the schema default for `source` existed before the discriminator
was introduced, so very old `/order` orders are indistinguishable by data
alone; a future migration could tag them, but doing so risks mislabeling real
cashier sales, which is worse than leaving them as POS.

## P2-DAT-1 — today-suggestion deactivate+insert is now transactional

Previously `setTodaySuggestion` deactivated all suggestions and then inserted
the new one in two separate statements; an insert failure would leave the
portal with **no** active suggestion. Now both run inside
`db.transaction(...)`, so a failure rolls back the deactivation and the
previously-active suggestion survives (`today-suggestion.integration.test.ts`).

---

More entries are appended as they are found (see the docs wisdom pass).
