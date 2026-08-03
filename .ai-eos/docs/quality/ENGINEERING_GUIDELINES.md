# Engineering Guidelines — Ayasofia Sweet

|               |                                  |
| ------------- | -------------------------------- |
| **الإصدار**   | 1.0                              |
| **آخر تحديث** | أغسطس 2026                       |
| **الجمهور**   | جميع المهندسين (بشر + AI Agents) |

---

## ١. فلسفة الهندسة

### نحن نبني للثقة، لا للعرض

هذا النظام يلمس مالًا حقيقيًا ومخزونًا حقيقيًا. كل قرار هندسي يجب أن يُرجح **سلامة البيانات** على **الجمال البصري** عندما يتعارضان. تقرير خاطئ بسنت واحد = فقدان ثقة لا يُعوض.

### أربع أولويات (مرتبة)

1. **الصحة (Correctness):** الحسابات دقيقة 100%. Z-report = العد النقدي.
2. **الموثوقية (Reliability):** النظام يعمل حتى بدون إنترنت. لا أعطال مفاجئة.
3. **الأداء (Performance):** POS يستجيب في < 200ms. KDS يظهر الطلب في < 3s.
4. **الجمال (Aesthetics):** واجهة نظيفة واحترافية — لكن ليست على حساب ما سبق.

---

## ٢. SOLID في سياقنا

### S — Single Responsibility

كل ملف له مسؤولية واحدة واضحة:

- `lib/pricing.ts` = حسابات رياضية بحتة (لا DB)
- `lib/pricing-server.ts` = جلب الأسعار + استدعاء الحسابات
- `lib/checkout-core.ts` = تنسيق عملية الخروج فقط

### O — Open/Closed

- نضيف ميزات عبر **إضافة** كود جديد، لا تعديل القديم
- مثال: إضافة قناة جديدة للطلب = إضافة قيمة لـ `orderChannelEnum`، لا تعديل `checkout-core`

### L — Liskov Substitution

- في مشروعنا: أي `CheckoutResult` يمكن معالجته بنفس النمط بغض النظر عن المصدر (POS أو Drive-Thru أو Customer)

### I — Interface Segregation

- لا تجبر المستهلك على依赖 ما لا يحتاجه
- `CartItemForServer` يحتوي فقط ما يحتاجه الخادم (productId, modifierIds, quantity)

### D — Dependency Inversion

- `checkout-core` يعتمد على `recalculateCartServerSide` (تجريد الحساب)، لا على تفاصيل قاعدة البيانات مباشرة

---

## ٣. DRY — لا تكرر نفسك

**لكن بحذر:** DRY للـ logic، ليس للـ UI.

```typescript
// ✅ استخرج المنطق المشترك — hook مخصص
function usePOSCart(menu: Menu) {
  /* كل منطق السلة هنا */
}

// ✅ POS و Drive-Thru يستخدمان نفس hook
function POSShell() {
  const cart = usePOSCart(menu); /* UI مختلف */
}
function DriveThruShell() {
  const cart = usePOSCart(menu); /* UI مختلف */
}

// ❌ لا تستخرج قبل أن ترى التكرار ٣ مرات (Rule of Three)
// ❌ لا تستخرج إذا كان "التشابه" سطحيًا والسلوك مختلفًا
```

### أنماط التكرار في مشروعنا (الحالية)

| النمط المتكرر                            | الحل الحالي       | الحل المستهدف               |
| ---------------------------------------- | ----------------- | --------------------------- |
| منطق السلة في POS/Drive-Thru             | ~300 سطر مكرر     | `usePOSCart` hook (Phase 4) |
| `parseFloat(product.basePrice) * 100`    | مكرر 3 مرات       | `toMinorUnits(basePrice)`   |
| نمط Server Action مع requireStaffSession | جيد حاليًا        | يبقى كما هو                 |
| idempotencyKeyRef pattern                | مستخدم في POS فقط | يُعمم على Customer Order    |

---

## ٤. KISS — حافظ على البساطة

### القرارات التي جعلت النظام بسيطًا

| القرار                   | البساطة التي حققها          |
| ------------------------ | --------------------------- |
| Modular Monolith         | لا توزيع، لا تعقيد شبكي     |
| Drizzle لا Prisma        | SQL شفاف، لا black box      |
| PIN لا Email/Password    | أسرع للموظف، أبسط للمطور    |
| shadcn/ui لا مكتبة مخصصة | مكونات جاهزة، قابلة للتخصيص |
| JSONB للمُعدِّلات        | لا جدول وسيط معقد           |

### قاعدة البساطة

> إذا كان الحل يتطلب شرحًا لأكثر من ٣٠ ثانية لمهندس آخر، فهو معقد جدًا. بَسّطه.

---

## ٥. YAGNI — لن تحتاجه (على الأرجح)

