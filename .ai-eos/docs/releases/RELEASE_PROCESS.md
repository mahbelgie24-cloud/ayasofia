# Engineering Release Process — Ayasofia AI-EOS

|               |            |
| ------------- | ---------- |
| **الإصدار**   | 1.0        |
| **آخر تحديث** | أغسطس 2026 |

---

## ١. فلسفة الإطلاق

> **نحن نطلق فقط ما تمت مراجعته واختباره واعتماده.**

لا إطلاق لأي كود لم يمر عبر:

1. ✅ Code Review (Sonnet)
2. ✅ Automated Tests (tsc + eslint + vitest)
3. ✅ Human Approval (للميزات المرئية أو المالية)

---

## ٢. أنواع الإصدارات (Semantic Versioning)

```
v<MAJOR>.<MINOR>.<PATCH>

MAJOR: تغييرات جذرية (إعادة كتابة، تغيير هيكلي)
MINOR: ميزات جديدة (متوافقة مع السابق)
PATCH: إصلاحات أخطاء (متوافقة مع السابق)
```

| الإصدار الحالي | `v0.1.0` |
| -------------- | -------- |

---

## ٣. استراتيجية الفروع (Branch Strategy)

```
main          ← production (ما يعيش على Vercel)
  └── develop ← integration (ما يتم العمل عليه)
       └── feat/XXXX-description  ← feature branches
       └── fix/XXXX-description   ← bug fix branches
```

### القواعد:

- **main:** لا يُدفع إليه مباشرة. فقط عبر merge من develop بعد المراجعة.
- **develop:** يُدفع إليه بعد المراجعة (Sonnet).
- **feature/fix branches:** يدفع إليها DeepSeek أثناء التنفيذ.

---

## ٤. دورة الإطلاق (Release Cycle)

```
┌──────────────┐
│  تطوير        │  DeepSeek ينفذ على feat/XXXX
│  (جلسة واحدة) │
└──────┬───────┘
       │ PR / Review Request
       ▼
┌──────────────┐
│  مراجعة       │  Sonnet يراجع
│  (Review)    │
└──────┬───────┘
       │ ✅ Approved
       ▼
┌──────────────┐
│  دمج          │  Merge ← develop
│  (Merge)     │
└──────┬───────┘
       │ تراكم عدة ميزات
       ▼
┌──────────────┐
│  إصدار        │  develop ← main
│  (Release)   │
└──────┬───────┘
       │ Vercel auto-deploy
       ▼
┌──────────────┐
│  نشر          │  Production live
│  (Deploy)    │
└──────┬───────┘
       │ مراقبة ٢٤ ساعة
       ▼
┌──────────────┐
│  مراقبة       │  Sentry + Human
│  (Monitor)   │
└──────────────┘
```

---

## ٥. أوامر الإطلاق (Release Checklist)

### قبل الإطلاق

- [ ] `npm run build` يمر على بيئة الإنتاج
- [ ] كل الاختبارات ناجحة
- [ ] `CHANGELOG.md` محدث
- [ ] `CURRENT_STATE.md` يعكس الحالة الجديدة
- [ ] تم عمل نسخة احتياطية من قاعدة البيانات (Supabase auto)
- [ ] إشعار Human بأن الإطلاق قادم

### الإطلاق

```bash
# 1. الدمج إلى main
git checkout main
git merge develop

# 2. إنشاء tag
git tag -a v0.2.0 -m "Release v0.2.0: Phase 4 Reporting"
git push origin main --tags

# 3. Vercel يبني وينشر تلقائيًا (من main)
```

### بعد الإطلاق

- [ ] تأكيد أن النشر ناجح (زيارة الرابط)
- [ ] اختبار سريع (smoke test) على الإنتاج
- [ ] مراقبة Sentry لمدة ٢٤ ساعة
- [ ] إبلاغ Human
- [ ] إنشاء RELEASE_NOTES.md

---

## ٦. التراجع (Rollback)

### إذا فشل الإطلاق:

```bash
# Vercel: زر "Redeploy" من الإصدار السابق
# يدويًا:
git checkout main
git revert <commit-hash>  # التراجع عن commits
git push origin main
```

### قاعدة التراجع:

> إذا كان hotfix مطلوبًا، يتم على `main` مباشرة ثم يُدمج إلى `develop` بعد الاستقرار.

---

## ٧. CHANGELOG

يحفظ في `CHANGELOG.md` (مجلد `.ai-eos/changelog/`).

**تنسيق الإدخال:**

```markdown
## [v0.2.0] — 2026-08-15

### Added

- Z-report generation endpoint
- Daily sales summary on admin dashboard

### Changed

- Extracted usePOSCart hook for shared cart logic

### Fixed

- parseFloat in getReceiptData replaced with toMinorUnits
- Customer order now reuses idempotencyKey across retries

### Security

- Added rate limiting on verifyStaffPin (max 5 attempts per 60s)
```

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** مع كل إطلاق رئيسي
- **آخر تحديث:** أغسطس 2026
