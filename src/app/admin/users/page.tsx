"use client";
import { useEffect, useMemo, useState } from "react";
import { getMemberStats, deleteUserDevices, type MemberStats } from "@/lib/admin-users";
import { useAuth } from "@/lib/auth-context";

// ─── /admin/users — สรุปสมาชิก + ตรวจการใช้ code ──────────────────────────────

const PAID_MEMBERS = 707; // จำนวนสมาชิกกลุ่มที่ชำระเงิน (ตัวเลขจาก Aj 2026-07-11)

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function KPI({ value, label, sub, color = "#0B6E65" }: {
  value: string | number; label: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #EBEBEA" }}>
      <p className="text-[26px] font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="text-[12.5px] font-semibold text-gray-600 mt-1.5">{label}</p>
      {sub && <p className="text-[11.5px] mt-0.5" style={{ color: "#A8A8A6" }}>{sub}</p>}
    </div>
  );
}

/** ย้ายสิทธิ์+ข้อมูลเรียนไปบัญชีใหม่ — เคสน้องเปลี่ยนอีเมล (Google account ใหม่) */
function MigrateCard() {
  const { user } = useAuth();
  const [fromEmail, setFrom] = useState("");
  const [toEmail,   setTo]   = useState("");
  const [busy,      setBusy] = useState(false);
  const [msg,       setMsg]  = useState<{ ok: boolean; text: string } | null>(null);

  async function migrate() {
    if (!user || busy) return;
    const f = fromEmail.trim().toLowerCase(), t = toEmail.trim().toLowerCase();
    if (!f || !t || f === t) { setMsg({ ok: false, text: "กรอกอีเมลเดิมและอีเมลใหม่ให้ครบ (ต้องไม่ซ้ำกัน)" }); return; }
    if (!confirm(`ย้ายสิทธิ์และข้อมูลเรียนทั้งหมด\n\nจาก: ${f}\nไป:   ${t}\n\nบัญชีเดิมจะไม่เหลือสิทธิ์ — ยืนยัน?`)) return;
    setBusy(true); setMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/migrate-user", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ fromEmail: f, toEmail: t }),
      });
      const d = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: d.error ?? "ย้ายไม่สำเร็จ" }); return; }
      const details = Object.entries(d.movedBySubcol as Record<string, number>)
        .filter(([, n]) => n > 0).map(([k, n]) => `${k} ${n}`).join(" · ");
      setMsg({ ok: true, text: `✓ ย้ายสำเร็จ — สิทธิ์คอร์ส ${d.coursesMoved} รายการ${details ? ` · ${details}` : ""}` });
      setFrom(""); setTo("");
    } catch {
      setMsg({ ok: false, text: "ย้ายไม่สำเร็จ กรุณาลองใหม่" });
    } finally {
      setBusy(false);
    }
  }

  const INPUT = "flex-1 min-w-0 rounded-xl px-3 py-2.5 text-[13px] bg-white focus:outline-none";
  return (
    <div className="bg-white rounded-2xl p-5 mb-3" style={{ border: "1px solid #EBEBEA" }}>
      <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        ย้ายสิทธิ์ไปบัญชีใหม่ (น้องเปลี่ยนอีเมล)
      </p>
      <p className="text-[12px] mb-3" style={{ color: "#A8A8A6" }}>
        เงื่อนไข: น้องต้องล็อกอินด้วยอีเมลใหม่ 1 ครั้งก่อน · ย้ายสิทธิ์คอร์ส + ประวัติ + คลังข้อผิด +
        ความคืบหน้าวิดีโอ + streak ครบชุด แล้วบัญชีเดิมจะไม่เหลือสิทธิ์
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className={INPUT} style={{ border: "1px solid #E0DFDC" }}
          placeholder="อีเมลเดิม" value={fromEmail} onChange={(e) => setFrom(e.target.value)} />
        <span className="hidden sm:flex items-center text-[13px]" style={{ color: "#A8A8A6" }}>→</span>
        <input className={INPUT} style={{ border: "1px solid #E0DFDC" }}
          placeholder="อีเมลใหม่" value={toEmail} onChange={(e) => setTo(e.target.value)} />
        <button onClick={migrate} disabled={busy}
          className="text-[13px] font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-50 flex-shrink-0"
          style={{ backgroundColor: "#0B6E65" }}>
          {busy ? "กำลังย้าย…" : "ย้ายสิทธิ์"}
        </button>
      </div>
      {msg && (
        <p className="text-[12.5px] mt-2.5 rounded-lg px-3 py-2"
          style={msg.ok
            ? { backgroundColor: "#F0FDF4", color: "#15803D" }
            : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [stats,   setStats]   = useState<MemberStats | null>(null);
  const [error,   setError]   = useState("");
  const [search,  setSearch]  = useState("");
  const [tab,     setTab]     = useState<"members" | "codes">("members");

  useEffect(() => {
    getMemberStats()
      .then(setStats)
      .catch((e) => { console.error(e); setError("โหลดข้อมูลไม่สำเร็จ — ต้อง login ด้วยบัญชี admin"); });
  }, []);

  const filtered = useMemo(() => {
    if (!stats) return [];
    const q = search.toLowerCase().trim();
    if (!q) return stats.members;
    return stats.members.filter((m) =>
      m.email.toLowerCase().includes(q) || m.displayName.toLowerCase().includes(q)
      || m.codes.some((c) => c.toLowerCase().includes(q)));
  }, [stats, search]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      {/* Header */}
      <div className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-gray-900">สมาชิก</h1>
          {stats && (
            <span className="text-[12px] font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
              {stats.totalUsers} บัญชี
            </span>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 pt-6 pb-16">
        {error && (
          <div className="rounded-xl px-4 py-3 mb-4 text-[13px] font-medium"
            style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            {error}
          </div>
        )}

        {!stats && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-24" style={{ border: "1px solid #EBEBEA" }} />
            ))}
          </div>
        )}

        {stats && (
          <>
            {/* ═══ KPI ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <KPI value={stats.totalUsers} label="บัญชีที่เคย login" />
              <KPI value={stats.activatedUsers} label="เปิดใช้คอร์สแล้ว"
                sub={`จากสมาชิกจ่ายเงิน ~${PAID_MEMBERS} คน`} />
              <KPI value={stats.examUsers} label="ทำข้อสอบแล้ว"
                sub={`${stats.totalAttempts.toLocaleString()} ครั้งรวม`} color="#7C3AED" />
              <KPI
                value={`${Math.round((stats.activatedUsers / PAID_MEMBERS) * 100)}%`}
                label="อัตราเข้าใช้จริง"
                sub="เปิดใช้ ÷ สมาชิกจ่ายเงิน"
                color={stats.activatedUsers > PAID_MEMBERS ? "#DC2626" : "#B45309"}
              />
            </div>

            {/* ═══ เครื่องมือ: ย้ายสิทธิ์ข้ามบัญชี ═══ */}
            <MigrateCard />

            {/* คำเตือนถ้าบัญชี activate เกินสมาชิกจ่ายเงิน */}
            {stats.activatedUsers > PAID_MEMBERS && (
              <div className="rounded-xl px-4 py-3 mb-4 text-[13px] font-semibold"
                style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                ⚠️ จำนวนบัญชีที่เปิดใช้ ({stats.activatedUsers}) เกินสมาชิกที่ชำระเงิน ({PAID_MEMBERS})
                — มีการแชร์ code แน่นอน ดูแท็บ &ldquo;การใช้ Code&rdquo;
              </div>
            )}

            {/* ═══ Tabs ═══ */}
            <div className="flex gap-2 mb-4">
              {([
                ["members", `รายชื่อสมาชิก (${stats.members.length})`],
                ["codes",   `การใช้ Code (${stats.codeUsage.length} ใบ)`],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="text-[12.5px] font-semibold px-3.5 py-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: tab === key ? "#111110" : "white",
                    color:           tab === key ? "white" : "#6B6B6A",
                    border:          "1px solid " + (tab === key ? "#111110" : "#E0DFDC"),
                  }}>
                  {label}
                </button>
              ))}
            </div>

            {/* ═══ Tab: รายชื่อ ═══ */}
            {tab === "members" && (
              <>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ค้นหาอีเมล / ชื่อ / code..."
                  className="w-full bg-white rounded-xl px-4 py-2.5 text-[13.5px] mb-3 focus:outline-none focus:ring-2 focus:ring-[#0B6E65]/20"
                  style={{ border: "1px solid #E0DFDC" }}
                />
                <div className="bg-white rounded-2xl overflow-x-auto" style={{ border: "1px solid #EBEBEA" }}>
                  <table className="w-full text-[12.5px]" style={{ minWidth: 640 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#FAFAF9", color: "#A8A8A6" }}>
                        <th className="text-left px-4 py-2.5 font-bold">อีเมล</th>
                        <th className="text-left px-3 py-2.5 font-bold">Code ที่ใช้</th>
                        <th className="text-right px-3 py-2.5 font-bold">ชุดที่ทำ</th>
                        <th className="text-right px-3 py-2.5 font-bold">ครั้ง</th>
                        <th className="text-right px-3 py-2.5 font-bold">อุปกรณ์</th>
                        <th className="text-right px-4 py-2.5 font-bold">ใช้ล่าสุด</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: "#F3F2F0" }}>
                      {filtered.slice(0, 300).map((m) => (
                        <tr key={m.uid} className="hover:bg-stone-50">
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-gray-900">{m.email || "(ไม่มีอีเมล)"}</p>
                            <p className="text-[11.5px]" style={{ color: "#A8A8A6" }}>{m.displayName}</p>
                          </td>
                          <td className="px-3 py-2.5">
                            {m.activated ? (
                              <span className="font-mono text-[11.5px]" style={{ color: "#0B6E65" }}>
                                {m.codes.join(", ")}
                              </span>
                            ) : (
                              <span className="text-[11.5px]" style={{ color: "#C4C4C0" }}>ยังไม่เปิดใช้</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold"
                            style={{ color: m.examsTaken > 0 ? "#0B6E65" : "#C4C4C0" }}>
                            {m.examsTaken}
                          </td>
                          <td className="px-3 py-2.5 text-right" style={{ color: "#6B7280" }}>
                            {m.attempts}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold whitespace-nowrap"
                            title={m.deviceLabels.join(", ")}
                            style={{ color: m.devices >= 4 ? "#DC2626" : m.devices === 3 ? "#B45309" : m.devices > 0 ? "#6B7280" : "#C4C4C0" }}>
                            {m.devices > 0 ? m.devices : "—"}
                            {m.devices >= 4 && " ⚠️"}
                            {m.devices > 0 && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`ล้างรายการอุปกรณ์ของ ${m.email}?\n(ใช้เมื่อลูกค้าเปลี่ยนเครื่องใหม่ — เครื่องที่ใช้อยู่จะลงทะเบียนใหม่เองอัตโนมัติ)`)) return;
                                  await deleteUserDevices(m.uid);
                                  setStats((prev) => prev && {
                                    ...prev,
                                    members: prev.members.map((x) =>
                                      x.uid === m.uid ? { ...x, devices: 0, deviceLabels: [] } : x),
                                  });
                                }}
                                className="ml-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
                                title="ล้างรายการอุปกรณ์ (ลูกค้าเปลี่ยนเครื่อง)"
                              >
                                ล้าง
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right" style={{ color: "#6B7280" }}>
                            {fmtDate(m.lastSeenAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 300 && (
                    <p className="px-4 py-2.5 text-[11.5px]" style={{ color: "#A8A8A6" }}>
                      แสดง 300 จาก {filtered.length} — ใช้ช่องค้นหาเพื่อกรอง
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ═══ Tab: การใช้ Code ═══ */}
            {tab === "codes" && (
              <div className="space-y-3">
                <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>
                  เรียงจาก code ที่มีบัญชีใช้มากที่สุด — code ที่แจกเฉพาะคน (maxUses=1)
                  แต่มีหลายบัญชี = ถูกแชร์
                </p>
                {stats.codeUsage.map((cu) => (
                  <div key={cu.code} className="bg-white rounded-2xl px-4 py-3.5"
                    style={{ border: `1px solid ${cu.users.length > 50 ? "#FDE68A" : "#EBEBEA"}` }}>
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="font-mono font-bold text-[14px] text-gray-900">{cu.code}</p>
                      <span className="text-[12px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                        {cu.users.length} บัญชี
                      </span>
                    </div>
                    <p className="text-[11.5px] mb-2" style={{ color: "#A8A8A6" }}>{cu.courseName}</p>
                    <details>
                      <summary className="text-[12px] cursor-pointer" style={{ color: "#0B6E65" }}>
                        ดูรายชื่ออีเมลที่ใช้ code นี้
                      </summary>
                      <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                        {cu.users.map((u, i) => (
                          <p key={u.uid + i} className="text-[12px]" style={{ color: "#6B7280" }}>
                            {i + 1}. {u.email}
                          </p>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
