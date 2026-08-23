"use client";
/**
 * /admin/feedback — ผลแบบประเมินการสอน (รวมฝั่ง server ที่ /api/admin/feedback)
 *
 * แสดงเป็นภาพรวมอย่างเดียว ไม่ผูกชื่อรายคน — ตรงกับที่บอกน้องไว้ในหน้าแบบประเมิน
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import { SURVEY, FEEDBACK_REWARD, type SurveyQuestion, type SurveyAnswers } from "@/lib/feedback-types";

interface Summary {
  responses: number;
  members: number;
  responseRate: number;
  avgStars: number;
  tally: Record<string, Record<string, number>>;
  comments: string[];
  codes: { total: number; unused: number; used: number };
}

const CARD = { border: "1px solid #EBEBEA" } as const;

function Bar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="mb-2.5">
      <div className="flex justify-between mb-1 gap-3">
        <span className="text-[13px] text-gray-700 leading-snug">{label}</span>
        <span className="text-[12.5px] font-bold flex-shrink-0" style={{ color }}>
          {count} · {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function QuestionResult({ q, tally, responses }: {
  q: SurveyQuestion; tally: Record<string, number>; responses: number;
}) {
  if (!tally) return null;

  if (q.kind === "grid") {
    return (
      <div className="bg-white rounded-2xl p-5 mb-3" style={CARD}>
        <p className="text-[14.5px] font-bold text-gray-900 mb-3">{q.title}</p>
        {q.rows!.map((row) => {
          const counts = q.scale!.map((s) => tally[`${row.value}:${s.value}`] ?? 0);
          const sum    = counts.reduce((a, b) => a + b, 0);
          return (
            <div key={row.value} className="mb-3.5">
              <p className="text-[13.5px] font-semibold text-gray-800 mb-1.5">{row.label}</p>
              <div className="flex h-6 rounded-lg overflow-hidden" style={{ backgroundColor: "#F3F2F0" }}>
                {q.scale!.map((s, i) => {
                  const pct = sum ? (counts[i] / sum) * 100 : 0;
                  if (pct === 0) return null;
                  const c = s.value === "high" ? "#16A34A" : s.value === "ok" ? "#FCD34D" : "#D4D4D0";
                  return (
                    <div key={s.value} className="flex items-center justify-center text-[11px] font-bold"
                      style={{ width: `${pct}%`, backgroundColor: c,
                               color: s.value === "high" ? "white" : "#7C2D12" }}>
                      {pct >= 12 ? `${Math.round(pct)}%` : ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 mt-1">
                {q.scale!.map((s, i) => (
                  <span key={s.value} className="text-[11.5px]" style={{ color: "#A8A8A6" }}>
                    {s.label} {counts[i]}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const choices = q.kind === "stars"
    ? [5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} ดาว` }))
    : (q.choices ?? []);

  const entries = choices
    .map((c) => ({ ...c, count: tally[c.value] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white rounded-2xl p-5 mb-3" style={CARD}>
      <p className="text-[14.5px] font-bold text-gray-900 mb-1">{q.title}</p>
      {q.kind === "multi" && (
        <p className="text-[12px] mb-3" style={{ color: "#A8A8A6" }}>
          เลือกได้หลายข้อ — % คิดจากจำนวนคนตอบ {responses} คน
        </p>
      )}
      {q.kind !== "multi" && <div className="mb-3" />}
      {entries.map((c, i) => (
        <Bar key={c.value} label={c.label} count={c.count} total={responses}
          color={i === 0 && c.count > 0 ? BRAND.primary : "#8ECFBF"} />
      ))}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const { user } = useAuth();
  const [data,    setData]    = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setErr("");
    try {
      const token = await user.getIdToken();
      const res   = await fetch("/api/admin/feedback", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setErr("โหลดไม่สำเร็จ"); return; }
      setData(await res.json());
    } catch { setErr("โหลดไม่สำเร็จ"); }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Export Excel: ชีท 1 คำตอบรายใบ (แปลงรหัส → ข้อความไทย) · ชีท 2 สรุปนับ ──
  const [exporting, setExporting] = useState(false);
  async function exportXlsx() {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/feedback?raw=1", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error();
      const { rows } = await res.json() as { rows: { n: number; createdAt: string | null; answers: SurveyAnswers }[] };
      const XLSX = await import("xlsx");

      const labelOf = (q: SurveyQuestion, v: string) => q.choices?.find((c) => c.value === v)?.label ?? v;
      const fmtDate = (iso: string | null) =>
        iso ? new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "";

      // หัวคอลัมน์: grid แตกเป็นคอลัมน์ละแถว (เช่น "แต่ละส่วนช่วยมากแค่ไหน: คลิปติว")
      const header: string[] = ["ลำดับ", "วันที่ตอบ"];
      for (const q of SURVEY) {
        if (q.kind === "grid") (q.rows ?? []).forEach((r) => header.push(`${q.title}: ${r.label}`));
        else header.push(q.title);
      }
      const body = rows.map((r) => {
        const line: (string | number)[] = [r.n, fmtDate(r.createdAt)];
        for (const q of SURVEY) {
          const v = r.answers[q.id];
          if (q.kind === "grid") {
            const rec = (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as Record<string, string>;
            (q.rows ?? []).forEach((row) => line.push(q.scale?.find((s) => s.value === rec[row.value])?.label ?? rec[row.value] ?? ""));
          } else if (q.kind === "stars") line.push(typeof v === "number" ? v : "");
          else if (q.kind === "multi") line.push(Array.isArray(v) ? v.map((x) => labelOf(q, String(x))).join("; ") : "");
          else if (q.kind === "single") line.push(typeof v === "string" ? labelOf(q, v) : "");
          else line.push(typeof v === "string" ? v : "");
        }
        return line;
      });
      const ws1 = XLSX.utils.aoa_to_sheet([header, ...body]);
      ws1["!cols"] = header.map((h, i) => ({ wch: i < 2 ? 12 : Math.min(40, Math.max(16, h.length)) }));

      // ชีทสรุป จาก tally ที่โหลดอยู่แล้ว
      const sum: (string | number)[][] = [["คำถาม", "ตัวเลือก", "จำนวน", "สัดส่วน (%)"]];
      const total = rows.length || 1;
      for (const q of SURVEY) {
        const t = data?.tally[q.id] ?? {};
        if (q.kind === "text") continue;
        if (q.kind === "grid") {
          for (const row of q.rows ?? []) for (const s of q.scale ?? []) {
            const n = t[`${row.value}:${s.value}`] ?? 0;
            sum.push([`${q.title}: ${row.label}`, s.label, n, Math.round((n / total) * 100)]);
          }
        } else if (q.kind === "stars") {
          for (const star of [5, 4, 3, 2, 1]) { const n = t[String(star)] ?? 0; sum.push([q.title, `${star} ดาว`, n, Math.round((n / total) * 100)]); }
        } else {
          for (const c of q.choices ?? []) { const n = t[c.value] ?? 0; sum.push([q.title, c.label, n, Math.round((n / total) * 100)]); }
        }
      }
      const ws2 = XLSX.utils.aoa_to_sheet(sum);
      ws2["!cols"] = [{ wch: 44 }, { wch: 30 }, { wch: 8 }, { wch: 12 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "คำตอบรายใบ");
      XLSX.utils.book_append_sheet(wb, ws2, "สรุปนับ");
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
      XLSX.writeFile(wb, `feedback-${today}.xlsx`);
    } catch {
      alert("Export ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally { setExporting(false); }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-16">

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[19px] font-bold text-gray-900">ผลประเมินการสอน</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#A8A8A6" }}>
              น้องตอบที่ <Link href="/feedback" className="underline">/feedback</Link> · ตอบครบได้โค้ดลด ฿{FEEDBACK_REWARD.amount}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={exportXlsx} disabled={exporting || !data}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: BRAND.primary }}>
              {exporting ? "กำลังสร้างไฟล์…" : "⬇ Export Excel"}
            </button>
            <button onClick={load} disabled={loading}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
              style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
              {loading ? "กำลังโหลด…" : "รีเฟรช"}
            </button>
          </div>
        </div>

        {err && <p className="text-[13px] mb-4" style={{ color: "#DC2626" }}>{err}</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { label: "คนตอบแล้ว",   value: data.responses,                     color: "#0B6E65" },
                { label: "จากสมาชิก",    value: `${data.responseRate}%`,            color: "#7C3AED",
                  sub: `${data.members} คน` },
                { label: "คะแนนเฉลี่ย",  value: data.avgStars ? `${data.avgStars}★` : "—", color: "#F59E0B" },
                { label: "โค้ดที่ใช้แล้ว", value: `${data.codes.used}/${data.codes.total}`, color: "#16A34A" },
              ].map((k) => (
                <div key={k.label} className="bg-white rounded-2xl p-4" style={CARD}>
                  <div className="text-[24px] font-extrabold leading-none" style={{ color: k.color }}>
                    {k.value}
                  </div>
                  <div className="text-[12px] font-semibold text-gray-500 mt-1">{k.label}</div>
                  {"sub" in k && k.sub && (
                    <div className="text-[11.5px]" style={{ color: "#A8A8A6" }}>{k.sub}</div>
                  )}
                </div>
              ))}
            </div>

            {data.responses === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center" style={CARD}>
                <div className="text-4xl mb-3">📝</div>
                <p className="text-[15px] font-semibold text-gray-800 mb-1">ยังไม่มีใครตอบ</p>
                <p className="text-[13px]" style={{ color: "#A8A8A6" }}>
                  โพสต์ลิงก์ /feedback ในกลุ่มแล้วผลจะขึ้นที่นี่
                </p>
              </div>
            ) : (
              <>
                {SURVEY.filter((q) => q.kind !== "text").map((q) => (
                  <QuestionResult key={q.id} q={q}
                    tally={data.tally[q.id] ?? {}} responses={data.responses} />
                ))}

                {data.comments.length > 0 && (
                  <div className="bg-white rounded-2xl p-5" style={CARD}>
                    <p className="text-[14.5px] font-bold text-gray-900 mb-1">
                      ข้อความถึงพี่อ้อม
                    </p>
                    <p className="text-[12px] mb-3" style={{ color: "#A8A8A6" }}>
                      {data.comments.length} ข้อความ · ใหม่สุดอยู่บน (ไม่แสดงชื่อผู้เขียน)
                    </p>
                    <div className="space-y-2.5">
                      {data.comments.map((c, i) => (
                        <p key={i} className="text-[13.5px] leading-relaxed rounded-xl px-3.5 py-2.5"
                          style={{ backgroundColor: "#FAFAF8", border: "1px solid #EBEBEA", color: "#374151" }}>
                          {c}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        <Link href="/admin" className="btn-secondary w-full py-3 text-[14px] block text-center mt-5">
          ← กลับ Admin
        </Link>
      </div>
    </div>
  );
}
