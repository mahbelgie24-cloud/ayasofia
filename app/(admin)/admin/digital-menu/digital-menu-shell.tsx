"use client";

import { useState, useEffect, useCallback } from "react";
import { QrCode, Sparkles, TrendingUp } from "lucide-react";
import {
  getTables,
  createTable,
  toggleTable,
  regenerateTableQr,
  getPrimaryBranchSlug,
  getCurrentSuggestion,
  setTodaySuggestion,
  clearTodaySuggestion,
  getProductsForSuggestion,
  getAdminUpsellRules,
  createUpsellRule,
  toggleUpsellRule,
  deleteUpsellRule,
  getUpsellCatalog,
  type AdminTable,
  type UpsellRuleRow,
} from "./actions";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";

type Tab = "tables" | "suggestion" | "upsell";

export function DigitalMenuAdminShell() {
  const [tab, setTab] = useState<Tab>("tables");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="القائمة الرقمية"
        title="إدارة الضيوف"
        subtitle="طاولات QR، اقتراح اليوم، وقواعد البيع الإضافي للزبائن."
      />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as Tab)}
        items={[
          { value: "tables", label: "الطاولات", icon: <QrCode className="size-4" /> },
          { value: "suggestion", label: "اقتراح اليوم", icon: <Sparkles className="size-4" /> },
          { value: "upsell", label: "البيع الإضافي", icon: <TrendingUp className="size-4" /> },
        ]}
        aria-label="أقسام القائمة الرقمية"
      />
      <div>
        {tab === "tables" && <TablesTab />}
        {tab === "suggestion" && <SuggestionTab />}
        {tab === "upsell" && <UpsellTab />}
      </div>
    </div>
  );
}

function msg(result: { success: boolean; error?: string }, ok: string) {
  return result.success ? ok : (result.error ?? "فشل");
}

