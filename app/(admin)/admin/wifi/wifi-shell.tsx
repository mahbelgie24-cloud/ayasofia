"use client";

import { useState, useEffect } from "react";
import { Save, Users, ShieldCheck, Clock, Edit3 } from "lucide-react";
import { getWifiSettings, saveWifiSetting, getWifiStats, type WifiStats } from "./actions";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/page-header";
import { Stat } from "@/components/ui/stat";
import { Card, CardBody } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

const EDITABLE = [
  { key: "wifi.splash_title", label: "عنوان الشاشة", default: "أياسوفيا ترحّب بك" },
  { key: "wifi.splash_subtitle", label: "النص التوضيحي", default: "واي فاي مجاني للضيوف" },
  { key: "wifi.privacy_line", label: "نص الخصوصية", default: "لا نشارك بياناتك مع أي طرف ثالث" },
];

export function WifiAdminShell() {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<WifiStats | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getWifiSettings(), getWifiStats()])
      .then(([settings, s]) => {
        setValues(settings);
        setStats(s);
      })
      .catch(() => {});
  }, []);

  const handleSave = async (key: string, value: string) => {
    setPending(key);
    try {
      const r = await saveWifiSetting(key, value);
      toast.warning(r.success ? "تم الحفظ" : (r.error ?? "فشل"));
    } catch {
      toast.error("لا يمكن كتابة هذا المفتاح");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="الواي فاي"
        title="بوابة الترحيب"
        subtitle="إحصائيات الاستخدام والنصوص التي تظهر للضيوف على شاشة الاتصال."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="إجمالي الجلسات"
          value={(stats?.totalSessions ?? 0).toLocaleString("ar")}
          icon={<Users className="size-4" />}
        />
        <Stat
          label="جلسات اليوم"
          value={(stats?.todaySessions ?? 0).toLocaleString("ar")}
          icon={<Clock className="size-4" />}
        />
        <Stat
          label="بموافقة (تسجيل)"
          value={(stats?.consented ?? 0).toLocaleString("ar")}
          icon={<ShieldCheck className="size-4" />}
          hint="الضيوف الذين تركوا اسم/رقم بعد الموافقة"
        />
      </div>

      <Card variant="default" className="max-w-2xl">
        <CardBody className="space-y-4">
          <h2 className="heading-3 text-brand-ink flex items-center gap-2">
            <Edit3 className="size-4" />
            نصوص شاشة الاتصال
          </h2>

          {EDITABLE.map(({ key, label, default: def }) => (
            <FormField key={key} label={label}>
              <div className="flex gap-2">
                <Input
                  value={values[key] ?? def}
                  onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                />
                <button
                  onClick={() => handleSave(key, values[key] ?? def)}
                  disabled={pending === key}
                  className="bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20 flex items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all disabled:opacity-50"
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
