/**
 * Ayasofia Sweet — Database Schema (Drizzle ORM / PostgreSQL via Supabase)
 * Generated directly from docs/technical-spec.md §9 (Data Model).
 * Every stock movement carries a reference and a reason; every order is
 * fully reconstructable after the fact — see spec §9 for the rationale.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

// ---------- Enums ----------
export const staffRoleEnum = pgEnum("staff_role", [
  "owner",
  "manager",
  "cashier",
  "barista",
]);

export const orderChannelEnum = pgEnum("order_channel", [
  "dine_in",
  "takeaway",
  "drive_thru", // §7 — first-class channel, not an afterthought
  "delivery", // reserved, out of scope for v1 per spec §3
]);

export const orderStatusEnum = pgEnum("order_status", [
  "received",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

export const modifierTypeEnum = pgEnum("modifier_type", ["single", "multi"]);

export const inventoryReasonEnum = pgEnum("inventory_reason", [
  "sale",
  "purchase",
  "waste",
  "adjustment",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "received",
  "cancelled",
]);

// ---------- Branches (single row today — future-proofing only, §9) ----------
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
});

// ---------- Staff (4-digit PIN login, §8.1) ----------
// The PIN login flow: client signs in anonymously → server action
// verifyStaffPin checks the PIN hash, sets app_metadata on the anon
// user, and persists the auth.user.id linkage here. No foreign key
// to auth.users — that table lives in Supabase's managed schema.
export const staff = pgTable("staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  role: staffRoleEnum("role").notNull().default("cashier"),
  pinHash: text("pin_hash").notNull(), // never store the raw PIN
  active: boolean("active").notNull().default(true),
  authUserId: uuid("auth_user_id"), // linked after first successful PIN login
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ---------- Menu ----------
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"), // placeholder icons live in /public/icons for now
  isAvailable: boolean("is_available").notNull().default(true),
  trackInventory: boolean("track_inventory").notNull().default(true),
});

// Modifier groups are per-product, not global — §10: a dessert doesn't
// need a sugar-level group, a bubble tea does. Don't force a shared schema.
export const modifierGroups = pgTable("modifier_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "Sugar Level", "Toppings"
  type: modifierTypeEnum("type").notNull().default("single"),
  isRequired: boolean("is_required").notNull().default(false),
});

export const modifiers = pgTable("modifiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => modifierGroups.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. "50%", "Large", "Tapioca Pearls"
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
});

// ---------- Inventory ----------
export const ingredients = pgTable("ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // 'g' | 'ml' | 'piece'
  currentStock: numeric("current_stock", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  reorderThreshold: numeric("reorder_threshold", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 4 })
    .notNull()
    .default("0"),
});

// Bill of Materials — one sale = automatic, auditable deduction (§9, §12)
export const recipes = pgTable(
  "recipes",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    quantityUsed: numeric("quantity_used", { precision: 12, scale: 2 }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.ingredientId] }),
  })
);

// ---------- Orders ----------
export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  channel: orderChannelEnum("channel").notNull(),
  status: orderStatusEnum("status").notNull().default("received"),
  customerName: text("customer_name"), // /order (QR) only — see §12 data privacy
  customerPhone: text("customer_phone"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  tax: numeric("tax", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"),
  staffId: uuid("staff_id").references(() => staff.id),
  // Required for the offline-sync queue in §12 — prevents a retried
  // sync from creating the same sale twice.
  idempotencyKey: text("idempotency_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  selectedModifiers: jsonb("selected_modifiers").notNull().default([]),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
});

// Every stock change is logged with a reason and (where relevant) the
// order that caused it — this is what makes the system auditable, §9.
export const inventoryMoves = pgTable("inventory_moves", {
  id: uuid("id").defaultRandom().primaryKey(),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredients.id),
  deltaQty: numeric("delta_qty", { precision: 12, scale: 2 }).notNull(),
  reason: inventoryReasonEnum("reason").notNull(),
  refOrderId: uuid("ref_order_id").references(() => orders.id),
  createdBy: uuid("created_by").references(() => staff.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  notes: text("notes"),
});

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCash: numeric("opening_cash", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  closingCash: numeric("closing_cash", { precision: 10, scale: 2 }),
  totalSales: numeric("total_sales", { precision: 10, scale: 2 }),
});

// Key/value config — currency, tax rate, receipt footer, etc. (§8.6)
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
