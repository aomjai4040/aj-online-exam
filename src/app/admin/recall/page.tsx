"use client";
/**
 * /admin/recall — อ่านความจำข้อสอบที่น้อง ๆ ส่งเข้ามา แล้วรวมเป็นเฉลย
 *
 * ตั้งใจไม่ merge อัตโนมัติ: ข้อมูลมาจากความจำ ต้องมีคนอ่านเทียบก่อน
 * ใบไหนใช้ได้กด "ใช้แล้ว" ใบไหนมั่ว กด "ไม่ใช้" — เหลือเฉพาะใบที่ยังไม่ตัดสิน
 * ปุ่ม "คัดลอกทั้งหมด" = ได้ข้อความรวมไปวางต่อในไฟล์/เครื่องมือ import ข้อสอบ
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  clearVerdict, getAllRecalls, getVerdicts, setRecallStatus, setVerdict,
  type RecallStatus, type RecallSubmission, type RecallVerdict,
} from "@/lib/recall-firestore";
import {
  RECALL_ALL, GAP_LABEL, isComplete, recallProgress, seedBySubject,
  crowdAnswerFor, crowdNoteFor, type RecallSeedItem,
} from "@/lib/recall-seed";
import { BRAND, subjectColor } from "@/lib/subjects";
import { SUBJECT_DISPLAY } from "@/lib/types";

const OPT = ["ก", "ข", "ค", "ง"];
type Filter = "pending" | "all" | "newq" | "crowd";

// ─── ใบที่ส่งเข้ามา ───────────────────────────────────────────────────────────

function SubmissionRow({
  s, onStatus,
}: { s: RecallSubmission; onStatus: (id: string, st: RecallStatus) => void }) {
  const tone =
    s.status === "merged"   ? { bg: "#F0FDF4", border: "#BBF7D0" }
    : s.status === "rejected" ? { bg: "#FAFAF8", border: "#EBEBEA" }
    : { bg: "white", border: "#EBEBEA" };

  return (
    <div className="rounded-xl px-3.5 py-3"
      style={{ backgroundColor: tone.bg, border: `1px solid ${tone.border}`,
               opacity: s.status === "rejected" ? 0.55 : 1 }}>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: s.confidence === "sure" ? "#EBF5F3" : "#FEF3C7",
            color:           s.confidence === "sure" ? BRAND.primary : "#B45309",
          }}>
          {s.confidence === "sure" ? "มั่นใจ" : "ไม่แน่ใจ"}
        </span>
        <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>
          {s.userName || s.userEmail || "—"}
        </span>
        {s.createdAt && (
          <span className="text-[11.5px]" style={{ color: "#C4C4C0" }}>
            {s.createdAt.toLocaleString("th-TH", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            })}
          </span>
        )}
      </div>

      {s.no === null && (
        <p className="font-exam text-[14px] leading-relaxed text-gray-900 mb-1.5">{s.text}</p>
      )}

      {s.options.length > 0 && (
        <div className="space-y-0.5 mb-1.5">
          {s.options.map((o, i) => (
            <p key={i} className="font-exam text-[13px] text-gray-600 leading-relaxed">
              {OPT[i]}. {o}
            </p>
          ))}
        </div>
      )}

      {s.answer && (
        <p className="font-exam text-[13.5px] leading-relaxed mb-1.5" style={{ color: "#15803D" }}>
          ✓ {s.answer}
        </p>
      )}

      {s.note && (
        <p className="text-[12px] rounded-lg px-2.5 py-1.5 mb-1.5"
          style={{ backgroundColor: "#F5FAF9", color: "#0B6E65" }}>
          💬 {s.note}
        </p>
      )}

      <div className="flex gap-2">
        <button onClick={() => onStatus(s.id, s.status === "merged" ? "new" : "merged")}
          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#F0FDF4", color: "#15803D" }}>
          {s.status === "merged" ? "✓ ใช้แล้ว (กดเพื่อยกเลิก)" : "ใช้ใบนี้"}
        </button>
        <button onClick={() => onStatus(s.id, s.status === "rejected" ? "new" : "rejected")}
          className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#F5F5F3", color: "#A8A8A6" }}>
          {s.status === "rejected" ? "เอากลับมา" : "ไม่ใช้"}
        </button>
      </div>
    </div>
  );
}

// ─── กล่องฟันธงเฉลย (เฉพาะ admin) ─────────────────────────────────────────────

function VerdictBox({
  item, verdict, onSave, onClear,
}: {
  item: RecallSeedItem;
  verdict?: RecallVerdict;
  onSave: (no: number, status: "confirmed" | "rejected", answer: string) => void;
  onClear: (no: number) => void;
}) {
  const crowd = crowdAnswerFor(item.no);
  const note  = crowdNoteFor(item.no);
  const [draft, setDraft] = useState(
    verdict?.answer || item.answer || crowd?.text || "",
  );
  const [busy, setBusy] = useState(false);

  async function save(status: "confirmed" | "rejected") {
    setBusy(true);
    await onSave(item.no, status, draft);
    setBusy(false);
  }

  return (
    <div className="rounded-xl px-3.5 py-3 mt-3"
      style={{
        backgroundColor: verdict?.status === "confirmed" ? "#F0FDF4" : "#FDF6E9",
        border: `1px solid ${verdict?.status === "confirmed" ? "#BBF7D0" : "#FCD34D"}`,
      }}>

      {crowd && (
        <>
          <p className="text-[11.5px] font-bold mb-1" style={{ color: "#B45309" }}>
            เฉลยจากกลุ่มผู้เข้าสอบ · {crowd.agree === "high" ? "หลายคนตอบตรงกัน ✅" : "ยังเถียงกันอยู่ ⚠️"}
          </p>
          <p className="font-exam text-[13.5px] leading-relaxed mb-1.5" style={{ color: "#7C2D12" }}>
            {crowd.text}
          </p>
        </>
      )}
      {note && (
        <p className="text-[12px] leading-relaxed rounded-lg px-2.5 py-1.5 mb-2"
          style={{ backgroundColor: "#FEF2F2", color: "#B91C1C" }}>
          {note}
        </p>
      )}

      {verdict?.status === "confirmed" ? (
        <>
          <p className="text-[12px] font-bold mb-1" style={{ color: "#15803D" }}>
            ✓ ยืนยันแล้ว — สมาชิกเห็นเฉลยนี้ในหน้า /recall
          </p>
          <p className="font-exam text-[13.5px] leading-relaxed mb-2" style={{ color: "#15803D" }}>
            {verdict.answer}
          </p>
          <button onClick={() => onClear(item.no)}
            className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: "#F5F5F3", color: "#A8A8A6" }}>
            ยกเลิกการยืนยัน
          </button>
        </>
      ) : (
        <>
          <p className="text-[11.5px] font-bold mb-1" style={{ color: "#A8A8A6" }}>
            เฉลยที่จะเผยแพร่ (แก้ได้)
          </p>
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
            className="w-full rounded-lg px-3 py-2 text-[13.5px] leading-relaxed mb-2 font-exam bg-white"
            style={{ border: "1px solid #EBEBEA" }} />
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => save("confirmed")} disabled={busy || !draft.trim()}
              className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40"
              style={{ backgroundColor: "#0B6E65", color: "white" }}>
              {busy ? "กำลังบันทึก…" : "✓ ยืนยันเฉลยนี้"}
            </button>
            <button onClick={() => save("rejected")} disabled={busy}
              className="text-[12px] font-medium px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              ✗ เฉลยกลุ่มผิด (ซ่อนจากสมาชิก)
            </button>
            {verdict?.status === "rejected" && (
              <span className="text-[12px] self-center" style={{ color: "#DC2626" }}>
                ทำเครื่องหมายว่าผิดแล้ว
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── หน้า ─────────────────────────────────────────────────────────────────────

export default function AdminRecallPage() {
  const { user } = useAuth();
  const [subs,     setSubs]     = useState<RecallSubmission[]>([]);
  const [verdicts, setVerdicts] = useState<Record<number, RecallVerdict>>({});
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<Filter>("crowd");
  const [copied,   setCopied]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([getAllRecalls(), getVerdicts()]);
      setSubs(s); setVerdicts(v);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(id: string, status: RecallStatus) {
    setSubs((p) => p.map((s) => (s.id === id ? { ...s, status } : s)));
    try { await setRecallStatus(id, status); }
    catch (e) { console.error(e); load(); }
  }

  async function saveVerdict(no: number, status: "confirmed" | "rejected", answer: string) {
    const by = user?.email ?? "admin";
    setVerdicts((p) => ({ ...p, [no]: { no, status, answer, by, at: new Date() } }));
    try { await setVerdict(no, status, answer, by); }
    catch (e) { console.error(e); load(); }
  }

  async function removeVerdict(no: number) {
    setVerdicts((p) => { const n = { ...p }; delete n[no]; return n; });
    try { await clearVerdict(no); }
    catch (e) { console.error(e); load(); }
  }

  const progress = useMemo(recallProgress, []);
  const bySubject = useMemo(seedBySubject, []);

  /** จัดใบเข้ากลุ่มตามเลขข้อ */
  const groups = useMemo(() => {
    const map = new Map<number, RecallSubmission[]>();
    for (const s of subs) {
      if (s.no === null) continue;
      if (!map.has(s.no)) map.set(s.no, []);
      map.get(s.no)!.push(s);
    }
    return map;
  }, [subs]);

  const newQuestions = useMemo(() => subs.filter((s) => s.no === null), [subs]);

  /** ข้อที่จะแสดง
   *  crowd   = มีเฉลยจากกลุ่มรอ Aj ฟันธง (คิวหลักตอนนี้)
   *  pending = ข้อที่ยังขาด หรือมีใบที่ยังไม่ตัดสิน */
  const visible = useMemo(() => {
    if (filter === "all") return RECALL_ALL;
    if (filter === "crowd") {
      return RECALL_ALL.filter((i) => crowdAnswerFor(i.no) && !verdicts[i.no])
        .sort((a, b) => {
          const ra = crowdAnswerFor(a.no)!.agree === "high" ? 0 : 1;
          const rb = crowdAnswerFor(b.no)!.agree === "high" ? 0 : 1;
          return ra - rb || a.no - b.no;
        });
    }
    return RECALL_ALL.filter((i) => {
      const g = groups.get(i.no) ?? [];
      return !isComplete(i) || g.some((s) => s.status === "new");
    });
  }, [filter, groups, verdicts]);

  const crowdPending = useMemo(
    () => RECALL_ALL.filter((i) => crowdAnswerFor(i.no) && !verdicts[i.no]).length,
    [verdicts],
  );

  /** ข้อความรวมสำหรับคัดลอกไปทำเฉลย/import */
  function copyAll() {
    const lines: string[] = [
      `ข้อสอบ สป.สธ. 2569 (ฉบับความทรงจำ) — ${RECALL_ALL.length} ข้อ`,
      `ใบที่ส่งเข้ามา ${subs.length} ใบ (ใช้แล้ว ${subs.filter((s) => s.status === "merged").length})`,
      `เฉลยที่ครูอ้อมยืนยันแล้ว ${Object.values(verdicts).filter((v) => v.status === "confirmed").length} ข้อ`,
      "",
    ];
    for (const item of RECALL_ALL) {
      lines.push(`${item.no}. ${item.text}`);
      item.options.forEach((o, i) => lines.push(`   ${OPT[i]}. ${o || "(ยังไม่มี)"}`));
      const v = verdicts[item.no];
      if (v?.status === "confirmed") lines.push(`   เฉลย (ยืนยันแล้ว): ${v.answer}   [${item.subject}]`);
      else lines.push(`   เฉลย: ${item.answer || "(ยังไม่มี)"}   [${item.subject}]`);
      const crowd = crowdAnswerFor(item.no);
      if (crowd && !v) {
        lines.push(`   ← เฉลยจากกลุ่มผู้เข้าสอบ (${crowd.agree === "high" ? "ตรงกันหลายคน" : "ยังเถียงกัน"}): ${crowd.text}`);
      }
      const cnote = crowdNoteFor(item.no);
      if (cnote) lines.push(`   ! ${cnote}`);
      const used = (groups.get(item.no) ?? []).filter((s) => s.status !== "rejected");
      for (const s of used) {
        const who = s.confidence === "sure" ? "มั่นใจ" : "ไม่แน่ใจ";
        if (s.options.length) lines.push(`   ← ตัวเลือกจากสมาชิก (${who}): ${s.options.join(" | ")}`);
        if (s.answer)         lines.push(`   ← เฉลยจากสมาชิก (${who}): ${s.answer}`);
        if (s.note)           lines.push(`   ← หมายเหตุ: ${s.note}`);
      }
      lines.push("");
    }
    if (newQuestions.length) {
      lines.push("── ข้อใหม่ที่สมาชิกส่งเพิ่ม ──", "");
      newQuestions.filter((s) => s.status !== "rejected").forEach((s, i) => {
        lines.push(`N${i + 1}. ${s.text}`);
        s.options.forEach((o, oi) => lines.push(`   ${OPT[oi]}. ${o}`));
        if (s.answer) lines.push(`   เฉลย: ${s.answer}`);
        lines.push(`   [${s.subject || "ไม่ระบุหมวด"}] ${s.confidence === "sure" ? "มั่นใจ" : "ไม่แน่ใจ"}`);
        lines.push("");
      });
    }
    navigator.clipboard.writeText(lines.join("\n"))
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); })
      .catch(() => alert("คัดลอกไม่สำเร็จ"));
  }


  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>
      <div className="max-w-3xl mx-auto px-5 pt-6 pb-16">

        {/* หัวหน้า */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[19px] font-bold text-gray-900">ความจำข้อสอบ 69</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "#A8A8A6" }}>
              น้อง ๆ ช่วยกันเติมที่ <Link href="/recall" className="underline">/recall</Link>
            </p>
          </div>
          <button onClick={load} disabled={loading}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#EBF5F3", color: BRAND.primary }}>
            {loading ? "กำลังโหลด…" : "รีเฟรช"}
          </button>
        </div>

        {/* สรุป */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "ข้อทั้งหมด",       value: progress.total,     color: "#0B6E65" },
            { label: "รอฟันธงเฉลย",      value: crowdPending,       color: "#B45309" },
            { label: "ยืนยันแล้ว",       value: Object.values(verdicts).filter((v) => v.status === "confirmed").length, color: "#16A34A" },
            { label: "ใบที่สมาชิกส่ง",   value: subs.length,        color: "#7C3AED" },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
              <div className="text-[26px] font-extrabold leading-none" style={{ color: k.color }}>
                {k.value}
              </div>
              <div className="text-[12px] font-semibold text-gray-500 mt-1">{k.label}</div>
            </div>
          ))}
        </div>

        {/* ผังข้อสอบจริงตามหมวด */}
        <div className="bg-white rounded-2xl p-5 mb-4" style={{ border: "1px solid #EBEBEA" }}>
          <p className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-3">
            ผังข้อสอบจริง 69 — จำนวนข้อต่อหมวด
          </p>
          <div className="space-y-2.5">
            {bySubject.map(([code, n]) => {
              const color = subjectColor(code);
              const pct   = Math.round((n / progress.total) * 100);
              return (
                <div key={code}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[13px] font-medium text-gray-700">
                      {SUBJECT_DISPLAY[code] ?? code}
                    </span>
                    <span className="text-[12px] font-bold" style={{ color }}>
                      {n} ข้อ · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full" style={{ backgroundColor: "#F3F2F0" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[12px] mt-3" style={{ color: "#A8A8A6" }}>
            หมวดที่ไม่ปรากฏ = ปีนี้แทบไม่ออก — ใช้ตัดสินใจว่าจะเติมข้อสอบหมวดไหนก่อน
          </p>
        </div>

        {/* แถบเครื่องมือ */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {([
            { v: "crowd",   label: `รอฟันธงเฉลย ${crowdPending}` },
            { v: "pending", label: "ต้องจัดการ" },
            { v: "all",     label: `ทุกข้อ ${RECALL_ALL.length}` },
            { v: "newq",    label: `ข้อใหม่ ${newQuestions.length}` },
          ] as const).map((t) => (
            <button key={t.v} onClick={() => setFilter(t.v)}
              className="rounded-xl px-3.5 py-2 text-[13px] font-semibold"
              style={{
                backgroundColor: filter === t.v ? BRAND.primary : "white",
                color: filter === t.v ? "white" : "#6B7280",
                border: `1.5px solid ${filter === t.v ? BRAND.primary : "#EBEBEA"}`,
              }}>
              {t.label}
            </button>
          ))}
          <button onClick={copyAll}
            className="rounded-xl px-3.5 py-2 text-[13px] font-semibold ml-auto"
            style={{ backgroundColor: copied ? "#F0FDF4" : "#FDF6E9",
                     color: copied ? "#15803D" : "#B45309",
                     border: `1.5px solid ${copied ? "#BBF7D0" : "#FCD34D"}` }}>
            {copied ? "คัดลอกแล้ว ✓" : "📋 คัดลอกทั้งหมด"}
          </button>
        </div>

        {/* รายการ */}
        {filter === "newq" ? (
          newQuestions.length === 0 ? (
            <p className="text-center text-[13px] py-10" style={{ color: "#A8A8A6" }}>
              ยังไม่มีข้อใหม่ที่สมาชิกส่งเพิ่ม
            </p>
          ) : (
            <div className="space-y-3">
              {newQuestions.map((s) => (
                <div key={s.id} className="bg-white rounded-2xl p-4" style={{ border: "1px solid #EBEBEA" }}>
                  <SubmissionRow s={s} onStatus={changeStatus} />
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {visible.map((item) => {
              const g     = groups.get(item.no) ?? [];
              const color = subjectColor(item.subject);
              return (
                <div key={item.no} className="bg-white rounded-2xl p-4"
                  style={{ border: `1px solid ${isComplete(item) ? "#EBEBEA" : "#FCD34D"}` }}>
                  <div className="flex items-start gap-2.5 mb-2">
                    <span className="text-[13px] font-extrabold flex-shrink-0"
                      style={{ color: isComplete(item) ? "#A8A8A6" : "#B45309" }}>
                      {item.no}.
                    </span>
                    <p className="font-exam text-[14.5px] leading-relaxed text-gray-900 flex-1">
                      {item.text}
                    </p>
                  </div>

                  {item.options.length > 0 && (
                    <div className="space-y-0.5 mb-1.5 pl-6">
                      {item.options.map((o, i) => (
                        <p key={i} className="font-exam text-[13px] leading-relaxed"
                          style={{ color: o ? "#4B5563" : "#D97706" }}>
                          {OPT[i]}. {o || "— ขาด —"}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="pl-6 mb-2 flex items-center gap-1.5 flex-wrap">
                    {item.answer
                      ? <span className="font-exam text-[13px]" style={{ color: "#15803D" }}>✓ {item.answer}</span>
                      : <span className="text-[12.5px] font-semibold" style={{ color: "#DC2626" }}>ยังไม่มีเฉลย</span>}
                  </div>

                  <div className="pl-6 flex items-center gap-1.5 flex-wrap mb-2">
                    <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: `${color}15`, color }}>
                      {SUBJECT_DISPLAY[item.subject] ?? item.subject}
                    </span>
                    {item.gaps.map((gp) => (
                      <span key={gp} className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}>
                        ขาด{GAP_LABEL[gp]}
                      </span>
                    ))}
                    {item.note && (
                      <span className="text-[11.5px]" style={{ color: "#A8A8A6" }}>· {item.note}</span>
                    )}
                  </div>

                  {/* กล่องฟันธงเฉลย — โผล่เมื่อมีเฉลยกลุ่ม หรือข้อนี้ยังไม่มีเฉลย */}
                  {(crowdAnswerFor(item.no) || !item.answer || verdicts[item.no]) && (
                    <VerdictBox item={item} verdict={verdicts[item.no]}
                      onSave={saveVerdict} onClear={removeVerdict} />
                  )}

                  {g.length === 0 ? (
                    <p className="text-[12.5px] pl-6 mt-2" style={{ color: "#C4C4C0" }}>
                      ยังไม่มีใครช่วยข้อนี้
                    </p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      <p className="text-[11.5px] font-bold uppercase tracking-wider"
                        style={{ color: "#A8A8A6" }}>
                        คำตอบที่ส่งเข้ามา {g.length} ใบ
                      </p>
                      {g.map((s) => <SubmissionRow key={s.id} s={s} onStatus={changeStatus} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Link href="/admin" className="btn-secondary w-full py-3 text-[14px] block text-center mt-5">
          ← กลับ Admin
        </Link>
      </div>
    </div>
  );
}
