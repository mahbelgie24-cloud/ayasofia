# Coding Standards — Ayasofia Sweet

|               |                                       |
| ------------- | ------------------------------------- |
| **الإصدار**   | 1.0                                   |
| **آخر تحديث** | أغسطس 2026                            |
| **النطاق**    | كل ملفات TypeScript/TSX/JS في المشروع |
| **الإلزام**   | إلزامي — يُفحص في كل Code Review      |

---

## ١. المبادئ العامة

### ١.١ الأسلوب المفضل

- **المسافات** لا التبويبات (2 spaces per `.editorconfig`)
- **`const`** افتراضيًا، `let` عند الحاجة، **لا `var` أبدًا**
- **`===`** دائمًا، لا `==`
- دوال السهم (`=>`) للـ callbacks، `function` للـ top-level exports
- أسماء واضحة ووصفية — `getMenuForPOS` لا `getData`
- لا تعليقات زائدة (الكود يجب أن يشرح نفسه). التعليقات = توثيق القرار فقط

### ١.٢ بنية الملف

```
ملف واحد = مسؤولية واحدة
< 300 سطر للملف الواحد (تقسيم إن زاد)
< 50 سطرًا للدالة الواحدة (تقسيم إن زاد)
```

### ١.٣ imports

```typescript
// ✅ صحيح
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";

// ❌ ممنوع
import * as Everything from "./giant-module";
import { db } from "../../../lib/db"; // مسار نسبي طويل
```

- استخدم `@/` للمسارات المطلقة (مُعرف في `tsconfig.json`)
- استيراد `type` صريح: `import type { Foo } from "./bar"`
- **لا استيراد `pricing-server.ts` في Client Component أبدًا**
- **لا استيراد `service.ts` (service-role client) في Client Component أبدًا**

---

## ٢. معايير TypeScript

### ٢.١ الأنواع (Types)

```typescript
// ✅ استخدم interface للكائنات
interface CartItem {
  productId: string;
  quantity: number;
}

// ✅ استخدم type للـ unions والمركبات
type Channel = "dine_in" | "takeaway" | "drive_thru";
type CheckoutResult = { success: true; orderId: string } | { success: false; error: string };

// ❌ لا تستخدم any أبدًا — استخدم unknown ثم تحقق
function parse(input: unknown): ParsedData {
  /* ... */
}

// ❌ لا تستخدم as casting إلا في أضيق الحدود
```

### ٢.٢ null vs undefined

- استخدم `null` للقيم المفقودة في قاعدة البيانات
- استخدم `undefined` للوسائط الاختيارية غير المعطاة
- لا تخلط بينهما في نفس المتغير

### ٢.٣ التعامل مع الأخطاء

```typescript
// ✅ نمط النتيجة الآمنة (discriminated union)
type Result<T> = { success: true; data: T } | { success: false; error: string };

// ❌ لا ترمي exceptions عارية بدون نوع
throw new Error("something"); // مسموح
throw "something"; // ممنوع
```

---

## ٣. معايير React / Next.js

### ٣.١ Server vs Client Components

```typescript
// ✅ Server Component (افتراضي)
// لا "use client" — يمكنه استيراد server-only modules
export default async function Page() {
  /* ... */
}

// ✅ Client Component
("use client");
import { useState } from "react"; // فقط ما يحتاجه العميل
```

**القاعدة:**

- ابدأ دائمًا بـ Server Component
- أضف `"use client"` فقط عند الحاجة لـ state/effects/events
- مؤشرات تحتاج Client Component: `useState`, `useEffect`, `onClick`, `onChange`

### ٣.٢ Server Actions

```typescript
// ✅ كل Server Action معتمد:
"use server";
import { requireStaffSession } from "@/lib/auth";

export async function myAction(input: Input): Promise<Result> {
  const { staffId } = await requireStaffSession();
  // ... logic
}

// ✅ Server Action عام (للعميل):
("use server");
export async function placeCustomerOrder(input: Input): Promise<Result> {
  // لا `requireStaffSession` — هذا متعمد (عام)
}
```

**القاعدة:** كل `"use server"` يتعامل مع البيانات يجب أن يبدأ بـ `requireStaffSession`، باستثناء `verifyStaffPin` و `placeCustomerOrder`.

### ٣.٣ المكونات

```typescript
// ✅ مكون بسيط
export function ProductCard({ product }: { product: Product }) {
  return <div>{product.nameAr}</div>;
}

// ✅ مكون معقد > 150 سطر → يُقسم
export function POSShell({ menu }: Props) { /* < 200 lines */ }

// ❌ لا inline styles معقدة — استخدم Tailwind أو CSS modules
// ❌ لا props بكميات كبيرة (> 6 props = refactor to object)
```

---

## ٤. معايير المال (Money Handling — إلزامي صارم)

**القاعدة الذهبية:**

```
السعر من Drizzle (string) → toMinorUnits (int agorot) → حساب صحيح
→ fromMinorUnits (string) → عرض أو كتابة
لا parseFloat على سعر أبدًا.
```

