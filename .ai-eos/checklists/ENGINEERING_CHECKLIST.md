# Engineering Checklists — Ayasofia AI-EOS

|               |            |
| ------------- | ---------- |
| **الإصدار**   | 1.0        |
| **آخر تحديث** | أغسطس 2026 |

---

## ١. قائمة المطور (Developer Checklist — قبل تقديم الكود)

انسخ هذه القائمة في تقريرك التنفيذي:

```
### Self-Check Results

- [ ] tsc --noEmit: [PASS/FAIL]
- [ ] npm run lint: [PASS/FAIL] ([N] warnings)
- [ ] npm run test: [PASS/FAIL] ([N]/[TOTAL])
- [ ] npm run build: [PASS/FAIL]
- [ ] Zero parseFloat on prices: [YES/NO]
- [ ] requireStaffSession on all new server actions: [YES/NO/NA]
- [ ] idempotencyKey on all writes: [YES/NO/NA]
- [ ] Writes wrapped in transactions: [YES/NO/NA]
- [ ] New code follows CODING_STANDARDS.md: [YES]
- [ ] No commented-out code left behind: [YES]
```

---

## ٢. قائمة المراجع (Reviewer Checklist — Sonnet قبل الموافقة)

```
### Review Checklist

Security:
- [ ] Every server action starts with requireStaffSession (except known exceptions)
- [ ] Correct minRole is enforced (manager for admin actions)
- [ ] No secrets or keys in code
- [ ] No service-role client import in Client Components
- [ ] Inputs are validated before use

Financial:
- [ ] Prices recalculated server-side (not trusted from client)
- [ ] idempotencyKey present on all order/inventory writes
- [ ] Multiple writes wrapped in db.transaction()
- [ ] No parseFloat on numeric-as-string from Drizzle
- [ ] Money arithmetic uses integer minor units (agorot)

Architecture:
- [ ] New files in correct layer (UI / Application / Data)
- [ ] No layer skipping (UI → DB directly)
- [ ] No new dependencies without ADR
- [ ] Schema changes via drizzle-kit generate (not manual)

Code Quality:
- [ ] Follows CODING_STANDARDS.md
- [ ] < 300 lines per file, < 50 lines per function
- [ ] No `any` types (or justified)
- [ ] Imports use @/ aliases
- [ ] Error messages in Arabic and user-friendly

Testing:
- [ ] New logic has unit tests
- [ ] Financial logic has test coverage
- [ ] Edge cases covered (empty, invalid, boundary)
- [ ] Tests are independent and repeatable

UI/UX:
- [ ] Touch targets ≥ 44px (POS/Drive-Thru)
- [ ] Text in Arabic (primary)
- [ ] Brand colors used correctly
- [ ] RTL layout not broken
- [ ] Alt text on images, aria-labels on icon-only buttons

Documentation:
- [ ] CHANGELOG updated (if user-visible change)
- [ ] CURRENT_STATE updated (if milestone change)
- [ ] ADR written (if architectural decision)
```

---

## ٣. قائمة الأمان (Security Audit Checklist — قبل كل إطلاق رئيسي)

```
Authentication:
- [ ] PIN hashing: scrypt + salt (verify in code)
- [ ] Rate limiting active on verifyStaffPin
- [ ] Session refresh after PIN verification
- [ ] endStaffSession works correctly

Authorization:
- [ ] All server actions gated (except verifyStaffPin, placeCustomerOrder)
- [ ] Role checks correct: manager = inventory/ reports, owner = staff/settings
- [ ] Admin layout throws 404 for insufficient role
- [ ] Proxy redirects unauthenticated users to /login

Data Protection:
- [ ] Service-role key never in client bundle
- [ ] .env.local git-ignored
- [ ] No secrets in logs (console.error)
- [ ] No sensitive data in error messages to client
- [ ] Customer phone numbers not publicly exposed

Infrastructure:
- [ ] RLS policies active on all tables
- [ ] Database backups automated (Supabase)
- [ ] Dependency audit: npm audit (no critical vulns)
- [ ] Content-Security-Policy headers configured
- [ ] HTTPS enforced (Vercel auto)

OWASP Top 10:
- [ ] A01: Broken Access Control — ✅ RLS + requireStaffSession
- [ ] A02: Cryptographic Failures — ✅ scrypt + TLS
- [ ] A03: Injection — ✅ Drizzle parameterized queries
- [ ] A05: Security Misconfiguration — [check rate limiting, CSP]
- [ ] A07: Auth Failures — [check PIN rate limiting]
- [ ] A08: Software & Data Integrity — ✅ idempotency + server calc
```

---

## ٤. قائمة ما قبل الإطلاق (Pre-Release Checklist)

```
Before deploying to production:

Data:
- [ ] Real menu data seeded (not placeholder)
- [ ] Real ingredients and recipes verified by owner
- [ ] Tax rate confirmed with accountant
- [ ] Currency confirmed (ILS)

Functionality:
- [ ] 20-sale E2E DoD test passes
- [ ] Z-report matches manual cash count
- [ ] Drive-Thru flow tested end-to-end
- [ ] Customer self-order flow tested
- [ ] KDS receives orders in < 3 seconds
- [ ] WhatsApp receipt sharing works

Security:
- [ ] Security audit checklist passed
- [ ] Rate limiting active on PIN
- [ ] Anonymous user cleanup job scheduled

Operations:
- [ ] Staff trained on system
- [ ] Backup plan: manual process still available
- [ ] Support contact established
- [ ] Parallel run scheduled (1 week minimum)

Go/No-Go Decision:
- [ ] Human approval: __________ (sign)
- [ ] Date: __________
```

---

## ٥. قائمة التعافي من الكوارث (Disaster Recovery Checklist)

```
If the system is down:

Immediate (first 5 minutes):
- [ ] Switch to manual paper ordering
- [ ] Notify Human (owner)
- [ ] Check Vercel dashboard — is the app down?
- [ ] Check Supabase dashboard — is the DB down?

Investigation (next 30 minutes):
- [ ] Check Sentry for error spikes
- [ ] Check recent deployments (any breaking changes?)
- [ ] Check Supabase logs
- [ ] Check Vercel logs

Recovery:
- [ ] If Vercel issue: redeploy last known good commit
- [ ] If Supabase issue: contact Supabase support + switch to offline mode
- [ ] If data issue: restore from latest Supabase backup

Post-recovery:
- [ ] Write postmortem (templates/reports/POSTMORTEM_TEMPLATE.md)
- [ ] Update RISK_REGISTER.md
- [ ] Implement preventive measures
```

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **التحديث:** عند إضافة مرحلة جديدة أو اكتشاف نمط خطأ متكرر
- **آخر تحديث:** أغسطس 2026
