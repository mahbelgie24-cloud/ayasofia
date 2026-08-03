# Dependency Map — Ayasofia Sweet

|               |            |
| ------------- | ---------- |
| **الإصدار**   | 1.0        |
| **آخر تحديث** | أغسطس 2026 |

---

## ١. خريطة التبعيات بين الملفات

```
lib/auth.ts ──────────────────────────────────────────────────────────────┐
  └── lib/supabase/server.ts                                              │
                                                                          │
lib/auth/session.ts ──────────────────────────────────────────────────────┤
  └── lib/supabase/client.ts                                              │
                                                                          │
lib/pricing.ts  ← (client-safe, no Node.js deps)                          │
  │                                                                       │
  └── lib/pricing-server.ts ──────────────────────────────────────────────┤
       ├── lib/pricing.ts                                                 │
       └── lib/db/index.ts ───────────────────────────────────────────────┤
            └── db/schema.ts                                              │
                                                                          │
lib/checkout-core.ts ─────────────────────────────────────────────────────┤
  ├── lib/db/index.ts                                                     │
  ├── lib/pricing-server.ts                                               │
  └── db/schema.ts                                                        │
                                                                          │
lib/receipt.ts ───────────────────────────────────────────────────────────┤
  └── lib/db/queries.ts ──────────────────────────────────────────────────┤
       └── lib/db/index.ts                                                │
                                                                          │
app/login/actions.ts ─────────────────────────────────────────────────────┤
  ├── lib/auth.ts                                                         │
  └── lib/supabase/service.ts                                             │
                                                                          │
app/(pos)/pos/actions.ts ─────────────────────────────────────────────────┤
  ├── lib/auth.ts                                                         │
  └── lib/checkout-core.ts                                                │
                                                                          │
app/order/actions.ts ─────────────────────────────────────────────────────┤
  └── lib/checkout-core.ts                                                │
                                                                          │
app/(pos)/kitchen/actions.ts ─────────────────────────────────────────────┤
  ├── lib/auth.ts                                                         │
  └── lib/db/index.ts                                                     │
                                                                          │
app/(admin)/admin/inventory/actions.ts ────────────────────────────────────┤
  ├── lib/auth.ts                                                         │
  └── lib/db/index.ts                                                     │
```

---

## ٢. التبعيات الممنوعة (Import Restrictions)

| الملف                     | لا يُستورد في        | السبب                  |
| ------------------------- | -------------------- | ---------------------- |
| `lib/pricing-server.ts`   | ❌ Client Components | يحتاج node-postgres    |
| `lib/supabase/service.ts` | ❌ Client Components | يحتوي service-role key |
| `lib/supabase/server.ts`  | ❌ Client Components | يحتاج cookies()        |
| `lib/db/index.ts`         | ❌ Client Components | يحتاج node-postgres    |
| `lib/db/queries.ts`       | ❌ Client Components | يحتاج db               |

---

## ٣. تبعيات الحزمة (Package Dependencies — الرئيسية)

```
next
├── react
├── react-dom
├── @supabase/ssr
└── ...

drizzle-orm
├── pg (node-postgres)
└── drizzle-kit (dev)

shadcn/ui (components/ui/button.tsx)
├── @base-ui/react
├── class-variance-authority
└── ...

vitest + @playwright/test (dev)
├── eslint + eslint-config-next (dev)
└── typescript (dev)
```

---

## ٤. تبعيات قاعدة البيانات

```
staff ─────────────────────────────────────────────────────────────────────
  └── orders (staff_id)                                                   │
  └── inventory_moves (created_by)                                        │
  └── shifts (staff_id)                                                   │
                                                                          │
categories ────────────────────────────────────────────────────────────────
  └── products (category_id)                                              │
                                                                          │
products ──────────────────────────────────────────────────────────────────
  ├── modifier_groups (product_id) [cascade]                              │
  ├── recipes (product_id) [cascade]                                      │
  └── order_items (product_id)                                            │
                                                                          │
modifier_groups ───────────────────────────────────────────────────────────
  └── modifiers (group_id) [cascade]                                      │
                                                                          │
ingredients ───────────────────────────────────────────────────────────────
  ├── recipes (ingredient_id) [cascade]                                   │
  └── inventory_moves (ingredient_id)                                     │
                                                                          │
orders ────────────────────────────────────────────────────────────────────
  ├── order_items (order_id) [cascade]                                    │
  └── inventory_moves (ref_order_id)                                      │
                                                                          │
suppliers ─────────────────────────────────────────────────────────────────
  └── purchases (supplier_id)                                             │
```

---

## ٥. اعتماديات Routes

| الصفحة               | Server Component   | Client Shell        | Server Action         |
| -------------------- | ------------------ | ------------------- | --------------------- |
| `/login`             | ✅                 | PinPad              | verifyStaffPin        |
| `/pos`               | ✅ (auth + menu)   | POSShell            | checkout              |
| `/drive-thru`        | ✅ (auth + menu)   | DriveThruShell      | checkout (shared)     |
| `/kitchen`           | ✅ (auth + orders) | KitchenShell        | updateOrderStatus     |
| `/order`             | ✅ (menu)          | CustomerOrderShell  | placeCustomerOrder    |
| `/order/status/[id]` | ✅ (order data)    | StatusClient        | —                     |
| `/pos/receipt/[id]`  | ✅ (receipt data)  | ReceiptClient       | —                     |
| `/admin`             | ✅ (auth)          | AdminNav + children | logPurchase, logWaste |
| `/admin/inventory`   | ✅ (data)          | InventoryClient     | logPurchase, logWaste |

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **التحديث:** عند إضافة ملف/Route/تبعية جديدة
- **آخر تحديث:** أغسطس 2026
