import { db } from "@/lib/db";
import { branches, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, permanentRedirect } from "next/navigation";

// Legacy /order self-ordering surface — RETIRED (team decision Q1=B).
// Any legacy printed QR pointing here is permanently (308) redirected to the
// digital-menu ordering surface instead of 404ing. Order STATUS pages stay at
// /order/status/[orderId] (token-gated) for historical orders.
export const dynamic = "force-dynamic";

/**
 * Deterministic default branch: the `default_branch_slug` setting wins;
 * otherwise the first branch alphabetically (single-branch shop assumption).
 */
async function resolveDefaultBranchSlug(): Promise<string> {
  const [slugSetting] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, "default_branch_slug"))
    .limit(1);
  if (slugSetting?.value) return slugSetting.value;

  const [branch] = await db
    .select({ slug: branches.slug })
    .from(branches)
    .orderBy(branches.name)
    .limit(1);
  return branch?.slug ?? "";
}

export default async function OrderPage() {
  const slug = await resolveDefaultBranchSlug();
  if (!slug) notFound();
  permanentRedirect(`/m/${slug}`);
}
