import { getDashboardSummary } from "./reports/actions";

export default async function AdminPage() {
  const summary = await getDashboardSummary();

  const kpis = [
    {
      label: "مبيعات اليوم",
      value: `${summary.todayRevenue} ₪`,
    },
    {
      label: "طلبات اليوم",
      value: String(summary.todayOrderCount),
    },
    {
      label: "متوسط الطلب",
      value: `${summary.averageOrder} ₪`,
    },
    {
      label: "مخزون منخفض",
      value: String(summary.lowStockCount),
      warn: summary.lowStockCount > 0,
    },
    {
      label: "ورديات مفتوحة",
      value: String(summary.openShiftCount),
    },
  ];

  return (
    <div dir="rtl" lang="ar">
      <h1 className="font-heading text-brand-ink text-2xl font-bold">لوحة التحكم</h1>
      <p className="text-text-secondary mt-1 text-sm">
        نظرة عامة على أداء المحل اليوم. التفاصيل الكاملة في قسم التقارير.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-xl bg-white p-4 shadow-sm ${
              kpi.warn ? "bg-status-warning/10" : ""
            }`}
          >
            <p className="text-text-secondary text-sm">{kpi.label}</p>
            <p
              className={`font-heading mt-1 text-2xl font-bold ${
                kpi.warn ? "text-status-warning" : "text-brand-ink"
              }`}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h2 className="font-heading text-brand-ink text-lg font-semibold">الأكثر مبيعاً اليوم</h2>
        {summary.topSellers.length === 0 ? (
          <p className="text-text-secondary mt-2 text-sm">لا توجد مبيعات اليوم بعد.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {summary.topSellers.map((item, i) => (
              <li
                key={item.productId}
                className="border-border-subtle flex items-center justify-between rounded-xl border bg-white px-4 py-2 text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="text-text-secondary text-xs font-semibold">{i + 1}</span>
                  <span className="font-medium">{item.nameAr}</span>
                </span>
                <span className="text-text-secondary">
                  {item.quantitySold} × {item.totalRevenue} ₪
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
