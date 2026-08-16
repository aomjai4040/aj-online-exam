"use client";
/**
 * TagCoverageCard — สรุปสถานะแท็กของคลังข้อสอบ (วางบนหน้า /admin/exams)
 *
 * ตอบ 3 คำถามที่ Aj ต้องรู้ก่อนวางแผนผลิตข้อสอบทั้งเดือน:
 *   1. แท็กครบไปกี่ข้อแล้ว (เหลือต้องไล่แท็กอีกเท่าไหร่)
 *   2. สัดส่วนความจำ:ประยุกต์ ตอนนี้เท่าไหร่ เทียบเป้า 60:40
 *   3. มีข้อบริบท อปท. กี่ข้อ อยู่ชุดไหน — ต้องกันก่อนปล่อยเข้าสนาม คร.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { BRAND } from "@/lib/subjects";
import { DCD_TOPICS, TARGET_RECALL_RATIO } from "@/lib/question-tags";

interface Coverage {
  total: number; tagged: number; recall: number; apply: number;
  recallRatio: number; byTopic: Record<string, number>; localContext: number;
  localExams: { examId: string; title: string; count: number }[];
}

export default function TagCoverageCard() {
  const { user } = useAuth();
  const [d, setD] = useState<Coverage | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/tag-coverage", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setD(await res.json());
    } catch { /* กดรีเฟรชใหม่ได้ */ }
    finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="card-elev p-5 mb-4">
        <p className="text-[13px]" style={{ color: "#A8A8A6" }}>กำลังอ่านคลังข้อสอบ…</p>
      </div>
    );
  }
  if (!d) return null;

  const untagged = d.total - d.tagged;
  const pctTagged = d.total ? Math.round((d.tagged / d.total) * 100) : 0;
  const recallPct = Math.round(d.recallRatio * 100);
  const targetPct = Math.round(TARGET_RECALL_RATIO * 100);
  const offTarget = Math.abs(recallPct - targetPct) > 10 && (d.recall + d.apply) >= 20;

  return (
    <div className="card-elev p-5 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-[15.5px] font-bold text-gray-900">สถานะแท็กคลังข้อสอบ</h2>
          <p className="text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>
            ต้องแท็กครบก่อนย้ายข้อเข้าสนามใหม่
          </p>
        </div>
        <button onClick={load}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
          style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
          รีเฟรช
        </button>
      </div>

      {/* แท็กครบไปแค่ไหน */}
      <div className="mb-3.5">
        <div className="flex justify-between mb-1">
          <span className="text-[13px] text-gray-700">แท็กครบแล้ว</span>
          <span className="text-[13px] font-bold" style={{ color: BRAND.primary }}>
            {d.tagged.toLocaleString()}/{d.total.toLocaleString()} · {pctTagged}%
          </span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pctTagged}%`, backgroundColor: BRAND.primary }} />
        </div>
        {untagged > 0 && (
          <p className="text-[12px] mt-1" style={{ color: "#B45309" }}>
            เหลืออีก {untagged.toLocaleString()} ข้อที่ยังไม่ได้แท็ก
          </p>
        )}
      </div>

      {/* สัดส่วนความจำ : ประยุกต์ */}
      <div className="rounded-xl px-3.5 py-3 mb-3"
        style={{ backgroundColor: offTarget ? "#FFFBEB" : "#F5FAF9",
                 border: `1px solid ${offTarget ? "#FDE68A" : "#C3E5DE"}` }}>
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="text-[13px] font-semibold text-gray-800">ความจำ : ประยุกต์</span>
          <span className="text-[13px] font-bold"
            style={{ color: offTarget ? "#B45309" : BRAND.primary }}>
            {recallPct} : {100 - recallPct}
            <span className="font-normal text-[11.5px]" style={{ color: "#A8A8A6" }}>
              {" "}(เป้า {targetPct} : {100 - targetPct})
            </span>
          </span>
        </div>
        <div className="flex h-5 rounded-lg overflow-hidden" style={{ backgroundColor: "#F3F2F0" }}>
          {recallPct > 0 && (
            <div className="flex items-center justify-center text-[11px] font-bold text-white"
              style={{ width: `${recallPct}%`, backgroundColor: BRAND.primary }}>
              {d.recall}
            </div>
          )}
          {recallPct < 100 && (
            <div className="flex items-center justify-center text-[11px] font-bold"
              style={{ width: `${100 - recallPct}%`, backgroundColor: "#C3E5DE", color: "#0B4F48" }}>
              {d.apply}
            </div>
          )}
        </div>
        {offTarget && (
          <p className="text-[12px] mt-1.5" style={{ color: "#B45309" }}>
            {recallPct > targetPct
              ? `ข้อความจำเยอะไป — ควรเพิ่มข้อประยุกต์อีกราว ${Math.round((d.recall / TARGET_RECALL_RATIO) - (d.recall + d.apply))} ข้อ`
              : "ข้อประยุกต์เยอะกว่าเป้า — เพิ่มข้อความจำอีกหน่อย"}
          </p>
        )}
      </div>

      {/* ⚠️ ข้อบริบทท้องถิ่น — ต้องกันก่อนเข้าสนาม คร. */}
      {d.localContext > 0 && (
        <div className="rounded-xl px-3.5 py-3 mb-3"
          style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA" }}>
          <p className="text-[13px] font-bold mb-1" style={{ color: "#B91C1C" }}>
            ⚠️ {d.localContext} ข้ออ้างบริบท อปท./ท้องถิ่น
          </p>
          <p className="text-[12px] leading-relaxed mb-1.5" style={{ color: "#DC2626" }}>
            ระบบกันไม่ให้ปล่อยเข้าสนามกรมควบคุมโรคแล้ว — แต่ถ้าจะเอาข้อพวกนี้มาใช้
            ต้องแก้โจทย์ให้เป็นบริบทกรมฯ ก่อน
          </p>
          <div className="space-y-0.5">
            {d.localExams.slice(0, 6).map((e) => (
              <p key={e.examId} className="text-[12px]" style={{ color: "#B91C1C" }}>
                · {e.title} — {e.count} ข้อ
              </p>
            ))}
          </div>
        </div>
      )}

      {/* กระจายตามหัวข้อ */}
      {Object.keys(d.byTopic).length > 0 && (
        <div>
          <p className="text-[12px] font-bold mb-2" style={{ color: "#A8A8A6" }}>
            กระจายตามหัวข้อ (8 หัวข้อภาค ข กรมควบคุมโรค)
          </p>
          <div className="space-y-1.5">
            {DCD_TOPICS.map((t) => {
              const n = d.byTopic[t.code] ?? 0;
              const pct = d.tagged ? Math.round((n / d.tagged) * 100) : 0;
              return (
                <div key={t.code} className="flex items-center gap-2.5">
                  <span className="text-[12.5px] text-gray-700 flex-1 min-w-0 truncate">{t.label}</span>
                  <div className="w-24 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#F3F2F0" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: n === 0 ? "#FCA5A5" : BRAND.primary }} />
                  </div>
                  <span className="text-[12px] font-semibold w-10 text-right flex-shrink-0"
                    style={{ color: n === 0 ? "#DC2626" : "#6B7280" }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
