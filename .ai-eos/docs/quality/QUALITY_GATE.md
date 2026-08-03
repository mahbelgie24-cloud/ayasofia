# Quality Gate — Ayasofia Sweet

|               |                              |
| ------------- | ---------------------------- |
| **الإصدار**   | 1.0                          |
| **آخر تحديث** | أغسطس 2026                   |
| **الإلزام**   | إلزامي قبل كل merge/delivery |

---

## بوابة الجودة (Quality Gate Checklist)

يجب اجتياز **كل** البنود قبل اعتبار المهمة مكتملة:

### 🟢 Phase 1: التطوير (Development)

- [ ] الكود يتبع `CODING_STANDARDS.md`
- [ ] لا `parseFloat` مباشر على أسعار أو مخزون
- [ ] لا استيراد server-only modules في Client Component
- [ ] كل Server Action يبدأ بـ `requireStaffSession` (إن تطلب)
- [ ] كل كتابة تستخدم `idempotencyKey`
- [ ] الكتابات المتعددة داخل `transaction`
- [ ] الأخطاء تُعالج (لا unhandled promises)
- [ ] رسائل الخطأ بالعربية ومفهومة

### 🟡 Phase 2: التحقق الآلي (Automated Checks)

- [ ] `tsc --noEmit` — 0 أخطاء TypeScript
- [ ] `npm run lint` — 0 أخطاء ESLint
- [ ] `npm run test` — كل الاختبارات ناجحة
- [ ] `npm run build` — البناء ينجح (للتحقق من توافق RSC/Client)

### 🔵 Phase 3: المراجعة (Review)

- [ ] مراجعة معمارية (Sonnet/CTO) — للقرارات المعمارية
- [ ] مراجعة كود (مهندس آخر أو Sonnet) — لكل كود جديد
- [ ] مراجعة أمنية — إن كان التغيير يمس auth/money/inventory
- [ ] لا تدهور في التغطية (لم تُحذف اختبارات بدون بديل)

### 🔴 Phase 4: القبول (Acceptance)

- [ ] تعريف الإنجاز (DoD) محقق للمهمة
- [ ] الميزة تعمل على بيئة staging/test
- [ ] الاختبارات اليدوية (manual smoke test) ناجحة
- [ ] الوثائق محدثة (CHANGELOG, CURRENT_STATE, ROADMAP)

---

## مصفوفة الجودة حسب نوع التغيير

| نوع التغيير                                    | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
| ---------------------------------------------- | ------- | ------- | ------- | ------- |
| **تغيير في المنطق المالي** (pricing, checkout) | ✅      | ✅      | ✅✅    | ✅✅    |
| **تغيير في المخزون** (inventory, recipes)      | ✅      | ✅      | ✅✅    | ✅      |
| **تغيير في الأمان** (auth, RLS)                | ✅      | ✅      | ✅✅✅  | ✅✅    |
| **مكون UI جديد**                               | ✅      | ✅      | ✅      | ✅      |
| **تغيير في الـ schema** (migration)            | ✅      | ✅      | ✅✅    | ✅      |
| **إصلاح خطأ (bug fix)**                        | ✅      | ✅      | ✅      | —       |
| **تحديث تبعية (dependency)**                   | —       | ✅      | —       | —       |
| **توثيق فقط**                                  | —       | —       | ✅      | ✅      |

✅✅ = مراجعة إضافية مطلوبة | ✅✅✅ = مراجعة أمنية شاملة

---

## حالات الفشل (Failure Modes)

### فشل Phase 2

→ **ممنوع التقدم.** أصلح الأخطاء ثم أعد التشغيل.

### فشل Phase 3

→ **مراجعة مع التعديلات.** المراجع يكتب تقريرًا (انظر `templates/reviews/REVIEW_REPORT_TEMPLATE.md`). المنفذ يُعدل ثم يُعاد التقديم.

### فشل Phase 4

→ **اجتماع سريع.** Human + Sonnet يناقشان: هل المشكلة في التنفيذ أم المواصفة؟ إما:

- تعديل + إعادة تنفيذ
- تعديل المواصفة (إذا كانت غير واقعية)
- تأجيل الميزة (إذا كانت العقبات أكبر من القيمة)

---

## مقاييس الجودة (Quality Metrics)

| المقياس                          | المستهدف         | القياس                  |
| -------------------------------- | ---------------- | ----------------------- |
| تغطية الاختبارات (المنطق المالي) | 100%             | `vitest run --coverage` |
| أخطاء TypeScript                 | 0                | `tsc --noEmit`          |
| أخطاء ESLint                     | 0                | `npm run lint`          |
| Core Web Vitals (LCP)            | < 2.5s           | Lighthouse / Playwright |
| Core Web Vitals (INP)            | < 200ms          | Lighthouse / Playwright |
| Core Web Vitals (CLS)            | < 0.1            | Lighthouse / Playwright |
| نسبة الأخطاء في الإنتاج          | < 1% of sessions | Sentry                  |
| وقت استجابة Server Actions       | < 500ms p95      | Sentry / logs           |

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** مع كل Phase جديد
- **التصعيد:** تجاوز أي بوابة = مخالفة لعملية الجودة
- **آخر تحديث:** أغسطس 2026
