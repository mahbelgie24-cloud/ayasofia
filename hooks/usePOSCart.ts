"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  calculateLineTotal,
  calculateCartTotal,
  type SelectedModifier as PricingModifier,
} from "@/lib/pricing";
import type { POSCategory } from "@/lib/db/queries";

export interface CartItem {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  basePrice: string;
  selectedModifiers: Array<{
    id: string;
    nameAr: string;
    name: string;
    priceDelta: string;
  }>;
  quantity: number;
  lineTotal: number;
}

export interface ModifierTarget {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  basePrice: string;
  groups: POSCategory["products"][number]["modifierGroups"];
}

export function usePOSCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modifierTarget, setModifierTarget] = useState<ModifierTarget | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});
  const idempotencyKeyRef = useRef<string>("");

  useEffect(() => {
    if (cart.length > 0 && !idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }
    if (cart.length === 0) {
      idempotencyKeyRef.current = "";
    }
  }, [cart.length]);

  const addToCart = useCallback(
    (
      product: { id: string; nameAr: string; nameEn: string; basePrice: string },
      selectedModifiers: Array<{
        id: string;
        nameAr: string;
        name: string;
        priceDelta: string;
      }>,
      initialQty = 1,
    ) => {
      const pricingMods: PricingModifier[] = selectedModifiers.map((m) => ({
        priceDelta: m.priceDelta,
      }));
      const lineTotal = calculateLineTotal(product.basePrice, pricingMods, initialQty);

      setCart((prev) => {
        const existingIdx = prev.findIndex(
          (item) =>
            item.productId === product.id &&
            JSON.stringify(item.selectedModifiers.map((m) => m.id).sort()) ===
              JSON.stringify(selectedModifiers.map((m) => m.id).sort()),
        );

        if (existingIdx >= 0) {
          const updated = [...prev];
          const existing = updated[existingIdx];
          const qty = existing.quantity + initialQty;
          updated[existingIdx] = {
            ...existing,
            quantity: qty,
            lineTotal: calculateLineTotal(
              product.basePrice,
              selectedModifiers.map((m) => ({ priceDelta: m.priceDelta })),
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
            productNameEn: product.nameEn,
            basePrice: product.basePrice,
            selectedModifiers,
            quantity: initialQty,
            lineTotal,
          },
        ];
      });
    },
    [],
  );

  const openModifiers = useCallback(
    (product: POSCategory["products"][number]) => {
      if (product.modifierGroups.length === 0) {
        addToCart(
          {
            id: product.id,
            nameAr: product.nameAr,
            nameEn: product.nameEn,
            basePrice: product.basePrice,
          },
          [],
        );
        return;
      }

      const initial: Record<string, string[]> = {};
      for (const g of product.modifierGroups) {
        initial[g.id] = [];
      }
      setModifierSelections(initial);
      setModifierTarget({
        productId: product.id,
        productNameAr: product.nameAr,
        productNameEn: product.nameEn,
        basePrice: product.basePrice,
        groups: product.modifierGroups,
      });
    },
    [addToCart],
  );

  const toggleSingle = useCallback((groupId: string, modifierName: string) => {
    setModifierSelections((prev) => ({
      ...prev,
      [groupId]: [modifierName],
    }));
  }, []);

  const toggleMulti = useCallback((groupId: string, modifierName: string) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      const next = current.includes(modifierName)
        ? current.filter((n) => n !== modifierName)
        : [...current, modifierName];
      return { ...prev, [groupId]: next };
    });
  }, []);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = Math.max(0, item.quantity + delta);
      if (newQty === 0) {
        return updated.filter((_, i) => i !== index);
      }
      const mods: PricingModifier[] = item.selectedModifiers.map((m) => ({
        priceDelta: m.priceDelta,
      }));
      updated[index] = {
        ...item,
        quantity: newQty,
        lineTotal: calculateLineTotal(item.basePrice, mods, newQty),
      };
      return updated;
    });
  }, []);

  const removeItem = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const confirmModifiers = useCallback(() => {
    if (!modifierTarget) return;

    const selected: Array<{
      id: string;
      nameAr: string;
      name: string;
      priceDelta: string;
    }> = [];
    for (const g of modifierTarget.groups) {
      const picked = modifierSelections[g.id] ?? [];
      for (const modName of picked) {
        const mod = g.modifiers.find((m) => m.name === modName);
        if (mod) {
          selected.push({
            id: mod.id,
            nameAr: mod.nameAr,
            name: mod.name,
            priceDelta: mod.priceDelta,
          });
        }
      }
    }

    addToCart(
      {
        id: modifierTarget.productId,
        nameAr: modifierTarget.productNameAr,
        nameEn: modifierTarget.productNameEn,
        basePrice: modifierTarget.basePrice,
      },
      selected,
    );

    setModifierTarget(null);
  }, [modifierTarget, modifierSelections, addToCart]);

  const cartTotal = calculateCartTotal(cart);

  return {
    cart,
    cartTotal,
    modifierTarget,
    modifierSelections,
    idempotencyKeyRef,
    addToCart,
    openModifiers,
    toggleSingle,
    toggleMulti,
    updateQuantity,
    removeItem,
    clearCart,
    confirmModifiers,
    setModifierTarget,
  };
}
