# Security Rules — Ayasofia Sweet

|               |                                   |
| ------------- | --------------------------------- |
| **الإصدار**   | 1.0                               |
| **آخر تحديث** | أغسطس 2026                        |
| **التصنيف**   | داخلي — غير مخصص للنشر العام      |
| **المرجع**    | OWASP ASVS Level 1 • OWASP Top 10 |

---

## ١. مبادئ الأمان الأساسية

1. **لا تثق في العميل أبدًا.** كل مدخل وكل سعر — يُعاد التحقق منه server-side.
2. **الأمان متعدد الطبقات.** لا تعتمد على طبقة واحدة. Proxy + Server Action + RLS = دفاع متعدد.
3. **أقل صلاحية ممكنة.** Cashier لا يرى margin. Barista لا يعدل الأسعار.
4. **لا أسرار في الكود.** كل المفاتيح في environment variables.
5. **سجل كل شيء.** كل حركة مخزون لها `reason` و `createdBy`.

---

## ٢. قواعد إلزامية (Hard Rules)

### ٢.١ المصادقة والجلسات

```typescript
// ✅ كل Server Action (ما عدا verifyStaffPin و placeCustomerOrder):
import { requireStaffSession } from "@/lib/auth";
const { staffId, role } = await requireStaffSession(minRole?);

// ❌ لا تتجاوز هذه القاعدة أبدًا
// إذا كان action لا يحوي requireStaffSession = أعد كتابته فورًا
```

**الاستثناءات الوحيدة (مبررة وموثقة):**

- `verifyStaffPin` — هو من يُنشئ الجلسة
- `placeCustomerOrder` — طريق عام للعملاء

### ٢.٢ الأدوار والصلاحيات

| الدور     | يمكنه                              |
| --------- | ---------------------------------- |
| `barista` | عرض شاشة المطبخ، تحديث حالة الطلب  |
| `cashier` | barista + إنشاء طلبات، عرض الأسعار |
| `manager` | cashier + إدارة المخزون، تقارير    |
| `owner`   | manager + إدارة الموظفين، إعدادات  |

**القاعدة:** `requireStaffSession("manager")` = لا barista ولا cashier يمرران.

### ٢.٣ أسرار البيئة

```bash
# .env.local — NEVER commit
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # OK للـ client
SUPABASE_SERVICE_ROLE_KEY=eyJ...        # SERVER ONLY — خطر لو تسرب
DATABASE_URL=postgresql://...           # SERVER ONLY
```

- `SUPABASE_SERVICE_ROLE_KEY` لا يظهر في أي client bundle
- `createServiceClient()` لا تُستورد في أي Client Component
- `NEXT_PUBLIC_` فقط للمفاتيح المخصصة للعلن

---

## ٣. تدقيق OWASP Top 10

| #   | الثغرة                    | الحالة في مشروعنا                                                    |
| --- | ------------------------- | -------------------------------------------------------------------- |
| A01 | Broken Access Control     | ✅ RLS + requireStaffSession على كل action                           |
| A02 | Cryptographic Failures    | ✅ scrypt للـ PIN، TLS للنقل                                         |
| A03 | Injection                 | ✅ Drizzle ORM (parameterized queries) — لا SQL نيء                  |
| A04 | Insecure Design           | ✅ مراجعة معمارية لكل تغيير كبير                                     |
| A05 | Security Misconfiguration | ✅ Rate limiting مفعل على PIN، cleanup job للـ anonymous users مجدول |
| A06 | Vulnerable Components     | ⚠️ تحتاج `npm audit` دوري                                            |
| A07 | Auth Failures             | ✅ Rate limiting + lockout على PIN (B1)، anonymous user cleanup (B2) |
| A08 | Software & Data Integrity | ✅ idempotency keys + server-side recomputation                      |
| A09 | Logging & Monitoring      | ⚠️ Sentry موجود لكن غير مفعل فعليًا                                  |
| A10 | SSRF                      | ✅ لا استدعاءات خارجية حالية                                         |

