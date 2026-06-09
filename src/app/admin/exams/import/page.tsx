"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { createExam, findExamByTitle, appendQuestionsToExam } from "@/lib/firestore";
import { SUBJECTS, getSubjectLabel } from "@/lib/types";
import type { QuestionForm } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_CODES = new Set<string>(SUBJECTS.map(s => s.code));

const TEMPLATE_CSV = [
  "subject,set_name,question,option_a,option_b,option_c,option_d,correct_answer,explanation",
  "APPLIED,ระบาดวิทยา ชุดที่ 1,ข้อใดเป็นตัวอย่างของการเฝ้าระวังโรค,การรักษาผู้ป่วย,การเก็บข้อมูลโรคอย่างต่อเนื่อง,การจ่ายยา,การผ่าตัด,B,การเฝ้าระวังโรคคือการเก็บรวบรวม วิเคราะห์ และแปลผลข้อมูลสุขภาพอย่างต่อเนื่อง",
].join("\n");

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  rowNum:        number;
  subject:       string;
  setName:       string;
  question:      string;
  optionA:       string;
  optionB:       string;
  optionC:       string;
  optionD:       string;
  correctAnswer: string;
  explanation:   string;
  errors:        string[];
  valid:         boolean;
}

interface ExamGroup {
  subject:   string;
  setName:   string;
  questions: ParsedRow[];
  existing?: { id: string; questionCount: number } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeAnswer(raw: string): number {
  const v = raw.trim().toUpperCase();
  if (v === "A" || v === "ก") return 0;
  if (v === "B" || v === "ข") return 1;
  if (v === "C" || v === "ค") return 2;
  if (v === "D" || v === "ง") return 3;
  return -1;
}

function validateRow(row: Omit<ParsedRow, "errors" | "valid">): string[] {
  const errs: string[] = [];
  const sub = row.subject.trim().toUpperCase();
  if (!sub)                     errs.push("subject ว่าง");
  else if (!VALID_CODES.has(sub)) errs.push(`subject "${sub}" ไม่ถูกต้อง`);
  if (!row.setName.trim())      errs.push("set_name ว่าง");
  if (!row.question.trim())     errs.push("question ว่าง");
  if (!row.optionA.trim())      errs.push("option_a ว่าง");
  if (!row.optionB.trim())      errs.push("option_b ว่าง");
  if (!row.optionC.trim())      errs.push("option_c ว่าง");
  if (!row.optionD.trim())      errs.push("option_d ว่าง");
  if (normalizeAnswer(row.correctAnswer) === -1)
    errs.push(`correct_answer "${row.correctAnswer}" ไม่ถูกต้อง (ต้องเป็น A-D หรือ ก-ง)`);
  return errs;
}

function rowsToGroups(rows: ParsedRow[]): ExamGroup[] {
  const map = new Map<string, ExamGroup>();
  for (const r of rows) {
    const key = `${r.subject.toUpperCase()}|||${r.setName}`;
    if (!map.has(key)) {
      map.set(key, { subject: r.subject.toUpperCase(), setName: r.setName, questions: [], existing: undefined });
    }
    map.get(key)!.questions.push(r);
  }
  return [...map.values()];
}

function parseSheetRows(rows: Record<string, string>[]): ParsedRow[] {
  return rows.map((row, i) => {
    const get = (keys: string[]) => {
      for (const k of keys) {
        const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
        if (v !== undefined) return String(v).trim();
      }
      return "";
    };

    const data = {
      rowNum:        i + 2,
      subject:       get(["subject"]).toUpperCase(),
      setName:       get(["set_name", "setName", "set name"]),
      question:      get(["question"]),
      optionA:       get(["option_a", "optionA", "option a", "a"]),
      optionB:       get(["option_b", "optionB", "option b", "b"]),
      optionC:       get(["option_c", "optionC", "option c", "c"]),
      optionD:       get(["option_d", "optionD", "option d", "d"]),
      correctAnswer: get(["correct_answer", "correctAnswer", "correct answer", "answer"]),
      explanation:   get(["explanation"]),
    };

    const errors = validateRow(data);
    return { ...data, errors, valid: errors.length === 0 };
  }).filter(r => r.question || r.subject); // skip truly empty rows
}

// ─── File parser ──────────────────────────────────────────────────────────────

async function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb   = XLSX.read(data, { type: "array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        resolve(parseSheetRows(json));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "done";

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step,     setStep]     = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rows,     setRows]     = useState<ParsedRow[]>([]);
  const [groups,   setGroups]   = useState<ExamGroup[]>([]);
  const [parsing,  setParsing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [doneMsg,  setDoneMsg]  = useState("");
  const [parseErr, setParseErr] = useState("");

  // ── Template download ──────────────────────────────────────────────────────

  function downloadTemplateCsv() {
    // ﻿ = UTF-8 BOM — ทำให้ Excel บน Windows อ่านภาษาไทยได้ถูกต้อง
    const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv; charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "exam_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateXlsx() {
    const ws = XLSX.utils.aoa_to_sheet([
      ["subject", "set_name", "question", "option_a", "option_b", "option_c", "option_d", "correct_answer", "explanation"],
      ["APPLIED", "ระบาดวิทยา ชุดที่ 1", "ข้อใดเป็นตัวอย่างของการเฝ้าระวังโรค", "การรักษาผู้ป่วย", "การเก็บข้อมูลโรคอย่างต่อเนื่อง", "การจ่ายยา", "การผ่าตัด", "B", "การเฝ้าระวังโรคคือการเก็บรวบรวม วิเคราะห์ และแปลผลข้อมูลสุขภาพอย่างต่อเนื่อง"],
    ]);
    // กำหนดความกว้างคอลัมน์
    ws["!cols"] = [
      { wch: 10 }, { wch: 25 }, { wch: 50 }, { wch: 25 }, { wch: 25 },
      { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 40 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "exam_template.xlsx");
  }

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setParseErr("");
    setParsing(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) { setParseErr("ไม่พบข้อมูลในไฟล์"); setParsing(false); return; }

      const grouped = rowsToGroups(parsed);

      // Check existing exams in Firestore
      const withExisting = await Promise.all(
        grouped.map(async (g) => {
          const existing = await findExamByTitle(g.setName).catch(() => null);
          return { ...g, existing: existing ? { id: existing.id, questionCount: existing.questionCount } : null };
        })
      );

      setRows(parsed);
      setGroups(withExisting);
      setStep("preview");
    } catch (err) {
      setParseErr("อ่านไฟล์ไม่ได้ กรุณาตรวจสอบรูปแบบ");
      console.error(err);
    } finally {
      setParsing(false);
    }
  }, []);

  // ── Import ─────────────────────────────────────────────────────────────────

  async function handleImport() {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) return;
    setSaving(true);

    let totalImported = 0;
    try {
      for (const g of groups) {
        const validQs = g.questions.filter(r => r.valid);
        if (validQs.length === 0) continue;

        const questions: QuestionForm[] = validQs.map(r => ({
          text:          r.question,
          options:       [r.optionA, r.optionB, r.optionC, r.optionD] as [string, string, string, string],
          correctAnswer: normalizeAnswer(r.correctAnswer),
          explanation:   r.explanation,
        }));

        if (g.existing) {
          await appendQuestionsToExam(g.existing.id, questions, g.existing.questionCount);
        } else {
          await createExam({
            title:       g.setName,
            description: "",
            subject:     g.subject,
            timeLimit:   0,
            isPublished: false,
            questions,
          });
        }
        totalImported += validQs.length;
      }

      setDoneMsg(`Import สำเร็จ จำนวน ${totalImported} ข้อ ใน ${groups.length} ชุด`);
      setStep("done");
    } catch (err) {
      console.error(err);
      setParseErr("เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalRows  = rows.length;
  const validRows  = rows.filter(r => r.valid).length;
  const errorRows  = totalRows - validRows;
  const hasErrors  = errorRows > 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F5FAF9" }}>

      {/* Header */}
      <div className="sticky top-14 z-30 bg-white"
        style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center gap-3">
          <button onClick={() => step === "preview" ? setStep("upload") : router.push("/admin/exams")}
            className="flex items-center gap-1.5 text-[16px] font-medium" style={{ color: "#4A5568" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {step === "preview" ? "อัพโหลดใหม่" : "กลับ"}
          </button>
          <h1 className="text-[18px] font-bold text-gray-900 flex-1 text-center">
            Import ข้อสอบ
          </h1>
          <div className="text-[15px] font-medium" style={{ color: "#4A5568" }}>
            {step === "upload" ? "① อัพโหลด" : step === "preview" ? "② ตรวจสอบ" : "✓ เสร็จสิ้น"}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6 space-y-5">

        {/* ── STEP: DONE ──────────────────────────────────────────────────── */}
        {step === "done" && (
          <>
            <div className="bg-white rounded-2xl p-8 text-center" style={{ border: "1px solid #C3E5DE" }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: "#EBF5F3" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-[20px] font-bold text-gray-900 mb-2">{doneMsg}</p>
              <p className="text-[16px]" style={{ color: "#4A5568" }}>
                ชุดข้อสอบที่ไม่ได้เผยแพร่จะยังไม่แสดงให้นักเรียนเห็น
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setStep("upload"); setRows([]); setGroups([]); setFileName(""); }}
                className="flex-1 py-3.5 rounded-2xl text-[16px] font-semibold border transition-colors"
                style={{ borderColor: "#0B6E65", color: "#0B6E65" }}>
                Import เพิ่มเติม
              </button>
              <button onClick={() => router.push("/admin/exams")}
                className="flex-1 py-3.5 rounded-2xl text-[16px] font-semibold text-white"
                style={{ backgroundColor: "#0B6E65" }}>
                จัดการข้อสอบ →
              </button>
            </div>
          </>
        )}

        {/* ── STEP: PREVIEW ───────────────────────────────────────────────── */}
        {step === "preview" && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "ข้อทั้งหมด", value: totalRows, color: "#0B6E65", bg: "#EBF5F3" },
                { label: "ถูกต้อง",    value: validRows,  color: "#16A34A", bg: "#F0FDF4" },
                { label: "มีปัญหา",    value: errorRows,  color: errorRows > 0 ? "#DC2626" : "#9CA3AF", bg: errorRows > 0 ? "#FEF2F2" : "#F9FAFB" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 text-center" style={{ border: "1px solid #EBEBEA" }}>
                  <div className="text-[28px] font-extrabold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[14px] font-semibold" style={{ color: "#6B7280" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Error rows */}
            {hasErrors && (
              <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #FECACA" }}>
                <p className="text-[17px] font-bold mb-3" style={{ color: "#DC2626" }}>
                  ⚠ พบ {errorRows} แถวที่มีปัญหา — ไม่สามารถ import ได้จนกว่าจะแก้ไข
                </p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {rows.filter(r => !r.valid).map(r => (
                    <div key={r.rowNum} className="flex items-start gap-2.5 text-[14px]">
                      <span className="font-mono font-bold flex-shrink-0" style={{ color: "#DC2626" }}>
                        แถว {r.rowNum}
                      </span>
                      <span style={{ color: "#4A5568" }}>{r.errors.join(" · ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Groups preview */}
            <div className="space-y-3">
              {groups.map((g, i) => {
                const validCount = g.questions.filter(r => r.valid).length;
                return (
                  <div key={i} className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[13px] font-bold font-mono px-2 py-0.5 rounded-lg"
                            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                            {g.subject}
                          </span>
                          {g.existing ? (
                            <span className="text-[13px] px-2 py-0.5 rounded-lg font-medium"
                              style={{ backgroundColor: "#FFF7ED", color: "#C2410C" }}>
                              เพิ่มเข้าชุดเดิม ({g.existing.questionCount} ข้ออยู่แล้ว)
                            </span>
                          ) : (
                            <span className="text-[13px] px-2 py-0.5 rounded-lg font-medium"
                              style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
                              สร้างชุดใหม่
                            </span>
                          )}
                        </div>
                        <p className="text-[17px] font-semibold text-gray-900">{g.setName}</p>
                        <p className="text-[14px] mt-0.5" style={{ color: "#4A5568" }}>
                          {getSubjectLabel(g.subject)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[20px] font-extrabold" style={{ color: "#0B6E65" }}>{validCount}</p>
                        <p className="text-[13px]" style={{ color: "#6B7280" }}>ข้อ</p>
                      </div>
                    </div>

                    {/* First 3 questions preview */}
                    <div className="space-y-1.5 mt-2">
                      {g.questions.filter(r => r.valid).slice(0, 3).map((r, qi) => (
                        <div key={qi} className="text-[14px] px-3 py-2 rounded-xl" style={{ backgroundColor: "#F5FAF9" }}>
                          <span className="font-medium" style={{ color: "#0B6E65" }}>{qi + 1}. </span>
                          <span className="text-gray-700 line-clamp-1">{r.question}</span>
                        </div>
                      ))}
                      {g.questions.filter(r => r.valid).length > 3 && (
                        <p className="text-[14px] pl-3" style={{ color: "#4A5568" }}>
                          และอีก {g.questions.filter(r => r.valid).length - 3} ข้อ…
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Parse error */}
            {parseErr && (
              <div className="p-4 rounded-2xl text-[16px]" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {parseErr}
              </div>
            )}

            {/* Import button */}
            <button
              onClick={handleImport}
              disabled={saving || hasErrors || validRows === 0}
              className="w-full py-4 rounded-2xl text-[18px] font-bold text-white
                         hover:opacity-90 disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "#0B6E65" }}>
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลัง Import…
                </span>
              ) : hasErrors
                ? `แก้ไข ${errorRows} แถวที่มีปัญหาก่อน`
                : `Import ${validRows} ข้อ (${groups.length} ชุด)`}
            </button>
          </>
        )}

        {/* ── STEP: UPLOAD ────────────────────────────────────────────────── */}
        {step === "upload" && (
          <>
            {/* Format guide */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #EBEBEA" }}>
              <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                <p className="text-[17px] font-bold text-gray-700">รูปแบบไฟล์</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={downloadTemplateXlsx}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[15px] font-semibold transition-colors"
                    style={{ backgroundColor: "#0B6E65", color: "white" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Excel (.xlsx)
                  </button>
                  <button onClick={downloadTemplateCsv}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[15px] font-semibold transition-colors border"
                    style={{ borderColor: "#0B6E65", color: "#0B6E65" }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    CSV (UTF-8)
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto mb-3">
                <code className="text-[13px] block p-3 rounded-xl whitespace-nowrap"
                  style={{ backgroundColor: "#F5F5F3", color: "#374151" }}>
                  subject, set_name, question, option_a, option_b, option_c, option_d, correct_answer, explanation
                </code>
              </div>

              <div className="space-y-2">
                <p className="text-[15px]" style={{ color: "#4A5568" }}>
                  <strong>subject</strong> — รหัสหมวดวิชา (เลือกจาก 7 ค่าด้านล่าง)
                </p>
                <p className="text-[15px]" style={{ color: "#4A5568" }}>
                  <strong>correct_answer</strong> — A B C D หรือ ก ข ค ง
                </p>
                <p className="text-[15px]" style={{ color: "#4A5568" }}>
                  <strong>set_name เดียวกัน</strong> = รวมเป็นชุดเดียว · ถ้าชื่อซ้ำกับที่มีอยู่ = เพิ่มเข้าชุดเดิม
                </p>
              </div>

              {/* Subject reference table */}
              <div className="mt-4 rounded-xl overflow-hidden" style={{ border: "1px solid #E0DFDC" }}>
                {SUBJECTS.map((s, i) => (
                  <div key={s.code}
                    className="flex items-start gap-3 px-3.5 py-2.5 text-[14px]"
                    style={{ backgroundColor: i % 2 === 0 ? "#FAFAF9" : "white", borderTop: i > 0 ? "1px solid #F3F2F0" : "none" }}>
                    <span className="font-bold font-mono w-20 flex-shrink-0" style={{ color: "#0B6E65" }}>{s.code}</span>
                    <span style={{ color: "#4A5568" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Upload zone */}
            <div
              className="bg-white rounded-2xl p-10 text-center border-2 border-dashed cursor-pointer
                         hover:border-[#0B6E65] transition-colors"
              style={{ borderColor: "#C3E5DE" }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <span className="w-10 h-10 border-[3px] border-[#C3E5DE] border-t-[#0B6E65] rounded-full animate-spin" />
                  <p className="text-[17px] font-semibold text-gray-700">กำลังอ่านไฟล์…</p>
                </div>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#0B6E65" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 mx-auto mb-4">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-[18px] font-semibold text-gray-700 mb-1">คลิกหรือลากไฟล์มาวางที่นี่</p>
                  <p className="text-[15px]" style={{ color: "#4A5568" }}>รองรับ .csv และ .xlsx (Excel)</p>
                </>
              )}
            </div>

            {parseErr && (
              <div className="p-4 rounded-2xl text-[16px]" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {parseErr}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
