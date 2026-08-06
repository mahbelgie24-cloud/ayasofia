"use client";

import { useState } from "react";
import type { POSCategory } from "@/lib/db/queries";
import { formatPrice, toMinorUnits } from "@/lib/pricing";
import { usePOSCart } from "@/hooks/usePOSCart";
import { checkout } from "./actions";
import { closeShift } from "@/lib/shifts";
import { enqueueOrder } from "@/lib/offline/queue";
import { Sheet, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { endStaffSession } from "@/lib/auth/session";
import { useRouter } from "next/navigation";

interface POSShellProps {
  menu: POSCategory[];
}

export function POSShell({ menu }: POSShellProps) {
  const router = useRouter();
  const [selectedCatId, setSelectedCatId] = useState(menu[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
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
    removeItem,
    confirmModifiers,
    setModifierTarget,
    clearCart,
  } = usePOSCart();

  const toast = useToast();

  const handleCheckout = async () => {
    if (cart.length === 0 || checkingOut) return;
    setCheckingOut(true);
    const cartItems = cart.map((item) => ({
      productId: item.productId,
      modifierIds: item.selectedModifiers.map((m) => m.id),
      quantity: item.quantity,
    }));
    // P1-M2: deterministic key for THIS cart snapshot (session + fingerprint).
    const idempotencyKey = await deriveIdempotencyKey(cartItems);
    try {
      const result = await checkout({
        cartItems,
        idempotencyKey,
        paymentMethod,
        clientTotal: cartTotal,
        customerPhone: customerPhone || undefined,
      });
      if (result.success) {
        clearCart();
        setCartOpen(false);
        if (result.deduped) {
          toast.warning("هذا الطلب أُرسل مسبقًا — يتم عرض الطلب الحالي");
        }
        router.push(`/pos/receipt/${result.orderId}`);
      } else {
        toast.error(result.error);
      }
    } catch {
      // The sale must never be lost to a dead Wi-Fi (spec §8, §12).
      // If the server call threw (network failure / session hiccup),
      // persist the order to the offline queue with the SAME idempotency
      // key so the sync engine can replay it — and only then, exactly
      // once — on reconnect (review finding C1).
      try {
        await enqueueOrder(
          JSON.stringify(cartItems),
          idempotencyKey,
          paymentMethod,
          "dine_in",
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

  const handleCloseShift = async () => {
    const cash = closingCash.trim() === "" ? 0 : parseFloat(closingCash);
    setClosingShift(true);
    try {
      const result = await closeShift(isNaN(cash) ? 0 : cash);
      if (result.success) {
        setShiftResult({ totalSales: result.totalSales, discrepancy: result.discrepancy });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("فشل في إنهاء الوردية");
    } finally {
      setClosingShift(false);
    }
  };

  const handleSignOut = async () => {
    await endStaffSession();
    router.push("/login");
  };

  const selectedCat = menu.find((c) => c.id === selectedCatId) ?? menu[0];

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
          className="border-status-warning/30 text-status-warning hover:bg-status-warning/10 ease-spring rounded-full border px-3 py-1 text-xs font-medium transition-colors"
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
            className={`ease-spring shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
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
                className={`border-border-subtle ease-spring flex flex-col items-center rounded-2xl border bg-white p-3 text-center transition-shadow hover:shadow-md disabled:opacity-40 ${
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
                  {formatPrice(toMinorUnits(product.basePrice))} ₪
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
          className="bg-brand-red hover:bg-brand-red/90 ease-spring flex w-full items-center justify-between rounded-full px-5 py-3 text-white transition-colors"
        >
          <span className="font-heading text-lg font-bold">
            {cart.length > 0 ? `${cart.length} سلعة — ${formatPrice(cartTotal)} ₪` : "السلة فارغة"}
          </span>
          <svg
            className={`ease-spring size-5 transition-transform ${cartOpen ? "rotate-180" : ""}`}
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
                          className="bg-muted flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="bg-muted flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-text-secondary hover:text-status-error flex min-h-11 min-w-11 items-center justify-center rounded-full text-xs"
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
                  className={`ease-spring flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    paymentMethod === "cash"
                      ? "bg-brand-red text-white"
                      : "bg-muted text-brand-ink hover:bg-muted/80"
                  }`}
                >
                  نقدي
                </button>
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`ease-spring flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
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
                  className="border-border-subtle bg-muted text-brand-ink placeholder:text-text-secondary focus:border-brand-red/50 ease-spring w-full rounded-full border px-4 py-2 text-sm text-xs transition-colors outline-none placeholder:text-xs"
                  dir="ltr"
                />
              </div>
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="bg-brand-red hover:bg-brand-red/90 ease-spring w-full rounded-full px-5 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50"
              >
                {checkingOut ? "جاري الدفع..." : `دفع ${formatPrice(cartTotal)} ₪`}
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
        <p className="text-text-secondary mb-4 text-sm">
          {formatPrice(toMinorUnits(modifierTarget?.basePrice ?? "0"))} ₪
        </p>

        <div className="mb-4 max-h-96 space-y-4 overflow-y-auto">
          {modifierTarget?.groups.map((group) => (
            <div key={group.id}>
              <p className="text-brand-ink mb-1.5 text-sm font-medium">
                {group.name}
                {group.isRequired && <span className="text-status-error mr-1 text-xs">*</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.modifiers.map((mod) => {
                  const isSelected = (modifierSelections[group.id] ?? []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() =>
                        group.type === "single"
                          ? toggleSingle(group.id, mod.id)
                          : toggleMulti(group.id, mod.id)
                      }
                      aria-pressed={isSelected}
                      className={`ease-spring rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "border-brand-red bg-brand-red text-white"
                          : "border-border-subtle bg-muted text-brand-ink hover:border-brand-red/50"
                      }`}
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
          <SheetClose onClick={() => setModifierTarget(null)}>إلغاء</SheetClose>
          <button
            onClick={confirmModifiers}
            className="bg-brand-red hover:bg-brand-red/90 ease-spring flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors"
          >
            إضافة إلى السلة
          </button>
        </div>
      </Sheet>

      {/* Shift close modal — accessible Dialog (WCAG 2.2 AA, WEB-A11Y-001) */}
      <Sheet open={shiftModal} onOpenChange={setShiftModal}>
        <SheetTitle>إنهاء الوردية</SheetTitle>

        {!shiftResult ? (
          <div className="my-4 space-y-3">
            <p className="text-text-secondary text-sm">أدخل المبلغ النقدي الفعلي في الدرج الآن</p>
            <input
              type="number"
              inputMode="decimal"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="0.00"
              className="border-border-subtle focus:border-brand-red/50 text-brand-ink ease-spring w-full rounded-full border bg-white px-4 py-3 text-center text-lg font-medium transition-colors outline-none"
              dir="ltr"
            />
            <div className="flex gap-2">
              <SheetClose>إلغاء</SheetClose>
              <button
                onClick={handleCloseShift}
                disabled={closingShift}
                className="bg-status-warning hover:bg-status-warning/90 ease-spring flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50"
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
              className="bg-brand-red hover:bg-brand-red/90 ease-spring w-full rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors"
            >
              تسجيل الخروج
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