---

## ٤. فجوات أمنية معروفة (يجب معالجتها)

| #   | الفجوة                              | الخطورة  | الإصلاح المخطط                                              | المرحلة |
| --- | ----------------------------------- | -------- | ----------------------------------------------------------- | ------- |
| 1   | لا rate limiting على verifyStaffPin | ✅ مُغلق | Rate limiting + lockout في B1                               | Phase 5 |
| 2   | لا تنظيف للمستخدمين المجهولين       | ✅ مُغلق | `scripts/cleanup-anonymous-users.ts` + GitHub Actions daily | Phase 5 |
| 3   | Sentry غير مفعل فعليًا              | متوسط    | تهيئة Sentry في next.config                                 | Phase 5 |
| 4   | `Math.random()` لـ order numbers    | ✅ مُغلق | `crypto.randomUUID()` في A3                                 | Phase 4 |
| 5   | لا CSP headers                      | منخفض    | Content-Security-Policy                                     | Phase 5 |
| 6   | لا CSRF protection صريحة            | منخفض    | Next.js Server Actions تحمي ضمنيًا                          | —       |

---

## ٥. نموذج التهديد (مبسط)

### تهديد ١: موظف يحاول التلاعب بالأسعار

- **السيناريو:** Cashier يعدل السعر في المتصفح قبل الإرسال
- **الحماية:** `recalculateCartServerSide()` يتجاهل أسعار العميل ويستخدم أسعار DB
- **النتيجة:** ❌ فشل — السعر الصحيح من الخادم

### تهديد ٢: موظف سابق يحاول الدخول

- **السيناريو:** موظف فُصل لكنه يعرف PIN
- **الحماية:** `active` field في staff table + يمكن تعطيله من admin
- **الثغرة:** لا يوجد تعطيل تلقائي — يجب على المدير تعطيل الحساب يدويًا
- **النتيجة:** ⚠️ يعمل مؤقتًا حتى يُعطّل الحساب (يحتاج UI إدارة موظفين)

### تهديد ٣: زبون يحاول الوصول لبيانات الموظفين

- **السيناريو:** Customer يستدعي Server Action للموظفين مباشرة
- **الحماية:** `requireStaffSession()` يرمي AuthError
- **النتيجة:** ❌ فشل

### تهديد ٤: هجوم brute force على PIN

- **السيناريو:** مهاجم يجرب 10,000 PIN آليًا
- **الحماية:** لا يوجد حاليًا — الثغرة رقم ١ أعلاه
- **النتيجة:** ✅ ينجح خلال دقائق

---

## ٦. الاستجابة للحوادث (مبسطة)

عند اكتشاف ثغرة أمنية:

1. **أبلغ فورًا** — Human + Sonnet
2. **قيم الخطورة** — هل تؤثر على بيانات حقيقية؟
3. **أوقف التطوير** — إصلاح الثغرة له الأولوية القصوى
4. **أصلح + اختبر** — في بيئة معزولة
5. **نشر الإصلاح** — عبر CI/CD
6. **وثق الدرس** — `reports/SEC-XXXX-postmortem.md`

---

## ٧. نفي المسؤولية (Disclaimer)

هذا النظام لم يخضع لتدقيق أمني خارجي. القواعد هنا تمثل أفضل الممارسات المعروفة للمطورين (OWASP ASVS Level 1 كحد أدنى). قبل الإطلاق الفعلي:

- [ ] تدقيق أمني شامل (Phase 5)
- [ ] تشغيل متوازي مع النظام اليدوي لمدة أسبوع
- [ ] مراجعة محاسب/محامٍ محلي للامتثال الضريبي

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet) + مسؤول الأمان (إن وجد)
- **دورة المراجعة:** قبل كل إطلاق رئيسي + عند اكتشاف ثغرة
- **السرية:** لا يُشارك خارج فريق التطوير
- **آخر تحديث:** أغسطس 2026
