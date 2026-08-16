"use client";

import { useState, useEffect } from "react";
import { UserPlus, Edit3, Power, PowerOff, X } from "lucide-react";
import { getStaffList, createStaffMember, updateStaffMember, type StaffMember } from "./actions";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

export function StaffShell() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [msg, setMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setMembers(await getStaffList());
    } catch {
      /* */
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  const showMsg = (m: string, ok = true) => {
    setSuccess(ok);
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="إدارة الموظفين"
        title="فريق العمل"
        subtitle="أضف وعدّل حسابات الموظفين وعيّن الأدوار المسموح بها."
        actions={
          <button
            onClick={() => setCreateMode(true)}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all"
          >
            <UserPlus className="size-4" />
            <span>موظف جديد</span>
          </button>
        }
      />

      {msg && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-2.5 text-sm ${
            success
              ? "border-status-success/30 bg-status-success/[0.08] text-status-success"
              : "border-status-warning/30 bg-status-warning/[0.08] text-status-warning-ink"
          }`}
        >
          {msg}
        </div>
      )}

      {createMode && (
        <StaffForm
          onSave={async (data) => {
            const r = await createStaffMember(data);
            if (r.success) {
              setCreateMode(false);
              refresh();
              showMsg("تمت إضافة الموظف");
            } else showMsg(r.error ?? "فشل", false);
          }}
          onCancel={() => setCreateMode(false)}
        />
      )}

      {editId && (
        <StaffForm
          initial={members.find((m) => m.id === editId)}
          onSave={async (data) => {
            const r = await updateStaffMember({ id: editId, ...data });
            if (r.success) {
              setEditId(null);
              refresh();
              showMsg("تم التحديث");
            } else showMsg(r.error ?? "فشل", false);
          }}
          onCancel={() => setEditId(null)}
        />
      )}

      {members.length === 0 ? (
        <Card variant="default">
          <CardBody>
            <EmptyState
              title="لا يوجد موظفون بعد"
              description="ابدأ بإضافة أول موظف وعرّف دوره ورمز PIN الخاص به."
              action={
                <button
                  onClick={() => setCreateMode(true)}
                  className="bg-brand-red hover:bg-brand-red-dark shadow-brand-red/20 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md"
                >
                  <UserPlus className="size-4" />
                  <span>موظف جديد</span>
                </button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card variant="default" className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border-subtle text-text-secondary bg-brand-cream/40 border-b text-right text-[11px] font-semibold tracking-wider uppercase">
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">الدور</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr
                    key={m.id}
                    className="border-border-subtle/60 hover:bg-brand-cream/30 border-b transition-colors last:border-0"
                  >
                    <td className="text-brand-ink px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={m.role} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          m.active
                            ? "bg-status-success/[0.12] text-status-success"
                            : "bg-status-error/[0.12] text-status-error"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            m.active ? "bg-status-success" : "bg-status-error"
                          }`}
                        />
                        {m.active ? "نشط" : "غير نشط"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditId(m.id)}
                          className="text-text-secondary hover:bg-muted hover:text-brand-ink flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                        >
                          <Edit3 className="size-3.5" />
                          <span>تعديل</span>
                        </button>
                        {m.active ? (
                          <button
                            onClick={async () => {
                              const r = await updateStaffMember({ id: m.id, active: false });
                              if (r.success) {
                                refresh();
                                showMsg("تم تعطيل الموظف");
                              } else showMsg(r.error ?? "فشل", false);
                            }}
                            className="text-status-warning hover:bg-status-warning/[0.1] flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                          >
                            <PowerOff className="size-3.5" />
                            <span>تعطيل</span>
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              const r = await updateStaffMember({ id: m.id, active: true });
                              if (r.success) {
                                refresh();
                                showMsg("تم تفعيل الموظف");
                              } else showMsg(r.error ?? "فشل", false);
                            }}
                            className="text-status-success hover:bg-status-success/[0.1] flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                          >
                            <Power className="size-3.5" />
                            <span>تفعيل</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const labels: Record<string, string> = {
    owner: "مالك",
    manager: "مدير",
    cashier: "كاشير",
    barista: "باريستا",
  };
  const colors: Record<string, string> = {
    owner: "bg-brand-red/10 text-brand-red",
    manager: "bg-status-warning/10 text-status-warning-ink",
    cashier: "bg-status-success/10 text-status-success",
    barista: "bg-muted text-text-secondary",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        colors[role] ?? "bg-muted text-text-secondary"
      }`}
    >
      {labels[role] ?? role}
    </span>
  );
}

function StaffForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: StaffMember;
  onSave: (data: { name: string; role: string; pin: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [role, setRole] = useState(initial?.role ?? "cashier");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    if (!name.trim()) {
      setError("الاسم مطلوب");
      return;
    }
    if (!initial && (!pin || pin.length !== 4)) {
      setError("الرمز يجب أن يكون 4 أرقام");
      return;
    }
    if (!initial && pin !== pinConfirm) {
      setError("الرمز وتأكيده غير متطابقين");
      return;
    }
    if (initial && pin && pin.length !== 4) {
      setError("الرمز يجب أن يكون 4 أرقام");
      return;
    }
    onSave({ name: name.trim(), role, pin });
  };

  return (
    <Card variant="pop" className="max-w-xl">
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="heading-3 text-brand-ink">{initial ? "تعديل موظف" : "موظف جديد"}</h3>
          <button
            onClick={onCancel}
            className="text-text-secondary hover:bg-muted flex size-8 items-center justify-center rounded-full transition-colors"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>

        <FormField label="الاسم" required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم الموظف"
            autoFocus
          />
        </FormField>

        <FormField label="الدور">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border-border-subtle focus:border-brand-red/60 focus:ring-brand-red/15 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm transition-colors outline-none focus:ring-3"
          >
            <option value="barista">باريستا</option>
            <option value="cashier">كاشير</option>
            <option value="manager">مدير</option>
            <option value="owner">مالك</option>
          </select>
        </FormField>

        <FormField
          label={initial ? "PIN الجديد" : "PIN"}
          hint={initial ? "اتركه فارغًا لعدم التغيير" : "4 أرقام، يُستخدم لتسجيل الدخول"}
          required={!initial}
        >
          <Input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="****"
            dir="ltr"
          />
        </FormField>

        {!initial && (
          <FormField label="تأكيد PIN" required>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="****"
              dir="ltr"
            />
          </FormField>
        )}

        {error && (
          <p role="alert" className="text-status-error text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="border-border-subtle text-text-secondary hover:bg-muted flex-1 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 flex-1 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all"
          >
            {initial ? "حفظ التغييرات" : "إضافة موظف"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
