"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { POSCategory } from "@/lib/db/queries";
import {
  calculateLineTotal,
  calculateCartTotal,
  formatPrice,
  type SelectedModifier as PricingModifier,
} from "@/lib/pricing";
import { checkout } from "./actions";
import { closeShift } from "@/lib/shifts";
import { endStaffSession } from "@/lib/auth/session";
import { useRouter } from "next/navigation";

interface CartItem {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  basePrice: string;
  selectedModifiers: { id: string; nameAr: string; name: string; priceDelta: string }[];
  quantity: number;
  lineTotal: number;
}

interface POSShellProps {
  menu: POSCategory[];
}

export function POSShell({ menu }: POSShellProps) {
  const router = useRouter();
  const [selectedCatId, setSelectedCatId] = useState(menu[0]?.id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [modifierTarget, setModifierTarget] = useState<{
    productId: string;
    productNameAr: string;
    productNameEn: string;
    basePrice: string;
    groups: POSCategory["products"][number]["modifierGroups"];
  } | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [shiftModal, setShiftModal] = useState(false);
  const [closingCash, setClosingCash] = useState("");
  const [shiftResult, setShiftResult] = useState<{
    totalSales: string;
    discrepancy: string;
  } | null>(null);
  const [closingShift, setClosingShift] = useState(false);
  const idempotencyKeyRef = useRef<string>("");

  // Generate a fresh idempotency key when the cart transitions from empty
  // to non-empty.  Reuse the same key across retries of the same cart.
  useEffect(() => {
    if (cart.length > 0 && !idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    if (cart.length === 0) {
      idempotencyKeyRef.current = "";
    }
  }, [cart.length]);

  const handleCheckout = async () => {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    try {
      const cartItems = cart.map((item) => ({
        productId: item.productId,
        modifierIds: item.selectedModifiers.map((m) => m.id),
        quantity: item.quantity,
      }));
      const result = await checkout({
        cartItems,
        idempotencyKey: idempotencyKeyRef.current,
        paymentMethod,
        clientTotal: cartTotal,
        customerPhone: customerPhone || undefined,
      });
      if (result.success) {
        setCart([]);
        setCartOpen(false);
        router.push(`/pos/receipt/${result.orderId}`);
      } else {
        alert(result.error);
      }
    } catch {
      alert("فشل في إتمام الطلب");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCloseShift = async () => {
    const cash = closingCash.trim() === "" ? 0 : parseFloat(closingCash);
    setClosingShift(true);
    try {
      const result = await closeShift(isNaN(cash) ? 0 : cash);
      if (result.success) {
        setShiftResult({
          totalSales: result.totalSales,
          discrepancy: result.discrepancy,
        });
      } else {
        alert(result.error);
      }
    } catch {
      alert("فشل في إنهاء الوردية");
    } finally {
      setClosingShift(false);
    }
  };

  const handleSignOut = async () => {
    await endStaffSession();
    router.push("/login");
  };

  const selectedCat = menu.find((c) => c.id === selectedCatId) ?? menu[0];

  const addToCart = (
    product: {
      id: string;
      nameAr: string;
      nameEn: string;
      basePrice: string;
      modifierGroups: POSCategory["products"][number]["modifierGroups"];
    },
    selectedModifiers: { id: string; nameAr: string; name: string; priceDelta: string }[],
  ) => {
    const pricingMods: PricingModifier[] = selectedModifiers.map((m) => ({
      priceDelta: m.priceDelta,
    }));
    const lineTotal = calculateLineTotal(product.basePrice, pricingMods, 1);

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.productId === product.id &&
          JSON.stringify(item.selectedModifiers.map((m) => m.id).sort()) ===
            JSON.stringify(selectedModifiers.map((m) => m.id).sort()),
      );

      if (existingIdx >= 0) {
        const updated = [...prev];
        const existing = updated[existingIdx];
        const qty = existing.quantity + 1;
        const pricingAll: number = calculateLineTotal(
          product.basePrice,
          selectedModifiers.map((m) => ({ priceDelta: m.priceDelta })),
          qty,
        );
        updated[existingIdx] = {
          ...existing,
          quantity: qty,
          lineTotal: pricingAll,
        };
        return updated;
      }

      return [
        ...prev,
        {
          productId: product.id,
          productNameAr: product.nameAr,
          productNameEn: product.nameEn,
          basePrice: product.basePrice,
          selectedModifiers,
          quantity: 1,
          lineTotal,
        },
      ];
    });
  };

  const openModifiers = useCallback((product: POSCategory["products"][number]) => {
    if (product.modifierGroups.length === 0) {
      addToCart(product, []);
      return;
    }

    const initial: Record<string, string[]> = {};
    for (const g of product.modifierGroups) {
      initial[g.id] = [];
    }
    setModifierSelections(initial);
    setModifierTarget({
      productId: product.id,
      productNameAr: product.nameAr,
      productNameEn: product.nameEn,
      basePrice: product.basePrice,
      groups: product.modifierGroups,
    });
  }, []);

  const toggleSingle = (groupId: string, modifierName: string) => {
    setModifierSelections((prev) => ({
      ...prev,
      [groupId]: [modifierName],
    }));
  };

  const toggleMulti = (groupId: string, modifierName: string) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      const next = current.includes(modifierName)
        ? current.filter((n) => n !== modifierName)
        : [...current, modifierName];
      return { ...prev, [groupId]: next };
    });
  };

  const confirmModifiers = () => {
    if (!modifierTarget) return;

    const selected: { id: string; nameAr: string; name: string; priceDelta: string }[] = [];
    for (const g of modifierTarget.groups) {
      const picked = modifierSelections[g.id] ?? [];
      for (const modName of picked) {
        const mod = g.modifiers.find((m) => m.name === modName);
        if (mod) {
          selected.push({
            id: mod.id,
            nameAr: mod.nameAr,
            name: mod.name,
            priceDelta: mod.priceDelta,
          });
        }
      }
    }

    addToCart(
      {
        id: modifierTarget.productId,
        nameAr: modifierTarget.productNameAr,
        nameEn: modifierTarget.productNameEn,
        basePrice: modifierTarget.basePrice,
        modifierGroups: modifierTarget.groups,
      },
      selected,
    );

    setModifierTarget(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = Math.max(0, item.quantity + delta);
      if (newQty === 0) {
        return updated.filter((_, i) => i !== index);
      }
      const mods: PricingModifier[] = item.selectedModifiers.map((m) => ({
        priceDelta: m.priceDelta,
      }));
      updated[index] = {
        ...item,
        quantity: newQty,
        lineTotal: calculateLineTotal(item.basePrice, mods, newQty),
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const cartTotal = calculateCartTotal(cart);

  return (
    <div className="bg-brand-cream flex h-screen flex-col" dir="rtl" lang="ar">
      {/* Shift control bar */}
      <div className="border-border-subtle flex shrink-0 items-center justify-between border-b bg-white px-3 py-1.5">
        <span className="text-text-secondary text-xs font-medium">POS</span>
        <button
          onClick={() => {
            setShiftResult(null);
            setClosingCash("");
            setShiftModal(true);
          }}
          className="border-status-warning/30 text-status-warning hover:bg-status-warning/10 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        >
          إنهاء الوردية
        </button>
      </div>

      {/* Category tabs */}
      <div className="border-border-subtle flex shrink-0 gap-1 overflow-x-auto border-b bg-white px-3 py-2">
        {menu.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              cat.id === selectedCatId
                ? "bg-brand-red text-white"
                : "bg-muted text-brand-ink hover:bg-muted/80"
            }`}
          >
            {cat.nameAr}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {!selectedCat || selectedCat.products.length === 0 ? (
          <p className="text-text-secondary p-8 text-center">لا توجد منتجات</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {selectedCat.products.map((product) => (
              <button
                key={product.id}
                onClick={() => openModifiers(product)}
                disabled={!product.isAvailable}
                className={`border-border-subtle flex flex-col items-center rounded-2xl border bg-white p-3 text-center transition-shadow hover:shadow-md disabled:opacity-40 ${
                  product.isAvailable ? "cursor-pointer" : "cursor-not-allowed"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                  alt={product.nameAr}
                  className="mb-2 h-16 w-16 object-contain"
                />
                <span className="font-heading text-brand-ink text-sm font-semibold">
                  {product.nameAr}
                </span>
                <span className="text-brand-red mt-1 text-sm font-medium">
                  {formatPrice(parseFloat(product.basePrice) * 100)} ₪
                </span>
                {product.modifierGroups.length > 0 && (
                  <span className="text-text-secondary mt-1 text-xs">تخصيص</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart bar */}
      <div className="border-border-subtle shrink-0 border-t bg-white px-4 py-3">
        <button
          onClick={() => setCartOpen(!cartOpen)}
          className="bg-brand-red hover:bg-brand-red/90 flex w-full items-center justify-between rounded-full px-5 py-3 text-white transition-colors"
        >
          <span className="font-heading text-lg font-bold">
            {cart.length > 0 ? `${cart.length} سلعة — ${formatPrice(cartTotal)} ₪` : "السلة فارغة"}
          </span>
          <svg
            className={`size-5 transition-transform ${cartOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Cart panel */}
      {cartOpen && (
        <div className="border-border-subtle shrink-0 border-t bg-white">
          <div className="max-h-64 overflow-y-auto p-3">
            {cart.length === 0 ? (
              <p className="text-text-secondary py-6 text-center">لم تتم إضافة أي سلع بعد</p>
            ) : (
              <ul className="space-y-2">
                {cart.map((item, idx) => (
                  <li
                    key={idx}
                    className="border-border-subtle flex items-start justify-between rounded-xl border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-brand-ink text-sm font-semibold">{item.productNameAr}</p>
                      {item.selectedModifiers.length > 0 && (
                        <p className="text-text-secondary mt-0.5 text-xs">
                          {item.selectedModifiers.map((m) => m.nameAr).join("، ")}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="bg-muted flex size-6 items-center justify-center rounded-full text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="bg-muted flex size-6 items-center justify-center rounded-full text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-text-secondary hover:text-status-error text-xs"
                        aria-label="حذف"
                      >
                        ✕
                      </button>
                      <span className="text-brand-red text-sm font-bold">
                        {formatPrice(item.lineTotal)} ₪
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {cart.length > 0 && (
            <div className="border-border-subtle border-t p-3">
              <p className="text-brand-ink mb-2 text-sm font-medium">طريقة الدفع</p>
              <div className="mb-3 flex gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "cash"
                      ? "bg-brand-red text-white"
                      : "bg-muted text-brand-ink hover:bg-muted/80"
                  }`}
                >
                  نقدي
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "card"
                      ? "bg-brand-red text-white"
                      : "bg-muted text-brand-ink hover:bg-muted/80"
                  }`}
                >
                  بطاقة
                </button>
              </div>
              <div className="mb-3">
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="رقم الزبون (اختياري — لإرسال الفاتورة عبر واتساب)"
                  className="border-border-subtle bg-muted text-brand-ink placeholder:text-text-secondary focus:border-brand-red/50 w-full rounded-full border px-4 py-2 text-sm transition-colors outline-none placeholder:text-xs"
                  dir="ltr"
                />
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="bg-brand-red hover:bg-brand-red/90 w-full rounded-full px-5 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50"
              >
                {checkingOut ? "جاري الدفع..." : `دفع ${formatPrice(cartTotal)} ₪`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modifier sheet / modal */}
      {modifierTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="font-heading text-brand-ink text-lg font-semibold">
              {modifierTarget.productNameAr}
            </h2>
            <p className="text-text-secondary mb-4 text-sm">
              {formatPrice(parseFloat(modifierTarget.basePrice) * 100)} ₪
            </p>

            <div className="mb-4 max-h-96 space-y-4 overflow-y-auto">
              {modifierTarget.groups.map((group) => (
                <div key={group.id}>
                  <p className="text-brand-ink mb-1.5 text-sm font-medium">
                    {group.name}
                    {group.isRequired && <span className="text-status-error mr-1 text-xs">*</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.modifiers.map((mod) => {
                      const isSelected = (modifierSelections[group.id] ?? []).includes(mod.name);
                      return (
                        <button
                          key={mod.id}
                          onClick={() =>
                            group.type === "single"
                              ? toggleSingle(group.id, mod.name)
                              : toggleMulti(group.id, mod.name)
                          }
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isSelected
                              ? "border-brand-red bg-brand-red text-white"
                              : "border-border-subtle bg-muted text-brand-ink hover:border-brand-red/50"
                          }`}
                        >
                          {mod.nameAr}
                          {parseFloat(mod.priceDelta) > 0 && ` (+${mod.priceDelta} ₪)`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setModifierTarget(null)}
                className="border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmModifiers}
                className="bg-brand-red hover:bg-brand-red/90 flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors"
              >
                إضافة إلى السلة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift close modal */}
      {shiftModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="font-heading text-brand-ink text-lg font-semibold">إنهاء الوردية</h2>

            {!shiftResult ? (
              <div className="my-4 space-y-3">
                <p className="text-text-secondary text-sm">
                  أدخل المبلغ النقدي الفعلي في الدرج الآن
                </p>
                <input
                  type="number"
                  inputMode="decimal"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  className="border-border-subtle focus:border-brand-red/50 text-brand-ink w-full rounded-full border bg-white px-4 py-3 text-center text-lg font-medium transition-colors outline-none"
                  dir="ltr"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShiftModal(false)}
                    className="border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={handleCloseShift}
                    disabled={closingShift}
                    className="bg-status-warning hover:bg-status-warning/90 flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50"
                  >
                    {closingShift ? "جاري..." : "تأكيد إنهاء الوردية"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="my-4 space-y-3">
                <div className="bg-brand-cream rounded-xl p-4 text-center">
                  <p className="text-text-secondary text-sm">إجمالي المبيعات</p>
                  <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
                    {shiftResult.totalSales} ₪
                  </p>
                </div>
                <div
                  className={`rounded-xl p-4 text-center ${
                    Math.abs(parseFloat(shiftResult.discrepancy)) > 0.01
                      ? "bg-status-warning/10"
                      : "bg-status-success/10"
                  }`}
                >
                  <p className="text-text-secondary text-sm">الفرق</p>
                  <p
                    className={`font-heading mt-1 text-xl font-bold ${
                      Math.abs(parseFloat(shiftResult.discrepancy)) > 0.01
                        ? "text-status-warning"
                        : "text-status-success"
                    }`}
                  >
                    {shiftResult.discrepancy} ₪
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="bg-brand-red hover:bg-brand-red/90 w-full rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors"
                >
                  تسجيل الخروج
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
