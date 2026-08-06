"use client";

import { useState, useCallback, useRef } from "react";
import {
  calculateLineTotal,
  calculateCartTotal,
  type SelectedModifier as PricingModifier,
} from "@/lib/pricing";
import { computeIdempotencyKey, type IdempotencyCartItem } from "@/lib/idempotency";
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
  /** Optional free-text line note (DM-03). */
  notes?: string;
}

export interface ModifierTarget {
  productId: string;
  productNameAr: string;
  productNameEn: string;
  basePrice: string;
  groups: POSCategory["products"][number]["modifierGroups"];
}

export function usePOSCart(opts?: { onItemAdded?: (productId: string) => void }) {
  const onItemAdded = opts?.onItemAdded;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modifierTarget, setModifierTarget] = useState<ModifierTarget | null>(null);
  const [modifierSelections, setModifierSelections] = useState<Record<string, string[]>>({});

  // P1-M2: a stable per-mount session identity. The derived idempotency key is
  // hash(session + cart fingerprint), so it is deterministic FOR the same cart
  // (dedupes a retried submit) yet changes when the cart changes. The session
  // disambiguator stops two different browsers with identical carts colliding.
  // Minted lazily on the first submit (inside an event handler, not during
  // render — crypto/Math randomness is allowed there, not in a render pass).
  const sessionIdRef = useRef<string>("");

  /**
   * Derive the idempotency key for a submit click from the CURRENT cart
   * snapshot. Same session + same cart ⇒ same key. Any cart change ⇒ a new key.
   */
  const deriveIdempotencyKey = useCallback((cartItems: IdempotencyCartItem[]): Promise<string> => {
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `s-${Math.random().toString(36).slice(2)}`;
    }
    return computeIdempotencyKey(sessionIdRef.current, cartItems);
  }, []);

  const addToCart = useCallback(
    (
      product: { id: string; nameAr: string; nameEn?: string; basePrice: string },
      selectedModifiers: Array<{
        id: string;
        nameAr: string;
        name: string;
        priceDelta: string;
      }>,
      initialQty = 1,
      notes?: string,
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
            productNameEn: product.nameEn ?? "",
            basePrice: product.basePrice,
            selectedModifiers,
            quantity: initialQty,
            lineTotal,
            notes: notes?.trim() ? notes.trim() : undefined,
          },
        ];
      });

      onItemAdded?.(product.id);
    },
    [onItemAdded],
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

  const toggleSingle = useCallback((groupId: string, modifierId: string) => {
    setModifierSelections((prev) => ({
      ...prev,
      [groupId]: [modifierId],
    }));
  }, []);

  const toggleMulti = useCallback((groupId: string, modifierId: string) => {
    setModifierSelections((prev) => {
      const current = prev[groupId] ?? [];
      const next = current.includes(modifierId)
        ? current.filter((id) => id !== modifierId)
        : [...current, modifierId];
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
      for (const modId of picked) {
        const mod = g.modifiers.find((m) => m.id === modId);
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
    deriveIdempotencyKey,
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
