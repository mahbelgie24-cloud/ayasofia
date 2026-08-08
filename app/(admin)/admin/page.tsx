import { Banknote, Receipt, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { getDashboardSummary } from "./reports/actions";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toMinorUnits, formatPrice } from "@/lib/pricing";

export default async function AdminPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="لوحة التحكم"
        title="نظرة عامة اليوم"
        subtitle="ملخّص أداء المحل — قراءات سريعة تساعدك على اتخاذ القرار."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat
          label="مبيعات اليوم"
          value={`${formatPrice(toMinorUnits(summary.todayRevenue))} ₪`}
          icon={<Banknote className="size-4" />}
        />
        <Stat
          label="طلبات اليوم"
          value={summary.todayOrderCount.toLocaleString("ar")}
          icon={<Receipt className="size-4" />}
        />
        <Stat
          label="متوسط الطلب"
          value={`${formatPrice(toMinorUnits(summary.averageOrder))} ₪`}
          icon={<TrendingUp className="size-4" />}
        />
        <Stat
          label="مخزون منخفض"
          value={summary.lowStockCount.toLocaleString("ar")}
          tone={summary.lowStockCount > 0 ? "warning" : "default"}
          icon={<AlertTriangle className="size-4" />}
          hint={summary.lowStockCount > 0 ? "يستحق إعادة الطلب" : "كل شيء بحالة جيدة"}
        />
        <Stat
          label="ورديات مفتوحة"
          value={summary.openShiftCount.toLocaleString("ar")}
          icon={<Clock className="size-4" />}
        />
      </div>

      <section>
        <SectionHeader
          title="الأكثر مبيعاً اليوم"
          subtitle="المنتجات التي حققت أعلى مبيعات منذ بداية اليوم."
        />
        {summary.topSellers.length === 0 ? (
          <Card variant="default" className="mt-4">
            <CardBody>
              <EmptyState
                title="لا توجد مبيعات اليوم بعد"
                description="ستظهر المنتجات الأكثر مبيعاً هنا فور إتمام أول طلب."
              />
            </CardBody>
          </Card>
        ) : (
          <Card variant="default" className="mt-4 overflow-hidden p-0">
            <ol role="list" className="divide-border-subtle divide-y">
              {summary.topSellers.map((item, i) => (
                <li
                  key={item.productId}
                  className="hover:bg-brand-cream/30 flex items-center justify-between gap-3 px-5 py-3 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-text-secondary/70 numeric w-6 text-center text-sm font-semibold">
                      {i + 1}
                    </span>
                    <span className="text-brand-ink truncate text-sm font-medium">
                      {item.nameAr}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-sm">
                    <span className="text-text-secondary numeric">{item.quantitySold}×</span>
                    <span className="text-brand-ink numeric font-semibold">
                      {item.totalRevenue} ₪
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>
    </div>
  );
}
