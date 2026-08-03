# API & Server Action Guidelines — Ayasofia Sweet

|             |                                    |
| ----------- | ---------------------------------- |
| **الإصدار** | 1.0                                |
| **النطاق**  | كل Server Actions + Route Handlers |

---

## ١. Server Actions هي API الوحيد

لا يوجد REST API منفصل. كل تفاعل بين العميل والخادم يمر عبر Server Actions. هذا قرار معماري متعمد (spec §4 — Modular Monolith).

---

## ٢. هيكل الـ Server Action القياسي

```typescript
"use server";

import { requireStaffSession } from "@/lib/auth";

// ١. تعريف صريح للمدخلات والمخرجات
interface MyInput {
  required: string;
  optional?: number;
}
type MyResult = { success: true; data: Data } | { success: false; error: string };

// ٢. اسم وصفي للدالة
export async function myServerAction(input: MyInput): Promise<MyResult> {
  // ٣. التحقق من الجلسة (أول سطر)
  const { staffId, role } = await requireStaffSession(/* minRole? */);

  // ٤. التحقق من المدخلات
  if (!input.required) return { success: false, error: "Missing required field" };

  // ٥. تنفيذ العملية (دائمًا داخل try-catch)
  try {
    await db.transaction(async (tx) => {
      // العملية الذرية هنا
    });
    return { success: true, data: result };
  } catch (err) {
    console.error("myServerAction failed:", err);
    return { success: false, error: "Operation failed" };
  }
}
```

---

## ٣. قواعد إلزامية لكل Server Action

### ٣.١ الأمان (Security)

| القاعدة                                           | السبب                                           |
| ------------------------------------------------- | ----------------------------------------------- |
| `requireStaffSession()` أول سطر                   | لا مسار بدون تحقق (ما عدا الاستثناءات المعروفة) |
| `requireStaffSession("manager")` للبيانات الحساسة | Cashier لا يرى margins                          |
| لا تثق في مدخلات العميل أبدًا                     | كل مدخل يُتحقق منه                              |
| لا Secrets في الاستجابة                           | لا `process.env` في الـ return                  |

### ٣.٢ المال والنزاهة (Financial Integrity)

| القاعدة                              | المرجع                        |
| ------------------------------------ | ----------------------------- |
| أعد حساب الإجمالي server-side دائمًا | `recalculateCartServerSide()` |
| `idempotencyKey` في كل كتابة         | `executeCheckout()`           |
| كل عملية في `transaction`            | Atomicity                     |
| لا `parseFloat` على أسعار            | Integer minor units           |

### ٣.٣ المخرجات (Output)

| القاعدة                            | مثال                                                   |
| ---------------------------------- | ------------------------------------------------------ |
| نمط `Result` discriminated union   | `{ success: true; data } \| { success: false; error }` |
| رسائل خطأ واضحة للبشر (ليست تقنية) | `"المنتج غير متوفر"` لا `"SQL error code 23505"`       |
| لا تكشف تفاصيل داخلية              | لا ترجع stack traces                                   |

---

## ٤. الاستثناءان (Deliberate Exceptions)

### ٤.١ `verifyStaffPin` — بوابة المصادقة

```typescript
// app/login/actions.ts
export async function verifyStaffPin(pin: string, anonUserId: string): Promise<PinResult> {
  // لا requireStaffSession هنا — هذه الدالة هي من يُنشئ الجلسة
  // تستخدم service-role client للوصول إلى staff table + admin.updateUserById
}
```

### ٤.٢ `placeCustomerOrder` — طلب العميل العام

```typescript
// app/order/actions.ts
export async function placeCustomerOrder(input: {...}): Promise<PlaceOrderResult> {
  // لا requireStaffSession هنا — العميل ليس موظفًا
  // لكن: server-side recomputation + transaction + idempotency لا تزال مفعلة
}
```

---

## ٥. التحقق من المدخلات (Input Validation)

```typescript
// ✅ نمط التحقق
if (!input.cartItems?.length) {
  return { success: false, error: "السلة فارغة" };
}

if (!input.idempotencyKey) {
  return { success: false, error: "مفتاح العملية مفقود" };
}

if (typeof input.quantity !== "number" || input.quantity <= 0) {
  return { success: false, error: "كمية غير صالحة" };
}

// ❌ لا تثق في العميل
const total = input.clientTotal; // ← لا تستخدمه أبدًا! أعد حسابه
```

---

## ٦. تسمية الـ Server Actions

| النمط                      | مثال                               |
| -------------------------- | ---------------------------------- |
| `checkout`                 | عملية POS                          |
| `placeCustomerOrder`       | عملية العميل                       |
| `verifyStaffPin`           | مصادقة                             |
| `updateOrderStatus`        | تحديث حالة                         |
| `logPurchase` / `logWaste` | تسجيل حركة مخزون                   |
| `getMenuForPOS`            | استعلام (دالة مساعدة، ليست action) |

- الأفعال: `get`, `create`, `update`, `delete`, `verify`, `checkout`, `log`
- لا اختصارات غامضة

---

## ٧. الأخطاء وسجل الأخطاء

```typescript
// ✅ سجل الأخطاء مع سياق مفيد
console.error("Checkout transaction failed:", {
  idempotencyKey,
  cartSize: cartItems.length,
  channel,
  error: err instanceof Error ? err.message : "unknown",
});

// ❌ لا تسجل بيانات حساسة
console.error("Checkout failed:", { customerPhone, pin }); // ← أبدًا!

// ❌ لا تسكت الأخطاء
try {
  /* ... */
} catch {
  /* silence */
} // ← أبدًا بدون سبب
```

---

## ٨. اختبار الـ Server Actions

```typescript
// ✅ اختبار وحدة (مع mocked dependencies)
describe("checkout — idempotency", () => {
  it("rejects an empty cart", async () => {
    const result = await checkout({ cartItems: [], idempotencyKey: "k1", ... });
    expect(result.success).toBe(false);
  });
});

// ✅ اختبار تكامل (مع قاعدة بيانات حقيقية)
describe("checkout integration", () => {
  it("creates order and deducts inventory", async () => {
    // يستخدم db حقيقية + بيانات test
  });
});
```

---

## ٩. قائمة التحقق قبل إضافة Server Action جديد

- [ ] يبدأ بـ `"use server"` (أول سطر)
- [ ] يستدعي `requireStaffSession(minRole?)` أولاً (إن تطلب)
- [ ] يتحقق من كل المدخلات قبل الاستخدام
- [ ] يحتوي على `idempotencyKey` (إن كان يكتب بيانات)
- [ ] يعيد حساب الإجماليات server-side (إن كان يتعامل مع أسعار)
- [ ] يستخدم `Result` type (لا throw exceptions)
- [ ] رسائل الخطأ مفهومة وغير تقنية
- [ ] مُختبر (وحدة + تكامل إن أمكن)
- [ ] لا يسرب أسرارًا أو بيانات حساسة

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** مع كل إضافة API جديدة كبيرة
- **آخر تحديث:** أغسطس 2026
