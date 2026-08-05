"use client";

import { useState, useEffect } from "react";
import {
  getFullMenuForAdmin,
  createCategory,
  updateCategory,
  deleteCategory,
  createProduct,
  updateProduct,
  toggleProductAvailable,
  saveRecipe,
  deleteRecipe,
} from "./actions";

type FullMenu = Awaited<ReturnType<typeof getFullMenuForAdmin>>;

export function MenuShell() {
  const [menu, setMenu] = useState<FullMenu | null>(null);
  const [msg, setMsg] = useState("");
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

  const showMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  if (!menu) return <p className="text-text-secondary p-6">جاري التحميل...</p>;

  return (
    <div dir="rtl" lang="ar">
      <h1 className="font-heading text-brand-ink text-2xl font-bold">إدارة القائمة</h1>
      {msg && <p className="text-status-warning mt-2 text-sm">{msg}</p>}

      {/* ── Categories ── */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">الفئات</h2>
          <button
            onClick={() => setNewCat(true)}
            className="bg-brand-red rounded-full px-3 py-1 text-xs font-medium text-white"
          >
            + فئة جديدة
          </button>
        </div>

        {newCat && (
          <CategoryForm
            onSave={async (data) => {
              const r = await createCategory(data);
              if (r.success) {
                setNewCat(false);
                refresh();
                showMsg("تمت الإضافة");
              } else showMsg(r.error ?? "فشل");
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
              } else showMsg(r.error ?? "فشل");
            }}
            onCancel={() => setEditCat(null)}
          />
        )}

        <div className="mt-2 space-y-2">
          {menu.categories.map((cat) => (
            <div key={cat.id} className="border-border-subtle rounded-xl border bg-white p-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{cat.nameAr}</span>
                  <span className="text-text-secondary mr-2 text-xs">({cat.nameEn})</span>
                  <span className="text-text-secondary mr-2 text-xs">ترتيب: {cat.sortOrder}</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() =>
                      setEditCat({
                        id: cat.id,
                        nameAr: cat.nameAr,
                        nameEn: cat.nameEn,
                        sortOrder: cat.sortOrder,
                      })
                    }
                    className="text-text-secondary hover:bg-muted rounded px-2 py-0.5 text-xs"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={async () => {
                      const r = await deleteCategory(cat.id);
                      if (r.success) {
                        refresh();
                        showMsg("تم الحذف");
                      } else showMsg(r.error ?? "فشل");
                    }}
                    className="text-status-error hover:bg-status-error/10 rounded px-2 py-0.5 text-xs"
                  >
                    حذف
                  </button>
                </div>
              </div>

              {/* Products under this category */}
              <div className="mt-3 space-y-2">
                {cat.products.map((prod) => (
                  <div key={prod.id} className="border-border-subtle/50 rounded-lg border p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{prod.nameAr}</span>
                        <span className="text-text-secondary mr-1 text-xs">{prod.basePrice} ₪</span>
                        {!prod.isAvailable && (
                          <span className="bg-status-error/10 text-status-error mr-1 rounded-full px-2 py-0.5 text-xs">
                            غير متاح
                          </span>
                        )}
                        {prod.recipes.length === 0 && (
                          <span className="text-status-warning mr-1 text-xs">⚠ لا وصفة</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          role="switch"
                          aria-checked={prod.isAvailable}
                          aria-label={prod.isAvailable ? "تحديد كمتاح" : "تحديد كغير متاح"}
                          onClick={async () => {
                            await toggleProductAvailable(prod.id, !prod.isAvailable);
                            refresh();
                          }}
                          className={`ease-spring relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                            prod.isAvailable ? "bg-status-success" : "bg-status-error/40"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              prod.isAvailable ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <button
                          onClick={() =>
                            setExpandedProduct(expandedProduct === prod.id ? null : prod.id)
                          }
                          className="text-text-secondary hover:bg-muted rounded px-2 py-0.5 text-xs"
                        >
                          {expandedProduct === prod.id ? "▲" : "تفاصيل ▼"}
                        </button>
                        <button
                          onClick={() => setEditProduct(prod.id)}
                          className="text-text-secondary hover:bg-muted rounded px-2 py-0.5 text-xs"
                        >
                          تعديل
                        </button>
                      </div>
                    </div>

                    {editProduct === prod.id && (
                      <ProductEditForm
                        product={prod}
                        categories={menu.categories}
                        onSave={async (data) => {
                          const r = await updateProduct({ id: prod.id, ...data });
                          if (r.success) {
                            setEditProduct(null);
                            refresh();
                            showMsg("تم التحديث");
                          } else showMsg(r.error ?? "فشل");
                        }}
                        onCancel={() => setEditProduct(null)}
                      />
                    )}

                    {expandedProduct === prod.id && (
                      <div className="mt-3 space-y-3 border-t pt-3">
                        {/* Modifier Groups */}
                        <div>
                          <h4 className="text-xs font-semibold">المُعدِّلات</h4>
                          {prod.modifierGroups.map((mg) => (
                            <div key={mg.id} className="mt-1 flex items-center gap-1 text-xs">
                              <span className="font-medium">{mg.name}</span>
                              <span className="text-text-secondary">
                                ({mg.type === "single" ? "اختيار واحد" : "متعدد"})
                              </span>
                              {mg.isRequired && <span className="text-status-error">*</span>}
                              <span className="text-text-secondary mr-auto">
                                {mg.modifiers.map((m) => m.nameAr).join("، ")}
                              </span>
                            </div>
                          ))}
                        </div>
                        {/* Recipes */}
                        <div>
                          <h4 className="text-xs font-semibold">الوصفة</h4>
                          {prod.recipes.length === 0 && (
                            <p className="text-status-warning text-xs">
                              لا توجد وصفة — المبيعات لا تخصم من المخزون
                            </p>
                          )}
                          {prod.recipes.map((rec) => (
                            <div
                              key={rec.ingredientId}
                              className="flex items-center justify-between text-xs"
                            >
                              <span>
                                {rec.ingredientName}: {rec.quantityUsed}
                              </span>
                              <button
                                onClick={async () => {
                                  await deleteRecipe(prod.id, rec.ingredientId);
                                  refresh();
                                }}
                                className="text-status-error text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setRecipeProduct(prod.id)}
                            className="text-brand-red mt-1 text-xs hover:underline"
                          >
                            + إضافة مكون
                          </button>
                          {recipeProduct === prod.id && (
                            <RecipeForm
                              ingredients={menu.ingredients}
                              onSave={async (data) => {
                                const r = await saveRecipe({ productId: prod.id, ...data });
                                if (r.success) {
                                  setRecipeProduct(null);
                                  refresh();
                                  showMsg("تم");
                                } else showMsg(r.error ?? "فشل");
                              }}
                              onCancel={() => setRecipeProduct(null)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* New product button */}
                {newProduct === cat.id ? (
                  <ProductCreateForm
                    categories={menu.categories}
                    defaultCategoryId={cat.id}
                    onSave={async (data) => {
                      const r = await createProduct({ ...data, categoryId: cat.id });
                      if (r.success) {
                        setNewProduct(null);
                        refresh();
                        showMsg("تمت الإضافة");
                      } else showMsg(r.error ?? "فشل");
                    }}
                    onCancel={() => setNewProduct(null)}
                  />
                ) : (
                  <button
                    onClick={() => setNewProduct(cat.id)}
                    className="text-text-secondary hover:bg-muted/50 w-full rounded-lg border border-dashed py-2 text-xs"
                  >
                    + منتج جديد
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
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
    <div className="border-border-subtle mt-2 rounded-lg border p-3">
      <input
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        placeholder="الاسم العربي"
        className="border-border-subtle mb-2 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        placeholder="الاسم الإنجليزي"
        className="border-border-subtle mb-2 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        type="number"
        value={sortOrder}
        onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
        placeholder="الترتيب"
        className="border-border-subtle mb-2 w-full rounded border px-2 py-1 text-sm"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ nameAr, nameEn, sortOrder })}
          className="bg-brand-red rounded-full px-3 py-1 text-xs text-white"
        >
          حفظ
        </button>
        <button
          onClick={onCancel}
          className="text-text-secondary rounded-full border px-3 py-1 text-xs"
        >
          إلغاء
        </button>
      </div>
    </div>
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
    <div className="border-border-subtle mt-2 rounded-lg border p-3">
      <input
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        placeholder="الاسم العربي"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        placeholder="الاسم الإنجليزي"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        type="number"
        step="0.01"
        value={basePrice}
        onChange={(e) => setBasePrice(e.target.value)}
        placeholder="السعر"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <select
        value={catId}
        onChange={(e) => setCatId(e.target.value)}
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
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
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => setTrackInventory(e.target.checked)}
        />
        تتبع المخزون
      </label>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            const data: Record<string, unknown> = {};
            if (nameAr !== product.nameAr) data.nameAr = nameAr;
            if (nameEn !== product.nameEn) data.nameEn = nameEn;
            if (basePrice !== product.basePrice) data.basePrice = parseFloat(basePrice);
            if (catId) data.categoryId = catId;
            if (imageUrl !== (product.imageUrl ?? "")) data.imageUrl = imageUrl;
            if (trackInventory !== product.trackInventory) data.trackInventory = trackInventory;
            onSave(data);
          }}
          className="bg-brand-red rounded-full px-3 py-1 text-xs text-white"
        >
          حفظ
        </button>
        <button
          onClick={onCancel}
          className="text-text-secondary rounded-full border px-3 py-1 text-xs"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

function ProductCreateForm({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  categories,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  defaultCategoryId,
  onSave,
  onCancel,
}: {
  categories: FullMenu["categories"];
  defaultCategoryId: string;
  onSave: (data: {
    nameAr: string;
    nameEn: string;
    basePrice: number;
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
  return (
    <div className="border-border-subtle mt-2 rounded-lg border p-3">
      <input
        value={nameAr}
        onChange={(e) => setNameAr(e.target.value)}
        placeholder="الاسم العربي"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        value={nameEn}
        onChange={(e) => setNameEn(e.target.value)}
        placeholder="الاسم الإنجليزي"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        type="number"
        step="0.01"
        value={basePrice}
        onChange={(e) => setBasePrice(e.target.value)}
        placeholder="السعر"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="رابط الصورة (اختياري)"
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-sm"
      />
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={trackInventory}
          onChange={(e) => setTrackInventory(e.target.checked)}
        />
        تتبع المخزون
      </label>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => {
            const price = parseFloat(basePrice);
            if (!nameAr || !nameEn || isNaN(price) || price <= 0) return;
            onSave({
              nameAr,
              nameEn,
              basePrice: price,
              imageUrl: imageUrl || undefined,
              trackInventory,
            });
          }}
          className="bg-brand-red rounded-full px-3 py-1 text-xs text-white"
        >
          إضافة
        </button>
        <button
          onClick={onCancel}
          className="text-text-secondary rounded-full border px-3 py-1 text-xs"
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
  onSave: (data: { ingredientId: string; quantityUsed: number }) => void;
  onCancel: () => void;
}) {
  const [ingId, setIngId] = useState(ingredients[0]?.id ?? "");
  const [qty, setQty] = useState("");
  return (
    <div className="border-border-subtle mt-1 rounded border p-2">
      <select
        value={ingId}
        onChange={(e) => setIngId(e.target.value)}
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-xs"
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
        className="border-border-subtle mb-1 w-full rounded border px-2 py-1 text-xs"
      />
      <div className="flex gap-1">
        <button
          onClick={() => {
            const n = parseFloat(qty);
            if (!ingId || isNaN(n) || n <= 0) return;
            onSave({ ingredientId: ingId, quantityUsed: n });
          }}
          className="bg-brand-red rounded-full px-2 py-0.5 text-xs text-white"
        >
          حفظ
        </button>
        <button
          onClick={onCancel}
          className="text-text-secondary rounded-full border px-2 py-0.5 text-xs"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
