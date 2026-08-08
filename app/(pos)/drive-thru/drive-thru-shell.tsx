"use client";

import { useState } from "react";
import Image from "next/image";
import { LogOut, Plus, Minus, X, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import type { POSCategory } from "@/lib/db/queries";
import { formatPrice, toMinorUnits } from "@/lib/pricing";
import { usePOSCart } from "@/hooks/usePOSCart";
import { checkout } from "../pos/actions";
import { enqueueOrder } from "@/lib/offline/queue";
import { Sheet, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { endStaffSession } from "@/lib/auth/session";
import { Logo } from "@/components/ui/logo";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

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
    const idempotencyKey = await deriveIdempotencyKey(cartItems);
    try {
      const result = await checkout({
        cartItems,
        idempotencyKey,
        paymentMethod,
        channel: "drive_thru",
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

  const handleSignOut = async () => {
    await endStaffSession();
    router.push("/login");
  };

  const selectedCat = driveThruMenu.find((c) => c.id === selectedCatId) ?? driveThruMenu[0];
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-brand-cream flex h-dvh flex-col" dir="rtl" lang="ar">
      {/* ── Top bar ── */}
      <header className="bg-brand-red border-brand-red-dark shadow-brand-red/15 flex shrink-0 items-center gap-2.5 border-b px-3 py-2.5 text-white shadow-md">
        <Logo size="sm" invert />
        <div className="flex-1">
          <h1 className="heading-3 text-sm font-bold text-white">Drive-Thru</h1>
          <p className="caption text-white/80">طلب سريع من نافذة السيارة</p>
        </div>
        <button
          onClick={() => router.push("/pos")}
          className="flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <span>POS</span>
        </button>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          <LogOut className="size-3.5" />
        </button>
      </header>

      {/* ── Category tabs ── */}
      <div className="border-border-subtle bg-card flex shrink-0 border-b px-2 py-1.5">
        <div className="overflow-x-auto">
          <Tabs
            value={selectedCatId}
            onValueChange={setSelectedCatId}
            size="sm"
            items={driveThruMenu.map((cat) => ({ value: cat.id, label: cat.nameAr }))}
            aria-label="فئات Drive-Thru"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
          {selectedCat?.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={() => openModifiers(product)}
            />
          ))}
        </div>
      </div>

      {cart.length > 0 && (
        <div className="border-border-subtle shrink-0 border-t bg-white px-3 py-3 shadow-[0_-4px_12px_rgba(43,29,29,0.04)]">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex w-full items-center justify-between gap-3 rounded-full px-4 py-3 text-sm font-bold text-white shadow-md transition-all"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-4" />
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-white/20 px-1.5 text-xs font-bold tabular-nums">
                {cartCount}
              </span>
            </span>
            <span className="heading-3 text-white">{`${formatPrice(cartTotal)} ₪`}</span>
            <span className="body-sm font-semibold text-white/90">السلة</span>
          </button>
        </div>
      )}

      {cartOpen && (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTitle>سلة Drive-Thru</SheetTitle>
          <p className="body-sm text-text-secondary -mt-3 mb-3">{cartCount} سلعة في السلة</p>
          <div className="max-h-48 space-y-2 overflow-y-auto pe-1">
            {cart.map((item, idx) => (
              <Card key={idx} variant="flat" className="p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="heading-3 text-brand-ink text-sm">{item.productNameAr}</p>
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-text-secondary mt-0.5 text-xs">
                        ({item.selectedModifiers.map((m) => m.nameAr).join("، ")})
                      </p>
                    )}
                  </div>
                  <span className="text-brand-red numeric shrink-0 text-sm font-bold">
                    {formatPrice(item.lineTotal)} ₪
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    onClick={() => updateQuantity(idx, -1)}
                    aria-label="تقليل"
                    className="bg-muted hover:bg-muted/80 flex size-9 items-center justify-center rounded-full text-xs font-bold transition-colors"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="numeric w-5 text-center text-xs font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(idx, 1)}
                    aria-label="زيادة"
                    className="bg-muted hover:bg-muted/80 flex size-9 items-center justify-center rounded-full text-xs font-bold transition-colors"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    aria-label="حذف"
                    className="text-text-secondary hover:bg-status-error/10 hover:text-status-error ms-auto flex size-9 items-center justify-center rounded-full transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <Tabs
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as "cash" | "card")}
              size="sm"
              items={[
                { value: "cash", label: "نقدي" },
                { value: "card", label: "بطاقة" },
              ]}
            />
            <Input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="رقم الزبون (اختياري)"
              dir="ltr"
            />
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50"
            >
              {checkingOut ? "جاري..." : `دفع ${formatPrice(cartTotal)} ₪`}
            </button>
            <SheetClose onClick={() => setCartOpen(false)}>متابعة الإضافة</SheetClose>
          </div>
        </Sheet>
      )}

      <Sheet
        open={!!modifierTarget}
        onOpenChange={(open) => {
          if (!open) setModifierTarget(null);
        }}
      >
        {modifierTarget && (
          <>
            <SheetTitle className="text-base">{modifierTarget.productNameAr}</SheetTitle>
            <p className="text-text-secondary -mt-3 mb-1 text-xs">السعر الأساسي</p>
            <p className="heading-3 text-brand-ink numeric text-base">
              {formatPrice(toMinorUnits(modifierTarget.basePrice))} ₪
            </p>

            <div className="my-3 max-h-64 space-y-4 overflow-y-auto pe-1">
              {modifierTarget.groups.map((group) => (
                <div key={group.id}>
                  <p className="heading-3 text-brand-ink mb-1.5 text-xs">{group.name}</p>
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
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                            isSel
                              ? "border-brand-red bg-brand-red shadow-brand-red/20 text-white shadow-sm"
                              : "border-border-subtle bg-muted text-brand-ink"
                          }`}
                        >
                          {mod.nameAr}
                          {toMinorUnits(mod.priceDelta) > 0 && ` +${mod.priceDelta}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <SheetClose onClick={() => setModifierTarget(null)} className="text-xs">
                إلغاء
              </SheetClose>
              <button
                onClick={confirmModifiers}
                className="bg-brand-red shadow-brand-red/20 flex-1 rounded-full py-2.5 text-sm font-bold text-white shadow-sm"
              >
                إضافة
              </button>
            </div>
          </>
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
      className={`ease-spring shadow-card hover:shadow-pop flex flex-col items-center rounded-2xl bg-white p-2 text-center transition-all hover:-translate-y-0.5 disabled:opacity-40 ${
        product.isAvailable ? "cursor-pointer" : "cursor-not-allowed"
      }`}
    >
      <div className="bg-brand-red-bg mb-1.5 flex h-12 w-12 items-center justify-center rounded-xl">
        <Image
          src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
          alt={product.nameAr}
          width={40}
          height={40}
          loading="lazy"
          className="h-9 w-9 object-contain"
        />
      </div>
      <span className="heading-3 text-brand-ink w-full text-xs leading-tight">
        {product.nameAr}
      </span>
      <span className="text-brand-red numeric mt-0.5 text-xs font-bold">
        {formatPrice(toMinorUnits(product.basePrice))} ₪
      </span>
    </button>
  );
}
