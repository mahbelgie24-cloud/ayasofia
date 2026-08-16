"use client";

import { useState } from "react";
import Image from "next/image";
import {
  LogOut,
  ClipboardList,
  X,
  Plus,
  Minus,
  ArrowRight,
  Car,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import type { POSCategory } from "@/lib/db/queries";
import { formatPrice, toMinorUnits } from "@/lib/pricing";
import { usePOSCart } from "@/hooks/usePOSCart";
import { checkout } from "./actions";
import { closeShift } from "@/lib/shifts";
import { enqueueOrder } from "@/lib/offline/queue";
import { Sheet, SheetTitle, SheetClose, SheetDescription } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { endStaffSession } from "@/lib/auth/session";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";

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
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-brand-cream flex h-dvh flex-col" dir="rtl" lang="ar">
      {/* ── Top bar ── */}
      <header className="border-border-subtle/60 relative flex shrink-0 items-center justify-between gap-3 border-b bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <Logo size="sm" surface="tile" />
          <div className="hidden sm:block">
            <p className="heading-3 text-brand-ink text-sm leading-tight">Ayasofia POS</p>
            <p className="text-text-secondary caption">حلويات آيا صوفيا</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => router.push("/drive-thru")}
            className="border-border-subtle text-text-secondary hover:border-brand-red hover:text-brand-red ease-spring flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-3.5 text-xs font-semibold transition-colors"
            title="Drive-Thru"
          >
            <Car className="size-3.5" />
            <span className="hidden sm:inline">Drive-Thru</span>
          </button>
          <button
            onClick={() => {
              setShiftResult(null);
              setClosingCash("");
              setShiftModal(true);
            }}
            className="border-status-warning/30 text-status-warning hover:bg-status-warning/10 ease-spring flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-3.5 text-xs font-semibold transition-colors"
          >
            <ClipboardList className="size-3.5" />
            <span>إنهاء الوردية</span>
          </button>
          <button
            onClick={handleSignOut}
            className="border-border-subtle text-text-secondary hover:border-status-error hover:text-status-error ease-spring flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border bg-white px-2.5 text-xs font-semibold transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </header>

      {/* ── Category tabs ── */}
      <div className="border-border-subtle/60 flex shrink-0 border-b bg-white/60 px-3 py-2 backdrop-blur-sm">
        <div className="w-full overflow-x-auto">
          <Tabs
            value={selectedCatId}
            onValueChange={setSelectedCatId}
            size="sm"
            items={menu.map((cat) => ({ value: cat.id, label: cat.nameAr }))}
            aria-label="فئات المنتجات"
          />
        </div>
      </div>

      {/* ── Product grid ── */}
      <div className="flex-1 overflow-y-auto p-3">
        {!selectedCat || selectedCat.products.length === 0 ? (
          <EmptyState title="لا توجد منتجات" description="اختر فئة أخرى أو تواصل مع المدير." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {selectedCat.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => openModifiers(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Cart bar ── */}
      <div className="border-border-subtle/60 relative shrink-0 border-t bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(43,29,29,0.06)]">
        <button
          onClick={() => setCartOpen(true)}
          className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand animate-shimmer relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-full px-5 py-3.5 text-white transition-all hover:-translate-y-0.5"
        >
          <span className="relative z-10 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
              <ShoppingCart className="size-4" />
            </span>
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 text-sm font-bold tabular-nums backdrop-blur-sm">
              {cartCount}
            </span>
            <span className="body-sm font-medium text-white/90">سلعة</span>
          </span>
          <span className="heading-3 relative z-10 text-white tabular-nums">
            {`${formatPrice(cartTotal)} ₪`}
          </span>
          <span className="body-sm relative z-10 flex items-center gap-1 font-semibold text-white/95">
            <span>السلة</span>
            <ArrowRight className="size-4 rtl:rotate-180" />
          </span>
        </button>
      </div>

      {/* ── Cart panel ── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen} size="md">
        <SheetTitle>سلة الطلب</SheetTitle>
        <SheetDescription>
          {cart.length === 0
            ? "أضف منتجات من القائمة لبدء الطلب"
            : `${cartCount} سلعة • ${cart.length} نوع`}
        </SheetDescription>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pe-1">
          {cart.length === 0 ? (
            <EmptyState title="السلة فارغة" description="اختر منتجاً من القائمة لتبدأ." />
          ) : (
            cart.map((item, idx) => (
              <Card key={idx} variant="flat" className="p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="heading-3 text-brand-ink text-sm">{item.productNameAr}</p>
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-text-secondary mt-1 text-xs">
                        {item.selectedModifiers.map((m) => m.nameAr).join("، ")}
                      </p>
                    )}
                  </div>
                  <span className="text-brand-red numeric shrink-0 text-sm font-bold">
                    {formatPrice(item.lineTotal)} ₪
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(idx, -1)}
                    aria-label="تقليل"
                    className="bg-muted hover:bg-brand-red-soft hover:text-brand-red ease-spring flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-bold transition-colors"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span
                    aria-live="polite"
                    className="numeric w-6 text-center text-sm font-semibold"
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(idx, 1)}
                    aria-label="زيادة"
                    className="bg-muted hover:bg-brand-red-soft hover:text-brand-red ease-spring flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-bold transition-colors"
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    aria-label="حذف"
                    className="text-text-secondary hover:bg-status-error/10 hover:text-status-error ease-spring ms-auto flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="mt-5 space-y-4">
            <FormField label="طريقة الدفع">
              <Tabs
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as "cash" | "card")}
                size="sm"
                items={[
                  { value: "cash", label: "نقدي" },
                  { value: "card", label: "بطاقة" },
                ]}
              />
            </FormField>

            <FormField label="رقم الزبون" hint="اختياري — لإرسال الفاتورة عبر واتساب">
              <Input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="05XXXXXXXX"
                dir="ltr"
              />
            </FormField>

            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-base font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
            >
              {checkingOut ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري الدفع...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="size-4" />
                  دفع {formatPrice(cartTotal)} ₪
                </span>
              )}
            </button>
          </div>
        )}

        <div className="mt-3 flex justify-end">
          <SheetClose onClick={() => setCartOpen(false)}>متابعة الإضافة</SheetClose>
        </div>
      </Sheet>

      {/* ── Modifier sheet ── */}
      <Sheet
        open={!!modifierTarget}
        onOpenChange={(open) => {
          if (!open) setModifierTarget(null);
        }}
        size="md"
      >
        <SheetTitle>{modifierTarget?.productNameAr ?? ""}</SheetTitle>
        <SheetDescription>اختر الإضافات لضبط الطلب</SheetDescription>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-text-secondary caption">السعر الأساسي</span>
          <span className="heading-2 text-brand-ink numeric text-lg">
            {formatPrice(toMinorUnits(modifierTarget?.basePrice ?? "0"))} ₪
          </span>
        </div>

        <div className="mt-4 mb-4 max-h-96 space-y-5 overflow-y-auto pe-1">
          {modifierTarget?.groups.map((group) => (
            <div key={group.id}>
              <div className="mb-2.5 flex items-center gap-2">
                <p className="heading-3 text-brand-ink text-sm">{group.name}</p>
                {group.isRequired && (
                  <span className="bg-status-error/10 text-status-error rounded-full px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    مطلوب
                  </span>
                )}
              </div>
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
                      className={`ease-spring rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-brand-red border-brand-red shadow-brand-soft -translate-y-0.5 text-white"
                          : "border-border-subtle bg-muted text-brand-ink hover:border-brand-red/40 hover:bg-brand-red-soft/40"
                      }`}
                    >
                      {mod.nameAr}
                      {toMinorUnits(mod.priceDelta) > 0 && (
                        <span
                          className={isSelected ? "ms-1 text-white/85" : "text-text-secondary ms-1"}
                        >
                          +{mod.priceDelta} ₪
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <SheetClose onClick={() => setModifierTarget(null)}>إلغاء</SheetClose>
          <button
            onClick={confirmModifiers}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand flex-1 rounded-full px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
          >
            إضافة إلى السلة
          </button>
        </div>
      </Sheet>

      {/* ── Shift close modal ── */}
      <Sheet open={shiftModal} onOpenChange={setShiftModal} size="sm">
        <SheetTitle>إنهاء الوردية</SheetTitle>
        <SheetDescription>
          أدخل المبلغ النقدي الفعلي في الدرج الآن لإقفال الوردية ومطابقة المبيعات.
        </SheetDescription>

        {!shiftResult ? (
          <div className="my-4 space-y-4">
            <FormField label="النقد في الدرج">
              <Input
                type="number"
                inputMode="decimal"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder="0.00"
                dir="ltr"
              />
            </FormField>
            <div className="flex gap-2">
              <SheetClose>إلغاء</SheetClose>
              <button
                onClick={handleCloseShift}
                disabled={closingShift}
                className="bg-status-warning hover:bg-status-warning/90 ease-spring flex-1 rounded-full px-4 py-3 text-sm font-bold text-white transition-colors disabled:opacity-50"
              >
                {closingShift ? "جاري..." : "تأكيد إنهاء الوردية"}
              </button>
            </div>
          </div>
        ) : (
          <div className="my-4 space-y-3">
            <Card variant="muted" className="p-4 text-center">
              <p className="text-text-secondary caption">إجمالي المبيعات</p>
              <p className="numeric heading-1 text-brand-ink mt-1">{shiftResult.totalSales} ₪</p>
            </Card>
            <Card
              variant="flat"
              className={`p-4 text-center ${
                Math.abs(parseFloat(shiftResult.discrepancy)) > 0.01
                  ? "bg-status-warning/[0.08] border-status-warning/30"
                  : "bg-status-success/[0.08] border-status-success/30"
              }`}
            >
              <p className="text-text-secondary caption">الفرق</p>
              <p
                className={`numeric heading-1 mt-1 ${
                  Math.abs(parseFloat(shiftResult.discrepancy)) > 0.01
                    ? "text-status-warning-ink"
                    : "text-status-success"
                }`}
              >
                {shiftResult.discrepancy} ₪
              </p>
            </Card>
            <button
              onClick={handleSignOut}
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            >
              <LogOut className="size-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ProductCard({
  product,
  onClick,
}: {
  product: POSCategory["products"][number];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!product.isAvailable}
      className={`ease-spring shadow-card hover:shadow-pop group relative flex flex-col items-center overflow-hidden rounded-2xl bg-white p-3 text-center transition-all hover:-translate-y-1 disabled:opacity-40 ${
        product.isAvailable ? "cursor-pointer" : "cursor-not-allowed"
      }`}
    >
      <div className="bg-brand-red-bg relative mb-2.5 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-105">
        <Image
          src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
          alt={product.nameAr}
          width={56}
          height={56}
          loading="lazy"
          className="h-12 w-12 object-contain"
        />
        <span
          aria-hidden="true"
          className="bg-brand-red/10 absolute inset-0 rounded-2xl opacity-0 transition-opacity group-hover:opacity-100"
        />
      </div>
      <span className="heading-3 text-brand-ink w-full text-sm leading-tight">
        {product.nameAr}
      </span>
      <span className="text-brand-red numeric mt-1 text-sm font-bold">
        {formatPrice(toMinorUnits(product.basePrice))} ₪
      </span>
      {product.modifierGroups.length > 0 && (
        <span className="text-text-secondary mt-0.5 text-[11px]">قابل للتخصيص</span>
      )}
    </button>
  );
}
