"use client";

import { useState, useEffect } from "react";
import { getWifiSettings, saveWifiSetting, getWifiStats, type WifiStats } from "./actions";
import { useToast } from "@/components/ui/toast";

const EDITABLE = [
  { key: "wifi.splash_title", label: "عنوان الشاشة", default: "أياسوفيا ترحّب بك" },
  { key: "wifi.splash_subtitle", label: "النص التوضيحي", default: "واي فاي مجاني للضيوف" },
  { key: "wifi.privacy_line", label: "نص الخصوصية", default: "لا نشارك بياناتك مع أي طرف ثالث" },
];

export function WifiAdminShell() {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<WifiStats | null>(null);

  useEffect(() => {
    Promise.all([getWifiSettings(), getWifiStats()])
      .then(([settings, s]) => {
        setValues(settings);
        setStats(s);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (key: string, value: string) => {
    try {
      const r = await saveWifiSetting(key, value);
      toast.warning(r.success ? "تم الحفظ" : (r.error ?? "فشل"));
    } catch {
      toast.error("لا يمكن كتابة هذا المفتاح");
    }
  };
  return (
    <div dir="rtl" lang="ar">
      <h1 className="font-heading text-brand-ink text-2xl font-bold">الواي فاي — بوابة الترحيب</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-text-secondary text-sm">إجمالي الجلسات</p>
          <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
            {stats?.totalSessions ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-text-secondary text-sm">جلسات اليوم</p>
          <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
            {stats?.todaySessions ?? "—"}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="text-text-secondary text-sm">بموافقة (تسجيل)</p>
          <p className="font-heading text-brand-ink mt-1 text-2xl font-bold">
            {stats?.consented ?? "—"}
          </p>
        </div>
      </div>

      <div className="mt-6 max-w-md space-y-4">
        {EDITABLE.map(({ key, label, default: def }) => (
          <div key={key}>
            <label className="text-brand-ink mb-1 block text-sm font-medium">{label}</label>
            <div className="flex gap-2">
              <input
                value={values[key] ?? def}
                onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                className="border-border-subtle flex-1 rounded-lg border bg-white px-3 py-2 text-sm"
              />
              <button
                onClick={() => handleSave(key, values[key] ?? def)}
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
