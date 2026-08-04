# Anonymous User Cleanup — Operational Runbook

|               |                                               |
| ------------- | --------------------------------------------- |
| **الغرض**     | حذف مستخدمي Supabase Auth المجهولين المتروكين |
| **التكرار**   | أسبوعيًا (الإثنين 03:00 UTC) — dry-run فقط    |
| **التنفيذ**   | يدوي عبر GitHub Actions → workflow_dispatch   |
| **المالك**    | فريق Ayasofia Sweet                           |
| **آخر تحديث** | أغسطس ٢٠٢٦                                    |

---

## ما يفعله هذا الأمر

يحذف مستخدمي `auth.users` المجهولين (`is_anonymous = true`) الذين:

1. أُنشئوا قبل أكثر من 24 ساعة (قابل للتكوين)
2. **ليسوا** مرتبطين بأي صف في `staff.auth_user_id`
3. **ليس** لديهم `staff_id` في `app_metadata`
4. **ليس** لديهم `email` أو `phone` (علامات على أن الحساب تمت ترقيته)

## ما لا يمسه أبدًا

- الموظفين المرتبطين (`staff.auth_user_id = user.id`)
- المستخدمين غير المجهولين (`is_anonymous !== true`)
- المستخدمين الحديثين (خلال 24 ساعة)
- المستخدمين الذين لديهم بريد إلكتروني أو هاتف
- المستخدمين الذين لديهم `staff_id` في metadata

---

## متغيرات البيئة المطلوبة

| المتغير                        | الوصف                               |
| ------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`     | رابط مشروع Supabase                 |
| `SUPABASE_SERVICE_ROLE_KEY`    | **سري** — مفتاح الخدمة (يتجاوز RLS) |
| `ANONYMOUS_USER_MAX_AGE_HOURS` | (اختياري) مدة الاحتفاظ — افتراضي 24 |

---

## الاستخدام

### Dry-run (افتراضي — آمن)

```bash
npm run cleanup:anonymous
```

**لا يحذف أي شيء.** يُظهر فقط عدد المستخدمين الذين كانوا سيُحذفون.

### التنفيذ الفعلي

```bash
npm run cleanup:anonymous -- --execute
```

### مع مدة احتفاظ مخصصة

```bash
ANONYMOUS_USER_MAX_AGE_HOURS=12 npm run cleanup:anonymous -- --execute
```

---

## الاختبار المحلي

```bash
# تأكد من وجود .env.local مع المتغيرات
cp .env.example .env.local
# املأ القيم الحقيقية

# تشغيل dry-run (آمن)
npm run cleanup:anonymous
```

---

## GitHub Actions

**الجدولة:** أسبوعيًا — الإثنين 03:00 UTC (dry-run فقط، **لا يحذف شيئاً**)

**التنفيذ اليدوي (الوحيد للحذف الفعلي):**

1. اذهب إلى GitHub → Actions → "Anonymous User Cleanup"
2. اضغط "Run workflow"
3. حدد خيار `execute` (true = حذف فعلي, false = dry-run)
4. أدخل `retention_hours` (عدد ساعات الاحتفاظ، افتراضي 24)
5. اضغط "Run workflow"

**لماذا dry-run فقط في الجدولة؟**

- الحذف التلقائي خطر إذا حدث خطأ في التحقق
- مراجعة dry-run الأسبوعي تمنحك رؤية للتراكم قبل التنفيذ
- التنفيذ الفعلي يجب أن يكون قراراً بشرياً واعياً

**الأسرار المطلوبة في GitHub:**

- `SUPABASE_URL` — رابط Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — مفتاح الخدمة

---

## ماذا تفعل عند فشل التشغيل

1. **راجع سجل GitHub Actions** لمعرفة الخطأ
2. **الأسباب الشائعة:**
   - `SUPABASE_SERVICE_ROLE_KEY` غير صحيح أو منتهي الصلاحية
   - `NEXT_PUBLIC_SUPABASE_URL` غير صحيح
   - مشكلة في الاتصال بقاعدة البيانات
3. **إذا فشل الحذف:** تحقق من سجلات Supabase
4. **لا تُعد تشغيل execute** حتى تفهم سبب الفشل

---

## تدوير مفتاح service-role

إذا كنت تشك في تسرّب `SUPABASE_SERVICE_ROLE_KEY`:

1. اذهب إلى Supabase Dashboard → Project Settings → API
2. اضغط "Revoke" على service_role key
3. اضغط "Generate new key"
4. حدّث `.env.local` محليًا
5. حدّث GitHub Secrets
6. تحقق من أن `npm run cleanup:anonymous` ما زال يعمل

---

## تنبيه

هذا الأمر **ليس** بديلاً عن مراجعة أمنية كاملة. إنه جزء من Phase 5 hardening فقط.
