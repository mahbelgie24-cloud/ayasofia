/**
 * Ayasofia Sweet — Database Schema (Drizzle ORM / PostgreSQL via Supabase)
 * Generated directly from docs/technical-spec.md §9 (Data Model).
 * Every stock movement carries a reference and a reason; every order is
 * fully reconstructable after the fact — see spec §9 for the rationale.
 */
import {
  pgTable,
  pgEnum,
  pgPolicy,
  uuid,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { authenticatedRole } from "drizzle-orm/supabase";
import { sql } from "drizzle-orm";

// ---------- Enums ----------
export const staffRoleEnum = pgEnum("staff_role", ["owner", "manager", "cashier", "barista"]);

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

// Entry surface that created the order — orthogonal to `channel`.
// A dine-in order can come from the cashier (POS) or a table QR scan
// (DIGITAL_MENU); reports filter by source to measure digital adoption.
// The wifi portal never creates orders (it logs wifi sessions), so no
// source value is reserved for it.
export const orderSourceEnum = pgEnum("order_source", ["POS", "DIGITAL_MENU"]);

export const modifierTypeEnum = pgEnum("modifier_type", ["single", "multi"]);

export const inventoryReasonEnum = pgEnum("inventory_reason", [
  "sale",
  "purchase",
  "waste",
  "adjustment",
]);

export const purchaseStatusEnum = pgEnum("purchase_status", ["pending", "received", "cancelled"]);

// ---------- Branches (single row today — future-proofing only, §9) ----------
export const branches = pgTable("branches", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // URL slug used by the public digital menu: /m/{slug} (FR-DM-10).
  // Seeded from the branch name and unique to keep QR URLs stable.
  slug: text("slug").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
}).enableRLS();

// Physical tables scoped to a branch. Each carries a unique QR token
// (UUID, never a sequential id) so a guest scan resolves to a real,
// active table for dine-in self-ordering (FR-DM-10). `code` is the
// human-facing label (e.g. "T3") shown on the kitchen ticket.
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    qrToken: uuid("qr_token").notNull().unique(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("tables_branch_id_idx").on(t.branchId)],
).enableRLS();

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
}).enableRLS();

// ---------- Menu ----------
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}).enableRLS();

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
}).enableRLS();

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
  // Cap on how many options may be selected for a `multi` group (e.g. a
  // Toppings group limited to 3). Null = unlimited. Ignored for `single`
  // groups. Enforced server-side on order creation (FR-DM-13).
  maxSelections: integer("max_selections"),
}).enableRLS();

export const modifiers = pgTable("modifiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => modifierGroups.id, { onDelete: "cascade" }),
  nameAr: text("name_ar").notNull(), // e.g. "كبير", "٥٠٪"
  name: text("name").notNull(), // e.g. "50%", "Large", "Tapioca Pearls"
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }).notNull().default("0"),
  // Optional ingredient linkage — a topping (e.g. "+Tapioca Pearls") can
  // consume a tracked ingredient so every sale deducts stock for the
  // modifier as well as the base recipe (spec §8.4).  Null when the
  // modifier has no inventory impact (e.g. sugar/ice levels).
  ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
  // Quantity of `ingredientId` consumed per serving (numeric(12,2)).
  ingredientQty: numeric("ingredient_qty", { precision: 12, scale: 2 }),
}).enableRLS();

// ---------- Inventory ----------
export const ingredients = pgTable("ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull(), // 'g' | 'ml' | 'piece'
  currentStock: numeric("current_stock", { precision: 12, scale: 2 }).notNull().default("0"),
  reorderThreshold: numeric("reorder_threshold", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  costPerUnit: numeric("cost_per_unit", { precision: 10, scale: 4 }).notNull().default("0"),
}).enableRLS();

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
  }),
).enableRLS();

// ---------- Orders ----------
export const orders = pgTable(
  "orders",
  {
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
    // Entry surface that created the order (POS | DIGITAL_MENU) — see the
    // order_source enum above. Reports filter on this to measure digital
    // adoption (FR-DM-15). Defaults to POS so existing cashier orders are
    // unaffected.
    source: orderSourceEnum("source").notNull().default("POS"),
    // For source=DIGITAL_MENU dine-in orders — which table the guest is at.
    // The kitchen ticket renders this code so the order reaches the right
    // table (C1).
    tableId: uuid("table_id").references(() => tables.id, { onDelete: "set null" }),
    // Delivery-specific fields (channel=delivery). Fee is computed
    // server-side from settings rules — never trusted from the client (C6).
    deliveryAddress: text("delivery_address"),
    deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }).notNull().default("0"),
    // Required for the offline-sync queue in §12 — prevents a retried
    // sync from creating the same sale twice.
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    pgPolicy("staff can read live orders", {
      for: "select",
      to: authenticatedRole,
      using: sql`(auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null`,
    }),
    // Indexes for the range scans used by closeShift (SUM by staff+date)
    // and getSalesSummary (SUM by date). Without these, the queries
    // seq-scan the entire orders table, which slows as orders grow.
    index("orders_created_at_idx").on(t.createdAt),
    index("orders_staff_id_created_at_idx").on(t.staffId, t.createdAt),
    index("orders_source_created_at_idx").on(t.source, t.createdAt),
  ],
).enableRLS();

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    selectedModifiers: jsonb("selected_modifiers").notNull().default([]),
    // Free-text line note from the digital-menu builder (DM-03), e.g.
    // "لا ثلج إضافي من فضلك". Server-side validated to a length cap.
    notes: text("notes"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  },
  () => [
    pgPolicy("staff can read order items", {
      for: "select",
      to: authenticatedRole,
      using: sql`(auth.jwt() -> 'app_metadata' ->> 'staff_id') is not null`,
    }),
  ],
).enableRLS();

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
}).enableRLS();

