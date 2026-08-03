# Roadmap — Ayasofia Sweet

|               |                              |
| ------------- | ---------------------------- |
| **الإصدار**   | 1.0                          |
| **آخر تحديث** | أغسطس 2026                   |
| **المرجع**    | `docs/technical-spec.md` §13 |

---

## خارطة الطريق التفصيلية

### ✅ Phase 0 — Discovery (مكتمل)

> DoD: جدول بيانات seed جاهز للتحميل

- [x] جمع القائمة الحقيقية مع الأسعار
- [x] تعريف الوصفات (BOM) لكل Bubble Tea
- [x] تأكيد العملة (₪ ILS)
- [x] إنشاء `db/seed-data.ts` + `db/seed.ts`

### ✅ Phase 1 — Core POS (مكتمل)

> DoD: 20 عملية بيع متتالية بدون أخطاء حسابية

- [x] تسجيل دخول PIN 4 أرقام
- [x] تصفح القائمة مع فئات
- [x] نظام مُعدِّلات Bubble Tea (حجم، سكر، ثلج، إضافات)
- [x] سلة مشتريات مع كميات
- [x] إتمام شراء مع idempotencyKey
- [x] إيصال WhatsApp
- [x] 67 اختبار (وحدة + تكامل) + 3 أجنحة E2E

### ✅ Phase 2 — Inventory Wired In (مكتمل)

> DoD: بيع 10 مشروبات متطابقة يخصم الكميات الصحيحة من tapioca والثلج والشاي

- [x] جداول: ingredients, recipes, inventory_moves
- [x] BOM لـ 17 منتجًا (50 وصفة)
- [x] خصم تلقائي عند البيع
- [x] مسار تدقيق (audit trail): كل حركة لها سبب ومرجع
- [x] مؤشرات مخزون منخفض في واجهة admin
- [x] تسجيل توريد وهدر (مدير فقط)

### ✅ Phase 3 — Drive-Thru + Customer Ordering + KDS (مكتمل)

> DoD: طلب من هاتف خارج الشبكة يظهر على KDS في < 3 ثوانٍ

- [x] واجهة `/drive-thru` (tea-first، كثيفة، أسرع من POS)
- [x] واجهة `/order` (بدون تسجيل، mobile-first)
- [x] تتبع حالة الطلب للعميل
- [x] واجهة `/kitchen` مع:
  - [x] Supabase Realtime (CDC)
  - [x] صوت تنبيه عند طلب جديد
  - [x] وسوم قنوات (🥤 صالة، 📱 خارجي، 🚘 Drive-Thru)
  - [x] انتقالات حالة (received → preparing → ready → completed)
- [x] حماية مسارات عبر `proxy.ts`

---

### → Phase 4 — Reporting (الخطوة التالية)

> DoD: Z-report يطابق العد النقدي اليدوي 100%

#### ٤.١ تقارير المبيعات

- [ ] REST API / Server Actions للتقارير
- [ ] تقرير يومي: إجمالي المبيعات، عدد الطلبات، طرق الدفع
- [ ] تقرير أسبوعي: اتجاهات، مقارنة بأسابيع سابقة
- [ ] واجهة `/admin/reports`

#### ٤.٢ أفضل المنتجات

- [ ] ترتيب المنتجات حسب: الكمية المباعة، الإيرادات
- [ ] لكل منتج: السعر، التكلفة، الهامش، عدد الطلبات

#### ٤.٣ هوامش الربح

- [ ] لكل منتج: صافي الربح = السعر − تكلفة المكونات (من recipes)
- [ ] تجميع يومي/أسبوعي
- [ ] **هذه الميزة للمدير والمالك فقط** (requireStaffSession("manager"))

#### ٤.٤ Z-Report / Cash Reconciliation

- [ ] واجهة بداية/نهاية وردية
- [ ] إدخال opening cash
- [ ] عرض: إجمالي المبيعات، cash، card، المتوقع في الدرج
- [ ] إدخال closing cash الفعلي
- [ ] حساب الفرق (over/short)
- [ ] ربط مع جدول `shifts`

#### ٤.٥ شاشات الإدارة الإضافية

- [ ] `/admin/staff` — إدارة الموظفين (إضافة، تعديل، تعطيل، PIN)
  - [ ] تحقق من عدم تكرار PIN بين الموظفين النشطين (spec §8.1 guardrail)
- [ ] `/admin/menu` — تعديل القائمة (منتجات، أسعار، معدِّلات)
- [ ] `/admin/settings` — إعدادات المحل (اسم، ضريبة، عملة، إيصال)
- [ ] `/admin/reports` — لوحة التقارير

#### ٤.٦ إصلاحات فنية (ضمن Phase 4)

- [ ] إصلاح `parseFloat` في `getReceiptData`
- [ ] استبدال `parseFloat(product.basePrice) * 100` بـ `toMinorUnits`
- [ ] استخراج usePOSCart hook لتوحيد منطق POS و Drive-Thru
- [ ] إصلاح idempotencyKey في Customer Order
- [ ] استبدال `Math.random()` بـ `crypto.randomUUID()`
- [ ] تفعيل حساب الضريبة من `settings`

---

### → Phase 5 — Hardening

> DoD: اجتياز OWASP checklist + أسبوع تشغيل متوازي بدون أخطاء

- [ ] Offline mode (Service Worker + IndexedDB + Dexie.js)
- [ ] مهمة Cron لتنظيف المستخدمين المجهولين
- [ ] تدقيق أمني شامل (OWASP ASVS Level 1)
- [ ] تفعيل Sentry للمراقبة
- [ ] إعداد CI/CD (GitHub Actions)
- [ ] تشغيل متوازي لمدة أسبوع مع العملية اليدوية

---

### ← Phase 6 — Candidate Enhancements

> مرحلة ما بعد الإطلاق — تُقيّم حسب الحاجة

- [ ] برنامج ولاء/مكافآت
- [ ] صورة طلب قابلة للمشاركة (Instagram/TikTok)
- [ ] لوحة قائمة Drive-Thru رقمية
- [ ] دفع إلكتروني (بوابة دفع محلية)
- [ ] PWA install prompt
- [ ] دعم طابعات متعددة

---

## إصلاحات عاجلة (قبل Phase 4)

قبل البدء بتنفيذ Phase 4:

| #   | الإصلاح                                     | الأولوية |
| --- | ------------------------------------------- | -------- |
| 1   | `parseFloat` في حسابات الأسعار (3 مواقع)    | 🔴       |
| 2   | Rate limiting على verifyStaffPin            | 🔴       |
| 3   | استخدام `toMinorUnits` بدل `parseFloat*100` | 🟡       |
| 4   | استخراج usePOSCart                          | 🟡       |
| 5   | idempotencyKey ref في Customer Order        | 🟡       |

---

## صيانة هذا الملف

- **مالك الملف:** Product Owner (بشر) + المدير التقني (Sonnet)
- **التحديث:** مع كل Sprint — تحديد أولويات الأسبوع/الأسبوعين القادمين
- **الارتباطات:** `CURRENT_STATE.md`, `CHANGELOG.md`
- **آخر تحديث:** أغسطس 2026
