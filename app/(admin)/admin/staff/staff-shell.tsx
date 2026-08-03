"use client";

import { useState, useEffect } from "react";
import { getStaffList, createStaffMember, updateStaffMember, type StaffMember } from "./actions";

export function StaffShell() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [msg, setMsg] = useState("");
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

  const showMsg = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div dir="rtl" lang="ar">
      <h1 className="font-heading text-brand-ink text-2xl font-bold">إدارة الموظفين</h1>
      {msg && <p className="text-status-warning mt-2 text-sm">{msg}</p>}

      <button
        onClick={() => setCreateMode(true)}
        className="bg-brand-red mt-4 rounded-full px-4 py-2 text-sm font-medium text-white"
      >
        + موظف جديد
      </button>

      {createMode && (
        <StaffForm
          onSave={async (data) => {
            const r = await createStaffMember(data);
            if (r.success) {
              setCreateMode(false);
              refresh();
              showMsg("تمت الإضافة");
            } else showMsg(r.error ?? "فشل");
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
            } else showMsg(r.error ?? "فشل");
          }}
          onCancel={() => setEditId(null)}
        />
      )}

      <div className="mt-6">
        <div className="border-border-subtle rounded-xl border bg-white p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-secondary border-border-subtle border-b text-right text-xs font-semibold">
                <th className="px-3 py-2">الاسم</th>
                <th className="px-3 py-2">الدور</th>
                <th className="px-3 py-2">الحالة</th>
                <th className="px-3 py-2">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-border-subtle/50 border-b">
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        m.active
                          ? "bg-status-success/10 text-status-success"
                          : "bg-status-error/10 text-status-error"
                      }`}
                    >
                      {m.active ? "نشط" : "غير نشط"}
                    </span>
                  </td>
                  <td className="flex gap-1 px-3 py-2">
                    <button
                      onClick={() => setEditId(m.id)}
                      className="text-text-secondary hover:bg-muted rounded px-2 py-0.5 text-xs"
                    >
                      تعديل
                    </button>
                    {m.active && (
                      <button
                        onClick={async () => {
                          const r = await updateStaffMember({ id: m.id, active: false });
                          if (r.success) {
                            refresh();
                            showMsg("تم تعطيل الموظف");
                          } else showMsg(r.error ?? "فشل");
                        }}
                        className="text-status-warning hover:bg-status-warning/10 rounded px-2 py-0.5 text-xs"
                      >
                        تعطيل
                      </button>
                    )}
                    {!m.active && (
                      <button
                        onClick={async () => {
                          const r = await updateStaffMember({ id: m.id, active: true });
                          if (r.success) {
                            refresh();
                            showMsg("تم تفعيل الموظف");
                          } else showMsg(r.error ?? "فشل");
                        }}
                        className="text-status-success hover:bg-status-success/10 rounded px-2 py-0.5 text-xs"
                      >
                        تفعيل
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
    manager: "bg-status-warning/10 text-status-warning",
    cashier: "bg-status-success/10 text-status-success",
    barista: "bg-muted text-text-secondary",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? ""}`}>
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

  return (
    <div className="border-border-subtle mt-4 max-w-md rounded-xl border bg-white p-4">
      <h3 className="font-heading mb-3 text-sm font-semibold">
        {initial ? "تعديل موظف" : "موظف جديد"}
      </h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium">الاسم</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-border-subtle w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="اسم الموظف"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">الدور</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border-border-subtle w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="barista">باريستا</option>
            <option value="cashier">كاشير</option>
            <option value="manager">مدير</option>
            <option value="owner">مالك</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium">
            {initial ? "PIN الجديد (اتركه فارغًا لعدم التغيير)" : "PIN (4 أرقام)"}
          </label>
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="border-border-subtle w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="****"
            dir="ltr"
          />
        </div>

        {!initial && (
          <div>
            <label className="mb-1 block text-xs font-medium">تأكيد PIN</label>
            <input
              type="password"
              maxLength={4}
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="border-border-subtle w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="****"
              dir="ltr"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            if (!name.trim()) return;
            if (!initial && (!pin || pin.length !== 4)) return;
            if (!initial && pin !== pinConfirm) return;
            onSave({ name: name.trim(), role, pin });
          }}
          className="bg-brand-red flex-1 rounded-full px-4 py-2 text-sm font-bold text-white"
        >
          {initial ? "حفظ التغييرات" : "إضافة موظف"}
        </button>
        <button
          onClick={onCancel}
          className="text-text-secondary border-border-subtle flex-1 rounded-full border px-4 py-2 text-sm"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
