# Database Guidelines — Ayasofia Sweet

|               |                                       |
| ------------- | ------------------------------------- |
| **الإصدار**   | 1.0                                   |
| **آخر تحديث** | أغسطس 2026                            |
| **التقنية**   | PostgreSQL via Supabase + Drizzle ORM |

---

## ١. المبادئ الأساسية

### ١.١ كل شيء عبر Drizzle

- **لا SQL نيء** — استخدم Drizzle query builder دائمًا
- **لا تعديل مباشر لقاعدة البيانات** — استخدم `npx drizzle-kit migrate`
- **لا هجرات يدوية** — `npx drizzle-kit generate` فقط

### ١.٢ المصدر الوحيد للحقيقة

- **`db/schema.ts`** هو التعريف الوحيد للمخطط
- أي تغيير يبدأ من `schema.ts` ← `generate` ← `migrate`
- الهجرات المُولدة هي أثر تاريخي — لا تُعدل يدويًا

---

## ٢. إضافة جدول جديد

### الخطوات

1. أضف تعريف الجدول في `db/schema.ts`
2. شغل `npx drizzle-kit generate` (يُنشئ ملف هجرة)
3. راجع ملف الهجرة المُنشأ
4. شغل `npx drizzle-kit migrate` (يُطبق على DB)
5. أضف `enableRLS()` على الجدول الجديد
6. أضف سياسة RLS مناسبة (عادة: `authenticatedRole` مع JWT claim)

### مثال

```typescript
// في db/schema.ts
export const newTable = pgTable(
  "new_table",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
  },
  () => [
    pgPolicy("staff can read new_table", {
      for: "select",
      to: authenticatedRole,
      using: sql`(auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null`,
    }),
  ],
).enableRLS();
```

---

## ٣. Row Level Security (RLS)

### ٣.١ السياسة القياسية (للجداول التي يقرأها كل الموظفين)

```sql
-- سياسة القراءة: أي مستخدم معه staff_id في JWT
(auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null
```

### ٣.٢ السياسة المقيدة (للجداول الحساسة — قيد التخطيط)

```sql
-- سياسة القراءة: المدير + المالك فقط
(auth.jwt() -> 'app_metadata' ->> 'role') IN ('manager', 'owner')
```

### ٣.٣ تذكر

- RLS على Supabase مفعل **افتراضيًا للجداول الجديدة** منذ 2024 — تحقق
- `service-role client` يتجاوز RLS — استخدمه بحذر شديد
- `anon client` لا يمرر RLS أبدًا — لهذا `/order` يستخدم server actions

---

## ٤. أنواع البيانات (Data Types)

### ٤.١ المال (Money)

```typescript
// ✅ استخدم numeric(precision, scale)
basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull();
currentStock: numeric("current_stock", { precision: 12, scale: 2 }).notNull();
costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 4 }).notNull();

// ❌ لا تستخدم float/real/double precision للمال أبدًا
// ❌ لا تستخدم integer للمال (تفقد الكسور)
```

### ٤.٢ المُعرفات

```typescript
// ✅ uuid للمفاتيح الأساسية
id: uuid("id").defaultRandom().primaryKey();

// ❌ لا auto-increment id — تعقيد في بيئة موزعة
// ❌ لا UUID strings يدوية — دع Postgres يولدها
```

### ٤.٣ الطوابع الزمنية

```typescript
// ✅ مع المنطقة الزمنية
createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

// ❌ لا timestamp without timezone للتطبيقات العالمية
```

---

## ٥. العلاقات والمفاتيح الخارجية

```typescript
// ✅ Foreign key مع cascade للحذف (للكيانات التابعة)
productId: uuid("product_id")
  .notNull()
  .references(() => products.id, { onDelete: "cascade" });

// ✅ Foreign key بدون cascade (للإشارات المرجعية)
ingredientId: uuid("ingredient_id")
  .notNull()
  .references(() => ingredients.id);

// ✅ Composite primary key
export const recipes = pgTable("recipes", {/* ... */}, (t) => ({
  pk: primaryKey({ columns: [t.productId, t.ingredientId] }),
}));
```

---

## ٦. الاستعلامات (Queries)

### ٦.١ استعلامات Drizzle (النمط المفضل)

```typescript
// ✅ استعلام بسيط
const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);

// ✅ استعلام مع joins (relations API)
const menu = await db.query.categories.findMany({
  with: { products: { with: { modifierGroups: { with: { modifiers: true } } } } },
});

// ✅ استعلام متعدد (Promise.all)
const [products, ingredients] = await Promise.all([
  db.select().from(products),
  db.select().from(ingredients),
]);
```

### ٦.٢ مكافحة N+1

```typescript
// ❌ N+1 queries — حلقة for مع await في كل دورة
for (const item of items) {
  const product = await db.select().from(products).where(eq(products.id, item.productId));
}

// ✅ استعلام واحد مع inArray
const productIds = items.map((i) => i.productId);
const products = await db.select().from(products).where(inArray(products.id, productIds));
```

---

## ٧. المعاملات (Transactions)

```typescript
// ✅ معاملة ذرية
await db.transaction(async (tx) => {
  await tx.insert(orders).values({ ... });
  await tx.insert(orderItems).values({ ... });
  await tx.insert(inventoryMoves).values({ ... });
  await tx.update(ingredients).set({ ... }).where(...);
});

// ❌ لا عمليات متعددة بدون معاملة
await db.insert(orders).values({ ... });          // إذا فشل التالي، يبقى هذا!
await db.insert(orderItems).values({ ... });       // خطر!
```

**القاعدة:** إذا كانت العملية تتضمن أكثر من كتابة واحدة، يجب أن تكون داخل `transaction`.

---

## ٨. الهجرات (Migrations)

### ٨.١ سير العمل

```bash
# ١. عدل db/schema.ts
# ٢. ولّد الهجرة
npx drizzle-kit generate
# ٣. راجع الملف المُنشأ في db/migrations/
# ٤. طبق الهجرة
npx drizzle-kit migrate
# ٥. أضف الملف المُنشأ إلى git
git add db/migrations/
```

### ٨.٢ لا تفعل هذا أبدًا

- ❌ لا تعدل ملف هجرة موجود — أنشئ ملفًا جديدًا
- ❌ لا تحذف ملفات الهجرات
- ❌ لا تشغل `migrate` قبل `generate`
- ❌ لا تستخدم `push` في الإنتاج

---

## ٩. البذور (Seeding)

```bash
# تشغيل البذرة (للتطوير فقط)
npx tsx db/seed.ts
```

- `db/seed.ts` حساس: يتحقق من وجود بيانات حقيقية قبل الحذف
- `db/seed-data.ts` يحتوي البيانات الأولية
- البذور **للتطوير فقط** — لا تُشغل في الإنتاج

---

## ١٠. المراقبة والصيانة

### ماذا نراقب

- حجم قاعدة البيانات (Supabase dashboard)
- أداء الاستعلامات (Postgres slow query log)
- تنبيهات المخزون المنخفض (قيد التطوير — Phase 4)

### مهام الصيانة

- تنظيف المستخدمين المجهولين (مهمة دورية — Phase 5)
- نسخ احتياطي تلقائي (مفعل في Supabase)
- فحص RLS policies بشكل دوري

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet) + مهندس البيانات
- **دورة المراجعة:** عند تغيير المخطط أو إضافة جدول جديد
- **آخر تحديث:** أغسطس 2026
