# Accessibility Guidelines — Ayasofia Sweet

|             |                             |
| ----------- | --------------------------- |
| **الإصدار** | 1.0                         |
| **المعيار** | WCAG 2.2 Level AA           |
| **المرجع**  | `docs/technical-spec.md` §6 |

---

## ١. لماذا WCAG AA؟

- **قانوني:** معيار معترف به عالميًا
- **عملي:** يغطي احتياجات الموظفين (ضغط الوقت، الإضاءة المختلفة)
- **أخلاقي:** الشمولية مبدأ أساسي

---

## ٢. قواعد إلزامية

### ٢.١ Touch Targets (أهداف اللمس)

| العنصر                 | الحد الأدنى | موصى به |
| ---------------------- | ----------- | ------- |
| أزرار POS/Drive-Thru   | 44×44px     | 48×48px |
| أزرار القائمة (منتجات) | 44×44px     | —       |
| أزرار التنقل           | 44×44px     | —       |
| مدخلات النماذج         | 24×24px     | 44×44px |

**السبب:** الموظف تحت ضغط الوقت + قد يستخدم تابلت بشاشة صغيرة.

### ٢.٢ تباين الألوان (Color Contrast)

| العنصر           | النسبة الدنيا | مثال                                  |
| ---------------- | ------------- | ------------------------------------- |
| نص عادي (< 18px) | 4.5:1         | `text-brand-ink` على `bg-brand-cream` |
| نص كبير (≥ 18px) | 3:1           | عناوين في KDS                         |
| أيقونات وأزرار   | 3:1           | `bg-brand-red` مع نص أبيض             |

**التحقق:** استخدم Chrome DevTools → Lighthouse → Accessibility

### ٢.٣ لا تعتمد على اللون وحده

```tsx
// ❌ خطأ: الحالة تُنقل باللون فقط
<span className="text-red">خطأ</span>

// ✅ صحيح: أيقونة + نص + لون
<span className="text-status-error" role="alert">
  <AlertIcon aria-hidden="true" />
  رقم الـ PIN غير صحيح
</span>
```

### ٢.٤ النصوص البديلة (Alt Text)

```tsx
// ✅ كل صورة لها alt
<img src="/icons/icon-bubbletea.svg" alt="شاي فقاعات" />

// ✅ أيقونة زخرفية فقط — aria-hidden
<StarIcon aria-hidden="true" />

// ❌ لا تترك alt فارغًا للصور ذات المعنى
<img src="/icons/logo.svg" alt="" /> // فقط إذا كانت زخرفية بحتة
```

### ٢.٥ عناوين الصفحات (Page Titles)

```tsx
// ✅ عنوان فريد لكل صفحة
export const metadata: Metadata = {
  title: "المطبخ — Ayasofia Sweet", // /kitchen
};
```

### ٢.٦ التنقل بلوحة المفاتيح

- كل عنصر تفاعلي يمكن الوصول إليه بـ Tab
- ترتيب Tab يتبع ترتيب القراءة (RTL: يمين إلى يسار)
- `:focus-visible` مرئي بوضوح على كل العناصر
- المؤشرات لا تُحبس (no keyboard traps)

### ٢.٧ النماذج (Forms)

```tsx
// ✅ كل حقل له label
<label htmlFor="customerPhone">رقم الجوال</label>
<input id="customerPhone" type="tel" />

// ✅ أخطاء مرتبطة بالحقول
<input aria-describedby="phone-error" />
<p id="phone-error" role="alert">الرجاء إدخال رقم صحيح</p>
```

### ٢.٨ الإعلان عن التغييرات (Live Regions)

```tsx
// ✅ KDS: طلب جديد — aria-live للتحديثات المباشرة
<div aria-live="polite" aria-atomic="true">
  {orders.length} طلب قيد الانتظار
</div>

// ✅ رسائل الخطأ
<p role="alert">{error}</p>
```

---

## ٣. RTL وإمكانية الوصول

`dir="rtl"` في `<html>` (مُنفذ ✅). هذا يعني:

- المتصفح يتعامل مع RTL لـ tab order والـ scrollbars تلقائيًا
- لا حاجة لانعكاس CSS يدوي
- الأيقونات الاتجاهية (مثل الأسهم) تحتاج انعكاسًا:

```tsx
<ArrowLeft className="rtl:rotate-180" /> // يصبح سهماً لليمين في RTL
```

---

## ٤. فجوات حالية

| الفجوة                              | الأولوية | المرحلة المستهدفة |
| ----------------------------------- | -------- | ----------------- |
| لا اختبارات accessibility automated | 🟡       | Phase 5           |
| `<img>` بدل `<Image>` (4 تحذيرات)   | 🟢       | Phase 4           |
| لا focus management في الـ modals   | 🟡       | Phase 4           |
| labels ناقصة في بعض المدخلات        | 🟡       | Phase 4           |
| لا skip navigation link             | 🟢       | Phase 5           |
| لا dark mode فعال                   | 🟢       | Phase 5           |

---

## ٥. التحقق

### يدويًا

- التنقل بـ Tab عبر كل الشاشات
- تجربة الشاشة مع تكبير 200%
- تجربة مع قارئ شاشة (اختياري للمراحل المبكرة)

### آليًا

```bash
# Playwright accessibility scan (قيد التخطيط)
npx playwright test --project=accessibility
```

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet) + مطور الواجهة
- **دورة المراجعة:** مع كل إعادة تصميم كبيرة
- **آخر تحديث:** أغسطس 2026
