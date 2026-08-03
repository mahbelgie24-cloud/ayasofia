# Ayasofia Sweet — AI Engineering Operating System (AI-EOS)

> **نظام التشغيل الهندسي** لإدارة دورة حياة تطوير البرمجيات بالكامل عبر عدة وكلاء AI.
>
> هذا ليس كود التطبيق. هذا هو **نظام الإدارة** الذي يحكم التطوير.

---

## ما هذا؟

AI-EOS هو منصة داخلية لإدارة المشروع تحدد:

| المكون        | الوصف                                                         |
| ------------- | ------------------------------------------------------------- |
| **الأدوار**   | Human (PO) • Sonnet (CTO) • DeepSeek (Senior SE)              |
| **سير العمل** | من الفكرة → التحليل → المواصفة → التنفيذ → المراجعة → الإطلاق |
| **المعايير**  | الكود، الجودة، الأمان، الأداء، الوصول                         |
| **الذاكرة**   | سياق المشروع، حالة راهنة، قرارات، مخاطر                       |

---

## هيكل النظام

```
.ai-eos/
├── README.md                         # أنت هنا
├── docs/
│   ├── context/                      # سياق المشروع الأساسي
│   │   ├── PROJECT_CONTEXT.md        # ما هذا المشروع؟ هيكله، فريقه، مبادئه
│   │   ├── PRODUCT_VISION.md         # الرؤية طويلة المدى
│   │   ├── BUSINESS_GOALS.md         # الأهداف الاستراتيجية + KPIs
│   │   ├── PROJECT_SCOPE.md          # النطاق الحالي والمستقبلي
│   │   ├── PROJECT_BOUNDARIES.md     # الحدود الصارمة (لا تتجاوزها)
│   │   ├── CURRENT_STATE.md          # أين نحن الآن (يُحدث باستمرار)
│   │   └── ROADMAP.md                # خارطة الطريق مع DoD
│   ├── architecture/                 # التصميم المعماري
│   │   ├── SYSTEM_ARCHITECTURE.md    # النمط، الطبقات، التدفقات
│   │   ├── TECH_STACK.md             # التقنيات والإصدارات
│   │   └── DEPENDENCY_MAP.md         # خريطة التبعيات
│   ├── quality/                      # معايير الجودة
│   │   ├── CODING_STANDARDS.md       # معايير كتابة الكود
│   │   ├── ENGINEERING_GUIDELINES.md # فلسفة الهندسة (SOLID, DRY, KISS)
│   │   ├── UI_UX_GUIDELINES.md       # معايير الواجهة والعلامة التجارية
│   │   ├── API_GUIDELINES.md         # معايير Server Actions
│   │   ├── DATABASE_GUIDELINES.md    # معايير قاعدة البيانات
│   │   ├── QUALITY_GATE.md           # بوابات الجودة
│   │   ├── PERFORMANCE_GUIDELINES.md # أهداف ومعايير الأداء
│   │   ├── ACCESSIBILITY_GUIDELINES.md # معايير WCAG 2.2 AA
│   │   └── ENGINEERING_GOVERNANCE.md # الحوكمة الهندسية
│   ├── security/                     # الأمان
│   │   └── SECURITY_RULES.md         # قواعد الأمان + OWASP checklist
│   ├── testing/                      # الاختبارات
│   │   └── TESTING_STRATEGY.md       # استراتيجية الاختبار
│   └── releases/                     # الإطلاقات
│       └── RELEASE_PROCESS.md        # عملية الإطلاق
├── workflows/                        # سير العمل والتعاون
│   ├── COLLABORATION_PROTOCOL.md     # كيف تتعاون الأطراف الثلاثة
│   ├── TASK_LIFECYCLE.md             # دورة حياة المهمة
│   └── REVIEW_SYSTEM.md              # نظام المراجعة (13 بُعدًا)
├── prompts/                          # قاعدة بيانات المطالبات
│   └── PROMPT_LIBRARY.md            # كل المطالبات القابلة لإعادة الاستخدام
├── templates/                        # قوالب المستندات
│   ├── features/FEATURE_SPEC_TEMPLATE.md
│   ├── tasks/TASK_TEMPLATE.md
│   ├── reviews/REVIEW_REPORT_TEMPLATE.md
│   └── decisions/ADR_TEMPLATE.md
├── checklists/
│   └── ENGINEERING_CHECKLIST.md      # قوائم التحقق (مطور، مراجع، أمان، إطلاق)
├── reports/
│   └── RISK_REGISTER.md              # سجل المخاطر
├── decisions/                        # سجل القرارات المعمارية (ADRs)
├── changelog/                        # سجل التغييرات
└── assets/                           # رسوم بيانية وموارد
```

---

## كيف تبدأ جلسة تطوير

### للبشر (Human) — عندما تريد ميزة جديدة:

1. اقرأ `ROADMAP.md` لترى أين نحن
2. اقرأ `CURRENT_STATE.md` لترى ما تم إنجازه
3. صِف طلبك (نص حر)
4. Sonnet سيحلل ويُعد مواصفة

### لـ Sonnet (CTO) — عندما تستلم طلبًا:

1. اقرأ `PROJECT_CONTEXT.md`
2. اقرأ `docs/technical-spec.md` (المرجع الأعلى — خارج AI-EOS)
3. اقرأ `CURRENT_STATE.md`
4. حلل الطلب ← اكتب SPEC ← قسم لمهام ← أسند لـ DeepSeek

### لـ DeepSeek (Senior SE) — عندما تستلم مهمة:

1. اقرأ `PROJECT_CONTEXT.md`
2. اقرأ `CURRENT_STATE.md`
3. اقرأ SPEC + TASK المرفقة
4. اقرأ `CODING_STANDARDS.md`
5. اقرأ الملفات المتأثرة (لفهم النمط)
6. نفذ ← اختبر ← قدم

---

## الوثائق الخارجية (خارج AI-EOS)

| الملف                    | الموقع                      | النطاق                      |
| ------------------------ | --------------------------- | --------------------------- |
| `docs/technical-spec.md` | `../docs/technical-spec.md` | المرجع الأعلى — يحكم كل شيء |
| `AGENTS.md`              | `../AGENTS.md`              | ملاحظات سريعة للـ AI agents |
| `db/schema.ts`           | `../db/schema.ts`           | مخطط قاعدة البيانات         |
| `package.json`           | `../package.json`           | التبعيات والإصدارات         |

---

## مبادئ النظام

1. **توثيق أولاً:** لا كود قبل مواصفة. لا مواصفة قبل تحليل.
2. **مراجعة قبل دمج:** لا كود يمر بدون مراجعة Sonnet.
3. **مهمة واحدة:** لا تنفذ أكثر من مهمة واحدة في جلسة تطوير.
4. **لا تخمين:** اقرأ الملفات، افحص المكتبات، اسأل عند الغموض.
5. **ذاكرة حية:** CURRENT_STATE.md يُحدث بعد كل مهمة. CHANGELOG بعد كل إصدار.
6. **المال أولاً:** الأمان المالي > أي شيء آخر.

---

## صيانة هذا النظام

- **مالك النظام:** المدير التقني (Sonnet)
- **المراجع:** Human (فصليًا)
- **التحديث:** عند تغيير هيكلي في طريقة العمل
- **آخر تحديث:** أغسطس 2026
- **الإصدار:** v1.0
