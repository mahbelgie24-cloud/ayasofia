# Performance Guidelines — Ayasofia Sweet

|             |                           |
| ----------- | ------------------------- |
| **الإصدار** | 1.0                       |
| **الأهداف** | Core Web Vitals (spec §6) |

---

## ١. الأهداف (Core Web Vitals)

| المقياس                             | المستهدف | السطح الحرج                 |
| ----------------------------------- | -------- | --------------------------- |
| **LCP** (Largest Contentful Paint)  | < 2.5s   | `/order` — جوالات الزبائن   |
| **INP** (Interaction to Next Paint) | < 200ms  | `/pos` — الموظفون تحت الضغط |
| **CLS** (Cumulative Layout Shift)   | < 0.1    | كل الصفحات                  |

**سطح القياس الأساسي:** `/order` (يمثل أسوأ حالة — اتصال جوال الزبون)

---

## ٢. استراتيجيات الأداء (حسب السطح)

### ٢.١ `/pos` و `/drive-thru` (موظفون)

- **Server Components** للبيانات الأولية (لا loading spinner للقائمة)
- **No heavy images** — أيقونات SVG صغيرة (< 5KB)
- **Minimal JavaScript** — فقط ما يحتاجه التفاعل
- **Touch targets** كبيرة (48px+) للسرعة

### ٢.٢ `/kitchen` (شاشة عرض)

- **Supabase Realtime** (لا polling — توفير شبكة)
- **DOM بسيط** — نصوص كبيرة، عناصر قليلة
- **لا تمرير لا نهائي** — الصفحة تعرض الموجود فقط

### ٢.٣ `/order` (زبون — الأهم أداءً)

- **Font optimization**: `next/font/google` مع `display: "swap"` (مُنفذ ✅)
- **Image optimization**: استخدم `<Image>` لا `<img>` (⚠️ تحذيرات نشطة)
- **Minimal bundle**: لا مكتبات كبيرة
- **Streaming / Suspense**: للصفحات التي تجلب بيانات

### ٢.٤ `/admin` (مدير — الأقل إلحاحًا)

- **Pagination** للبيانات الكبيرة (قيد التطوير)
- **Lazy loading** للرسوم البيانية

---

## ٣. القواعد العامة

### ٣.١ الصور

```tsx
// ✅ استخدم next/image
import Image from "next/image";
<Image src={product.imageUrl} alt={product.nameAr} width={64} height={64} />

// ❌ تجنب <img> (يحذر منها ESLint)
<img src={product.imageUrl} alt={product.nameAr} />
```

### ٣.٢ الخطوط

```tsx
// ✅ next/font/google (مُنفذ)
import { Baloo_2 } from "next/font/google";
const baloo = Baloo_2({ subsets: ["latin"], display: "swap" });

// ❌ لا @import للخطوط في CSS
```

### ٣.٣ Server Components افتراضيًا

```tsx
// ✅ ابدأ بـ Server Component دائمًا
export default async function Page() {
  const data = await db.query.products.findMany(); // مباشر
  return <ProductList products={data} />;
}

// ✅ أضف "use client" فقط عند الحاجة
// indicators: useState, useEffect, onClick, onChange
```

### ٣.٤ تجنب waterfalls

```typescript
// ❌ Waterfall — استعلامان متسلسلان بلا داع
const order = await getOrder(id);
const items = await getItems(order.id); // ينتظر الأول

// ✅ Parallel — استعلامان مستقلان
const [order, items] = await Promise.all([getOrder(id), getItems(id)]);
```

### ٣.٥ تجنب الـ bundle الكبير

```typescript
// ✅ استيراد دالة واحدة
import { eq } from "drizzle-orm";

// ❌ استيراد المكتبة كاملة
import * as drizzle from "drizzle-orm";
```

---

## ٤. قياس الأداء

### ٤.١ أدوات القياس

- **Lighthouse** في Chrome DevTools (للتطوير)
- **Playwright** مع performance tracing (لـ CI)
- **Sentry Performance** (للإنتاج — غير مفعل حاليًا)

### ٤.٢ أمر Playwright للقياس

```bash
npx playwright test --project=chromium --trace on
```

---

## ٥. تحسينات مستقبلية (غير منفذة)

| التحسين                               | الأولوية | المرحلة |
| ------------------------------------- | -------- | ------- |
| استبدال `<img>` بـ `<Image>`          | 🟡       | Phase 4 |
| تفعيل Sentry Performance              | 🟢       | Phase 5 |
| PWA + Service Worker caching          | 🟡       | Phase 5 |
| Pagination في جداول admin             | 🟡       | Phase 5 |
| Code splitting للمسارات غير المستخدمة | 🟢       | Phase 5 |

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** مع كل قياس أداء رئيسي
- **آخر تحديث:** أغسطس 2026
