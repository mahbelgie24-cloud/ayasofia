"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReceiptData } from "@/lib/db/queries";
import { buildReceiptText } from "@/lib/receipt";

interface Props {
  data: ReceiptData;
}

export function ReceiptClient({ data }: Props) {
  const [shared, setShared] = useState(false);
  const plainText = useMemo(() => buildReceiptText(data), [data]);

  // Auto-trigger print on mount
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  const handleWhatsApp = () => {
    if (data.customerPhone) {
      const phone = data.customerPhone.replace(/\D/g, "");
      const text = encodeURIComponent(plainText);
      window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
    } else if (
      typeof window !== "undefined" &&
      "navigator" in window &&
      "share" in window.navigator
    ) {
      (window.navigator as Navigator)
        .share({ title: `فاتورة ${data.orderNumber}`, text: plainText })
        .catch(() => setShared(false));
    } else if (
      typeof window !== "undefined" &&
      "navigator" in window &&
      "clipboard" in window.navigator
    ) {
      (window.navigator as Navigator).clipboard
        .writeText(plainText)
        .then(() => setShared(true))
        .catch(() => {});
    }
  };

  return (
    <>
      {/* On-screen controls — hidden during print */}
      <style>{`
        @media print {
          .no-print, nav, header, footer { display: none !important; }
          html, body { margin: 0; padding: 0; }
          .receipt { width: 80mm; margin: 0 auto; }
        }
        .receipt { font-size: 12px; line-height: 1.5; }
      `}</style>

      <div className="no-print fixed right-0 bottom-0 left-0 z-50 flex gap-2 bg-white p-3 shadow-lg sm:static sm:shadow-none">
        <button
          onClick={() => window.print()}
          className="bg-brand-red flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white"
        >
          طباعة
        </button>
        <button
          onClick={handleWhatsApp}
          className="border-brand-red text-brand-red flex-1 rounded-full border px-4 py-2.5 text-sm font-bold"
        >
          {data.customerPhone ? "واتساب" : shared ? "تم النسخ" : "مشاركة"}
        </button>
      </div>

      {/* Receipt */}
      <div className="receipt text-brand-ink mx-auto max-w-[80mm] px-2 py-4" dir="rtl" lang="ar">
        <div className="mb-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-mono.svg"
            alt={data.shopName}
            className="mx-auto mb-2 h-12 w-auto invert"
          />
          <p className="font-bold">{data.shopName}</p>
          {data.shopAddress && <p className="text-text-secondary text-xs">{data.shopAddress}</p>}
          {data.shopPhone && <p className="text-text-secondary text-xs">{data.shopPhone}</p>}
        </div>

        <hr className="border-text-secondary/30 mb-2 border-dashed" />

        <div className="mb-2 text-xs">
          <p>
            <span className="font-semibold">رقم الطلب:</span> {data.orderNumber}
          </p>
          <p>
            <span className="font-semibold">طريقة الدفع:</span> {data.paymentMethod ?? "غير محدد"}
          </p>
          {data.staffName && (
            <p>
              <span className="font-semibold">الموظف:</span> {data.staffName}
            </p>
          )}
          <p>
            <span className="font-semibold">التاريخ:</span>{" "}
            {new Date(data.createdAt).toLocaleString("ar")}
          </p>
        </div>

        <hr className="border-text-secondary/30 mb-2 border-dashed" />

        <div className="mb-2">
          {data.items.map((item, i) => (
            <div key={i} className="mb-1 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">
                  {item.productNameAr} × {item.quantity}
                </span>
                <span>{item.lineTotal} ₪</span>
              </div>
              {item.modifierNames.length > 0 && (
                <p className="text-text-secondary mr-3">+ {item.modifierNames.join("، ")}</p>
              )}
            </div>
          ))}
        </div>

        <hr className="border-text-secondary/30 mb-2 border-dashed" />

        <div className="mb-2 text-xs">
          <div className="flex justify-between">
            <span>المجموع الفرعي</span>
            <span>{data.subtotal} ₪</span>
          </div>
          {parseFloat(data.tax) > 0 && (
            <div className="flex justify-between">
              <span>الضريبة</span>
              <span>{data.tax} ₪</span>
            </div>
          )}
          {parseFloat(data.discount) > 0 && (
            <div className="flex justify-between">
              <span>الخصم</span>
              <span>{data.discount} ₪</span>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <span>الإجمالي</span>
            <span>{data.total} ₪</span>
          </div>
        </div>

        <hr className="border-text-secondary/30 mb-2 border-dashed" />

        {data.receiptFooter && (
          <p className="text-text-secondary text-center text-xs">{data.receiptFooter}</p>
        )}
      </div>
    </>
  );
}