// Every price change is logged with the old and new value — spec §12
// requires "an audit log on every price or stock adjustment."  Stock
// has inventory_moves above; prices have this table.  Without it, a
// manager could silently change a product's base_price and leave no
// trace of who did it or what the old price was (WEB-SEC-006).
export const priceChanges = pgTable("price_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  // "product" or "modifier" — which entity's price changed
  entityType: text("entity_type").notNull(),
  // No FK: either products.id or modifiers.id, discriminated by entityType
  entityId: uuid("entity_id").notNull(),
  // "base_price" or "price_delta" — which price field changed
  field: text("field").notNull(),
  // Numeric-as-string, matching how Drizzle returns numeric columns
  oldValue: text("old_value").notNull(),
  newValue: text("new_value").notNull(),
  changedBy: uuid("changed_by")
    .notNull()
    .references(() => staff.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  notes: text("notes"),
}).enableRLS();

export const purchases = pgTable("purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const shifts = pgTable("shifts", {
  id: uuid("id").defaultRandom().primaryKey(),
  staffId: uuid("staff_id")
    .notNull()
    .references(() => staff.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingCash: numeric("opening_cash", { precision: 10, scale: 2 }).notNull().default("0"),
  closingCash: numeric("closing_cash", { precision: 10, scale: 2 }),
  totalSales: numeric("total_sales", { precision: 10, scale: 2 }),
}).enableRLS();

// Key/value config — currency, tax rate, receipt footer, etc. (§8.6)
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
}).enableRLS();

// "اقتراح اليوم" — a single highlighted product, shared entity between the
// digital menu home and the wifi post-connect screen (WF-06 / FR-DM-02).
// At most one active suggestion per branch is expected; the latest
// `is_active = true` row wins. Created/updated via the admin screen.
export const todaySuggestion = pgTable("today_suggestion", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  titleAr: text("title_ar"), // optional override; falls back to product name
  descriptionAr: text("description_ar"), // short marketing line (e.g. "منعش صيفاً ✨")
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
}).enableRLS();

// Condition → suggestion engine rules (FR-DM-16). Evaluated server-side in
// lib/upsell.ts when the digital menu builds its cart-adjacent suggestions.
//   condition: what to test — e.g. "cart_has_product_category",
//              "cart_without_modifier", "cart_below_threshold",
//              "time_of_day", "always"
//   triggerValue: JSON payload the condition needs (category id, modifier
//              id, threshold agorot integer, or "hot"/"cold" window)
//   suggestionProductId / suggestionModifierId: what to push
//   priority: higher wins tie-breaks when multiple rules match
export const upsellRules = pgTable("upsell_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  condition: text("condition").notNull(), // see lib/upsell.ts contract
  triggerValue: text("trigger_value").notNull().default("{}"),
  suggestionProductId: uuid("suggestion_product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  suggestionModifierId: uuid("suggestion_modifier_id").references(() => modifiers.id, {
    onDelete: "set null",
  }),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

export const upsellRulesRelations = relations(upsellRules, ({ one }) => ({
  suggestionProduct: one(products, {
    fields: [upsellRules.suggestionProductId],
    references: [products.id],
  }),
  suggestionModifier: one(modifiers, {
    fields: [upsellRules.suggestionModifierId],
    references: [modifiers.id],
  }),
}));

// WiFi captive-portal sessions (WF-05). Anonymous by default: `deviceId`
// is stored as a salted hash, never a raw identifier. Name/phone are
// written only when the guest explicitly consented (consented=true, C5).
export const wifiSessions = pgTable(
  "wifi_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    deviceIdHash: text("device_id_hash").notNull(),
    consented: boolean("consented").notNull().default(false),
    guestName: text("guest_name"), // PII — only when consented
    guestPhone: text("guest_phone"), // PII — only when consented
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    // Wall-clock seconds the device remained connected (updated on logout/
    // session end). Null while the session is still active.
    durationSec: integer("duration_sec"),
    // Router integration status (authorizeDevice result from the adapter).
    routerSessionId: text("router_session_id"),
    notes: text("notes"),
  },
  (t) => [index("wifi_sessions_device_hash_idx").on(t.deviceIdHash)],
).enableRLS();

// ---------- Drizzle Relations (for query API) ----------

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  modifierGroups: many(modifierGroups),
}));

export const modifierGroupsRelations = relations(modifierGroups, ({ one, many }) => ({
  product: one(products, {
    fields: [modifierGroups.productId],
    references: [products.id],
  }),
  modifiers: many(modifiers),
}));

export const modifiersRelations = relations(modifiers, ({ one }) => ({
  group: one(modifierGroups, {
    fields: [modifiers.groupId],
    references: [modifierGroups.id],
  }),
}));

export const tablesRelations = relations(tables, ({ one }) => ({
  branch: one(branches, {
    fields: [tables.branchId],
    references: [branches.id],
  }),
}));

export const todaySuggestionRelations = relations(todaySuggestion, ({ one }) => ({
  product: one(products, {
    fields: [todaySuggestion.productId],
    references: [products.id],
  }),
}));
