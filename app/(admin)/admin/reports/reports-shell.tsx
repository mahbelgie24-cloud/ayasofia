"use client";

import { useState, useEffect } from "react";
import {
  Banknote,
  Receipt,
  TrendingUp,
  BarChart3,
  Calculator,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
} from "lucide-react";
import {
  getSalesSummary,
  getBestSellers,
  getProductMargins,
  getZReport,
  exportSalesCsv,
  type SalesSummary,
  type BestSeller,
  type ProductMargin,
  type ZReportShift,
} from "./actions";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { Stat } from "@/components/ui/stat";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toMinorUnits, formatPrice } from "@/lib/pricing";

function localDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayStr(): string {
  return localDateStr(new Date());
}

function weekAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return localDateStr(d);
}

function ReportsContent({
  tab,
  startDate,
  endDate,
}: {
  tab: "sales" | "bestsellers" | "margins" | "zreport";
  startDate: string;
  endDate: string;
}) {
  const [sales, setSales] = useState<SalesSummary | null>(null);
  const [bestSellers, setBestSellers] = useState<BestSeller[] | null>(null);
  const [margins, setMargins] = useState<ProductMargin[] | null>(null);
  const [zReport, setZReport] = useState<ZReportShift[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        if (tab === "sales") {
          const d = await getSalesSummary(startDate, endDate);
          if (!cancelled) setSales(d);
        }
        if (tab === "bestsellers") {
          const d = await getBestSellers(startDate, endDate);
          if (!cancelled) setBestSellers(d);
        }
        if (tab === "margins") {
          const d = await getProductMargins();
          if (!cancelled) setMargins(d);
        }
        if (tab === "zreport") {
          const d = await getZReport();
          if (!cancelled) setZReport(d);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [tab, startDate, endDate]);

  const channelLabels: Record<string, string> = {
    dine_in: "صالة",
    takeaway: "خارجي",
    drive_thru: "Drive-Thru",
    delivery: "توصيل",
  };
  const sourceLabels: Record<string, string> = {
    POS: "نقطة البيع",
    DIGITAL_MENU: "القائمة الرقمية",
  };

  return (
    <div className="mt-6 space-y-4">
      {loading && (
        <div className="text-text-secondary py-6 text-center text-sm">جاري التحميل...</div>
      )}

      {!loading && tab === "sales" && sales && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="إجمالي الإيرادات"
              value={`${formatPrice(toMinorUnits(sales.totalRevenue))} ₪`}
              icon={<Banknote className="size-4" />}
            />
            <Stat
              label="عدد الطلبات"
              value={sales.orderCount.toLocaleString("ar")}
              icon={<Receipt className="size-4" />}
            />
            <Stat
              label="متوسط الطلب"
              value={
                sales.orderCount > 0
                  ? `${formatPrice(
                      toMinorUnits(
                        (toMinorUnits(sales.totalRevenue) / sales.orderCount).toFixed(2),
                      ),
                    )} ₪`
                  : "0.00 ₪"
              }
              icon={<TrendingUp className="size-4" />}
            />
          </div>

          <Card variant="default" className="p-0">
            <div className="border-border-subtle border-b px-4 py-3">
              <SectionHeader title="حسب القناة" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary border-border-subtle bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
                    <th className="px-4 py-2.5">القناة</th>
                    <th className="px-4 py-2.5">عدد الطلبات</th>
                    <th className="px-4 py-2.5">الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sales.byChannel).map(([channel, data]) => (
                    <tr key={channel} className="border-border-subtle/60 border-b last:border-0">
                      <td className="text-brand-ink px-4 py-3 font-medium">
                        {channelLabels[channel] ?? channel}
                      </td>
                      <td className="numeric text-text-secondary px-4 py-3">{data.count}</td>
                      <td className="numeric text-brand-ink px-4 py-3 font-semibold">
                        {data.revenue} ₪
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card variant="default" className="p-0">
            <div className="border-border-subtle border-b px-4 py-3">
              <SectionHeader title="حسب المصدر" subtitle="متابعة تبنّي الزبائن للقائمة الرقمية" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary border-border-subtle bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
                    <th className="px-4 py-2.5">المصدر</th>
                    <th className="px-4 py-2.5">عدد الطلبات</th>
                    <th className="px-4 py-2.5">الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(sales.bySource).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-text-secondary px-4 py-8 text-center">
                        لا توجد بيانات
                      </td>
                    </tr>
                  ) : (
                    Object.entries(sales.bySource).map(([source, data]) => (
                      <tr key={source} className="border-border-subtle/60 border-b last:border-0">
                        <td className="text-brand-ink px-4 py-3 font-medium">
                          {sourceLabels[source] ?? source}
                        </td>
                        <td className="numeric text-text-secondary px-4 py-3">{data.count}</td>
                        <td className="numeric text-brand-ink px-4 py-3 font-semibold">
                          {data.revenue} ₪
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!loading && tab === "bestsellers" && bestSellers && (
        <Card variant="default" className="p-0">
          <div className="border-border-subtle border-b px-4 py-3">
            <SectionHeader
              title="الأكثر مبيعًا"
              subtitle={`للفترة من ${startDate} إلى ${endDate}`}
            />
          </div>
          {bestSellers.length === 0 ? (
            <CardBody>
              <EmptyState
                title="لا توجد مبيعات في هذه الفترة"
                description="جرّب فترة زمنية أطول أو راجع تواريخ الطلبات."
              />
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary border-border-subtle bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
                    <th className="px-4 py-2.5 text-center">#</th>
                    <th className="px-4 py-2.5">المنتج</th>
                    <th className="px-4 py-2.5">الكمية المباعة</th>
                    <th className="px-4 py-2.5">الإيرادات</th>
                  </tr>
                </thead>
                <tbody>
                  {bestSellers.map((item, i) => (
                    <tr
                      key={item.productId}
                      className="border-border-subtle/60 border-b last:border-0"
                    >
                      <td className="text-text-secondary/70 numeric w-12 text-center text-sm">
                        {i + 1}
                      </td>
                      <td className="text-brand-ink px-4 py-3 font-medium">{item.nameAr}</td>
                      <td className="numeric text-text-secondary px-4 py-3">{item.quantitySold}</td>
                      <td className="numeric text-brand-ink px-4 py-3 font-semibold">
                        {item.totalRevenue} ₪
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {!loading && tab === "margins" && margins && (
        <Card variant="default" className="p-0">
          <div className="border-border-subtle border-b px-4 py-3">
            <SectionHeader title="هوامش الربح" subtitle="هامش كل منتج بناءً على تكلفة المكونات." />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
                  <th className="px-4 py-2.5">المنتج</th>
                  <th className="px-4 py-2.5">السعر</th>
                  <th className="px-4 py-2.5">تكلفة المكونات</th>
                  <th className="px-4 py-2.5">الهامش</th>
                  <th className="px-4 py-2.5">نسبة الهامش</th>
                </tr>
              </thead>
              <tbody>
                {margins.map((item) => {
                  const hasRecipes = parseFloat(item.ingredientCost) > 0;
                  const marginVal = parseFloat(item.margin);
                  return (
                    <tr
                      key={item.productId}
                      className="border-border-subtle/60 border-b last:border-0"
                    >
                      <td className="text-brand-ink px-4 py-3 font-medium">
                        {item.nameAr}
                        {!hasRecipes && (
                          <span className="text-status-warning ms-2 inline-flex items-center gap-1 text-[11px] font-semibold">
                            <AlertTriangle className="size-3" />
                            لا توجد وصفة
                          </span>
                        )}
                      </td>
                      <td className="numeric text-text-secondary px-4 py-3">{item.basePrice} ₪</td>
                      <td className="numeric text-text-secondary px-4 py-3">
                        {item.ingredientCost} ₪
                      </td>
                      <td
                        className={`numeric px-4 py-3 font-semibold ${
                          marginVal < 0 ? "text-status-error" : "text-status-success"
                        }`}
                      >
                        {item.margin} ₪
                      </td>
                      <td className="numeric text-text-secondary px-4 py-3">
                        {item.marginPercent}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!loading && tab === "zreport" && zReport && (
        <Card variant="default" className="p-0">
          <div className="border-border-subtle border-b px-4 py-3">
            <SectionHeader
              title="تقرير Z"
              subtitle="ملخص الورديات المنتهية — مطابقة النقد في الدرج."
            />
          </div>
          {zReport.length === 0 ? (
            <CardBody>
              <EmptyState
                title="لا توجد ورديات مسجلة"
                description="ستظهر تقارير الورديات المنتهية هنا تلقائياً."
              />
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-text-secondary border-border-subtle bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
                    <th className="px-4 py-2.5">الموظف</th>
                    <th className="px-4 py-2.5">تاريخ الفتح</th>
                    <th className="px-4 py-2.5">الافتتاحي</th>
                    <th className="px-4 py-2.5">الختامي</th>
                    <th className="px-4 py-2.5">المبيعات</th>
                    <th className="px-4 py-2.5">الفرق</th>
                    <th className="px-4 py-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {zReport.map((shift) => {
                    const isOpen = shift.closedAt === null;
                    const hasDiscrepancy =
                      shift.discrepancy !== null && Math.abs(parseFloat(shift.discrepancy)) > 0.01;
                    return (
                      <tr key={shift.id} className="border-border-subtle/60 border-b last:border-0">
                        <td className="text-brand-ink px-4 py-3 font-medium">
                          {shift.staffName ?? "—"}
                        </td>
                        <td className="text-text-secondary numeric px-4 py-3 text-xs">
                          {new Date(shift.openedAt).toLocaleDateString("ar")}
                        </td>
                        <td className="numeric text-text-secondary px-4 py-3">
                          {shift.openingCash} ₪
                        </td>
                        <td className="numeric text-text-secondary px-4 py-3">
                          {shift.closingCash ?? "—"} ₪
                        </td>
                        <td className="numeric text-brand-ink px-4 py-3 font-semibold">
                          {shift.totalSales ?? "—"} ₪
                        </td>
                        <td
                          className={`numeric px-4 py-3 font-medium ${
                            isOpen
                              ? "text-text-secondary"
                              : hasDiscrepancy
                                ? "text-status-warning"
                                : "text-status-success"
                          }`}
                        >
                          {isOpen ? "—" : `${shift.discrepancy} ₪`}
                        </td>
                        <td className="px-4 py-3">
                          {isOpen ? (
                            <span className="bg-status-warning/[0.12] text-status-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                              مفتوحة
                            </span>
                          ) : hasDiscrepancy ? (
                            <span className="bg-status-warning/[0.12] text-status-warning inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                              <AlertTriangle className="size-3" />
                              فرق
                            </span>
                          ) : (
                            <span className="bg-status-success/[0.12] text-status-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                              <CheckCircle2 className="size-3" />
                              متطابقة
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export function ReportsShell() {
  const toast = useToast();
  const [tab, setTab] = useState<"sales" | "bestsellers" | "margins" | "zreport">("sales");
  const [startDate, setStartDate] = useState(weekAgoStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [exporting, setExporting] = useState(false);

  const handleStartDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val > endDate) {
      setStartDate(endDate);
    } else {
      setStartDate(val);
    }
  };

  const handleEndDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val < startDate) {
      setEndDate(startDate);
    } else {
      setEndDate(val);
    }
  };

  // CSV export is a Blob + anchor.click() download. No server-side temp
  // file is created — the response body is the only plaintext copy,
  // and the user's browser owns it after that. The cell-level escaping
  // for formula injection is applied server-side in lib/security/csv-escape.ts.
  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const result = await exportSalesCsv(startDate, endDate);
      // BOM so Excel auto-detects UTF-8 (Arabic + Latin columns).
      const blob = new Blob(["\uFEFF" + result.csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke the object URL on the next tick so the download has time
      // to start. Forgetting to revoke leaks the blob until the page
      // unloads.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.warning(`تم تصدير ${result.rowCount} طلب`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="التقارير"
        title="أداء المحل"
        subtitle="مبيعات، هوامش، وتقرير Z لمتابعة الأداء واتخاذ القرار."
        actions={
          <button
            onClick={handleExportCsv}
            disabled={exporting}
            aria-label="تصدير المبيعات كملف CSV"
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            <span>{exporting ? "جاري التصدير…" : "تصدير CSV"}</span>
          </button>
        }
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "sales" | "bestsellers" | "margins" | "zreport")}
        items={[
          { value: "sales", label: "المبيعات", icon: <BarChart3 className="size-4" /> },
          { value: "bestsellers", label: "الأكثر مبيعًا", icon: <TrendingUp className="size-4" /> },
          { value: "margins", label: "هوامش الربح", icon: <Calculator className="size-4" /> },
          { value: "zreport", label: "تقرير Z", icon: <ClipboardList className="size-4" /> },
        ]}
        aria-label="أقسام التقارير"
      />

      {(tab === "sales" || tab === "bestsellers") && (
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="من" className="w-auto">
            <Input type="date" value={startDate} onChange={handleStartDate} />
          </FormField>
          <FormField label="إلى" className="w-auto">
            <Input type="date" value={endDate} onChange={handleEndDate} />
          </FormField>
        </div>
      )}

      <ReportsContent
        key={`${tab}-${startDate}-${endDate}`}
        tab={tab}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
