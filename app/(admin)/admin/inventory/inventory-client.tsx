"use client";

import { useState } from "react";
import { AlertTriangle, List, Truck, Trash2 } from "lucide-react";
import { logPurchase, logWaste } from "./actions";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentStock: string;
  reorderThreshold: string;
  costPerUnit: string;
}

interface Option {
  id: string;
  name: string;
}

export function InventoryClient({
  ingredients,
  suppliers,
}: {
  ingredients: Ingredient[];
  suppliers: Option[];
}) {
  const [tab, setTab] = useState<"list" | "purchase" | "waste">("list");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="المخزون"
        title="إدارة المكونات"
        subtitle="تتبّع الكميات المتاحة، سجّل التوريد والهدر، وابقَ على اطلاع بحالة المواد."
      />

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "list" | "purchase" | "waste")}
        items={[
          { value: "list", label: "القائمة", icon: <List className="size-4" /> },
          { value: "purchase", label: "توريد", icon: <Truck className="size-4" /> },
          { value: "waste", label: "هدر", icon: <Trash2 className="size-4" /> },
        ]}
        aria-label="أقسام المخزون"
      />

      {tab === "list" && <InventoryTable ingredients={ingredients} />}
      {tab === "purchase" && <PurchaseForm ingredients={ingredients} suppliers={suppliers} />}
      {tab === "waste" && <WasteForm ingredients={ingredients} />}
    </div>
  );
}

function InventoryTable({ ingredients }: { ingredients: Ingredient[] }) {
  if (ingredients.length === 0) {
    return (
      <Card variant="default" className="mt-4">
        <CardBody>
          <EmptyState
            title="لا توجد مواد بعد"
            description="ابدأ بإضافة المكونات الأساسية لقائمتك."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card variant="default" className="mt-4 overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border-subtle text-text-secondary bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
              <th className="px-4 py-3">المادة</th>
              <th className="px-4 py-3">الوحدة</th>
              <th className="px-4 py-3">المخزون الحالي</th>
              <th className="px-4 py-3">حد إعادة الطلب</th>
              <th className="px-4 py-3">تكلفة الوحدة</th>
            </tr>
          </thead>
          <tbody>
            {ingredients.map((ing) => {
              const isLow = parseFloat(ing.currentStock) <= parseFloat(ing.reorderThreshold);
              return (
                <tr
                  key={ing.id}
                  className={`border-border-subtle/60 border-b transition-colors last:border-0 ${
                    isLow ? "bg-status-warning/[0.06]" : "hover:bg-brand-cream/30"
                  }`}
                >
                  <td className="text-brand-ink px-4 py-3 font-medium">
                    {ing.name}
                    {isLow && (
                      <span className="bg-status-warning/20 text-status-warning ms-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                        <AlertTriangle className="size-2.5" />
                        منخفض
                      </span>
                    )}
                  </td>
                  <td className="text-text-secondary px-4 py-3 text-xs">{ing.unit}</td>
                  <td
                    className={`numeric px-4 py-3 font-medium ${
                      isLow ? "text-status-warning" : "text-brand-ink"
                    }`}
                  >
                    {ing.currentStock}
                  </td>
                  <td className="text-text-secondary numeric px-4 py-3 text-xs">
                    {ing.reorderThreshold}
                  </td>
                  <td className="text-text-secondary numeric px-4 py-3 text-xs" dir="ltr">
                    ₪{ing.costPerUnit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PurchaseForm({
  ingredients,
  suppliers,
}: {
  ingredients: Ingredient[];
  suppliers: Option[];
}) {
  const [ingId, setIngId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!ingId || isNaN(qty) || qty <= 0) {
      setSuccess(false);
      setMsg("يرجى إدخال بيانات صحيحة");
      return;
    }
    const result = await logPurchase({
      ingredientId: ingId,
      quantity: qty,
      totalCost: cost.trim() === "" ? undefined : cost,
      supplierId: newSupplier ? undefined : supplierId || undefined,
    });
    setSuccess(result.success);
    setMsg(result.success ? "تم التسجيل بنجاح" : (result.error ?? "فشل"));
    if (result.success) {
      setQuantity("");
      setCost("");
    }
  };

  return (
    <Card variant="default" className="mt-4 max-w-2xl">
      <CardBody className="space-y-4">
        <h2 className="heading-3 text-brand-ink">تسجيل توريد</h2>

        <FormField label="المادة" required>
          <select
            value={ingId}
            onChange={(e) => setIngId(e.target.value)}
            className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
          >
            <option value="">اختر المادة</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="الكمية" required>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00"
            />
          </FormField>

          <FormField label="التكلفة الإجمالية" hint="بـ ₪ (اختياري)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              placeholder="0.00"
              dir="ltr"
            />
          </FormField>
        </div>

        <FormField label="المورّد" hint="اختر مورّدًا موجودًا أو أضف اسمًا جديدًا">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
          >
            <option value="">بدون مورّد</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormField>

        <Input
          value={newSupplier}
          onChange={(e) => setNewSupplier(e.target.value)}
          placeholder="أو أضف مورّدًا جديدًا…"
        />

        <button
          onClick={handleSubmit}
          className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 w-full rounded-full px-4 py-3 text-sm font-bold text-white shadow-md transition-all"
        >
          تسجيل التوريد
        </button>

        {msg && (
          <p
            role="alert"
            className={`text-sm ${success ? "text-status-success" : "text-status-warning"}`}
          >
            {msg}
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function WasteForm({ ingredients }: { ingredients: Ingredient[] }) {
  const [ingId, setIngId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!ingId || isNaN(qty) || qty <= 0) {
      setSuccess(false);
      setMsg("يرجى إدخال بيانات صحيحة");
      return;
    }
    const result = await logWaste({
      ingredientId: ingId,
      quantity: qty,
    });
    setSuccess(result.success);
    setMsg(result.success ? "تم التسجيل بنجاح" : (result.error ?? "فشل"));
    if (result.success) setQuantity("");
  };

  return (
    <Card variant="default" className="mt-4 max-w-2xl">
      <CardBody className="space-y-4">
        <h2 className="heading-3 text-brand-ink">تسجيل هدر</h2>

        <FormField label="المادة" required>
          <select
            value={ingId}
            onChange={(e) => setIngId(e.target.value)}
            className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
          >
            <option value="">اختر المادة</option>
            {ingredients.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="الكمية المهدرة" required>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
          />
        </FormField>

        <button
          onClick={handleSubmit}
          className="bg-status-warning hover:bg-status-warning/90 ease-spring w-full rounded-full px-4 py-3 text-sm font-bold text-white transition-colors"
        >
          تسجيل الهدر
        </button>

        {msg && (
          <p
            role="alert"
            className={`text-sm ${success ? "text-status-success" : "text-status-warning"}`}
          >
            {msg}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
