# System Architecture — Ayasofia Sweet

|               |                     |
| ------------- | ------------------- |
| **الإصدار**   | 1.0                 |
| **آخر تحديث** | أغسطس 2026          |
| **المعماري**  | CTO (Claude Sonnet) |
| **النمط**     | Modular Monolith    |

---

## ١. النمط المعماري

### Modular Monolith — لماذا؟

```
❌ Microservices → عبء تشغيلي لـ ٥ موظفين في متجر واحد
✅ Modular Monolith → بساطة + انضباط = صيانة منخفضة
```

**الوحدات الداخلية (Modules):**

| الوحدة     | المسار                                     | الوصف               |
| ---------- | ------------------------------------------ | ------------------- |
| POS        | `app/(pos)/pos/`                           | نقطة البيع الرئيسية |
| Drive-Thru | `app/(pos)/drive-thru/`                    | مسار السيارات       |
| Kitchen    | `app/(pos)/kitchen/`                       | شاشة المطبخ         |
| Customer   | `app/order/`                               | طلب العميل الذاتي   |
| Admin      | `app/(admin)/admin/`                       | الإدارة والتقارير   |
| Auth       | `app/login/` + `lib/auth.ts`               | المصادقة            |
| Checkout   | `lib/checkout-core.ts`                     | منطق الخروج المشترك |
| Pricing    | `lib/pricing.ts` + `lib/pricing-server.ts` | حسابات الأسعار      |
| Inventory  | `lib/checkout-core.ts` + admin actions     | المخزون             |

---

## ٢. الرسم المعماري (High-Level)

```
                          ┌────────────────────┐
                          │    Client Browser   │
                          │  (React SPA + PWA)  │
                          └────────┬───────────┘
                                   │ HTTP/2
                    ┌──────────────┼──────────────┐
                    │              │              │
              ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
              │ Server     │ │ Server    │ │ Route     │
              │ Components │ │ Actions   │ │ Handlers  │
              │ (RSC)      │ │ (RPC)     │ │ (API)     │
              └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
                    │              │              │
                    └──────────────┼──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       Application Core       │
                    │  ┌────────────────────────┐  │
                    │  │ lib/auth.ts            │  │
                    │  │ lib/checkout-core.ts   │  │
                    │  │ lib/pricing.ts         │  │
                    │  │ lib/pricing-server.ts  │  │
                    │  └────────────────────────┘  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │       Data Access Layer      │
                    │  ┌────────────────────────┐  │
                    │  │ Drizzle ORM             │  │
                    │  │ (node-postgres)         │  │
                    │  └────────────────────────┘  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │    PostgreSQL (Supabase)     │
                    │  ┌────────────────────────┐  │
                    │  │ RLS Policies           │  │
                    │  │ Supabase Realtime      │  │
                    │  │ Supabase Auth          │  │
                    │  └────────────────────────┘  │
                    └──────────────────────────────┘
```

---

## ٣. تدفق الطلب (Order Flow)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  POS     │     │ Drive-Thru│    │Customer  │     │  Order   │
│ (staff)  │     │ (staff)  │     │ (public) │     │  Page    │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │               │               │                  │
     │ cart items     │ cart items     │ cart items        │
     │ + channel      │ + channel      │ + name/phone      │
     │                │                │                  │
     ▼                ▼                ▼                  ▼
