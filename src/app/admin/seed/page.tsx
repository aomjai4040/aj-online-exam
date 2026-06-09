"use client";
import { useState } from "react";
import Link from "next/link";
import { createExam, getPublishedExams } from "@/lib/firestore";
import { SEEDS } from "@/lib/seeds";

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = "idle" | "checking" | "importing" | "done" | "exists" | "error";

interface SeedState {
  status:  Status;
  message: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeedPage() {
  const [states, setStates] = useState<Record<string, SeedState>>(
    Object.fromEntries(SEEDS.map((s) => [s.id, { status: "idle", message: "" }]))
  );

  function setState(id: string, patch: Partial<SeedState>) {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function handleImport(seedId: string) {
    const seed = SEEDS.find((s) => s.id === seedId);
    if (!seed) return;

    setState(seedId, { status: "checking", message: "กำลังตรวจสอบ..." });

    try {
      // Check if exam with same title already exists
      const existing = await getPublishedExams();
      const alreadyIn = existing.some(
        (e) => e.title.trim() === seed.form.title.trim()
      );

      if (alreadyIn) {
        setState(seedId, {
          status:  "exists",
          message: "มีชุดนี้ใน Firestore แล้ว",
        });
        return;
      }

      setState(seedId, { status: "importing", message: "กำลัง import..." });
      await createExam(seed.form);
      setState(seedId, {
        status:  "done",
        message: `นำเข้าสำเร็จ ${seed.questionCount} ข้อ`,
      });
    } catch (err) {
      console.error(err);
      setState(seedId, {
        status:  "error",
        message: "เกิดข้อผิดพลาด กรุณาตรวจสอบ Firebase",
      });
    }
  }

  // ── Status helpers ──────────────────────────────────────────────────────────

  const STATUS_ICON: Record<Status, string> = {
    idle:      "📥",
    checking:  "🔍",
    importing: "⏳",
    done:      "✅",
    exists:    "☑️",
    error:     "❌",
  };

  const STATUS_COLOR: Record<Status, { bg: string; border: string; text: string }> = {
    idle:      { bg: "#EBF5F3", border: "#C3E5DE", text: "#0B6E65" },
    checking:  { bg: "#EFF6FF", border: "#BFDBFE", text: "#2563EB" },
    importing: { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309" },
    done:      { bg: "#F0FDF4", border: "#86EFAC", text: "#16A34A" },
    exists:    { bg: "#F5F5F3", border: "#EBEBEA", text: "#6B7280" },
    error:     { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626" },
  };

  const SUBJECT_COLOR: Record<string, string> = {
    ระบาดวิทยา:          "#3B82F6",
    อนามัยสิ่งแวดล้อม:   "#10B981",
    กฎหมาย:              "#F97316",
    บริหารสาธารณสุข:     "#8B5CF6",
    ชีวสถิติ:            "#0D9488",
  };
  function subjectColor(s: string) { return SUBJECT_COLOR[s] ?? "#0B6E65"; }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-[16px] transition-colors"
            style={{ color: "#4A5568" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Admin
          </Link>
          <span style={{ color: "#EBEBEA" }}>/</span>
          <h1 className="text-[18px] font-bold text-gray-900">Seed ข้อสอบ</h1>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-5 pt-6 pb-16">

        {/* Info banner */}
        <div
          className="flex items-start gap-3 p-4 rounded-2xl mb-5 text-[16px]"
          style={{ backgroundColor: "#EBF5F3", border: "1px solid #C3E5DE" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ color: "#0B6E65" }}>
            <p className="font-semibold mb-0.5">นำเข้าข้อสอบสำเร็จรูปเข้า Firestore</p>
            <p className="text-[18px] opacity-80">
              ระบบจะตรวจสอบชื่อชุดก่อน — หากมีชุดนั้นอยู่แล้วจะไม่นำเข้าซ้ำ
              ข้อสอบที่นำเข้าจะปรากฏในหน้าคลังข้อสอบทันทีหากเปิด isPublished
            </p>
          </div>
        </div>

        {/* Seed list */}
        <div className="space-y-3">
          {SEEDS.map((seed) => {
            const st    = states[seed.id];
            const sc    = STATUS_COLOR[st.status];
            const color = subjectColor(seed.subject);
            const hex   = color.replace("#", "");
            const r     = parseInt(hex.slice(0, 2), 16);
            const g     = parseInt(hex.slice(2, 4), 16);
            const b     = parseInt(hex.slice(4, 6), 16);
            const chipBg = `rgba(${r},${g},${b},0.09)`;
            const busy  = st.status === "checking" || st.status === "importing";

            return (
              <div
                key={seed.id}
                className="bg-white rounded-2xl overflow-hidden"
                style={{ border: "1px solid #EBEBEA" }}
              >
                {/* Accent bar */}
                <div className="h-[3px]" style={{ backgroundColor: color }} />

                <div className="p-5">
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <span
                        className="inline-block text-[17px] font-bold px-2.5 py-[5px] rounded-full mb-2"
                        style={{ backgroundColor: chipBg, color }}
                      >
                        {seed.subject}
                      </span>
                      <h3 className="text-[18px] font-bold text-gray-900 leading-snug">
                        {seed.form.title}
                      </h3>
                      {seed.form.description && (
                        <p className="text-[18px] mt-1 line-clamp-2" style={{ color: "#4A5568" }}>
                          {seed.form.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 text-[18px] mb-4" style={{ color: "#9CA3AF" }}>
                    <span className="font-semibold" style={{ color: "#6B7280" }}>
                      {seed.questionCount} ข้อ
                    </span>
                    <span className="opacity-40">·</span>
                    <span>{seed.form.timeLimit} นาที</span>
                    <span className="opacity-40">·</span>
                    <span>{seed.form.isPublished ? "เผยแพร่ทันที" : "ฉบับร่าง"}</span>
                  </div>

                  {/* Status + button row */}
                  <div className="flex items-center gap-3">
                    {/* Status pill */}
                    {st.status !== "idle" && (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[18px] font-medium flex-1"
                        style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}`, color: sc.text }}
                      >
                        <span>{STATUS_ICON[st.status]}</span>
                        <span>{st.message}</span>
                      </div>
                    )}
                    {st.status === "idle" && <div className="flex-1" />}

                    {/* Action button */}
                    <button
                      onClick={() => handleImport(seed.id)}
                      disabled={busy || st.status === "done" || st.status === "exists"}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                 text-[16px] font-semibold text-white
                                 transition-all duration-150
                                 hover:opacity-90 active:scale-[0.98]
                                 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      style={{ backgroundColor: "#0B6E65" }}
                    >
                      {busy ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          กำลังดำเนินการ
                        </>
                      ) : st.status === "done" ? (
                        <>✓ นำเข้าแล้ว</>
                      ) : st.status === "exists" ? (
                        <>☑️ มีอยู่แล้ว</>
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          นำเข้า Firestore
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Link to /exams after import */}
        <div className="mt-6 text-center">
          <p className="text-[18px] mb-3" style={{ color: "#4A5568" }}>
            หลังนำเข้าแล้ว ชุดข้อสอบจะปรากฏในหน้าคลังทันที
          </p>
          <Link
            href="/exams"
            className="inline-flex items-center gap-2 text-[16px] font-medium transition-colors"
            style={{ color: "#0B6E65" }}
          >
            ดูหน้าคลังข้อสอบ →
          </Link>
        </div>
      </div>
    </div>
  );
}
