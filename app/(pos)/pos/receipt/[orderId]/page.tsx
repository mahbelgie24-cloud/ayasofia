import { requireStaffSession } from "@/lib/auth";
import { getReceiptData } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { ReceiptClient } from "./receipt-client";

interface Props {
  params: Promise<{ orderId: string }>;
}

export default async function ReceiptPage({ params }: Props) {
  await requireStaffSession();
  const { orderId } = await params;
  const data = await getReceiptData(orderId);

  if (!data) notFound();

  return <ReceiptClient data={data} />;
}
