"use client";

// DEPRECATED (Q1=B): the /order ordering surface is retired — the page 308s
// to the digital menu. This component is no longer reachable from any route and
// is retained only to keep its server action + tests compilable. Do not rebuild.

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { POSCategory } from "@/lib/db/queries";
import { formatPrice, toMinorUnits } from "@/lib/pricing";
import { usePOSCart } from "@/hooks/usePOSCart";
import { placeCustomerOrder } from "./actions";
import { Sheet, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

export function CustomerOrderShell({ menu }: { menu: POSCategory[] }) {
  const router = useRouter();
  const [selectedCatId, setSelectedCatId] = useState(menu[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);
  const [addedAnim, setAddedAnim] = useState<string | null>(null);

  const handleItemAdded = useCallback((productId: string) => {
    setAddedAnim(productId);
    setTimeout(() => setAddedAnim(null), 400);
  }, []);

  const {
    cart,
    cartTotal,
    modifierTarget,
    modifierSelections,
    deriveIdempotencyKey,
    openModifiers,
    toggleSingle,
    toggleMulti,
    updateQuantity,
    confirmModifiers,
    setModifierTarget,
  } = usePOSCart({ onItemAdded: handleItemAdded });

  const toast = useToast();

  const selectedCat = menu.find((c) => c.id === selectedCatId) ?? menu[0];

  const handleSubmit = async () => {
    if (cart.length === 0 || !customerName.trim() || checkingOut) return;
    setCheckingOut(true);
    const cartItems = cart.map((item) => ({
      productId: item.productId,
      modifierIds: item.selectedModifiers.map((m) => m.id),
      quantity: item.quantity,
    }));
    const idempotencyKey = await deriveIdempotencyKey(cartItems);
    try {
      const result = await placeCustomerOrder({
        cartItems,
        customerName: customerName.trim(),
        customerPhone: customerPhone || undefined,
        idempotencyKey,
      });
      if (result.success) {
        if (result.deduped) {
          toast.warning("تم إرسال هذا الطلب مسبقًا — يتم عرض الطلب الحالي");
        }
        router.push(
          `/order/status/${result.orderId}?accessToken=${encodeURIComponent(result.accessToken)}`,
        );
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("فشل في إتمام الطلب");
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="bg-brand-cream flex min-h-screen flex-col" dir="rtl" lang="ar">
      {/* Hero header */}
      <div className="bg-brand-red px-4 py-6 text-center text-white">
        <Image
          src="/icons/logo-mono.svg"
          alt=""
          width={40}
          height={40}
          className="mx-auto mb-2 h-10 w-auto invert"
        />
        <h1 className="font-heading text-xl font-bold">Ayasofia Sweet</h1>
        <p className="mt-1 text-sm text-white/80">اطلب مشروبك المفضل</p>
      </div>

      {/* Category tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto bg-white px-3 py-2 shadow-sm">
        {menu.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            className={`ease-spring shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
              className={`border-border-subtle ease-spring flex flex-col items-center rounded-2xl border bg-white p-3 text-center shadow-sm transition-all hover:shadow-md disabled:opacity-40 ${
                addedAnim === product.id ? "animate-bounce" : ""
              }`}
            >
              <Image
                src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                alt={product.nameAr}
                width={64}
                height={64}
                className="mb-2 object-contain"
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
            {`${cart.length} سلعة — ${formatPrice(cartTotal)} ₪`} {cartOpen ? "▲" : "▼"}
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
                        onClick={() => updateQuantity(idx, -1)}
                        className="bg-muted flex min-h-11 min-w-11 items-center justify-center rounded-full text-xs"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(idx, 1)}
                        className="bg-muted flex min-h-11 min-w-11 items-center justify-center rounded-full text-xs"
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

      {/* Modifier sheet — accessible Dialog (WCAG 2.2 AA, WEB-A11Y-001) */}
      <Sheet
        open={!!modifierTarget}
        onOpenChange={(open) => {
          if (!open) setModifierTarget(null);
        }}
      >
        <SheetTitle>{modifierTarget?.productNameAr ?? ""}</SheetTitle>
        <div className="my-3 max-h-96 space-y-3 overflow-y-auto">
          {modifierTarget?.groups.map((group) => (
            <div key={group.id}>
              <p className="text-brand-ink mb-1 text-sm font-medium">{group.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.modifiers.map((mod) => {
                  const isSel = (modifierSelections[group.id] ?? []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() =>
                        group.type === "single"
                          ? toggleSingle(group.id, mod.id)
                          : toggleMulti(group.id, mod.id)
                      }
                      aria-pressed={isSel}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${isSel ? "border-brand-red bg-brand-red text-white" : "border-border-subtle bg-muted"}`}
                    >
                      {mod.nameAr}
                      {toMinorUnits(mod.priceDelta) > 0 && ` (+${mod.priceDelta} ₪)`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <SheetClose>إلغاء</SheetClose>
          <button
            onClick={confirmModifiers}
            className="bg-brand-red flex-1 rounded-full py-2.5 text-sm font-bold text-white"
          >
            إضافة إلى السلة
          </button>
        </div>
      </Sheet>
    </div>
  );
}
