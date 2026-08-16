"use client";
/**
 * /admin/dcd-intake — คำตอบแบบสอบถามก่อนจ่ายของคอร์ส คร.
 *
 * ใช้ตอบ 3 คำถามของ Aj: ใครยังไม่สมัครสอบกับกรมฯ (ต้องเตือนก่อน 4 ก.ย.) ·
 * ควรติวเรื่องไหนก่อน (เรียงคิวผลิตเนื้อหา 35 วัน) · ช่องทางไหนขายได้จริง
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BRAND } from "@/lib/subjects";
import { DCD_INTAKE, type IntakeAnswers } from "@/lib/dcd-intake";

interface Row { email: string; answers: IntakeAnswers }

export default function AdminDcdIntakePage() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "dcdIntake"));
      setRows(snap.docs.map((d) => ({
        email:   String(d.data().email ?? ""),
        answers: (d.data().answers ?? {}) as IntakeAnswers,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const total = rows.length;

  /** นับต่อตัวเลือก */
  function tally(qid: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const a = r.answers[qid];
      const vals = Array.isArray(a) ? a : a ? [a] : [];
      for (const v of vals) out[v] = (out[v] ?? 0) + 1;
    }
    return out;
  }

  const notApplied = rows.filter((r) => r.answers.applied === "soon");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-16">

        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[19px] font-bold text-gray-900">แบบสอบถามคอร์ส คร.</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#A8A8A6" }}>
              น้องตอบก่อนชำระเงิน · {total} คน
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
            {loading ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
        </div>

        {/* คนที่ยังไม่สมัครสอบ — สำคัญสุด ต้องตามก่อนปิดรับ 4 ก.ย. */}
        {notApplied.length > 0 && (
          <div className="rounded-2xl px-4 py-3.5 mb-4"
            style={{ backgroundColor: "#FEF2F2", border: "1.5px solid #FECACA" }}>
            <p className="text-[13.5px] font-bold mb-1" style={{ color: "#B91C1C" }}>
              ⚠️ {notApplied.length} คนยังไม่ได้สมัครสอบกับกรมฯ (ปิดรับ 4 ก.ย.)
            </p>
            <p className="text-[12.5px] leading-relaxed" style={{ color: "#DC2626" }}>
              {notApplied.map((r) => r.email).join(" · ")}
            </p>
          </div>
        )}

        {total === 0 && !loading ? (
          <div className="bg-white rounded-2xl p-10 text-center" style={{ border: "1px solid #EBEBEA" }}>
            <div className="text-4xl mb-3">📋</div>
            <p className="text-[15px] font-semibold text-gray-800">ยังไม่มีคนตอบ</p>
          </div>
        ) : (
          DCD_INTAKE.map((q) => {
            const t = tally(q.id);
            const entries = q.choices
              .map((c) => ({ ...c, count: t[c.value] ?? 0 }))
              .sort((a, b) => b.count - a.count);
            return (
              <div key={q.id} className="bg-white rounded-2xl p-5 mb-3"
                style={{ border: "1px solid #EBEBEA" }}>
                <p className="text-[14.5px] font-bold text-gray-900 mb-3">{q.title}</p>
                {entries.map((c, i) => {
                  const pct = total ? Math.round((c.count / total) * 100) : 0;
                  return (
                    <div key={c.value} className="mb-2.5">
                      <div className="flex justify-between mb-1 gap-3">
                        <span className="text-[13px] text-gray-700">{c.label}</span>
                        <span className="text-[12.5px] font-bold flex-shrink-0"
                          style={{ color: i === 0 && c.count > 0 ? BRAND.primary : "#8ECFBF" }}>
                          {c.count} · {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`,
                                   backgroundColor: i === 0 && c.count > 0 ? BRAND.primary : "#8ECFBF" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}

        <Link href="/admin" className="btn-secondary w-full py-3 text-[14px] block text-center mt-5">
          ← กลับ Admin
        </Link>
      </div>
    </div>
  );
}
