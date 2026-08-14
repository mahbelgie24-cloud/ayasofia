import { Banknote, Receipt, AlertTriangle, Clock, Sparkles } from "lucide-react";
import { getDashboardSummary } from "./reports/actions";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PearlDivider } from "@/components/ui/pearl-field";
import { toMinorUnits, formatPrice } from "@/lib/pricing";

export default async function AdminPage() {
  const summary = await getDashboardSummary();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="لوحة التحكم"
        title="نظرة عامة اليوم"
        subtitle="ملخّص أداء المحل — قراءات سريعة تساعدك على اتخاذ القرار."
      />

      {/* Featured stat — the most important number, brand-anchored */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="مبيعات اليوم"
          value={`${formatPrice(toMinorUnits(summary.todayRevenue))} ₪`}
          icon={<Banknote className="size-4" />}
          featured
          hint="منذ بداية اليوم"
        />
        <Stat
          label="طلبات اليوم"
          value={summary.todayOrderCount.toLocaleString("ar")}
          icon={<Receipt className="size-4" />}
          hint={`${formatPrice(toMinorUnits(summary.averageOrder))} ₪ متوسط`}
        />
        <Stat
          label="مخزون منخفض"
          value={summary.lowStockCount.toLocaleString("ar")}
          tone={summary.lowStockCount > 0 ? "warning" : "success"}
          icon={<AlertTriangle className="size-4" />}
          hint={summary.lowStockCount > 0 ? "يستحق إعادة الطلب" : "كل شيء بحالة جيدة"}
        />
        <Stat
          label="ورديات مفتوحة"
          value={summary.openShiftCount.toLocaleString("ar")}
          icon={<Clock className="size-4" />}
          hint="نشطة الآن"
        />
      </div>

      <section>
        <SectionHeader
          title="الأكثر مبيعاً اليوم"
          subtitle="المنتجات التي حققت أعلى مبيعات منذ بداية اليوم."
        />
        <PearlDivider tone="muted" className="mt-4 mb-4" />
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
          <Card variant="pop" className="mt-4 overflow-hidden p-0">
            <ol role="list" className="divide-border-subtle/70 divide-y">
              {summary.topSellers.map((item, i) => (
                <li
                  key={item.productId}
                  className="hover:bg-brand-red-soft/30 group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        i === 0
                          ? "bg-brand-red shadow-brand-soft text-white"
                          : i === 1
                            ? "bg-brand-red-soft text-brand-red"
                            : i === 2
                              ? "bg-brand-cream text-brand-red ring-brand-red/15 ring-1"
                              : "bg-muted text-text-secondary"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-brand-ink truncate text-sm font-semibold">{item.nameAr}</p>
                      <p className="text-text-secondary caption mt-0.5 flex items-center gap-1">
                        <Sparkles className="size-2.5" />
                        الأكثر طلباً اليوم
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-3 text-sm">
                    <span className="text-text-secondary numeric">{item.quantitySold}×</span>
                    <span className="text-brand-red numeric text-base font-bold">
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
