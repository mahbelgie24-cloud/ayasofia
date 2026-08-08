"use client";

import { useState, useEffect } from "react";
import { Plus, Edit3, Trash2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { toMinorUnits } from "@/lib/pricing";
import {
  getFullMenuForAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  toggleProductAvailable,
  updateModifier,
  saveRecipe,
  deleteRecipe,
} from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

type FullMenu = Awaited<ReturnType<typeof getFullMenuForAdmin>>;

export function MenuShell() {
  const [menu, setMenu] = useState<FullMenu | null>(null);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [editCat, setEditCat] = useState<{
    id: string;
    nameAr: string;
    nameEn: string;
    sortOrder: number;
  } | null>(null);
  const [newCat, setNewCat] = useState(false);
  const [editProduct, setEditProduct] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<string | null>(null);
  const [recipeProduct, setRecipeProduct] = useState<string | null>(null);
  const [modifierIngredientTarget, setModifierIngredientTarget] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setMenu(await getFullMenuForAdmin());
    } catch {
      /* */
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  const showMsg = (m: string, ok = true) => {
    setSuccess(ok);
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  if (!menu) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="إدارة القائمة" title="الفئات والمنتجات" />
        <Card variant="default" className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="إدارة القائمة"
        title="الفئات والمنتجات"
        subtitle="أضف الفئات، عدّل الأسعار والمُعدِّلات، وأدِر الوصفات المرتبطة بالمخزون."
        actions={
          <button
            onClick={() => setNewCat(true)}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all"
          >
            <Plus className="size-4" />
            <span>فئة جديدة</span>
          </button>
        }
      />

      {msg && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            success
              ? "border-status-success/30 bg-status-success/[0.08] text-status-success"
              : "border-status-warning/30 bg-status-warning/[0.08] text-status-warning"
          }`}
        >
          {msg}
        </div>
      )}

      {/* ── Categories ── */}
      <section className="space-y-4">
        {newCat && (
          <CategoryForm
            onSave={async (data) => {
              const r = await createCategory(data);
              if (r.success) {
                setNewCat(false);
                refresh();
                showMsg("تمت الإضافة");
              } else showMsg(r.error ?? "فشل", false);
            }}
            onCancel={() => setNewCat(false)}
          />
        )}

        {editCat && (
          <CategoryForm
            initial={editCat}
            onSave={async (data) => {
              const r = await updateCategory({ id: editCat.id, ...data });
              if (r.success) {
                setEditCat(null);
                refresh();
                showMsg("تم التحديث");
              } else showMsg(r.error ?? "فشل", false);
            }}
            onCancel={() => setEditCat(null)}
          />
        )}

        {menu.categories.map((cat) => (
          <Card key={cat.id} variant="default" className="overflow-hidden p-0">
            <div className="border-border-subtle bg-brand-cream/40 flex items-center justify-between border-b px-4 py-3">
              <div>
                <h3 className="heading-3 text-brand-ink">{cat.nameAr}</h3>
                <p className="caption text-text-secondary">
                  {cat.nameEn} · ترتيب: {cat.sortOrder}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    setEditCat({
                      id: cat.id,
                      nameAr: cat.nameAr,
                      nameEn: cat.nameEn,
                      sortOrder: cat.sortOrder,
                    })
                  }
                  className="text-text-secondary hover:bg-card flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors"
                >
                  <Edit3 className="size-3.5" />
                  <span>تعديل</span>
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`حذف فئة "${cat.nameAr}"؟`)) return;
                    const r = await deleteCategory(cat.id);
                    if (r.success) {
                      refresh();
                      showMsg("تم الحذف");
                    } else showMsg(r.error ?? "فشل", false);
                  }}
                  className="text-status-error hover:bg-status-error/[0.08] flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  <span>حذف</span>
                </button>
              </div>
            </div>

            {/* Products */}
            <div className="divide-border-subtle/60 divide-y">
              {cat.products.map((prod) => {
                const isExpanded = expandedProduct === prod.id;
                return (
                  <div key={prod.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-brand-ink truncate text-sm font-semibold">
                            {prod.nameAr}
                          </p>
                          <span className="text-text-secondary numeric text-xs">
                            {prod.basePrice} ₪
                          </span>
                          {!prod.isAvailable && (
                            <span className="bg-status-error/[0.12] text-status-error rounded-full px-2 py-0.5 text-[10px] font-semibold">
                              غير متاح
                            </span>
                          )}
                          {prod.recipes.length === 0 && (
                            <span className="text-status-warning inline-flex items-center gap-1 text-[10px] font-semibold">
                              <AlertTriangle className="size-3" />
                              لا وصفة
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          role="switch"
                          aria-checked={prod.isAvailable}
                          aria-label={prod.isAvailable ? "إيقاف البيع" : "تفعيل البيع"}
                          onClick={async () => {
                            await toggleProductAvailable(prod.id, !prod.isAvailable);
                            refresh();
                          }}
                          className={`ease-spring relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                            prod.isAvailable ? "bg-status-success" : "bg-status-error/40"
                          }`}
                        >
                          <span
                            className={`inline-block size-4 rounded-full bg-white shadow-sm transition-transform ${
                              prod.isAvailable ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <button
                          onClick={() => setExpandedProduct(isExpanded ? null : prod.id)}
                          className="text-text-secondary hover:bg-brand-cream/60 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors"
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="size-3.5" />
                              <span>إخفاء</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="size-3.5" />
                              <span>تفاصيل</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => setEditProduct(prod.id)}
                          className="text-text-secondary hover:bg-brand-cream/60 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors"
                        >
                          <Edit3 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {editProduct === prod.id && (
                      <div className="mt-3">
                        <ProductEditForm
                          product={prod}
                          categories={menu.categories}
                          onSave={async (data) => {
                            const r = await updateProduct({ id: prod.id, ...data });
                            if (r.success) {
                              setEditProduct(null);
                              refresh();
                              showMsg("تم التحديث");
                            } else showMsg(r.error ?? "فشل", false);
                          }}
                          onCancel={() => setEditProduct(null)}
                        />
                      </div>
                    )}

                    {isExpanded && (
                      <div className="mt-4 space-y-4 border-t pt-4">
                        {/* Modifier Groups */}
                        <div>
                          <h4 className="text-text-secondary caption mb-2 tracking-wider uppercase">
                            المُعدِّلات
                          </h4>
                          <div className="space-y-2">
                            {prod.modifierGroups.map((mg) => (
                              <div key={mg.id} className="bg-brand-cream/40 rounded-xl p-2.5">
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-brand-ink font-semibold">{mg.name}</span>
                                  <span className="text-text-secondary">
                                    ({mg.type === "single" ? "اختيار واحد" : "متعدد"})
                                  </span>
                                  {mg.type === "multi" && mg.maxSelections != null && (
                                    <span className="text-text-secondary">
                                      · أقصى {mg.maxSelections}
                                    </span>
                                  )}
                                  {mg.isRequired && <span className="text-status-error">*</span>}
                                </div>
                                <ul className="mt-1.5 space-y-1">
                                  {mg.modifiers.map((m) => (
                                    <li
                                      key={m.id}
                                      className="border-border-subtle bg-card flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
                                    >
                                      <span className="text-brand-ink font-medium">{m.nameAr}</span>
                                      {toMinorUnits(m.priceDelta) > 0 && (
                                        <span className="text-text-secondary">
                                          (+{m.priceDelta} ₪)
                                        </span>
                                      )}
                                      <span className="ms-auto flex items-center gap-2">
                                        {m.ingredientId ? (
                                          <span className="text-text-secondary">
                                            {menu.ingredients.find((i) => i.id === m.ingredientId)
                                              ?.name ?? "مكوّن"}
                                            : {m.ingredientQty}
                                          </span>
                                        ) : (
                                          <span className="text-text-secondary/60">بدون مخزون</span>
                                        )}
                                        <button
                                          onClick={() => setModifierIngredientTarget(m.id)}
                                          className="text-brand-red hover:underline"
                                        >
                                          {m.ingredientId ? "تعديل" : "+ مكوّن"}
                                        </button>
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                                {modifierIngredientTarget && (
                                  <div className="mt-2">
                                    <ModifierIngredientForm
                                      ingredients={menu.ingredients}
                                      modifierId={modifierIngredientTarget}
                                      onSave={async (data) => {
                                        const r = await updateModifier({
                                          id: modifierIngredientTarget,
                                          ...data,
                                        });
                                        setModifierIngredientTarget(null);
                                        refresh();
                                        showMsg(r.success ? "تم" : (r.error ?? "فشل"), r.success);
                                      }}
                                      onClear={async () => {
                                        await updateModifier({
                                          id: modifierIngredientTarget,
                                          clearIngredient: true,
                                        });
                                        setModifierIngredientTarget(null);
                                        refresh();
                                        showMsg("تم إزالة الربط");
                                      }}
                                      onCancel={() => setModifierIngredientTarget(null)}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Recipes */}
                        <div>
                          <h4 className="text-text-secondary caption mb-2 tracking-wider uppercase">
                            الوصفة
                          </h4>
                          {prod.recipes.length === 0 && (
                            <p className="text-status-warning text-xs">
                              لا توجد وصفة — المبيعات لا تخصم من المخزون
                            </p>
                          )}
                          <ul className="space-y-1">
                            {prod.recipes.map((rec) => (
                              <li
                                key={rec.ingredientId}
                                className="border-border-subtle bg-card flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs"
                              >
                                <span className="text-brand-ink">
                                  {rec.ingredientName}:{" "}
                                  <span className="numeric font-medium">{rec.quantityUsed}</span>
                                </span>
                                <button
                                  onClick={async () => {
                                    await deleteRecipe(prod.id, rec.ingredientId);
                                    refresh();
                                  }}
                                  className="text-status-error text-xs hover:underline"
                                >
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                          <button
                            onClick={() => setRecipeProduct(prod.id)}
                            className="text-brand-red mt-2 text-xs font-medium hover:underline"
                          >
                            + إضافة مكوّن
                          </button>
                          {recipeProduct === prod.id && (
                            <div className="mt-2">
                              <RecipeForm
                                ingredients={menu.ingredients}
                                onSave={async (data) => {
                                  const r = await saveRecipe({ productId: prod.id, ...data });
                                  if (r.success) {
                                    setRecipeProduct(null);
                                    refresh();
                                    showMsg("تم");
                                  } else showMsg(r.error ?? "فشل", false);
                                }}
                                onCancel={() => setRecipeProduct(null)}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {newProduct === cat.id ? (
                <div className="px-4 py-3">
                  <ProductCreateForm
                    categories={menu.categories}
                    defaultCategoryId={cat.id}
                    onSave={async (data) => {
                      const r = await createProduct({ ...data, categoryId: cat.id });
                      if (r.success) {
                        setNewProduct(null);
                        refresh();
                        showMsg("تمت الإضافة");
                      } else showMsg(r.error ?? "فشل", false);
                    }}
                    onCancel={() => setNewProduct(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setNewProduct(cat.id)}
                  className="text-text-secondary hover:bg-brand-cream/40 hover:text-brand-ink border-border-subtle mx-4 my-2 flex w-[calc(100%-2rem)] items-center justify-center gap-1.5 rounded-xl border border-dashed py-2.5 text-xs font-medium transition-colors"
                >
                  <Plus className="size-3.5" />
                  <span>منتج جديد</span>
                </button>
              )}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}

// ── Sub-components ──

function CategoryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { nameAr: string; nameEn: string; sortOrder: number };
  onSave: (data: { nameAr: string; nameEn: string; sortOrder: number }) => void;
  onCancel: () => void;
}) {
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [nameEn, setNameEn] = useState(initial?.nameEn ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  return (
    <Card variant="pop" className="max-w-2xl">
      <div className="space-y-3 p-5">
        <input
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder="الاسم العربي"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="الاسم الإنجليزي"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          placeholder="الترتيب"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={() => onSave({ nameAr, nameEn, sortOrder })}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/20 flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all"
          >
            حفظ
          </button>
        </div>
      </div>
    </Card>
  );
}

function ProductEditForm({
  product,
  categories,
  onSave,
  onCancel,
}: {
  product: {
    id: string;
    nameAr: string;
    nameEn: string;
    basePrice: string;
    imageUrl: string | null;
    isAvailable: boolean;
    trackInventory: boolean;
  };
  categories: FullMenu["categories"];
  onSave: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [nameAr, setNameAr] = useState(product.nameAr);
  const [nameEn, setNameEn] = useState(product.nameEn);
  const [basePrice, setBasePrice] = useState(product.basePrice);
  const [catId, setCatId] = useState("");
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [trackInventory, setTrackInventory] = useState(product.trackInventory);
  return (
    <Card variant="flat" className="space-y-2 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder="الاسم العربي"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="الاسم الإنجليزي"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          type="number"
          step="0.01"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          placeholder="السعر"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <select
          value={catId}
          onChange={(e) => setCatId(e.target.value)}
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        >
          <option value="">الفئة (بدون تغيير)</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameAr}
            </option>
          ))}
        </select>
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="رابط الصورة"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3 sm:col-span-2"
        />
      </div>
      <label className="text-text-secondary flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => setTrackInventory(e.target.checked)}
          className="accent-brand-red size-4"
        />
        تتبع المخزون
      </label>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={() => {
            const data: Record<string, unknown> = {};
            if (nameAr !== product.nameAr) data.nameAr = nameAr;
            if (nameEn !== product.nameEn) data.nameEn = nameEn;
            if (basePrice !== product.basePrice) data.basePrice = basePrice;
            if (catId) data.categoryId = catId;
            if (imageUrl !== (product.imageUrl ?? "")) data.imageUrl = imageUrl;
            if (trackInventory !== product.trackInventory) data.trackInventory = trackInventory;
            onSave(data);
          }}
          className="bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20 flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
        >
          حفظ
        </button>
      </div>
    </Card>
  );
}

function ProductCreateForm({
  onSave,
  onCancel,
}: {
  categories: FullMenu["categories"];
  defaultCategoryId: string;
  onSave: (data: {
    nameAr: string;
    nameEn: string;
    basePrice: string;
    imageUrl?: string;
    trackInventory: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card variant="flat" className="space-y-2 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder="الاسم العربي"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="الاسم الإنجليزي"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          type="number"
          step="0.01"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          placeholder="السعر"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
        <input
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="رابط الصورة (اختياري)"
          dir="ltr"
          className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-sm transition-colors outline-none focus:ring-3"
        />
      </div>
      <label className="text-text-secondary flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => setTrackInventory(e.target.checked)}
          className="accent-brand-red size-4"
        />
        تتبع المخزون
      </label>
      {error && (
        <p role="alert" className="text-status-error text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={() => {
            setError(null);
            const price = basePrice.trim();
            if (!nameAr || !nameEn || price === "") {
              setError("الاسم بالعربية والإنجليزية والسعر مطلوبة");
              return;
            }
            onSave({
              nameAr,
              nameEn,
              basePrice: price,
              imageUrl: imageUrl || undefined,
              trackInventory,
            });
          }}
          className="bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20 flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
        >
          إضافة
        </button>
      </div>
    </Card>
  );
}

function ModifierIngredientForm({
  ingredients,
  modifierId,
  onSave,
  onClear,
  onCancel,
}: {
  ingredients: Array<{ id: string; name: string; unit: string }>;
  modifierId: string;
  onSave: (data: { ingredientId: string; ingredientQty: string }) => void;
  onClear: () => void;
  onCancel: () => void;
}) {
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? "");
  const [qty, setQty] = useState("");
  return (
    <div className="bg-brand-cream/40 space-y-1.5 rounded-xl p-2.5">
      <select
        value={ingId}
        onChange={(e) => setIngId(e.target.value)}
        className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-xs transition-colors outline-none focus:ring-3"
      >
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.unit})
          </option>
        ))}
      </select>
      <input
        type="number"
        min="0"
        step="0.01"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="الكمية لكل حصة"
        dir="ltr"
        className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-xs transition-colors outline-none focus:ring-3"
      />
      <div className="flex gap-1.5 pt-1">
        <button
          onClick={() => {
            const n = qty.trim();
            if (!ingId || n === "") return;
            onSave({ ingredientId: ingId, ingredientQty: n });
          }}
          className="bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20 flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
        >
          حفظ
        </button>
        {modifierId && (
          <button
            onClick={onClear}
            className="text-status-error border-status-error/30 hover:bg-status-error/[0.08] rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            إزالة
          </button>
        )}
        <button
          onClick={onCancel}
          className="text-text-secondary border-border-subtle hover:bg-muted rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

function RecipeForm({
  ingredients,
  onSave,
  onCancel,
}: {
  ingredients: Array<{ id: string; name: string; unit: string }>;
  onSave: (data: { ingredientId: string; quantityUsed: string }) => void;
  onCancel: () => void;
}) {
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? "");
  const [qty, setQty] = useState("");
  return (
    <div className="bg-brand-cream/40 space-y-1.5 rounded-xl p-2.5">
      <select
        value={ingId}
        onChange={(e) => setIngId(e.target.value)}
        className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-xs transition-colors outline-none focus:ring-3"
      >
        {ingredients.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} ({i.unit})
          </option>
        ))}
      </select>
      <input
        type="number"
        step="0.01"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        placeholder="الكمية"
        dir="ltr"
        className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-xl border bg-white px-3 py-1.5 text-xs transition-colors outline-none focus:ring-3"
      />
      <div className="flex gap-1.5 pt-1">
        <button
          onClick={() => {
            const n = qty.trim();
            if (!ingId || n === "") return;
            onSave({ ingredientId: ingId, quantityUsed: n });
          }}
          className="bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20 flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all"
        >
          حفظ
        </button>
        <button
          onClick={onCancel}
          className="text-text-secondary border-border-subtle hover:bg-muted rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
