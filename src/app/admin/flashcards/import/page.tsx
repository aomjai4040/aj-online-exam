"use client";
import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { bulkImportCards, type ImportCardRow } from "@/lib/flashcard-firestore";
import { FC_TAGS, type FCImportance } from "@/lib/flashcard-types";

// ─── CSV Template ─────────────────────────────────────────────────────────────
//
// columns (ต้องตรงทุก column):
//   deck_slug    → slug ของ deck เช่น "ch01", "pre-exam-2025"
//   deck_name    → ชื่อ deck (ใช้สร้าง deck ถ้ายังไม่มี)
//   deck_type    → chapter | pre_exam | tag | custom
//   deck_order   → ลำดับการ์ดในนั้น (ตัวเลข)
//   front        → ด้านหน้าการ์ด
//   back         → ด้านหลังการ์ด
//   hint         → คำใบ้ (ว่างได้)
//   category     → หมวดหมู่ เช่น "ระบาดวิทยา"
//   importance   → 1 / 2 / 3
//   tags         → comma-separated เช่น "จุดตาย,ตัวเลข"
//   is_published → 1 หรือ 0

const TEMPLATE_HEADER =
  "deck_slug,deck_name,deck_type,deck_order,front,back,hint,category,importance,tags,is_published";

const TEMPLATE_ROWS = [
  `ch01,บทที่ 1 ระบาดวิทยา,chapter,1,Attack Rate คืออะไร?,จำนวนผู้ป่วย ÷ จำนวนคนเสี่ยง × 100,ใช้ในการระบาดโรค,ระบาดวิทยา,3,"จุดตาย,ตัวเลข",1`,
  `ch01,บทที่ 1 ระบาดวิทยา,chapter,2,Herd immunity threshold ของหัด (R0=15) คือ?,95%,,ระบาดวิทยา,2,ตัวเลข,1`,
  `pre-exam-2025,สรุปก่อนสอบ สป.สธ. 2025,pre_exam,1,R naught (R0) คืออะไร?,จำนวนผู้ป่วยรายใหม่ที่เกิดจากผู้ป่วย 1 คนในประชากรที่ไม่มีภูมิ,,ระบาดวิทยา,3,จุดตาย,1`,
];

const TEMPLATE_CSV = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join("\n");

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TAGS    = new Set(Object.values(FC_TAGS));
const VALID_TYPES   = new Set(["chapter", "pre_exam", "tag", "custom"]);

interface ParsedRow {
  rowNum:    number;
  data:      ImportCardRow;
  errors:    string[];
  valid:     boolean;
}

function parseRow(raw: Record<string, string>, rowNum: number): ParsedRow {
  const g = (k: string) => String(raw[k] ?? "").trim();
  const errors: string[] = [];

  const deckSlug   = g("deck_slug");
  const deckName   = g("deck_name");
  const deckType   = g("deck_type") as ImportCardRow["deckType"];
  const deckOrder  = parseInt(g("deck_order"), 10);
  const front      = g("front");
  const back       = g("back");
  const hint       = g("hint");
  const category   = g("category");
  const importance = parseInt(g("importance"), 10) as FCImportance;
  const tagsRaw    = g("tags").split(",").map((t) => t.trim()).filter(Boolean);
  const isPublished= g("is_published") !== "0";

  if (!deckSlug)               errors.push("deck_slug ว่าง");
  if (!deckName)               errors.push("deck_name ว่าง");
  if (!VALID_TYPES.has(deckType)) errors.push(`deck_type "${deckType}" ไม่ถูกต้อง`);
  if (isNaN(deckOrder))        errors.push("deck_order ต้องเป็นตัวเลข");
  if (!front)                  errors.push("front ว่าง");
  if (!back)                   errors.push("back ว่าง");
  if (!category)               errors.push("category ว่าง");
  if (![1, 2, 3].includes(importance)) errors.push("importance ต้องเป็น 1, 2, หรือ 3");

  const badTags = tagsRaw.filter((t) => !VALID_TAGS.has(t as never));
  if (badTags.length) errors.push(`tags ไม่ถูกต้อง: ${badTags.join(", ")}`);

  return {
    rowNum,
    data: {
      deckSlug,
      deckName,
      deckType:    VALID_TYPES.has(deckType) ? deckType : "custom",
      deckOrder:   isNaN(deckOrder) ? 0 : deckOrder,
      front, back, hint, category,
      importance:  [1, 2, 3].includes(importance) ? importance : 1,
      tags:        tagsRaw.filter((t) => VALID_TAGS.has(t as never)),
      isPublished,
    },
    errors,
    valid: errors.length === 0,
  };
}

