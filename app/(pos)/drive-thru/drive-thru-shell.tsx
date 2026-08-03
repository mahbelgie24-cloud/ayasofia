"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { POSCategory } from "@/lib/db/queries";
import {
  calculateLineTotal,
  calculateCartTotal,
  formatPrice,
  toMinorUnits,
  type SelectedModifier as PricingModifier,
} from "@/lib/pricing";
import { checkout } from "../pos/actions";

interface CartItem {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  basePrice: string;
  selectedModifiers: { id: string; nameAr: string; name: string; priceDelta: string }[];
  quantity: number;
  lineTotal: number;
}

export function DriveThruShell({ menu }: { menu: POSCategory[] }) {
  const router = useRouter();
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
  const idempotencyKeyRef = useRef<string>("");

  // Categories already ordered by sortOrder from getMenuForPOS —
  // bubble tea categories have lower sortOrder values in seed data,
  // ensuring they appear first. No string-matching needed.
  const driveThruMenu = [...menu].sort((a, b) => a.sortOrder - b.sortOrder);

  const [selectedCatId, setSelectedCatId] = useState(driveThruMenu[0]?.id ?? "");

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
        channel: "drive_thru",
        clientTotal: calculateCartTotal(cart),
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

  const selectedCat = driveThruMenu.find((c) => c.id === selectedCatId) ?? driveThruMenu[0];

  const addToCart = (
    product: { id: string; nameAr: string; nameEn: string; basePrice: string },
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
        const qty = updated[existingIdx].quantity + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: qty,
          lineTotal: calculateLineTotal(
            product.basePrice,
            selectedModifiers.map((m) => ({ priceDelta: m.priceDelta })),
            qty,
          ),
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
    for (const g of product.modifierGroups) initial[g.id] = [];
    setModifierSelections(initial);
    setModifierTarget({
      productId: product.id,
      productNameAr: product.nameAr,
      productNameEn: product.nameEn,
      basePrice: product.basePrice,
      groups: product.modifierGroups,
    });
  }, []);

  const toggleSingle = (groupId: string, modName: string) => {
    setModifierSelections((prev) => ({ ...prev, [groupId]: [modName] }));
  };

  const toggleMulti = (groupId: string, modName: string) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      return {
        ...prev,
        [groupId]: current.includes(modName)
          ? current.filter((n) => n !== modName)
          : [...current, modName],
      };
    });
  };

  const confirmModifiers = () => {
    if (!modifierTarget) return;
    const selected: { id: string; nameAr: string; name: string; priceDelta: string }[] = [];
    for (const g of modifierTarget.groups) {
      for (const modName of modifierSelections[g.id] ?? []) {
        const mod = g.modifiers.find((m) => m.name === modName);
        if (mod)
          selected.push({
            id: mod.id,
            nameAr: mod.nameAr,
            name: mod.name,
            priceDelta: mod.priceDelta,
          });
      }
    }
    addToCart(
      {
        id: modifierTarget.productId,
        nameAr: modifierTarget.productNameAr,
        nameEn: modifierTarget.productNameEn,
        basePrice: modifierTarget.basePrice,
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
      if (newQty === 0) return updated.filter((_, i) => i !== index);
      updated[index] = {
        ...item,
        quantity: newQty,
        lineTotal: calculateLineTotal(
          item.basePrice,
          item.selectedModifiers.map((m) => ({ priceDelta: m.priceDelta })),
          newQty,
        ),
      };
      return updated;
    });
  };

  const removeItem = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index));

  const cartTotal = calculateCartTotal(cart);

  return (
    <div className="bg-brand-cream flex h-screen flex-col" dir="rtl" lang="ar">
      <div className="border-border-subtle bg-brand-red flex shrink-0 items-center gap-2 border-b px-3 py-2 text-white">
        <span className="font-heading text-lg font-bold">🚘 Drive-Thru</span>
        <div className="flex-1" />
        <span className="text-sm">
          {cart.length > 0 ? `${cart.length} سلعة — ${formatPrice(cartTotal)} ₪` : ""}
        </span>
      </div>

      <div className="border-border-subtle flex shrink-0 gap-1 overflow-x-auto border-b bg-white px-2 py-1.5">
        {driveThruMenu.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              cat.id === selectedCatId
                ? "bg-brand-red text-white"
                : "bg-muted text-brand-ink hover:bg-muted/80"
            }`}
          >
            {cat.nameAr}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {selectedCat?.products.map((product) => (
            <button
              key={product.id}
              onClick={() => openModifiers(product)}
              disabled={!product.isAvailable}
              className={`border-border-subtle flex flex-col items-center rounded-xl border bg-white p-2 text-center transition-shadow hover:shadow-sm disabled:opacity-40 ${
                product.isAvailable ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <img
                src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                alt={product.nameAr}
                className="mb-1 h-12 w-12 object-contain"
              />
              <span className="font-heading text-brand-ink text-xs leading-tight font-semibold">
                {product.nameAr}
              </span>
              <span className="text-brand-red mt-0.5 text-xs font-medium">
                {formatPrice(toMinorUnits(product.basePrice))} ₪
              </span>
              {product.modifierGroups.length > 0 && (
                <span className="text-text-secondary mt-0.5 text-[10px]">تخصيص</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="border-border-subtle shrink-0 border-t bg-white px-3 py-2">
          <button
            onClick={() => setCartOpen(!cartOpen)}
            className="bg-brand-red w-full rounded-full px-4 py-2 text-sm font-bold text-white"
          >
            {`السلة: ${cart.length} — ${formatPrice(cartTotal)} ₪`}
          </button>

          {cartOpen && (
            <div className="mt-2 max-h-48 overflow-y-auto">
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  className="border-border-subtle flex items-center justify-between border-b py-1 text-xs"
                >
                  <div>
                    <span className="font-semibold">{item.productNameAr}</span>
                    {item.selectedModifiers.length > 0 && (
                      <span className="text-text-secondary mr-1">
                        ({item.selectedModifiers.map((m) => m.nameAr).join("، ")})
                      </span>
                    )}
                    <div className="mt-0.5 flex items-center gap-1">
                      <button
                        onClick={() => updateQuantity(idx, -1)}
                        className="bg-muted flex size-5 items-center justify-center rounded-full text-xs"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="bg-muted flex size-5 items-center justify-center rounded-full text-xs"
                      >
                        +
                      </button>
                      <button onClick={() => removeItem(idx)} className="text-text-secondary mr-1">
                        ✕
                      </button>
                    </div>
                  </div>
                  <span className="text-brand-red font-bold">{formatPrice(item.lineTotal)} ₪</span>
                </div>
              ))}

              <div className="mt-2 space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex-1 rounded-full py-1 text-xs font-medium ${paymentMethod === "cash" ? "bg-brand-red text-white" : "bg-muted"}`}
                  >
                    نقدي
                  </button>
                  <button
                    onClick={() => setPaymentMethod("card")}
                    className={`flex-1 rounded-full py-1 text-xs font-medium ${paymentMethod === "card" ? "bg-brand-red text-white" : "bg-muted"}`}
                  >
                    بطاقة
                  </button>
                </div>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="رقم الزبون (اختياري)"
                  className="border-border-subtle bg-muted w-full rounded-full border px-3 py-1.5 text-xs"
                  dir="ltr"
                />
                <button
                  onClick={handleCheckout}
                  disabled={checkingOut}
                  className="bg-brand-red w-full rounded-full py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {checkingOut ? "جاري الدفع..." : `دفع ${formatPrice(cartTotal)} ₪`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modifierTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <h2 className="font-heading text-brand-ink text-base font-semibold">
              {modifierTarget.productNameAr}
            </h2>
            <div className="my-3 max-h-64 space-y-3 overflow-y-auto">
              {modifierTarget.groups.map((group) => (
                <div key={group.id}>
                  <p className="text-brand-ink mb-1 text-xs font-medium">{group.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.modifiers.map((mod) => {
                      const isSel = (modifierSelections[group.id] ?? []).includes(mod.name);
                      return (
                        <button
                          key={mod.id}
                          onClick={() =>
                            group.type === "single"
                              ? toggleSingle(group.id, mod.name)
                              : toggleMulti(group.id, mod.name)
                          }
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${isSel ? "border-brand-red bg-brand-red text-white" : "border-border-subtle bg-muted"}`}
                        >
                          {mod.nameAr}
                          {parseFloat(mod.priceDelta) > 0 && ` (+${mod.priceDelta})`}
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
                className="border-border-subtle flex-1 rounded-full border py-2 text-xs"
              >
                إلغاء
              </button>
              <button
                onClick={confirmModifiers}
                className="bg-brand-red flex-1 rounded-full py-2 text-xs font-bold text-white"
              >
                إضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
