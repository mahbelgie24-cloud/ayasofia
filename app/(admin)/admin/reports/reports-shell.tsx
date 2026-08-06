"use client";

import { useState, useEffect } from "react";
import {
  getSalesSummary,
  getBestSellers,
  getProductMargins,
  getZReport,
  type SalesSummary,
  type BestSeller,
  type ProductMargin,
  type ZReportShift,
} from "./actions";

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
    <>
      {loading && <p className="text-text-secondary mt-6 text-center text-sm">جاري التحميل...</p>}

      {!loading && tab === "sales" && sales && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-text-secondary text-sm">إجمالي الإيرادات</p>
              <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
                {sales.totalRevenue} ₪
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-text-secondary text-sm">عدد الطلبات</p>
              <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
                {sales.orderCount}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <p className="text-text-secondary text-sm">متوسط الطلب</p>
              <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
                {sales.orderCount > 0
                  ? (parseFloat(sales.totalRevenue) / sales.orderCount).toFixed(2)
                  : "0.00"}{" "}
                ₪
              </p>
            </div>
          </div>

          <div className="border-border-subtle rounded-xl border bg-white p-4">
            <p className="text-sm font-medium">حسب القناة</p>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
                  <th className="px-3 py-2">القناة</th>
                  <th className="px-3 py-2">عدد الطلبات</th>
                  <th className="px-3 py-2">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sales.byChannel).map(([channel, data]) => (
                  <tr key={channel} className="border-border-subtle/50 border-b">
                    <td className="px-3 py-2 font-medium">{channelLabels[channel] ?? channel}</td>
                    <td className="px-3 py-2">{data.count}</td>
                    <td className="px-3 py-2">{data.revenue} ₪</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-border-subtle rounded-xl border bg-white p-4">
            <p className="text-sm font-medium">حسب المصدر (تبنّي القائمة الرقمية)</p>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
                  <th className="px-3 py-2">المصدر</th>
                  <th className="px-3 py-2">عدد الطلبات</th>
                  <th className="px-3 py-2">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sales.bySource).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-text-secondary px-3 py-4 text-center">
                      لا توجد بيانات
                    </td>
                  </tr>
                ) : (
                  Object.entries(sales.bySource).map(([source, data]) => (
                    <tr key={source} className="border-border-subtle/50 border-b">
                      <td className="px-3 py-2 font-medium">{sourceLabels[source] ?? source}</td>
                      <td className="px-3 py-2">{data.count}</td>
                      <td className="px-3 py-2">{data.revenue} ₪</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "bestsellers" && bestSellers && (
        <div className="mt-6">
          <div className="border-border-subtle rounded-xl border bg-white p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">المنتج</th>
                  <th className="px-3 py-2">الكمية المباعة</th>
                  <th className="px-3 py-2">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-text-secondary px-3 py-4 text-center">
                      لا توجد مبيعات في هذه الفترة
                    </td>
                  </tr>
                ) : (
                  bestSellers.map((item, i) => (
                    <tr key={item.productId} className="border-border-subtle/50 border-b">
                      <td className="text-text-secondary px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{item.nameAr}</td>
                      <td className="px-3 py-2">{item.quantitySold}</td>
                      <td className="px-3 py-2">{item.totalRevenue} ₪</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "margins" && margins && (
        <div className="mt-6">
          <div className="border-border-subtle rounded-xl border bg-white p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
                  <th className="px-3 py-2">المنتج</th>
                  <th className="px-3 py-2">السعر</th>
                  <th className="px-3 py-2">تكلفة المكونات</th>
                  <th className="px-3 py-2">الهامش</th>
                  <th className="px-3 py-2">نسبة الهامش</th>
                </tr>
              </thead>
              <tbody>
                {margins.map((item) => {
                  const hasRecipes = parseFloat(item.ingredientCost) > 0;
                  const marginVal = parseFloat(item.margin);
                  return (
                    <tr key={item.productId} className="border-border-subtle/50 border-b">
                      <td className="px-3 py-2 font-medium">
                        {item.nameAr}
                        {!hasRecipes && (
                          <span className="text-status-warning mr-2 text-xs">(لا توجد وصفة)</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{item.basePrice} ₪</td>
                      <td className="px-3 py-2">{item.ingredientCost} ₪</td>
                      <td
                        className={`px-3 py-2 font-medium ${
                          marginVal < 0 ? "text-status-error" : "text-status-success"
                        }`}
                      >
                        {item.margin} ₪
                      </td>
                      <td className="px-3 py-2">{item.marginPercent}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && tab === "zreport" && zReport && (
        <div className="mt-6">
          <div className="border-border-subtle rounded-xl border bg-white p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
                  <th className="px-3 py-2">الموظف</th>
                  <th className="px-3 py-2">تاريخ الفتح</th>
                  <th className="px-3 py-2">الرصيد الافتتاحي</th>
                  <th className="px-3 py-2">الرصيد الختامي</th>
                  <th className="px-3 py-2">المبيعات</th>
                  <th className="px-3 py-2">الفرق</th>
                  <th className="px-3 py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {zReport.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-text-secondary px-3 py-4 text-center">
                      لا توجد ورديات مسجلة
                    </td>
                  </tr>
                ) : (
                  zReport.map((shift) => {
                    const isOpen = shift.closedAt === null;
                    const hasDiscrepancy =
                      shift.discrepancy !== null && Math.abs(parseFloat(shift.discrepancy)) > 0.01;
                    return (
                      <tr key={shift.id} className="border-border-subtle/50 border-b">
                        <td className="px-3 py-2">{shift.staffName ?? "—"}</td>
                        <td className="text-text-secondary px-3 py-2">
                          {new Date(shift.openedAt).toLocaleDateString("ar")}
                        </td>
                        <td className="px-3 py-2">{shift.openingCash} ₪</td>
                        <td className="px-3 py-2">{shift.closingCash ?? "—"} ₪</td>
                        <td className="px-3 py-2">{shift.totalSales ?? "—"} ₪</td>
                        <td
                          className={`px-3 py-2 font-medium ${
                            isOpen
                              ? ""
                              : hasDiscrepancy
                                ? "text-status-warning"
                                : "text-status-success"
                          }`}
                        >
                          {isOpen ? "—" : `${shift.discrepancy} ₪`}
                        </td>
                        <td className="px-3 py-2">
                          {isOpen ? (
                            <span className="text-status-warning text-xs">مفتوحة</span>
                          ) : hasDiscrepancy ? (
                            <span className="bg-status-warning/10 text-status-warning rounded-full px-2 py-0.5 text-xs">
                              فرق {shift.discrepancy} ₪
                            </span>
                          ) : (
                            <span className="text-status-success text-xs">متطابقة</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export function ReportsShell() {
  const [tab, setTab] = useState<"sales" | "bestsellers" | "margins" | "zreport">("sales");
  const [startDate, setStartDate] = useState(weekAgoStr());
  const [endDate, setEndDate] = useState(todayStr());

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

  return (
    <div dir="rtl" lang="ar">
      <h1 className="font-heading text-brand-ink text-2xl font-bold">التقارير</h1>

      <div className="mt-4 flex gap-2">
        {(["sales", "bestsellers", "margins", "zreport"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`ease-spring min-h-11 min-w-11 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? "bg-brand-red text-white" : "text-brand-ink bg-muted hover:bg-muted/80"
            }`}
          >
            {t === "sales"
              ? "المبيعات"
              : t === "bestsellers"
                ? "الأكثر مبيعًا"
                : t === "margins"
                  ? "هوامش الربح"
                  : "تقرير Z"}
          </button>
        ))}
      </div>

      {(tab === "sales" || tab === "bestsellers") && (
        <div className="mt-4 flex items-center gap-3">
          <label className="text-text-secondary text-sm">من</label>
          <input
            type="date"
            value={startDate}
            onChange={handleStartDate}
            className="border-border-subtle rounded-lg border bg-white px-3 py-1.5 text-sm"
          />
          <label className="text-text-secondary text-sm">إلى</label>
          <input
            type="date"
            value={endDate}
            onChange={handleEndDate}
            className="border-border-subtle rounded-lg border bg-white px-3 py-1.5 text-sm"
          />
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
