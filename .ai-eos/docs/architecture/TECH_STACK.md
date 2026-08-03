# Technology Stack — Ayasofia Sweet

|               |                             |
| ------------- | --------------------------- |
| **الإصدار**   | 1.0                         |
| **آخر تحديث** | أغسطس 2026                  |
| **المرجع**    | `docs/technical-spec.md` §5 |

---

## المكدس التقني الكامل

### Frontend

| التقنية                  | الإصدار | الدور                          | license    |
| ------------------------ | ------- | ------------------------------ | ---------- |
| React                    | 19.2.x  | واجهة المستخدم                 | MIT        |
| Next.js                  | 16.x    | إطار العمل (App Router)        | MIT        |
| TypeScript               | ^5      | لغة البرمجة                    | Apache-2.0 |
| Tailwind CSS             | ^4      | تنسيق CSS                      | MIT        |
| shadcn/ui                | ^4.16   | مكونات UI (Base UI primitives) | MIT        |
| lucide-react             | ^1.28   | أيقونات                        | ISC        |
| class-variance-authority | ^0.7    | variants API                   | Apache-2.0 |
| clsx                     | ^2.1    | class merging                  | MIT        |
| tailwind-merge           | ^3.6    | Tailwind class merging         | MIT        |
| tw-animate-css           | ^1.4    | animations                     | —          |
| @base-ui/react           | ^1.6    | shadcn/ui dependency           | MIT        |

### Backend

| التقنية          | الإصدار | الدور                              | license    |
| ---------------- | ------- | ---------------------------------- | ---------- |
| Next.js (Server) | 16.x    | Server Components + Server Actions | MIT        |
| Drizzle ORM      | ^0.45   | Type-safe SQL                      | Apache-2.0 |
| pg               | ^8.22   | node-postgres driver               | MIT        |
| Supabase JS      | ^2.111  | Auth + Realtime                    | MIT        |
| @supabase/ssr    | ^0.12   | SSR auth helpers                   | MIT        |

### Infrastructure

| التقنية               | الدور              | خطة التسعير       |
| --------------------- | ------------------ | ----------------- |
| PostgreSQL (Supabase) | قاعدة البيانات     | Free tier (500MB) |
| Supabase Auth         | المصادقة           | Free tier         |
| Supabase Realtime     | CDC / live updates | Free tier         |
| Vercel                | استضافة التطبيق    | Hobby (محدود)     |
| Sentry                | مراقبة الأخطاء     | Free tier         |

### DevOps & Testing

| التقنية     | الإصدار | الدور                     |
| ----------- | ------- | ------------------------- |
| Vitest      | ^4.1    | اختبارات الوحدة + التكامل |
| Playwright  | ^1.62   | اختبارات E2E              |
| ESLint      | ^9      | تدقيق الكود               |
| TypeScript  | ^5      | تدقيق الأنواع             |
| Drizzle Kit | ^0.31   | إدارة الهجرات             |

---

## متطلبات التشغيل

```bash
Node.js >= 20
npm >= 10
PostgreSQL 15+ (عبر Supabase)
```

---

## متغيرات البيئة

```bash
# .env.local (git-ignored)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:...@db.xxxxx.supabase.co:5432/postgres
SENTRY_DSN=https://...  # optional
NEXT_PUBLIC_APP_CURRENCY=ILS
```

انظر `.env.example` للقائمة الكاملة.

---

## التبعيات المحظورة (Deliberately Avoided)

| التقنية                           | سبب التجنب                             |
| --------------------------------- | -------------------------------------- |
| Redis / أي cache layer            | PostgreSQL + فهارس كافٍ لهذا الحجم     |
| Docker / Kubernetes               | عبء تشغيلي غير ضروري                   |
| Prisma                            | Drizzle يمنح SQL شفاف (أهم للمبتدئين)  |
| NextAuth / Auth0                  | Supabase Auth مدمج ومجاني              |
| REST framework (tRPC, etc.)       | Server Actions تكفي                    |
| State management (Redux, Zustand) | React state + Server Components كافيان |
| GraphQL                           | تعقيد إضافي بدون فائدة                 |
| WebSockets مخصصة                  | Supabase Realtime يغطي الاحتياج        |
| S3 / CDN صور                      | Vercel + Supabase storage كافيان       |

---

## فلسفة اختيار التقنيات

1. **الأقل تعقيدًا الذي يفي بالغرض:** لا نضيف تقنية "احتياطًا"
2. **نظام بيئي واحد:** TypeScript في كل الطبقات
3. **مجاني عند هذا الحجم:** كل التقنيات المختارة لها free tier كافٍ
4. **موثق جيدًا:** لتحسين جودة مخرجات AI agents
5. **SQL شفاف:** المطور يرى الاستعلام الفعلي، لا black box

---

## صيانة هذا الملف

- **مالك الملف:** المدير التقني (Sonnet)
- **دورة المراجعة:** عند ترقية تبعية رئيسية أو إضافة تقنية جديدة
- **التحديث:** أرقام الإصدارات تُحدث من `package.json`
- **آخر تحديث:** أغسطس 2026
