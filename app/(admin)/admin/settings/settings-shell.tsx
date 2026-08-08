"use client";

import { useState, useEffect } from "react";
import { Save, Store, MapPin, Phone, Receipt, Percent } from "lucide-react";
import { getSettings, saveSetting } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface EditableSetting {
  key: string;
  label: string;
  hint?: string;
  type?: "text" | "number";
  dir?: "ltr" | "rtl";
  icon: React.ReactNode;
}

const EDITABLE: EditableSetting[] = [
  { key: "shop_name", label: "اسم المحل", icon: <Store className="size-4" /> },
  { key: "shop_address", label: "العنوان", icon: <MapPin className="size-4" /> },
  {
    key: "shop_phone",
    label: "رقم الهاتف",
    dir: "ltr",
    icon: <Phone className="size-4" />,
  },
  {
    key: "receipt_footer",
    label: "نص تذييل الإيصال",
    hint: "يظهر أسفل كل فاتورة مطبوعة",
    icon: <Receipt className="size-4" />,
  },
  {
    key: "tax_rate",
    label: "نسبة الضريبة",
    hint: "بالنسبة المئوية — مثال: 17",
    type: "number",
    dir: "ltr",
    icon: <Percent className="size-4" />,
  },
];

export function SettingsShell() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(setValues)
      .catch(() => {});
  }, []);

  const handleSave = async (key: string, value: string) => {
    setPending(key);
    const r = await saveSetting(key, value);
    setSuccess(r.success);
    setMsg(r.success ? "تم الحفظ" : (r.error ?? "فشل"));
    setPending(null);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="الإعدادات"
        title="إعدادات المتجر"
        subtitle="حدّث معلومات المحل، نص الإيصال، ونسبة الضريبة."
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

      <Card variant="default" className="max-w-2xl">
        <CardBody className="space-y-5">
          {EDITABLE.map(({ key, label, hint, type, dir, icon }) => (
            <FormField key={key} label={label} hint={hint}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="text-text-secondary/70 pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 [&_svg]:size-4">
                    {icon}
                  </span>
                  <Input
                    type={type}
                    value={values[key] ?? ""}
                    onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                    dir={dir}
                    className="ps-10"
                  />
                </div>
                <button
                  onClick={() => handleSave(key, values[key] ?? "")}
                  disabled={pending === key}
                  className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/20 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <Save className="size-3.5" />
                  <span>{pending === key ? "..." : "حفظ"}</span>
                </button>
              </div>
            </FormField>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
