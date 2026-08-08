"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Sparkles, ChefHat } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Logo } from "@/components/ui/logo";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
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
      <header className="bg-brand-red relative overflow-hidden px-4 pt-6 pb-12 text-center text-white">
        <PearlsField />
        <div className="relative z-10">
          <div className="mb-3 flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/15 shadow-lg shadow-black/10 backdrop-blur-sm">
              <Logo size="sm" invert />
            </div>
          </div>
          <h1 className="heading-1 text-white">أهلًا بك في {branchName}</h1>
          <p className="body mt-1.5 text-white/85">مشروبك… على مزاجك تمامًا.</p>
          {table && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <ChefHat className="size-3.5" />
              الطاولة {table.code}
            </span>
          )}
        </div>
      </header>

      {/* ── Today's suggestion ── */}
      {todaySuggestion && (
        <section className="relative z-10 -mt-6 px-4">
          <Card
            variant="pop"
            className="ease-spring hover:shadow-pop flex w-full items-center gap-3 border-0 p-3.5 text-start transition-shadow"
          >
            <button
              onClick={() => {
                const prod = categories
                  .flatMap((c) => c.products)
                  .find((p) => p.id === todaySuggestion.productId);
                if (prod) openBuilder(prod);
              }}
              className="flex w-full items-center gap-3 text-start"
            >
              <div className="bg-brand-red-soft flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl">
                <Image
                  src={todaySuggestion.imageUrl ?? "/icons/icon-bubbletea.svg"}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </div>
              <span className="min-w-0 flex-1">
                <span className="text-brand-red-dark flex items-center gap-1 text-[11px] font-bold tracking-wide uppercase">
                  <Sparkles className="size-3" />
                  اقتراح اليوم
                </span>
                <span className="heading-3 text-brand-ink mt-0.5 block truncate text-sm">
                  {todaySuggestion.titleAr ?? todaySuggestion.nameAr}
                </span>
                {todaySuggestion.descriptionAr && (
                  <span className="caption text-text-secondary block truncate">
                    {todaySuggestion.descriptionAr}
                  </span>
                )}
                <span className="text-brand-red-dark numeric mt-0.5 block text-sm font-bold">
                  {formatPrice(toMinorUnits(todaySuggestion.basePrice))} ₪
                </span>
              </span>
            </button>
          </Card>
        </section>
      )}

      {/* ── Best sellers ── */}
      {bestSellers.length > 0 && (
        <section className="mt-5 px-4" aria-label="الأكثر طلبًا">
          <SectionLabel icon={<Sparkles className="size-3.5" />}>الأكثر طلبًا</SectionLabel>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {bestSellers.map((b) => {
              const prod = categories.flatMap((c) => c.products).find((p) => p.id === b.productId);
              if (!prod) return null;
              return (
                <button
                  key={b.productId}
                  onClick={() => openBuilder(prod)}
                  className="ease-spring shadow-card hover:shadow-pop flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center transition-shadow"
                >
                  <div className="bg-brand-red-bg flex h-12 w-12 items-center justify-center rounded-2xl">
                    <Image
                      src={prod.imageUrl ?? "/icons/icon-bubbletea.svg"}
                      alt=""
                      width={40}
                      height={40}
                      className="h-9 w-9 object-contain"
                    />
                  </div>
                  <span className="text-brand-ink w-full truncate text-xs font-medium">
                    {prod.nameAr}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Category tabs ── */}
      <div className="sticky top-0 z-20 mt-5 border-b border-white/30 bg-white/95 backdrop-blur-sm">
        <div className="overflow-x-auto px-3 py-2">
          <Tabs
            value={selectedCatId}
            onValueChange={setSelectedCatId}
            items={categories.map((cat) => ({ value: cat.id, label: cat.nameAr }))}
            size="sm"
            aria-label="فئات المنتجات"
          />
        </div>
      </div>

      {/* ── Product grid ── */}
      <main className="flex-1 p-3">
        {!selectedCat || selectedCat.products.length === 0 ? (
          <EmptyState title="لا توجد منتجات" description="عُد لاحقًا، القائمة تتجدد باستمرار." />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {selectedCat.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={(e) => {
                  handleItemAdded(e, product.id);
                  openBuilder(product);
                }}
              />
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
        <div className="sticky bottom-0 z-20 border-t border-white/30 bg-white/95 px-4 py-3 backdrop-blur-sm">
          <button
            onClick={() => setCartOpen(true)}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex min-h-14 w-full items-center justify-between gap-3 rounded-full px-6 text-white shadow-lg transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/20 px-2 text-sm font-bold tabular-nums">
                {cart.length}
              </span>
              <span className="body-sm text-white/85">سلعة</span>
            </span>
            <span className="heading-3 text-white">{`${formattedTotal} ₪`}</span>
            <span className="body-sm flex items-center gap-1 font-semibold text-white/95">
              عرض السلة
            </span>
          </button>
        </div>
      )}

      {/* ── Cart sheet ── */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetTitle>سلة مشروبك</SheetTitle>
        <p className="body-sm text-text-secondary -mt-3 mb-4">
          {cart.length === 0 ? "ابدأ بإضافة مشروبك المفضّل" : `${cart.length} سلعة في سلتك`}
        </p>
        <div className="my-3 space-y-3">
          {cart.length === 0 ? (
            <EmptyState title="السلة فارغة" description="تصفّح القائمة وأضف ما يعجبك." />
          ) : (
            cart.map((item, idx) => (
              <Card key={idx} variant="flat" className="p-3">
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
                    aria-label="تقليل الكمية"
                    className="bg-muted hover:bg-muted/80 flex size-10 items-center justify-center rounded-full text-sm font-bold transition-colors"
                  >
                    −
                  </button>
                  <span
                    aria-live="polite"
                    className="numeric w-6 text-center text-sm font-semibold"
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(idx, 1)}
                    aria-label="زيادة الكمية"
                    className="bg-muted hover:bg-muted/80 flex size-10 items-center justify-center rounded-full text-sm font-bold transition-colors"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeItem(idx)}
                    aria-label="حذف"
                    className="text-text-secondary hover:bg-status-error/10 hover:text-status-error ms-auto flex size-10 items-center justify-center rounded-full text-xs transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Upsell suggestions inside cart */}
        {upsellItems.length > 0 && (
          <Card variant="muted" className="mb-3 gap-0 p-3">
            <p className="text-text-secondary mb-2 text-xs font-semibold">ربما يعجبك أيضًا</p>
            <div className="space-y-2">
              {upsellItems.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl bg-white p-2.5">
                  <Image
                    src={p.imageUrl ?? "/icons/icon-bubbletea.svg"}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-brand-ink truncate text-xs font-medium">{p.nameAr}</p>
                    <p className="text-brand-red numeric text-xs font-bold">
                      {formatPrice(toMinorUnits(p.basePrice))} ₪
                    </p>
                  </div>
                  <button
                    onClick={() => openBuilder(p)}
                    className="bg-brand-red hover:bg-brand-red-dark min-h-10 rounded-full px-4 text-sm font-semibold text-white transition-colors"
                  >
                    أضف
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Order type */}
        <div className="mb-4">
          <p className="label text-brand-ink mb-2">نوع الطلب</p>
          <Tabs
            value={orderType}
            onValueChange={(v) => setOrderType(v as OrderType)}
            size="sm"
            items={[
              ...(table ? [{ value: "dine_in" as const, label: "داخل المطعم" }] : []),
              { value: "takeaway" as const, label: "استلام سريع" },
              { value: "delivery" as const, label: "توصيل" },
            ]}
          />
        </div>

        {orderType === "delivery" && (
          <div className="mb-3">
            <FormField label="عنوان التوصيل" required className="mb-3">
              <Input
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="الحي / الشارع / علامة مميزة"
              />
            </FormField>
          </div>
        )}

        <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="رقم الجوال (اختياري)"
            dir="ltr"
          />
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="الاسم (اختياري)"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <SheetClose onClick={() => setCartOpen(false)}>متابعة التسوق</SheetClose>
          <button
            onClick={handleSubmit}
            disabled={ordering || cart.length === 0}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex-1 rounded-full py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50"
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
            <p aria-live="polite" className="text-brand-red numeric -mt-2 mb-4 text-2xl font-bold">
              {formatPrice(builderLivePrice)} ₪
            </p>

            <div className="my-3 max-h-72 space-y-5 overflow-y-auto pe-1">
              {builder.product.modifierGroups.map((group) => {
                const picked = builder.selected[group.id] ?? [];
                return (
                  <div key={group.id}>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="heading-3 text-brand-ink text-sm">{group.name}</p>
                      {group.isRequired && (
                        <span className="text-status-error text-[10px] font-semibold tracking-wider uppercase">
                          مطلوب
                        </span>
                      )}
                      {group.type === "multi" && group.maxSelections != null && (
                        <span className="caption text-text-secondary">
                          · أقصى {group.maxSelections}
                        </span>
                      )}
                    </div>
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
                            className={`ease-spring rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                              isSel
                                ? "border-brand-red bg-brand-red shadow-brand-red/20 text-white shadow-sm"
                                : "border-border-subtle bg-muted text-brand-ink hover:border-brand-red/40"
                            } disabled:cursor-not-allowed disabled:opacity-40`}
                          >
                            {mod.nameAr}
                            {price > 0 && (
                              <span className={isSel ? "text-white/85" : "text-text-secondary"}>
                                {" "}
                                +{formatPrice(price)} ₪
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <FormField label="ملاحظات" hint="مثال: بدون ثلج من فضلك">
                <Input
                  value={builder.note}
                  onChange={(e) => setBuilder((b) => (b ? { ...b, note: e.target.value } : b))}
                  placeholder="أي تخصيص تريده للمشروب…"
                  maxLength={500}
                />
              </FormField>
            </div>

            <div className="flex gap-2 pt-2">
              <SheetClose onClick={() => setBuilder(null)}>إلغاء</SheetClose>
              <button
                onClick={confirmBuilder}
                disabled={!builderValid}
                className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex-1 rounded-full py-3 text-sm font-bold text-white shadow-md transition-all disabled:opacity-50"
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

/* ── Internal helpers ───────────────────────────────────────────────────── */

function SectionLabel({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h2 className="text-brand-red-dark flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase">
      {icon}
      {children}
    </h2>
  );
}

function ProductCard({
  product,
  onSelect,
}: {
  product: PublicCategory["products"][number];
  onSelect: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onSelect}
      disabled={!product.isAvailable}
      className={`ease-spring shadow-card hover:shadow-pop flex flex-col items-center rounded-2xl bg-white p-3 text-center transition-all hover:-translate-y-0.5 disabled:opacity-40 ${
        product.isAvailable ? "cursor-pointer" : "cursor-not-allowed"
      }`}
    >
      <div className="bg-brand-red-bg mb-2.5 flex h-16 w-16 items-center justify-center rounded-2xl">
        <Image
          src={product.imageUrl ?? "/icons/icon-bubbletea.svg"}
          alt={product.nameAr}
          width={56}
          height={56}
          loading="lazy"
          className="h-12 w-12 object-contain"
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
