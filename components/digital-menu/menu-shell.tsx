"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type {
  PublicCategory,
  PublicProduct,
  PublicSuggestion,
  PublicBestSeller,
} from "@/lib/db/queries";
import { formatPrice, toMinorUnits, calculateLineTotal } from "@/lib/pricing";
import { usePOSCart } from "@/hooks/usePOSCart";
import { placeDigitalMenuOrder, getUpsellSuggestions } from "@/app/digital-menu/actions";
import { Sheet, SheetTitle, SheetClose } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { PearlsField } from "@/components/digital-menu/pearls-field";

type OrderType = "dine_in" | "takeaway" | "delivery";

interface MenuShellProps {
  branchName: string;
  branchSlug: string;
  categories: PublicCategory[];
  todaySuggestion: PublicSuggestion | null;
  bestSellers: PublicBestSeller[];
  table: { id: string; code: string } | null;
}

interface BuilderSelections {
  product: PublicCategory["products"][number];
  selected: Record<string, string[]>;
  note: string;
}

export function MenuShell({
  branchName,
  branchSlug,
  categories,
  todaySuggestion,
  bestSellers,
  table,
}: MenuShellProps) {
  const router = useRouter();
  const toast = useToast();
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id ?? "");
  const [cartOpen, setCartOpen] = useState(false);
  const [builder, setBuilder] = useState<BuilderSelections | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [orderType, setOrderType] = useState<OrderType>(table ? "dine_in" : "takeaway");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [flyPearl, setFlyPearl] = useState<{ top: number; left: number } | null>(null);
  const [upsellItems, setUpsellItems] = useState<PublicProduct[]>([]);

  const {
    cart,
    cartTotal,
    deriveIdempotencyKey,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  } = usePOSCart();

  const selectedCat = categories.find((c) => c.id === selectedCatId) ?? categories[0];

  // ── Pearl-fly-to-cart animation on add ──
  const handleItemAdded = useCallback((e: React.MouseEvent, productId: string) => {
    void productId;
    const card = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setFlyPearl({ top: card.top + card.height / 2, left: card.left + card.width / 2 });
    window.setTimeout(() => setFlyPearl(null), 600);
  }, []);

  // ── Modifier builder (server-side re-validated at submit) ──
  const openBuilder = useCallback((product: PublicCategory["products"][number]) => {
    const selected: Record<string, string[]> = {};
    // Pre-select required single groups' first option to reduce taps.
    for (const g of product.modifierGroups) {
      if (g.type === "single" && g.isRequired && g.modifiers.length > 0) {
        selected[g.id] = [g.modifiers[0].id];
      } else {
        selected[g.id] = [];
      }
    }
    setBuilder({ product, selected, note: "" });
  }, []);

  const toggleOption = useCallback(
    (groupId: string, modId: string, type: "single" | "multi") => {
      if (!builder) return;
      const group = builder.product.modifierGroups.find((g) => g.id === groupId);
      const current = builder.selected[groupId] ?? [];
      let next: string[];

      if (type === "single") {
        next = [modId];
      } else {
        if (current.includes(modId)) {
          next = current.filter((id) => id !== modId);
        } else {
          // Enforce max selections client-side (server re-validates, FR-DM-13).
          if (group?.maxSelections != null && current.length >= group.maxSelections) {
            toast.warning(`الحد الأقصى ${group.maxSelections} اختيارات`);
            return;
          }
          next = [...current, modId];
        }
      }
      setBuilder((b) => (b ? { ...b, selected: { ...b.selected, [groupId]: next } } : b));
    },
    [builder, toast],
  );

  const builderLivePrice = useMemo(() => {
    if (!builder) return 0;
    const deltas: { priceDelta: string }[] = [];
    for (const g of builder.product.modifierGroups) {
      for (const m of g.modifiers) {
        if ((builder.selected[g.id] ?? []).includes(m.id))
          deltas.push({ priceDelta: m.priceDelta });
      }
    }
    return calculateLineTotal(builder.product.basePrice, deltas, 1);
  }, [builder]);

  const builderValid = useMemo(() => {
    if (!builder) return false;
    for (const g of builder.product.modifierGroups) {
      if (g.isRequired && (builder.selected[g.id] ?? []).length === 0) return false;
    }
    return true;
  }, [builder]);

  const confirmBuilder = useCallback(() => {
    if (!builder) return;
    if (!builderValid) {
      toast.error("اختر الخيارات المطلوبة");
      return;
    }
    const mods: Array<{
      id: string;
      nameAr: string;
      name: string;
      priceDelta: string;
    }> = [];
    for (const g of builder.product.modifierGroups) {
      for (const modId of builder.selected[g.id] ?? []) {
        const m = g.modifiers.find((x) => x.id === modId);
        if (m) mods.push({ id: m.id, nameAr: m.nameAr, name: m.name, priceDelta: m.priceDelta });
      }
    }
    addToCart(
      {
        id: builder.product.id,
        nameAr: builder.product.nameAr,
        nameEn: builder.product.nameEn,
        basePrice: builder.product.basePrice,
      },
      mods,
      1,
      builder.note,
    );
    setBuilder(null);
  }, [builder, builderValid, addToCart, toast]);

  // ── Upsell suggestions (cart-aware, FR-DM-16) ──
  useEffect(() => {
    if (!cartOpen || cart.length === 0) return;
    let cancelled = false;
    const allProducts = categories.flatMap((c) => c.products);
    getUpsellSuggestions({
      cartItems: cart.map((item) => ({
        productId: item.productId,
        modifierIds: item.selectedModifiers.map((m) => m.id),
        quantity: item.quantity,
        notes: undefined,
      })),
    }).then((res) => {
      if (cancelled || !res.success) return;
      const picked: PublicProduct[] = [];
      for (const s of res.suggestions) {
        const prod = allProducts.find((p) => p.id === s.productId);
        if (prod && !picked.some((p) => p.id === prod.id)) picked.push(prod);
      }
      setUpsellItems(picked);
    });
    return () => {
      cancelled = true;
    };
  }, [cartOpen, cart, categories]);

  // ── Submit → single POS pipeline (source=DIGITAL_MENU) ──
  const handleSubmit = async () => {
    if (cart.length === 0 || ordering) return;
    if (orderType === "delivery" && !deliveryAddress.trim()) {
      toast.error("أدخل عنوان التوصيل");
      return;
    }
    setOrdering(true);
    const cartItems = cart.map((item) => ({
      productId: item.productId,
      modifierIds: item.selectedModifiers.map((m) => m.id),
      quantity: item.quantity,
      notes: item.notes,
    }));
    const idempotencyKey = await deriveIdempotencyKey(cartItems);
    try {
      const result = await placeDigitalMenuOrder({
        branchSlug,
        cartItems,
        idempotencyKey,
        orderType,
        tableId: orderType === "dine_in" ? table?.id : null,
        deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
      });
      if (result.success) {
        clearCart();
        if (result.deduped) {
          toast.warning("تم إرسال هذا الطلب مسبقًا — يتم عرض الطلب الحالي");
        }
        router.push(
          `/m/${branchSlug}/status/${result.orderId}?accessToken=${encodeURIComponent(result.accessToken)}`,
        );
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("فشل في إتمام الطلب");
    } finally {
      setOrdering(false);
    }
  };

  const formattedTotal = formatPrice(cartTotal);

  return (
    <div className="bg-brand-red-bg flex min-h-dvh flex-col" dir="rtl" lang="ar">
      {/* ── Hero ── */}
      <header className="bg-brand-red relative overflow-hidden px-4 pt-6 pb-8 text-center text-white">
        <PearlsField />
        <div className="relative z-10">
          <Image
            src="/icons/logo-mono.svg"
            alt=""
            width={44}
            height={44}
            className="mx-auto mb-2 h-11 w-auto invert"
          />
          <h1 className="font-heading text-xl font-bold">أهلًا بك في {branchName}</h1>
          <p className="mt-1 text-sm text-white">مشروبك… على مزاجك تمامًا.</p>
          {table && (
            <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              الطاولة {table.code}
            </span>
          )}
        </div>
      </header>

      {/* ── Today's suggestion ── */}
      {todaySuggestion && (
        <section className="relative z-10 -mt-4 px-4">
          <button
            onClick={() => {
              const prod = categories
                .flatMap((c) => c.products)
                .find((p) => p.id === todaySuggestion.productId);
              if (prod) openBuilder(prod);
            }}
            className="bg-brand-red-soft border-brand-red/20 z-10 flex w-full items-center gap-3 rounded-2xl border p-3 text-start shadow-sm"
          >
            <Image
              src={todaySuggestion.imageUrl ?? "/icons/icon-bubbletea.svg"}
              alt=""
              width={52}
              height={52}
              className="h-13 w-13 shrink-0 object-contain"
            />
            <span className="min-w-0 flex-1">
              <span className="text-brand-red-dark text-xs font-bold">اقتراح اليوم</span>
              <span className="font-heading text-brand-ink block truncate text-sm font-semibold">
                {todaySuggestion.titleAr ?? todaySuggestion.nameAr}
              </span>
              {todaySuggestion.descriptionAr && (
                <span className="text-text-secondary block truncate text-xs">
                  {todaySuggestion.descriptionAr}
                </span>
              )}
              <span className="text-brand-red-dark mt-0.5 block text-sm font-bold">
                {formatPrice(toMinorUnits(todaySuggestion.basePrice))} ₪
              </span>
            </span>
          </button>
        </section>
      )}

      {/* ── Best sellers ── */}
      {bestSellers.length > 0 && (
        <section className="mt-4 px-4" aria-label="الأكثر طلبًا">
          <h2 className="font-heading text-brand-ink mb-2 text-sm font-bold">الأكثر طلبًا</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {bestSellers.map((b) => {
              const prod = categories.flatMap((c) => c.products).find((p) => p.id === b.productId);
              if (!prod) return null;
              return (
                <button
                  key={b.productId}
                  onClick={() => openBuilder(prod)}
                  className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-transparent bg-white p-3 text-center shadow-sm"
                >
                  <Image
                    src={prod.imageUrl ?? "/icons/icon-bubbletea.svg"}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 object-contain"
                  />
                  <span className="text-brand-ink max-w-20 truncate text-xs font-medium">
                    {prod.nameAr}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Category tabs ── */}
      <div className="sticky top-0 z-20 mt-4 flex shrink-0 gap-1 overflow-x-auto bg-white/95 px-3 py-2 backdrop-blur-sm">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCatId(cat.id)}
            aria-pressed={cat.id === selectedCatId}
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

      {/* ── Product grid ── */}
      <main className="flex-1 p-3">
        {!selectedCat || selectedCat.products.length === 0 ? (
          <p className="text-text-secondary p-8 text-center">لا توجد منتجات</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {selectedCat.products.map((product) => (
              <button
                key={product.id}
                onClick={(e) => {
                  handleItemAdded(e, product.id);
                  openBuilder(product);
                }}
                className={`border-border-subtle ease-spring flex flex-col items-center rounded-2xl border bg-white p-3 text-center shadow-sm transition-shadow hover:shadow-md ${
                  product.isAvailable ? "" : "opacity-40"
                }`}
              >
                <Image
                  src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                  alt={product.nameAr}
                  width={64}
                  height={64}
                  loading="lazy"
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
      </main>

      {/* ── Flying pearl ── */}
      {flyPearl && (
        <span
          aria-hidden="true"
          className="bg-brand-red pointer-events-none fixed z-50 size-3 animate-[pearl-fly_0.6s_ease_spring] rounded-full"
          style={{ top: flyPearl.top, left: flyPearl.left }}
        />
      )}

      {/* ── Sticky cart bar ── */}
      {cart.length > 0 && (
        <div className="sticky bottom-0 z-20 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-brand-red hover:bg-brand-red/90 ease-spring flex min-h-14 w-full items-center justify-between rounded-full px-6 text-white transition-colors"
          >
            <span className="font-heading text-lg font-bold">
              {`${cart.length} سلعة — ${formattedTotal} ₪`}
            </span>
            <span className="text-sm" aria-hidden="true">
              عرض السلة
            </span>
          </button>
        </div>
      )}

      {/* ── Cart sheet ── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetTitle>سلة مشروبك</SheetTitle>
        <div className="my-3 space-y-3">
          {cart.length === 0 ? (
            <p className="text-text-secondary py-8 text-center">السلة فارغة</p>
          ) : (
            cart.map((item, idx) => (
              <div key={idx} className="border-border-subtle rounded-2xl border p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-brand-ink text-sm font-semibold">{item.productNameAr}</p>
                    {item.selectedModifiers.length > 0 && (
                      <p className="text-text-secondary mt-0.5 text-xs">
                        {item.selectedModifiers.map((m) => m.nameAr).join("، ")}
                      </p>
                    )}
                  </div>
                  <span className="text-brand-red shrink-0 text-sm font-bold">
                    {formatPrice(item.lineTotal)} ₪
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(idx, -1)}
                    aria-label="تقليل الكمية"
                    className="bg-muted flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-bold"
                  >
                    −
                  </button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(idx, 1)}
                    aria-label="زيادة الكمية"
                    className="bg-muted flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm font-bold"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    aria-label="حذف"
                    className="text-text-secondary hover:text-status-error ms-auto flex min-h-11 min-w-11 items-center justify-center rounded-full text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Upsell suggestions inside cart */}
        {upsellItems.length > 0 && (
          <div className="bg-brand-red-soft/60 mb-3 rounded-2xl p-3">
            <p className="text-text-secondary mb-2 text-xs font-semibold">ربما يعجبك أيضًا</p>
            <div className="space-y-2">
              {upsellItems.map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-xl bg-white p-2">
                  <Image
                    src={p.imageUrl ?? "/icons/icon-bubbletea.svg"}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-brand-ink truncate text-xs font-medium">{p.nameAr}</p>
                    <p className="text-brand-red text-xs font-bold">
                      {formatPrice(toMinorUnits(p.basePrice))} ₪
                    </p>
                  </div>
                  <button
                    onClick={() => openBuilder(p)}
                    className="bg-brand-red rounded-full px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    أضف
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order type */}
        <div className="mb-3">
          <p className="text-brand-ink mb-2 text-sm font-medium">نوع الطلب</p>
          <div className="flex gap-2">
            {(table ? ["dine_in", "takeaway", "delivery"] : ["takeaway", "delivery"]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t as OrderType)}
                aria-pressed={orderType === t}
                className={`ease-spring flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  orderType === t
                    ? "bg-brand-red text-white"
                    : "bg-muted text-brand-ink hover:bg-muted/80"
                }`}
              >
                {t === "dine_in" ? "داخل المطعم" : t === "takeaway" ? "استلام سريع" : "توصيل"}
              </button>
            ))}
          </div>
        </div>

        {orderType === "delivery" && (
          <div className="mb-3">
            <label className="text-brand-ink mb-1 block text-sm font-medium" htmlFor="dm-address">
              عنوان التوصيل
            </label>
            <input
              id="dm-address"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="الحي / الشارع / علامة مميزة"
              className="border-border-subtle bg-muted w-full rounded-2xl border px-4 py-2.5 text-sm"
            />
          </div>
        )}

        <div className="mb-2 space-y-2">
          <input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="رقم الجوال (اختياري)"
            className="border-border-subtle bg-muted w-full rounded-full border px-4 py-2 text-sm"
            dir="ltr"
          />
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="الاسم (اختياري)"
            className="border-border-subtle bg-muted w-full rounded-full border px-4 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <SheetClose onClick={() => setCartOpen(false)}>متابعة التسوق</SheetClose>
          <button
            onClick={handleSubmit}
            disabled={ordering || cart.length === 0}
            className="bg-brand-red hover:bg-brand-red/90 ease-spring flex-1 rounded-full py-3 text-sm font-bold text-white transition-colors disabled:opacity-50"
          >
            {ordering ? "جاري الإرسال..." : `أكد الطلب — ${formatPrice(cartTotal)} ₪`}
          </button>
        </div>
      </Sheet>

      {/* ── Modifier builder sheet ── */}
      <Sheet
        open={!!builder}
        onOpenChange={(open) => {
          if (!open) setBuilder(null);
        }}
      >
        {builder && (
          <>
            <SheetTitle>{builder.product.nameAr}</SheetTitle>
            <p aria-live="polite" className="text-brand-red text-lg font-bold">
              {formatPrice(builderLivePrice)} ₪
            </p>

            <div className="my-3 max-h-72 space-y-4 overflow-y-auto">
              {builder.product.modifierGroups.map((group) => {
                const picked = builder.selected[group.id] ?? [];
                return (
                  <div key={group.id}>
                    <p className="text-brand-ink mb-1.5 text-sm font-medium">
                      {group.name}
                      {group.isRequired && (
                        <span className="text-status-error mr-1 text-xs">* مطلوب</span>
                      )}
                      {group.type === "multi" && group.maxSelections != null && (
                        <span className="text-text-secondary mr-1 text-xs">
                          (أقصى {group.maxSelections})
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.modifiers.map((mod) => {
                        const isSel = picked.includes(mod.id);
                        const disabled =
                          group.type === "multi" &&
                          !isSel &&
                          group.maxSelections != null &&
                          picked.length >= group.maxSelections;
                        const price = toMinorUnits(mod.priceDelta);
                        return (
                          <button
                            key={mod.id}
                            onClick={() => toggleOption(group.id, mod.id, group.type)}
                            disabled={disabled}
                            aria-pressed={isSel}
                            className={`ease-spring rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                              isSel
                                ? "border-brand-red bg-brand-red text-white"
                                : "border-border-subtle bg-muted text-brand-ink hover:border-brand-red/50"
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            {mod.nameAr}
                            {price > 0 && ` (+${formatPrice(price)} ₪)`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div>
                <label
                  className="text-brand-ink mb-1 block text-sm font-medium"
                  htmlFor="dm-builder-note"
                >
                  ملاحظات
                </label>
                <input
                  id="dm-builder-note"
                  value={builder.note}
                  onChange={(e) => setBuilder((b) => (b ? { ...b, note: e.target.value } : b))}
                  placeholder="مثال: بدون ثلج من فضلك"
                  maxLength={500}
                  className="border-border-subtle bg-muted w-full rounded-full border px-4 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <SheetClose onClick={() => setBuilder(null)}>إلغاء</SheetClose>
              <button
                onClick={confirmBuilder}
                disabled={!builderValid}
                className="bg-brand-red hover:bg-brand-red/90 ease-spring flex-1 rounded-full py-3 text-sm font-bold text-white transition-colors disabled:opacity-50"
              >
                أضف إلى السلة — {formatPrice(builderLivePrice)} ₪
              </button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  );
}
