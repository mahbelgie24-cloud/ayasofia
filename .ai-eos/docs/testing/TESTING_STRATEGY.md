# Testing Strategy — Ayasofia Sweet

|               |                                              |
| ------------- | -------------------------------------------- |
| **الإصدار**   | 1.0                                          |
| **آخر تحديث** | أغسطس 2026                                   |
| **الإطار**    | Vitest (unit/integration) + Playwright (E2E) |

---

## ١. هرم الاختبارات (Testing Pyramid)

```
        ┌─────┐
        │ E2E │   Playwright — تدفقات حرجة
        │ 3   │   POS checkout flow, KDS realtime
        ├─────┤
        │ INT │   Vitest + DB حقيقية
        │ 6   │   checkout, inventory, concurrent
        ├─────┤
        │UNIT │   Vitest — منطق معزول
        │ 58  │   pricing, receipt, auth, validations
        └─────┘
```

**الأرقام:** اختبارات المشروع الحالية (67 إجماليًا)

---

## ٢. استراتيجية الاختبار

### ٢.١ ما يجب اختباره (أولويات)

| الأولوية | ماذا               | الإطار             | مثال                               |
| -------- | ------------------ | ------------------ | ---------------------------------- |
| 🔴 P0    | المنطق المالي      | Vitest unit        | `calculateLineTotal` بكل التركيبات |
| 🔴 P0    | خصم المخزون        | Vitest integration | check stock before/after sale      |
| 🔴 P0    | idempotency        | Vitest integration | concurrent key collision           |
| 🟡 P1    | تدفقات المستخدم    | Playwright E2E     | 20 صفقة DoD                        |
| 🟡 P1    | التحقق من المدخلات | Vitest unit        | empty cart, missing key            |
| 🟢 P2    | تنسيق الإيصال      | Vitest unit        | receipt text formatting            |
| 🟢 P2    | صلاحيات المستخدم   | Vitest unit        | cashier can't access admin         |

### ٢.٢ ما لا نختبره (حاليًا)

- ❌ اختبارات المكونات (Component tests) — لا توجد بنية تحتية لها
- ❌ اختبارات مرئية (Visual regression) — لا Percy/Chromatic
- ❌ اختبارات RLS مباشرة — تُختبر ضمنيًا عبر integration tests

---

## ٣. أنماط الاختبارات

### ٣.١ اختبار الوحدة (Unit Test)

```typescript
// __tests__/pricing.test.ts
import { describe, it, expect } from "vitest";
import { calculateLineTotal } from "@/lib/pricing";

describe("calculateLineTotal", () => {
  it("single item with no modifiers", () => {
    expect(calculateLineTotal("15.00", [], 1)).toBe(1500);
  });

  it("multiple quantities with priced modifiers", () => {
    expect(calculateLineTotal("15.00", [{ priceDelta: "3.00" }, { priceDelta: "2.00" }], 3)).toBe(
      6000,
    );
  });

  it("handles decimal prices", () => {
    expect(calculateLineTotal("2.50", [{ priceDelta: "1.25" }], 2)).toBe(750);
  });
});
```

### ٣.٢ اختبار التكامل (Integration Test)

```typescript
// __tests__/inventory.integration.test.ts
import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { logPurchase } from "@/app/(admin)/admin/inventory/actions";

describe("inventory integration", () => {
  it("increases stock by exact purchase amount", async () => {
    // Uses real database — ensure .env.test is configured
  });
});
```

### ٣.٣ اختبار E2E

```typescript
// e2e/pos-checkout.spec.ts
import { test, expect } from "@playwright/test";

test("completes 20 varied sales with zero calculation errors", async ({ page }) => {
  // Full POS flow with real browser + real DB
});
```

---

## ٤. أوامر التشغيل

```bash
# تشغيل كل اختبارات الوحدة والتكامل
npm run test                 # vitest run

# وضع المراقبة (للتطوير)
npx vitest

# اختبار ملف محدد
npx vitest run __tests__/pricing.test.ts

# تغطية الاختبارات
npx vitest run --coverage

# اختبارات E2E (تحتاج Supabase حقيقي)
npx playwright test

# وضع المراقبة E2E
npx playwright test --ui
```

---

## ٥. بيانات الاختبار

- **اختبارات الوحدة:** تحاكي (mock) كل التبعيات الخارجية — لا تحتاج قاعدة بيانات
- **اختبارات التكامل:** تستخدم قاعدة بيانات حقيقية (DATABASE_URL في `.env.local`)
- **اختبارات E2E:** تستخدم خادم dev محلي + قاعدة بيانات Supabase حقيقية
  - `e2e/global-setup.ts` يأخذ snapshot للمخزون
  - `e2e/global-teardown.ts` ينظف بيانات الاختبار ويعيد المخزون

**تنبيه:** E2E tests تلمس قاعدة بيانات حقيقية وتنشئ طلبات حقيقية. لا تشغلها على الإنتاج!

---

## ٦. فلسفة الـ Mocking

```
✅ Mock للاعتماديات الخارجية الثقيلة:
   - Supabase Auth client (في unit tests)
   - Drizzle DB (في unit tests عبر mockTx)

❌ لا mock لـ:
   - منطق الأعمال الخاص بنا (pricing, checkout logic)
   - التحويلات الحسابية (toMinorUnits, formatPrice)
   - التحقق من المدخلات
```

**القاعدة:** Mock ما لا نملكه. اختبر ما نكتبه.

---

## ٧. تشغيل الاختبارات في CI/CD

حاليًا الاختبارات **لا تعمل في CI** (لا يوجد GitHub Actions مُعدّ). الخطة:

| المرحلة       | الخطة                                      |
| ------------- | ------------------------------------------ |
| **حاليًا**    | تشغيل يدوي قبل كل deploy                   |
| **Phase 5**   | GitHub Actions لـ unit + integration tests |
| **ما بعد v1** | GitHub Actions لـ E2E مع Supabase staging  |

سبب التأخير: اختبارات E2E والتكامل تحتاج مفاتيح Supabase كـ CI secrets — لم تُعد بعد.

---

## ٨. كتابة اختبار جديد

### القواعد

1. **اسم وصفي:** `it("rejects an empty cart")` لا `it("test 1")`
2. **استقلالية:** كل اختبار قائم بذاته — لا يعتمد على اختبار سابق
3. **نمط AAA:** Arrange (إعداد) → Act (تنفيذ) → Assert (تحقق)
4. **ملف واحد لكل مجال:** `pricing.test.ts`، `checkout.test.ts`، ...
5. **لا اختبارات هشة:** لا تعتمد على توقيت، ترتيب عشوائي، أو حالة خارجية

### مواقع الملفات

| نوع الاختبار | المسار                                   | مثال                                     |
| ------------ | ---------------------------------------- | ---------------------------------------- |
| وحدة         | `__tests__/[module].test.ts`             | `__tests__/pricing.test.ts`              |
| تكامل        | `__tests__/[module].integration.test.ts` | `__tests__/checkout.integration.test.ts` |
| E2E          | `e2e/[feature].spec.ts`                  | `e2e/pos-checkout.spec.ts`               |

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet) + مهندس الاختبارات
- **دورة المراجعة:** مع كل Phase جديد
- **التحديث:** عند إضافة نوع جديد من الاختبارات أو تغيير الإطار
- **آخر تحديث:** أغسطس 2026