┌──────────────────────────────────────────────────────────────┐
│                     checkout / placeCustomerOrder            │
│                          (Server Actions)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  1. requireStaffSession() / (none for customer)        │ │
│  │  2. Validate cart items                                │ │
│  │  3. Call executeCheckout()                             │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     executeCheckout()                        │
│                    (lib/checkout-core.ts)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  db.transaction(async (tx) => {                        │ │
│  │    1. Check idempotencyKey (return existing if found)  │ │
│  │    2. recalculateCartServerSide(cartItems)             │ │
│  │    3. Insert order                                     │ │
│  │    4. Insert order_items (with modifier snapshots)     │ │
│  │    5. Read recipes (BOM)                               │ │
│  │    6. Insert inventory_moves (sale)                    │ │
│  │    7. Update ingredients.currentStock                  │ │
│  │  })                                                    │ │
│  │  Catch PG 23505 → return existing order (race recovery)│ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL (Supabase)                      │
│  ┌─────────────────────┐   ┌─────────────────────────────┐  │
│  │ orders              │   │ ingredients.currentStock     │  │
│  │ order_items         │   │ inventory_moves (audit)      │  │
│  │ (new rows)          │   │ (stock changed)              │  │
│  └─────────────────────┘   └─────────────────────────────┘  │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Supabase Realtime → KDS (kitchen-shell.tsx)         │   │
│  │  - INSERT on orders → new order appears              │   │
│  │  - UPDATE on orders → status changes                 │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## ٤. تدفق المصادقة (Auth Flow)

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  PinPad      │      │ verifyStaff  │      │  Supabase    │
│  (client)    │      │ Pin (action) │      │  Auth        │
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │ 1. signInAnonymously│                     │
       │─────────────────────┼─────────────────────▶
       │                     │                     │
       │ 2. verifyStaffPin(pin, anonUserId)        │
       │────────────────────▶│                     │
       │                     │                     │
       │                     │ 3. Fetch staff rows │
       │                     │─────────────────────▶
       │                     │                     │
       │                     │ 4. verifyPin() match│
       │                     │                     │
       │                     │ 5. admin.updateUser │
       │                     │    (app_metadata:   │
       │                     │     staff_id, role) │
       │                     │─────────────────────▶
       │                     │                     │
       │                     │ 6. update staff     │
       │                     │    .auth_user_id    │
       │                     │─────────────────────▶
       │                     │                     │
       │ 7. { success: true }│                     │
       │◀────────────────────│                     │
       │                     │                     │
       │ 8. refreshSession() │                     │
       │─────────────────────┼─────────────────────▶
       │ 9. JWT now carries  │                     │
       │    staff_id + role  │                     │
       │                     │                     │
       │ 10. router.push(/pos)                     │
```

---

## ٥. طبقات الأمان (Security Layers)

```
┌──────────────────────────────────────────────────────────┐
│ Layer 1: proxy.ts (UX Redirect)                          │
│ - Checks JWT for staff_id claim                          │
│ - Redirects to /login if absent                           │
│ - NOT the auth authority — UX gate only                   │
├──────────────────────────────────────────────────────────┤
│ Layer 2: requireStaffSession() (Auth Gate)               │
│ - Verifies JWT via supabase.auth.getUser()               │
│ - Extracts staff_id + role from app_metadata             │
│ - Checks role rank against minRole                       │
│ - Throws AuthError on failure → caught by caller          │
│ - THE actual security boundary                            │
├──────────────────────────────────────────────────────────┤
│ Layer 3: Row Level Security (RLS)                         │
│ - PostgreSQL-level policies on all 15 tables             │
│ - auth.jwt() -> 'app_metadata' ->> 'staff_id'            │
│ - Service-role client bypasses RLS (used ONLY in auth)    │
│ - Defense in depth — even if app layer fails             │
├──────────────────────────────────────────────────────────┤
│ Layer 4: Server-Side Recalculation                        │
│ - recalculateCartServerSide() never trusts client         │
│ - Fetches current prices from DB, recomputes              │
│ - Logs mismatch but proceeds with server total            │
│ - Prevents price manipulation even with valid auth        │
└──────────────────────────────────────────────────────────┘
```

---

## ٦. قرارات معمارية رئيسية

| القرار         | الاختيار                              | البديل المرفوض   | السبب                            |
| -------------- | ------------------------------------- | ---------------- | -------------------------------- |
| نوع التطبيق    | Modular Monolith                      | Microservices    | عبء تشغيلي بدون فائدة لمتجر واحد |
| API نمط        | Server Actions (RPC)                  | REST / GraphQL   | بساطة، TypeScript end-to-end     |
| حالة العميل    | Client Components + Server Components | SPA منفصلة       | أداء أفضل، Seo غير مطلوب         |
| قاعدة البيانات | PostgreSQL                            | MongoDB/NoSQL    | ACID للمال والمخزون              |
| ORM            | Drizzle                               | Prisma           | SQL شفاف، حجم أصغر               |
| المصادقة       | Supabase Auth (PIN مخصص)              | Email/Password   | سرعة للموظفين                    |
| الوقت الحقيقي  | Supabase Realtime                     | WebSocket مخصص   | لا جهد بنية تحتية إضافي          |
| UI             | Tailwind + shadcn/ui                  | MUI / Ant Design | تخصيص كامل للعلامة التجارية      |
| التخزين المؤقت | لا يوجد                               | Redis            | PostgreSQL مع فهارس كافٍ         |

انظر `decisions/` لـ ADRs مفصلة لكل قرار.

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** عند تغيير نمط معماري أو إضافة طبقة جديدة
- **الارتباطات:** `TECH_STACK.md`, `PROJECT_CONTEXT.md`, `decisions/`
- **آخر تحديث:** أغسطس 2026
