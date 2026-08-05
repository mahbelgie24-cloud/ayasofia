"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { POSCategory } from "@/lib/db/queries";
import { formatPrice, toMinorUnits } from "@/lib/pricing";
import { usePOSCart } from "@/hooks/usePOSCart";
import { checkout } from "../pos/actions";
import { enqueueOrder } from "@/lib/offline/queue";
import { Sheet, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";

export function DriveThruShell({ menu }: { menu: POSCategory[] }) {
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [checkingOut, setCheckingOut] = useState(false);

  const {
    cart,
    cartTotal,
    modifierTarget,
    modifierSelections,
    idempotencyKeyRef,
    openModifiers,
    toggleSingle,
    toggleMulti,
    updateQuantity,
    removeItem,
    confirmModifiers,
    setModifierTarget,
    clearCart,
  } = usePOSCart();

  const toast = useToast();

  const driveThruMenu = [...menu].sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedCatId, setSelectedCatId] = useState(driveThruMenu[0]?.id ?? "");

  const handleCheckout = async () => {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    const cartItems = cart.map((item) => ({
      productId: item.productId,
      modifierIds: item.selectedModifiers.map((m) => m.id),
      quantity: item.quantity,
    }));
    try {
      const result = await checkout({
        cartItems,
        idempotencyKey: idempotencyKeyRef.current,
        paymentMethod,
        channel: "drive_thru",
        clientTotal: cartTotal,
        customerPhone: customerPhone || undefined,
      });
      if (result.success) {
        clearCart();
        setCartOpen(false);
        router.push(`/pos/receipt/${result.orderId}`);
      } else {
        toast.error(result.error);
      }
    } catch {
      // Never lose a sale to a dead Wi-Fi (spec §8, §12) — queue it
      // for the offline sync engine with the same idempotency key so it
      // replays exactly once on reconnect (review finding C1).
      try {
        await enqueueOrder(
          JSON.stringify(cartItems),
          idempotencyKeyRef.current,
          paymentMethod,
          "drive_thru",
          customerPhone || undefined,
        );
        clearCart();
        setCartOpen(false);
        toast.warning("تم حفظ الطلب محلياً — سيُرسل تلقائياً عند عودة الاتصال");
      } catch {
        toast.error("فشل في إتمام الطلب ولم يتم حفظه محلياً");
      }
    } finally {
      setCheckingOut(false);
    }
  };

  const selectedCat = driveThruMenu.find((c) => c.id === selectedCatId) ?? driveThruMenu[0];

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
            className={`ease-spring shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
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
              className={`border-border-subtle ease-spring flex flex-col items-center rounded-xl border bg-white p-2 text-center transition-shadow hover:shadow-sm disabled:opacity-40 ${
                product.isAvailable ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <Image
                src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                alt={product.nameAr}
                width={48}
                height={48}
                className="mb-1 object-contain"
              />
              <span className="font-heading text-brand-ink text-xs leading-tight font-semibold">
                {product.nameAr}
              </span>
              <span className="text-brand-red mt-0.5 text-xs font-medium">
                {formatPrice(toMinorUnits(product.basePrice))} ₪
              </span>
              {product.modifierGroups.length > 0 && (
                <span className="text-text-secondary mt-0.5 text-xs">تخصيص</span>
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
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-text-secondary hover:text-status-error flex min-h-11 min-w-11 items-center justify-center rounded-full text-xs"
                      >
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

      {/* Modifier sheet — accessible Dialog (WCAG 2.2 AA, WEB-A11Y-001) */}
      <Sheet
        open={!!modifierTarget}
        onOpenChange={(open) => {
          if (!open) setModifierTarget(null);
        }}
        className="p-4"
      >
        <SheetTitle className="text-base">{modifierTarget?.productNameAr ?? ""}</SheetTitle>
        <div className="my-3 max-h-64 space-y-3 overflow-y-auto">
          {modifierTarget?.groups.map((group) => (
            <div key={group.id}>
              <p className="text-brand-ink mb-1 text-xs font-medium">{group.name}</p>
              <div className="flex flex-wrap gap-1">
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
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${isSel ? "border-brand-red bg-brand-red text-white" : "border-border-subtle bg-muted"}`}
                    >
                      {mod.nameAr}
                      {toMinorUnits(mod.priceDelta) > 0 && ` (+${mod.priceDelta})`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <SheetClose className="py-2 text-xs">إلغاء</SheetClose>
          <button
            onClick={confirmModifiers}
            className="bg-brand-red flex-1 rounded-full py-2 text-xs font-bold text-white"
          >
            إضافة
          </button>
        </div>
      </Sheet>
    </div>
  );
}
