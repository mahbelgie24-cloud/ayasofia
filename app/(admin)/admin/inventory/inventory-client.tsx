"use client";

import { useState } from "react";
import { logPurchase, logWaste } from "./actions";

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
    <div>
      <h1 className="font-heading text-brand-ink text-2xl font-bold">المخزون</h1>

      <div className="mt-4 flex gap-2">
        {(["list", "purchase", "waste"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`ease-spring rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-brand-red text-white" : "bg-muted text-brand-ink hover:bg-muted/80"
            }`}
          >
            {t === "list" ? "القائمة" : t === "purchase" ? "توريد" : "هدر"}
          </button>
        ))}
      </div>

      {tab === "list" && <InventoryTable ingredients={ingredients} />}
      {tab === "purchase" && <PurchaseForm ingredients={ingredients} suppliers={suppliers} />}
      {tab === "waste" && <WasteForm ingredients={ingredients} />}
    </div>
  );
}

function InventoryTable({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-border-subtle text-text-secondary border-b text-right text-xs font-semibold tracking-wider uppercase">
            <th className="px-3 py-3">المادة</th>
            <th className="px-3 py-3">الوحدة</th>
            <th className="px-3 py-3">المخزون الحالي</th>
            <th className="px-3 py-3">حد إعادة الطلب</th>
            <th className="px-3 py-3">تكلفة الوحدة</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ing) => {
            const isLow = parseFloat(ing.currentStock) <= parseFloat(ing.reorderThreshold);
            return (
              <tr
                key={ing.id}
                className={`border-border-subtle/50 border-b ${
                  isLow ? "bg-status-warning/10" : ""
                }`}
              >
                <td className="text-brand-ink px-3 py-2.5 font-medium">
                  {ing.name}
                  {isLow && (
                    <span className="bg-status-warning/20 text-status-warning mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium">
                      منخفض
                    </span>
                  )}
                </td>
                <td className="text-text-secondary px-3 py-2.5">{ing.unit}</td>
                <td
                  className={`px-3 py-2.5 font-medium ${
                    isLow ? "text-status-warning" : "text-brand-ink"
                  }`}
                >
                  {ing.currentStock}
                </td>
                <td className="text-text-secondary px-3 py-2.5">{ing.reorderThreshold}</td>
                <td className="text-text-secondary px-3 py-2.5" dir="ltr">
                  ₪{ing.costPerUnit}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    const cst = parseFloat(cost);
    if (!ingId || isNaN(qty) || qty <= 0) {
      setMsg("يرجى إدخال بيانات صحيحة");
      return;
    }
    const result = await logPurchase({
      ingredientId: ingId,
      quantity: qty,
      totalCost: isNaN(cst) ? 0 : cst,
      supplierId: newSupplier ? undefined : supplierId || undefined,
    });
    setMsg(result.success ? "تم التسجيل بنجاح" : (result.error ?? "فشل"));
    if (result.success) {
      setQuantity("");
      setCost("");
    }
  };

  return (
    <div className="mt-6 max-w-md space-y-4">
      <h2 className="font-heading text-brand-ink text-lg font-semibold">تسجيل توريد</h2>

      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">المادة</label>
        <select
          value={ingId}
          onChange={(e) => setIngId(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="">اختر المادة</option>
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">الكمية</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">
          التكلفة الإجمالية (₪)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">المورّد</label>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="">بدون مورّد</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
            className="border-border-subtle flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
            placeholder="أو أضف مورد جديد..."
          />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        className="bg-brand-red hover:bg-brand-red/90 ease-spring w-full rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors"
      >
        تسجيل التوريد
      </button>

      {msg && <p className="text-status-warning text-sm">{msg}</p>}
    </div>
  );
}

function WasteForm({ ingredients }: { ingredients: Ingredient[] }) {
  const [ingId, setIngId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [msg, setMsg] = useState("");

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!ingId || isNaN(qty) || qty <= 0) {
      setMsg("يرجى إدخال بيانات صحيحة");
      return;
    }
    const result = await logWaste({
      ingredientId: ingId,
      quantity: qty,
    });
    setMsg(result.success ? "تم التسجيل بنجاح" : (result.error ?? "فشل"));
    if (result.success) setQuantity("");
  };

  return (
    <div className="mt-6 max-w-md space-y-4">
      <h2 className="font-heading text-brand-ink text-lg font-semibold">تسجيل هدر</h2>

      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">المادة</label>
        <select
          value={ingId}
          onChange={(e) => setIngId(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="">اختر المادة</option>
          {ingredients.map((ing) => (
            <option key={ing.id} value={ing.id}>
              {ing.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-brand-ink mb-1 block text-sm font-medium">الكمية المهدرة</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border-border-subtle w-full rounded-lg border bg-white px-3 py-2 text-sm"
          placeholder="0.00"
        />
      </div>

      <button
        onClick={handleSubmit}
        className="bg-status-warning hover:bg-status-warning/90 ease-spring w-full rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors"
      >
        تسجيل الهدر
      </button>

      {msg && <p className="text-status-warning text-sm">{msg}</p>}
    </div>
  );
}