| ما لم نبنه (وقاومنا إغراء بنائه) | لماذا                           |
| -------------------------------- | ------------------------------- |
| Multi-branch support             | متجر واحد فقط                   |
| Microservices                    | لا حاجة — عبء تشغيلي بدون فائدة |
| Native mobile app                | PWA تغطي الاحتياج               |
| WebSocket server مخصص            | Supabase Realtime موجود         |
| Redis cache                      | PostgreSQL مع RLS+فهارس كافٍ    |
| نظام إشعارات Push                | مبالغة — WhatsApp يكفي          |

### القاعدة

> لا تبني شيئًا حتى **تحتاجه فعلاً**. "سنحتاجه لاحقًا" = YAGNI.

---

## ٦. Separation of Concerns — طبقات واضحة

```
┌─────────────────────────────────────┐
│  UI Layer (app/ + components/)       │  → React Components
│  - عرض البيانات                       │  → Client/Server Components
│  - تفاعل المستخدم                     │  → "use client" فقط للحاجة
├─────────────────────────────────────┤
│  Application Layer (lib/ + actions)  │  → Server Actions
│  - تنسيق العمليات                     │  → Business Logic
│  - التحقق من الصلاحيات                │  → requireStaffSession
├─────────────────────────────────────┤
│  Data Layer (lib/db/ + drizzle)      │  → Drizzle ORM
│  - استعلامات                         │  → PostgreSQL
│  - Transactions                      │  → Supabase
├─────────────────────────────────────┤
│  Infrastructure (env, config)        │  → Environment Variables
│  - أسرار                             │  → .env.local
│  - اتصالات                           │  → Pool connections
└─────────────────────────────────────┘
```

**القاعدة:** لا تتخطى طبقة. UI لا يتحدث إلى DB مباشرة. Application layer دائمًا في المنتصف.

---

## ٧. Single Source of Truth (SSOT)

| المعلومات              | المصدر الوحيد للحقيقة                                              |
| ---------------------- | ------------------------------------------------------------------ |
| نطاق المشروع           | `docs/technical-spec.md` (إذا تعارض مع أي شيء، الـ spec هو الصحيح) |
| مخطط DB                | `db/schema.ts` (ثم الهجرات)                                        |
| صلاحيات المستخدمين     | `lib/auth.ts` (`ROLE_RANK`)                                        |
| ألوان العلامة التجارية | `app/globals.css` (متغيرات `@theme`)                               |
| قواعد ESLint           | `eslint.config.mjs`                                                |
| إعدادات TypeScript     | `tsconfig.json`                                                    |
| السياق العام للمشروع   | `.ai-eos/docs/context/PROJECT_CONTEXT.md`                          |

---

## ٨. التوثيق أولاً (Documentation First)

### قاعدة الـ ٣ دقائق

> أي قرار معماري أو تغيير في الاتجاه يجب توثيقه في ٣ دقائق. لا تؤجل التوثيق.

### ماذا نُوثق وأين

| نوع التوثيق  | المكان                         |
| ------------ | ------------------------------ |
| قرار معماري  | `decisions/ADR-XXXX.md`        |
| مواصفة ميزة  | `specifications/SPEC-XXXX.md`  |
| تغيير في API | الكود نفسه (JSDoc) + CHANGELOG |
| مشكلة أمنية  | `security/SEC-XXXX.md`         |
| مشكلة معروفة | `reports/KNOWN_ISSUES.md`      |

---

## ٩. لا تخمين — تحقق

كمهندس أول (DeepSeek) أو مدير تقني (Sonnet):

- **لا تفترض أن مكتبة موجودة** — تحقق من `package.json`
- **لا تخمن نمط الكود** — اقرأ ملفًا مجاورًا
- **لا تقدر حجم التأثير** — استخدم `grep` للبحث عن كل الاستخدامات
- **لا تفترض أن الاختبارات ستنجح** — شغلها

---

## ١٠. المرونة في مواجهة الفشل (Resilience)

| السيناريو            | الاستراتيجية                                        |
| -------------------- | --------------------------------------------------- |
| انقطاع الإنترنت      | Offline mode (IndexedDB + Service Worker) → Phase 5 |
| تعارض idempotencyKey | استرداد من PG error 23505 (مُنفذ ✅)                |
| فشل معاملة DB        | Rollback كامل (مُنفذ ✅)                            |
| خطأ في حساب السعر    | Server-side recalculation تتصدى له (مُنفذ ✅)       |
| انتهاء جلسة المستخدم | إعادة توجيه إلى /login (مُنفذ ✅)                   |
| فشل Realtime         | KDS يعرض البيانات الأولية من server props           |

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** نصف سنوية أو عند إضافة نمط هندسي جديد
- **آخر تحديث:** أغسطس 2026
