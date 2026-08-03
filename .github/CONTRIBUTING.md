# Contributing to Ayasofia Sweet

شكرًا لاهتمامك بالمساهمة. هذا المشروع يتبع **AI Engineering Operating System (AI-EOS)** — اقرأ `.ai-eos/README.md` أولاً.

---

## أدوات التطوير المطلوبة

```bash
Node.js >= 20
npm >= 10
PostgreSQL 15+ (عبر Supabase)
```

## إعداد بيئة التطوير

```bash
# 1. استنساخ المستودع
git clone https://github.com/anomalyco/ayasofia.git
cd ayasofia

# 2. تثبيت التبعيات
npm install

# 3. إعداد متغيرات البيئة
cp .env.example .env.local
# املأ القيم من Supabase dashboard

# 4. تطبيق هجرات قاعدة البيانات
npx drizzle-kit migrate

# 5. تحميل البيانات الأولية (للتطوير)
npx tsx db/seed.ts

# 6. تشغيل خادم التطوير
npm run dev
```

---

## دورة التطوير (AI-EOS)

```
Human (PO) → Sonnet (CTO) يحلل ويكتب SPEC → DeepSeek (SE) ينفذ → Sonnet يراجع → Human يوافق
```

### للمطورين البشر

- راجع `AGENTS.md` لفهم قواعد المشروع
- اقرأ `docs/technical-spec.md` قبل أي تغيير
- اتبع `CODING_STANDARDS.md` في `.ai-eos/docs/quality/`

### لوكلاء AI

- اقرأ `AGENTS.md` (القواعد المختصرة)
- اقرأ `CLAUDE.md` (ملاحظات Claude المحددة)
- اقرأ `docs/technical-spec.md` (المواصفة الكاملة)

---

## سير العمل (Git Workflow)

```bash
# 1. أنشئ فرعًا من develop
git checkout develop
git pull
git checkout -b feat/XXXX-short-description

# 2. طور + اختبر
npm run typecheck
npm run lint
npm run test

# 3. Commit (Conventional Commits)
git commit -m "feat: add daily sales summary report"

# 4. ادفع وافتح PR
git push origin feat/XXXX-short-description
# افتح PR نحو develop

# 5. انتظر المراجعة
# Sonnet (CTO) سيراجع الكود
# عدّل حسب الملاحظات إن لزم
```

---

## معايير الكود (Quick Reference)

### القواعد الذهبية

```
❌ لا parseFloat على أسعار أبدًا — استخدم toMinorUnits()
❌ لا تتجاوز requireStaffSession() في Server Actions
✅ كل كتابة = idempotencyKey
✅ كل كتابات متعددة = db.transaction()
```

### أسلوب Commit (Conventional Commits)

| البادئة     | الاستخدام                   |
| ----------- | --------------------------- |
| `feat:`     | ميزة جديدة                  |
| `fix:`      | إصلاح خطأ                   |
| `refactor:` | إعادة هيكلة بدون تغيير سلوك |
| `test:`     | إضافة أو تعديل اختبارات     |
| `docs:`     | توثيق                       |
| `security:` | إصلاح أمني                  |
| `chore:`    | صيانة (تبعيات، بناء)        |

### هيكل الملفات

| النوع         | المسار                         |
| ------------- | ------------------------------ |
| Server Action | `app/[route]/actions.ts`       |
| صفحة          | `app/[route]/page.tsx`         |
| مكون عميل     | `app/[route]/[name]-shell.tsx` |
| مكون مشترك    | `components/[name].tsx`        |
| مكتبة         | `lib/[name].ts`                |
| اختبار        | `__tests__/[name].test.ts`     |
| E2E           | `e2e/[name].spec.ts`           |

---

## الاختبارات

```bash
# وحدة + تكامل
npm run test

# E2E (تحتاج Supabase)
npx playwright test

# وضع المراقبة
npx vitest
```

**قاعدة:** كل منطق مالي أو مخزون يجب أن يكون له اختبار وحدة.

---

## التواصل

- **قضايا تقنية:** افتح Issue بـ Bug Report template
- **اقتراحات:** افتح Issue بـ Feature Request template
- **أمان:** لا تفتح Issue عامًا — راجع `SECURITY.md`

---

## ترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE).