```typescript
// ✅ الطريقة الصحيحة:
import { calculateLineTotal, formatPrice } from "@/lib/pricing";

const total = calculateLineTotal("15.50", [{ priceDelta: "2.00" }], 2);
// total = 3500 (agorot — integer)

// ❌ ممنوع:
const total = parseFloat(priceFromDb) * quantity; // FLOAT!
formatPrice(parseFloat(product.basePrice) * 100); // FLOAT!
```

**مرجع:** `AGENTS.md` — "Money representation"

---

## ٥. معايير قاعدة البيانات

### ٥.١ الهجرات (Migrations)

```bash
# عند كل تغيير في schema.ts:
npx drizzle-kit generate  # يُنشئ ملف هجرة
npx drizzle-kit migrate   # يُطبق على قاعدة البيانات
```

- **لا تعدل الهجرات القديمة أبدًا** — أنشئ هجرة جديدة
- **لا تعدل قاعدة البيانات يدويًا** خارج Drizzle
- اسم الهجرة وصفي: `add_name_ar_to_modifiers`

### ٥.٢ الاستعلامات

```typescript
// ✅ استخدم Drizzle query builder
const rows = await db.select().from(products).where(eq(products.id, id));

// ✅ استخدم transactions للتحديثات المتعددة
await db.transaction(async (tx) => {
  await tx.insert(orders).values({ ... });
  await tx.insert(inventoryMoves).values({ ... });
});

// ❌ لا SQL نيء إلا للأمور المعقدة (مع تبرير في التعليق)
// ❌ لا N+1 queries — استخدم inArray أو joins
```

---

## ٦. تنظيم الملفات

| النوع          | المسار                         | مثال                            |
| -------------- | ------------------------------ | ------------------------------- |
| Server Actions | `app/[route]/actions.ts`       | `app/(pos)/pos/actions.ts`      |
| مكون صفحة      | `app/[route]/page.tsx`         | `app/(pos)/pos/page.tsx`        |
| مكون عميل      | `app/[route]/[name]-shell.tsx` | `app/(pos)/pos/pos-shell.tsx`   |
| مكون مشترك     | `components/[name].tsx`        | `components/pin-pad.tsx`        |
| مكون shadcn/ui | `components/ui/[name].tsx`     | `components/ui/button.tsx`      |
| دوال مساعدة    | `lib/[name].ts`                | `lib/pricing.ts`                |
| مخطط DB        | `db/schema.ts`                 | —                               |
| بيانات أولية   | `db/seed-data.ts`              | —                               |
| هجرات          | `db/migrations/`               | `0005_massive_morgan_stark.sql` |

---

## ٧. الاختبارات

```typescript
// ✅ اختبار وحدة
import { describe, it, expect } from "vitest";
describe("calculateLineTotal", () => {
  it("single item with no modifiers", () => {
    expect(calculateLineTotal("15.00", [], 1)).toBe(1500);
  });
});

// ✅ اختبار تكامل (يلمس قاعدة البيانات)
// يُسمى [name].integration.test.ts
// يستخدم vitest + db حقيقية

// ✅ اختبار E2E
// في مجلد e2e/
// يستخدم Playwright
```

**القاعدة:** كل منطق يتعلق بالمال أو المخزون يجب أن يكون له اختبار وحدة.

---

## ٨. الأسماء والتسمية (Naming Convention)

| العنصر             | النمط       | مثال                                        |
| ------------------ | ----------- | ------------------------------------------- |
| الملفات            | kebab-case  | `pos-shell.tsx`, `checkout-core.ts`         |
| الدوال             | camelCase   | `calculateLineTotal`, `requireStaffSession` |
| المكونات           | PascalCase  | `POSShell`, `PinPad`                        |
| الأنواع/interfaces | PascalCase  | `CheckoutResult`, `CartItem`                |
| الثوابت            | UPPER_SNAKE | `KEY_LENGTH`, `MINOR_UNIT_MULTIPLIER`       |
| جداول DB           | snake_case  | `order_items`, `inventory_moves`            |
| أعمدة DB           | snake_case  | `created_at`, `base_price`                  |
| متغيرات البيئة     | UPPER_SNAKE | `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## ٩. Git

```
feat: add Z-report generation endpoint
fix: correct inventory deduction rounding
refactor: extract usePOSCart hook from pos-shell
test: add concurrent checkout integration test
docs: update Phase 4 specification
chore: upgrade drizzle-orm to 0.46
```

- **Conventional Commits** إلزامي
- لا commit لـ `.env.local` أو secrets
- كل commit = تغيير واحد متماسك
- رسالة commit تشرح **ماذا** و **لماذا**، ليس **كيف**

---

## ١٠. قائمة التحقق الذاتي (قبل فتح PR/طلب مراجعة)

- [ ] `tsc --noEmit` يمر
- [ ] `eslint` يمر (0 أخطاء)
- [ ] `vitest run` يمر
- [ ] لا `parseFloat` مباشر على أسعار
- [ ] لا استيراد خادم في Client Component
- [ ] كل Server Action يتحقق من الجلسة (إن تطلب)
- [ ] كل كتابة تستخدم `idempotencyKey`
- [ ] التغييرات موثقة في `CHANGELOG.md` (إن كانت تستحق)

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** مع كل Phase
- **آخر تحديث:** أغسطس 2026
