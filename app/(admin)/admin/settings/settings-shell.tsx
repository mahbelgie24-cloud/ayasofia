"use client";

import { useState, useEffect } from "react";
import { getSettings, saveSetting } from "./actions";

const EDITABLE = [
  { key: "shop_name", label: "اسم المحل" },
  { key: "shop_address", label: "العنوان" },
  { key: "shop_phone", label: "رقم الهاتف" },
  { key: "receipt_footer", label: "نص تذييل الإيصال" },
  { key: "tax_rate", label: "نسبة الضريبة (%)" },
];

export function SettingsShell() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getSettings()
      .then(setValues)
      .catch(() => {});
  }, []);

  const handleSave = async (key: string, value: string) => {
    const r = await saveSetting(key, value);
    setMsg(r.success ? "تم الحفظ" : (r.error ?? "فشل"));
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div dir="rtl" lang="ar">
      <h1 className="font-heading text-brand-ink text-2xl font-bold">الإعدادات</h1>
      {msg && <p className="text-status-warning mt-2 text-sm">{msg}</p>}

      <div className="mt-6 max-w-md space-y-4">
        {EDITABLE.map(({ key, label }) => (
          <div key={key}>
            <label className="text-brand-ink mb-1 block text-sm font-medium">{label}</label>
            <div className="flex gap-2">
              <input
                value={values[key] ?? ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                className="border-border-subtle flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
                dir={key === "tax_rate" || key === "shop_phone" ? "ltr" : undefined}
              />
              <button
                onClick={() => handleSave(key, values[key] ?? "")}
                className="bg-brand-red rounded-full px-4 py-2 text-sm font-medium text-white"
              >
                حفظ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