function parseFile(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb    = XLSX.read(e.target?.result, { type: "binary" });
        const ws    = wb.Sheets[wb.SheetNames[0]];
        const rows  = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        resolve(rows.map((r, i) => parseRow(r, i + 2)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Step = "idle" | "preview" | "importing" | "done";

export default function AdminFlashCardImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [step,   setStep]   = useState<Step>("idle");
  const [rows,   setRows]   = useState<ParsedRow[]>([]);
  const [result, setResult] = useState({ decksCreated: 0, cardsImported: 0 });
  const [errMsg, setErrMsg] = useState("");

  const validRows   = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);
  const isImporting = step === "importing";

  // ── Handle file ───────────────────────────────────────────────────────────
  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrMsg("");
    try {
      const parsed = await parseFile(file);
      setRows(parsed);
      setStep("preview");
    } catch {
      setErrMsg("อ่านไฟล์ไม่สำเร็จ — ตรวจสอบ format แล้วลองใหม่");
    }
  }, []);

  // ── Handle import ─────────────────────────────────────────────────────────
  const handleImport = useCallback(async () => {
    if (!validRows.length) return;
    setStep("importing");
    try {
      const res = await bulkImportCards(validRows.map((r) => r.data));
      setResult(res);
      setStep("done");
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Import ล้มเหลว");
      setStep("preview");
    }
  }, [validRows]);

  // ── Download template ─────────────────────────────────────────────────────
  const downloadTemplate = useCallback(() => {
    const blob = new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), {
      href: url, download: "flashcard_template.csv",
    }).click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep("idle");
    setRows([]);
    setErrMsg("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-5 py-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[24px] font-bold text-gray-900 mb-1">
          Import Flash Card
        </h1>
        <p className="text-[14px]" style={{ color: "#6B7280" }}>
          นำเข้าการ์ดจาก CSV หรือ Excel · รองรับหลาย Deck ในไฟล์เดียว
        </p>
      </div>

      {/* ── Done ──────────────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-[20px] font-bold text-green-800 mb-1">Import สำเร็จ!</p>
          <div className="flex justify-center gap-6 my-4 text-[15px]">
            <div>
              <p className="text-[28px] font-extrabold text-green-700">{result.cardsImported}</p>
              <p style={{ color: "#4B5563" }}>การ์ดที่เพิ่ม</p>
            </div>
            <div>
              <p className="text-[28px] font-extrabold text-green-700">{result.decksCreated}</p>
              <p style={{ color: "#4B5563" }}>Deck ที่สร้างใหม่</p>
            </div>
          </div>
          <button onClick={reset}
            className="px-6 py-2.5 rounded-xl font-semibold text-white"
            style={{ backgroundColor: "#0B6E65" }}>
            Import เพิ่มเติม
          </button>
        </div>
      )}

      {step !== "done" && (
        <>
          {/* ── Upload zone ───────────────────────────────────────────────── */}
          <div
            className="border-2 border-dashed rounded-2xl p-8 text-center
                       cursor-pointer hover:border-green-400 transition-colors mb-3"
            style={{ borderColor: "#D1D5DB" }}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
            <div className="text-4xl mb-2">📂</div>
            <p className="font-semibold text-gray-700 text-[15px]">
              คลิกเพื่อเลือกไฟล์ CSV / Excel
            </p>
            <p className="text-[13px] mt-1" style={{ color: "#9CA3AF" }}>
              .csv · .xlsx · .xls
            </p>
          </div>

          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="text-[13px] font-semibold px-4 py-2 rounded-xl mb-5"
            style={{ backgroundColor: "#EBF5F3", color: "#0B6E65" }}>
            ⬇ ดาวน์โหลด Template CSV
          </button>

          {/* Column guide */}
          <div className="rounded-xl overflow-hidden mb-5"
            style={{ border: "1px solid #E5E7EB" }}>
            <div className="bg-gray-50 px-4 py-2.5">
              <p className="text-[12px] font-bold uppercase tracking-widest"
                style={{ color: "#6B7280" }}>
                คอลัมน์ที่ต้องมีในไฟล์
              </p>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-1">
              {[
                ["deck_slug",    "slug ของ deck เช่น ch01"],
                ["deck_name",    "ชื่อ deck แสดงผล"],
                ["deck_type",    "chapter | pre_exam | tag | custom"],
                ["deck_order",   "ลำดับการ์ดในนั้น (ตัวเลข)"],
                ["front",        "ด้านหน้าการ์ด (คำถาม)"],
                ["back",         "ด้านหลังการ์ด (คำตอบ)"],
                ["hint",         "คำใบ้ก่อนพลิก (ว่างได้)"],
                ["category",     "หมวด เช่น ระบาดวิทยา"],
                ["importance",   "1 / 2 / 3"],
                ["tags",         "จุดตาย, ตัวเลข, ก่อนสอบ, สับสนบ่อย"],
                ["is_published", "1 = แสดง, 0 = ซ่อน"],
              ].map(([col, desc]) => (
                <div key={col} className="flex items-baseline gap-1.5">
                  <code className="text-[12px] font-mono font-bold"
                    style={{ color: "#0B6E65" }}>
                    {col}
                  </code>
                  <span className="text-[12px]" style={{ color: "#6B7280" }}>
                    {desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Error message */}
          {errMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4
                            text-[14px] text-red-700">
              {errMsg}
            </div>
          )}

          {/* ── Preview ────────────────────────────────────────────────────── */}
          {step === "preview" && (
            <>
              {/* Summary chips */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[13px] font-semibold px-3 py-1 rounded-full
                                 bg-green-50 text-green-700">
                  ✓ {validRows.length} ใบพร้อม import
                </span>
                {invalidRows.length > 0 && (
                  <span className="text-[13px] font-semibold px-3 py-1 rounded-full
                                   bg-red-50 text-red-600">
                    ✗ {invalidRows.length} แถวมีข้อผิดพลาด
                  </span>
                )}
              </div>

              {/* Error rows */}
              {invalidRows.length > 0 && (
                <div className="mb-4 space-y-1.5">
                  {invalidRows.slice(0, 8).map((r) => (
                    <div key={r.rowNum}
                      className="bg-red-50 border border-red-200 rounded-xl
                                 px-4 py-2 text-[13px]">
                      <span className="font-bold text-red-600">
                        แถว {r.rowNum}:{" "}
                      </span>
                      {r.errors.join(" · ")}
                    </div>
                  ))}
                  {invalidRows.length > 8 && (
                    <p className="text-[13px] text-red-400 pl-1">
                      … และอีก {invalidRows.length - 8} แถว
                    </p>
                  )}
                </div>
              )}

              {/* Preview table */}
              <div className="overflow-x-auto rounded-xl mb-5"
                style={{ border: "1px solid #E5E7EB" }}>
                <table className="min-w-full text-[13px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {["Deck", "Front", "Back", "Category", "Tags", "★"].map((h) => (
                        <th key={h}
                          className="px-3 py-2.5 text-left font-semibold"
                          style={{ color: "#374151" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 5).map((r) => (
                      <tr key={r.rowNum}
                        className="border-t"
                        style={{ borderColor: "#F3F4F6" }}>
                        <td className="px-3 py-2 font-mono" style={{ color: "#0B6E65" }}>
                          {r.data.deckSlug}
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate text-gray-900">
                          {r.data.front}
                        </td>
                        <td className="px-3 py-2 max-w-[160px] truncate"
                          style={{ color: "#4B5563" }}>
                          {r.data.back}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap"
                          style={{ color: "#4B5563" }}>
                          {r.data.category}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-red-600">
                          {r.data.tags.join(", ")}
                        </td>
                        <td className="px-3 py-2 text-yellow-500">
                          {"★".repeat(r.data.importance)}
                        </td>
                      </tr>
                    ))}
                    {validRows.length > 5 && (
                      <tr style={{ borderTop: "1px solid #F3F4F6" }}>
                        <td colSpan={6}
                          className="px-3 py-2.5 text-center text-[13px]"
                          style={{ color: "#9CA3AF" }}>
                          … และอีก {validRows.length - 5} ใบ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Import button */}
              <button
                onClick={handleImport}
                disabled={!validRows.length || isImporting}
                className="w-full py-4 rounded-2xl font-bold text-[17px] text-white
                           disabled:opacity-40 transition-opacity"
                style={{ backgroundColor: "#0B6E65" }}>
                {isImporting
                  ? "กำลัง Import…"
                  : `Import ${validRows.length.toLocaleString()} ใบ`}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
