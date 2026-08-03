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
import { placeCustomerOrder } from "./actions";

interface CartItem {
  productId: string;
  productNameAr: string;
  basePrice: string;
  selectedModifiers: { id: string; nameAr: string; name: string; priceDelta: string }[];
  quantity: number;
  lineTotal: number;
}

export function CustomerOrderShell({ menu }: { menu: POSCategory[] }) {
  const router = useRouter();
  const [selectedCatId, setSelectedCatId] = useState(menu[0]?.id ?? "");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [modifierTarget, setModifierTarget] = useState<{
    productId: string;
    productNameAr: string;
    basePrice: string;
    groups: POSCategory["products"][number]["modifierGroups"];
  } | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [addedAnim, setAddedAnim] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string>("");

  useEffect(() => {
    if (cart.length > 0 && !idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    if (cart.length === 0) {
      idempotencyKeyRef.current = "";
    }
  }, [cart.length]);

  const selectedCat = menu.find((c) => c.id === selectedCatId) ?? menu[0];

  const addToCart = useCallback(
    (
      product: { id: string; nameAr: string; basePrice: string },
      mods: { id: string; nameAr: string; name: string; priceDelta: string }[],
    ) => {
      const pricingMods: PricingModifier[] = mods.map((m) => ({ priceDelta: m.priceDelta }));
      const lineTotal = calculateLineTotal(product.basePrice, pricingMods, 1);
      setCart((prev) => {
        const idx = prev.findIndex(
          (item) =>
            item.productId === product.id &&
            JSON.stringify(item.selectedModifiers.map((m) => m.id).sort()) ===
              JSON.stringify(mods.map((m) => m.id).sort()),
        );
        if (idx >= 0) {
          const updated = [...prev];
          const qty = updated[idx].quantity + 1;
          updated[idx] = {
            ...updated[idx],
            quantity: qty,
            lineTotal: calculateLineTotal(
              product.basePrice,
              mods.map((m) => ({ priceDelta: m.priceDelta })),
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
            basePrice: product.basePrice,
            selectedModifiers: mods,
            quantity: 1,
            lineTotal,
          },
        ];
      });
      setAddedAnim(product.id);
      setTimeout(() => setAddedAnim(null), 400);
    },
    [],
  );

  const openModifiers = useCallback(
    (product: POSCategory["products"][number]) => {
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
        basePrice: product.basePrice,
        groups: product.modifierGroups,
      });
    },
    [addToCart],
  );

  const toggle = (groupId: string, type: "single" | "multi", modName: string) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (type === "single") return { ...prev, [groupId]: [modName] };
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
        basePrice: modifierTarget.basePrice,
      },
      selected,
    );
    setModifierTarget(null);
  };

  const updateQty = (index: number, delta: number) => {
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

  const handleSubmit = async () => {
    if (cart.length === 0 || !customerName.trim() || checkingOut) return;
    setCheckingOut(true);
    try {
      const result = await placeCustomerOrder({
        cartItems: cart.map((item) => ({
          productId: item.productId,
          modifierIds: item.selectedModifiers.map((m) => m.id),
          quantity: item.quantity,
        })),
        customerName: customerName.trim(),
        customerPhone: customerPhone || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      });
      if (result.success) {
        router.push(`/order/status/${result.orderId}`);
      } else {
        alert(result.error);
      }
    } catch {
      alert("فشل في إتمام الطلب");
    } finally {
      setCheckingOut(false);
    }
  };

  const total = calculateCartTotal(cart);

  return (
    <div className="bg-brand-cream flex min-h-screen flex-col" dir="rtl" lang="ar">
      {/* Hero header */}
      <div className="bg-brand-red px-4 py-6 text-center text-white">
        <img src="/icons/logo-mono.svg" alt="" className="mx-auto mb-2 h-10 w-auto invert" />
        <h1 className="font-heading text-xl font-bold">Ayasofia Sweet</h1>
        <p className="mt-1 text-sm text-white/80">اطلب مشروبك المفضل</p>
      </div>

      {/* Category tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto bg-white px-3 py-2 shadow-sm">
        {menu.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              cat.id === selectedCatId ? "bg-brand-red text-white" : "bg-muted text-brand-ink"
            }`}
          >
            {cat.nameAr}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-3">
          {selectedCat?.products.map((product) => (
            <button
              key={product.id}
              onClick={() => openModifiers(product)}
              disabled={!product.isAvailable}
              className={`border-border-subtle flex flex-col items-center rounded-2xl border bg-white p-3 text-center shadow-sm transition-all hover:shadow-md disabled:opacity-40 ${
                addedAnim === product.id ? "animate-bounce" : ""
              }`}
            >
              <img
                src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                alt={product.nameAr}
                className="mb-2 h-16 w-16 object-contain"
              />
              <span className="font-heading text-brand-ink text-sm font-semibold">
                {product.nameAr}
              </span>
              <span className="text-brand-red mt-1 text-sm font-medium">
                {formatPrice(toMinorUnits(product.basePrice))} ₪
              </span>
              {product.modifierGroups.length > 0 && (
                <span className="text-text-secondary mt-1 text-xs">تخصيص</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cart + checkout */}
      {cart.length > 0 && (
        <div className="border-border-subtle shrink-0 border-t bg-white px-4 py-3">
          <button
            onClick={() => setCartOpen(!cartOpen)}
            className="bg-brand-red w-full rounded-full px-4 py-2 text-sm font-bold text-white"
          >
            {`${cart.length} سلعة — ${formatPrice(total)} ₪`} {cartOpen ? "▲" : "▼"}
          </button>

          {cartOpen && (
            <div className="mt-2 space-y-2">
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  className="border-border-subtle flex items-center justify-between border-b py-1 text-sm"
                >
                  <div>
                    <span className="font-semibold">{item.productNameAr}</span>
                    {item.selectedModifiers.length > 0 && (
                      <span className="text-text-secondary mr-1 text-xs">
                        ({item.selectedModifiers.map((m) => m.nameAr).join("، ")})
                      </span>
                    )}
                    <div className="mt-0.5 flex items-center gap-1">
                      <button
                        onClick={() => updateQty(idx, -1)}
                        className="bg-muted flex size-5 items-center justify-center rounded-full text-xs"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQty(idx, 1)}
                        className="bg-muted flex size-5 items-center justify-center rounded-full text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <span className="text-brand-red font-bold">{formatPrice(item.lineTotal)} ₪</span>
                </div>
              ))}

              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="الاسم (مطلوب)"
                className="border-border-subtle bg-muted w-full rounded-full border px-4 py-2 text-sm"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="رقم الجوال (اختياري)"
                className="border-border-subtle bg-muted w-full rounded-full border px-4 py-2 text-sm"
                dir="ltr"
              />
              <button
                onClick={handleSubmit}
                disabled={checkingOut}
                className="bg-brand-red w-full rounded-full py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {checkingOut ? "جاري الطلب..." : "اطلب الآن"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modifier sheet */}
      {modifierTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-5 sm:rounded-2xl">
            <h2 className="font-heading text-brand-ink text-lg font-semibold">
              {modifierTarget.productNameAr}
            </h2>
            <div className="my-3 max-h-96 space-y-3 overflow-y-auto">
              {modifierTarget.groups.map((group) => (
                <div key={group.id}>
                  <p className="text-brand-ink mb-1 text-sm font-medium">{group.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.modifiers.map((mod) => {
                      const isSel = (modifierSelections[group.id] ?? []).includes(mod.name);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => toggle(group.id, group.type, mod.name)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${isSel ? "border-brand-red bg-brand-red text-white" : "border-border-subtle bg-muted"}`}
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
                className="border-border-subtle flex-1 rounded-full border py-2.5 text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={confirmModifiers}
                className="bg-brand-red flex-1 rounded-full py-2.5 text-sm font-bold text-white"
              >
                إضافة إلى السلة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