function TablesTab() {
  const toast = useToast();
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");

  const load = useCallback(() => {
    void Promise.all([getTables(), getPrimaryBranchSlug()]).then(([t, s]) => {
      setTables(t);
      setSlug(s);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tableUrl = (t: AdminTable) => (slug ? `/m/${slug}/t/${t.qrToken}` : "");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          placeholder="اسم الطاولة (مثال: T3)"
          aria-label="اسم الطاولة الجديدة"
          className="border-border-subtle rounded-lg border bg-white px-3 py-2 text-sm"
        />
        <button
          onClick={async () => {
            if (!newCode.trim()) return;
            const r = await createTable({ code: newCode });
            toast[msg(r, "تمت الإضافة") === "تمت الإضافة" ? "warning" : "error"](
              msg(r, "تمت الإضافة"),
            );
            if (r.success) {
              setNewCode("");
              load();
            }
          }}
          className="bg-brand-red rounded-full px-4 py-2 text-sm font-medium text-white"
        >
          إضافة طاولة
        </button>
      </div>

      <div className="border-border-subtle rounded-xl border bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
              <th className="px-3 py-2">الطاولة</th>
              <th className="px-3 py-2">رابط QR</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {tables.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-text-secondary px-3 py-4 text-center">
                  لا توجد طاولات بعد
                </td>
              </tr>
            ) : (
              tables.map((t) => (
                <tr key={t.id} className="border-border-subtle/50 border-b">
                  <td className="px-3 py-2 font-medium">{t.code}</td>
                  <td className="text-text-secondary px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="max-w-56 truncate text-xs" dir="ltr">
                        {tableUrl(t)}
                      </span>
                      <button
                        onClick={async () => {
                          await navigator.clipboard
                            ?.writeText(window.location.origin + tableUrl(t))
                            .catch(() => {});
                          toast.warning("تم نسخ الرابط");
                        }}
                        className="text-brand-red inline-flex min-h-8 items-center rounded px-1 text-xs font-semibold hover:underline"
                      >
                        نسخ
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {t.active ? (
                      <span className="text-status-success text-xs">نشطة</span>
                    ) : (
                      <span className="text-status-warning text-xs">معطّلة</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const r = await toggleTable({ id: t.id });
                          toast[msg(r, "تم") === "تم" ? "warning" : "error"](msg(r, "تم"));
                          load();
                        }}
                        className="inline-flex min-h-8 items-center rounded px-1 text-xs font-medium hover:underline"
                      >
                        {t.active ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        onClick={async () => {
                          const r = await regenerateTableQr({ id: t.id });
                          toast.warning(msg(r, "تم توليد QR جديد"));
                          load();
                        }}
                        className="text-text-secondary inline-flex min-h-8 items-center rounded px-1 text-xs hover:underline"
                      >
                        QR جديد
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SuggestionTab() {
  const toast = useToast();
  const [products, setProducts] = useState<Array<{ id: string; nameAr: string }>>([]);
  const [current, setCurrent] = useState<{
    productId: string | null;
    titleAr: string | null;
    descriptionAr: string | null;
  }>({ productId: null, titleAr: null, descriptionAr: null });
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(() => {
    void Promise.all([getProductsForSuggestion(), getCurrentSuggestion()]).then(([p, c]) => {
      setProducts(p);
      setCurrent(c);
      setTitle(c.titleAr ?? "");
      setDesc(c.descriptionAr ?? "");
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="border-border-subtle max-w-md space-y-4 rounded-xl border bg-white p-4">
      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">المنتج المميز</label>
        <select
          value={current.productId ?? ""}
          onChange={(e) => setCurrent((c) => ({ ...c, productId: e.target.value || null }))}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="">اختر منتجًا</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameAr}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">عنوان (اختياري)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">وصف (اختياري)</label>
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={async () => {
            if (!current.productId) return;
            const r = await setTodaySuggestion({
              productId: current.productId,
              titleAr: title || undefined,
              descriptionAr: desc || undefined,
            });
            toast.warning(msg(r, "تم حفظ الاقتراح"));
            load();
          }}
          className="bg-brand-red rounded-full px-4 py-2 text-sm font-medium text-white"
        >
          حفظ
        </button>
        <button
          onClick={async () => {
            const r = await clearTodaySuggestion();
            toast.warning(msg(r, "تمت إزالة الاقتراح"));
            load();
          }}
          className="border-border-subtle text-text-secondary rounded-full border px-4 py-2 text-sm"
        >
          إزالة
        </button>
      </div>
    </div>
  );
}

function UpsellTab() {
  const toast = useToast();
  const [rules, setRules] = useState<UpsellRuleRow[]>([]);
  const [catalog, setCatalog] = useState<{
    products: Array<{ id: string; nameAr: string }>;
    modifiers: Array<{ id: string; nameAr: string }>;
  }>({
    products: [],
    modifiers: [],
  });
  const [condition, setCondition] = useState("always");
  const [triggerValue, setTriggerValue] = useState("{}");
  const [suggestionProductId, setSuggestionProductId] = useState("");
  const [priority, setPriority] = useState(0);

  const load = useCallback(() => {
    void Promise.all([getAdminUpsellRules(), getUpsellCatalog()]).then(([r, c]) => {
      setRules(r);
      setCatalog(c);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const conditionLabels: Record<string, string> = {
    cart_has_product_category: "السلة تحتوي فئة",
    cart_without_modifier: "بدون معدّل محدد",
    cart_below_threshold: "السلة أقل من حد",
    time_of_day: "الوقت من اليوم",
    always: "دائمًا",
  };

  return (
    <div className="space-y-4">
      <div className="border-border-subtle max-w-md space-y-3 rounded-xl border bg-white p-4">
        <p className="text-sm font-medium">قاعدة جديدة</p>
        <div>
          <label className="text-brand-ink mb-1 block text-xs font-medium">الشرط</label>
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
          >
            {Object.entries(conditionLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-brand-ink mb-1 block text-xs font-medium">
            قيمة التحفيز (JSON) — مثال: {`{"categoryId":"<id>"}`}
          </label>
          <input
            value={triggerValue}
            onChange={(e) => setTriggerValue(e.target.value)}
            className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
            dir="ltr"
          />
        </div>
        <div>
          <label className="text-brand-ink mb-1 block text-xs font-medium">المنتج المقترح</label>
          <select
            value={suggestionProductId}
            onChange={(e) => setSuggestionProductId(e.target.value)}
            className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
          >
            <option value="">بدون منتج</option>
            {catalog.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nameAr}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-brand-ink mb-1 block text-xs font-medium">الأولوية</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={async () => {
            const r = await createUpsellRule({
              condition,
              triggerValue,
              suggestionProductId: suggestionProductId || null,
              suggestionModifierId: null,
              priority,
            });
            toast[msg(r, "تمت الإضافة") === "تمت الإضافة" ? "warning" : "error"](
              msg(r, "تمت الإضافة"),
            );
            if (r.success) {
              setTriggerValue("{}");
              setSuggestionProductId("");
              load();
            }
          }}
          className="bg-brand-red rounded-full px-4 py-2 text-sm font-medium text-white"
        >
          إضافة
        </button>
      </div>

      <div className="border-border-subtle rounded-xl border bg-white p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
              <th className="px-3 py-2">الشرط</th>
              <th className="px-3 py-2">الأولوية</th>
              <th className="px-3 py-2">الحالة</th>
              <th className="px-3 py-2">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-text-secondary px-3 py-4 text-center">
                  لا توجد قواعد
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className="border-border-subtle/50 border-b">
                  <td className="px-3 py-2">{conditionLabels[r.condition] ?? r.condition}</td>
                  <td className="px-3 py-2">{r.priority}</td>
                  <td className="px-3 py-2">
                    {r.isActive ? (
                      <span className="text-status-success text-xs">نشطة</span>
                    ) : (
                      <span className="text-status-warning text-xs">معطّلة</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const res = await toggleUpsellRule({ id: r.id });
                          toast.warning(msg(res, "تم"));
                          load();
                        }}
                        className="inline-flex min-h-8 items-center rounded px-1 text-xs font-medium hover:underline"
                      >
                        {r.isActive ? "تعطيل" : "تفعيل"}
                      </button>
                      <button
                        onClick={async () => {
                          const res = await deleteUpsellRule({ id: r.id });
                          toast.warning(msg(res, "تم الحذف"));
                          load();
                        }}
                        className="text-status-error inline-flex min-h-8 items-center rounded px-1 text-xs font-medium hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
