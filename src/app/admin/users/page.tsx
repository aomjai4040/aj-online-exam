"use client";
import { useEffect, useMemo, useState } from "react";
import { getMemberStats, type MemberStats } from "@/lib/admin-users";

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
                          <td className="px-3 py-2.5 text-right font-bold"
                            title={m.deviceLabels.join(", ")}
                            style={{ color: m.devices >= 3 ? "#DC2626" : m.devices > 0 ? "#6B7280" : "#C4C4C0" }}>
                            {m.devices > 0 ? m.devices : "—"}
                            {m.devices >= 3 && " ⚠️"}
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
