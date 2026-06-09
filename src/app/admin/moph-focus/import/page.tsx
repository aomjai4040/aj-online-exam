"use client";
import { useCallback, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { bulkImportMOPHFocus } from "@/lib/moph-focus-firestore";
import {
  MOPH_TAG_LIST, MOPH_TAGS,
  type MOPHTag, type MOPHImportRow,
} from "@/lib/moph-focus-types";

// ─── CSV Template ─────────────────────────────────────────────────────────────
//
// Columns (ต้องครบทุก column):
//   title          → หัวข้อหลัก
//   subtitle       → หัวข้อรอง (ว่างได้)
//   summary        → สรุป 2-3 บรรทัด (plain text)
//   mustKnow       → สิ่งที่ต้องรู้ (Markdown)
//   examPoints     → อาจออกสอบตรงไหน (Markdown)
//   quickMemory    → จำง่ายใน 10 วินาที (Markdown)
//   fullContent    → อ่านเพิ่มเติม (Markdown, ว่างได้)
//   tags           → pipe-separated เช่น "Quick Win|นโยบาย"
//   coverEmoji     → emoji ปก เช่น 🏥
//   order          → ลำดับ (ตัวเลข)
//   isPublished    → 1 หรือ 0
//   publishedDate  → YYYY-MM-DD (ว่างได้ = วันนี้)

const TEMPLATE_HEADER =
  "title,subtitle,summary,mustKnow,examPoints,quickMemory,fullContent,tags,coverEmoji,order,isPublished,publishedDate";

const TEMPLATE_ROWS = [
  `นโยบาย 30 บาทรักษาทุกที่,ระบบหลักประกันสุขภาพถ้วนหน้า,ประชาชนทุกคนสามารถรับบริการที่สถานพยาบาลใดก็ได้ทั่วประเทศ ไม่จำกัดสิทธิ์ตามภูมิลำเนา,"**หลักการ**: ใช้บัตรประชาชนรับบริการได้ทุกที่ทั่วไทย\n**เริ่ม**: ปี 2566 นำร่อง 4 จังหวัด\n**ปัจจุบัน**: ขยายครอบคลุมทั่วประเทศ","- อาจถามเกี่ยวกับ **หลักการ** หรือ **ปี** ที่เริ่มนโยบาย\n- ถามว่านโยบายนี้เกี่ยวกับระบบสุขภาพประเภทใด","30 บาท = ใบเดียวทั่วไทย\nบัตรประชาชน 1 ใบ รักษาได้ทุกที่","## พื้นหลัง\nนโยบาย 30 บาทรักษาทุกที่ เป็นการพัฒนาต่อยอดจากโครงการหลักประกันสุขภาพถ้วนหน้า (บัตรทอง) เดิม\n\n## เป้าหมาย\n- ลดความเหลื่อมล้ำในการเข้าถึงบริการสุขภาพ\n- ลดภาระการเดินทางของผู้ป่วย","Quick Win|นโยบาย|ข่าวที่ควรรู้",🏥,1,1,2025-01-01`,
];

const TEMPLATE_CSV = "﻿" + [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join("\n");

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_TAGS = new Set<string>(MOPH_TAG_LIST);

interface ParsedRow {
  rowNum: number;
  data:   MOPHImportRow;
  errors: string[];
  valid:  boolean;
}

function parseRow(raw: Record<string, string>, rowNum: number): ParsedRow {
  const g = (k: string) => String(raw[k] ?? "").trim();
  const errors: string[] = [];

  const title        = g("title");
  const subtitle     = g("subtitle");
  const summary      = g("summary");
  const mustKnow     = g("mustKnow");
  const examPoints   = g("examPoints");
  const quickMemory  = g("quickMemory");
  const fullContent  = g("fullContent");
  const coverEmoji   = g("coverEmoji") || "🏥";
  const order        = parseInt(g("order"), 10) || rowNum;
  const isPublished  = g("isPublished") !== "0";
  const publishedDate = g("publishedDate");

  // Tags: pipe-separated
  const rawTags = g("tags")
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
  const tags: MOPHTag[] = [];
  const badTags: string[] = [];
  for (const t of rawTags) {
    if (VALID_TAGS.has(t)) {
      tags.push(t as MOPHTag);
    } else {
      badTags.push(t);
    }
  }

  // Validation
  if (!title)   errors.push("title ว่าง");
  if (!summary) errors.push("summary ว่าง");
  if (!mustKnow) errors.push("mustKnow ว่าง");
  if (badTags.length) errors.push(`tags ไม่รู้จัก: ${badTags.join(", ")}`);
  if (publishedDate && !/^\d{4}-\d{2}-\d{2}$/.test(publishedDate))
    errors.push("publishedDate ต้องเป็น YYYY-MM-DD");

  return {
    rowNum,
    data: { title, subtitle, summary, mustKnow, examPoints, quickMemory,
            fullContent, tags, coverEmoji, order, isPublished, publishedDate },
    errors,
    valid: errors.length === 0,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

type ImportState = "idle" | "parsed" | "importing" | "done" | "error";

export default function MOPHFocusImportPage() {
  const fileRef                   = useRef<HTMLInputElement>(null);
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [state, setState]         = useState<ImportState>("idle");
  const [importedCount, setImportedCount] = useState(0);
  const [errorMsg, setErrorMsg]   = useState("");
  const [fileName, setFileName]   = useState("");

  // ── Parse file ──────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    setState("idle");
    setRows([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb    = XLSX.read(e.target?.result, { type: "array" });
        const ws    = wb.Sheets[wb.SheetNames[0]];
        const data  = XLSX.utils.sheet_to_json<Record<string, string>>(ws, {
          defval: "",
          raw: false,
        });

        if (!data.length) {
          setErrorMsg("ไม่พบข้อมูลในไฟล์");
          setState("error");
          return;
        }

        const parsed = data.map((row, i) => parseRow(row, i + 2));
        setRows(parsed);
        setState("parsed");
      } catch {
        setErrorMsg("อ่านไฟล์ไม่ได้ กรุณาตรวจสอบรูปแบบ");
        setState("error");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Import ──────────────────────────────────────────────────────────────
  const handleImport = async () => {
    const validRows = rows.filter((r) => r.valid);
    if (!validRows.length) return;

    setState("importing");
    try {
      const { imported } = await bulkImportMOPHFocus(validRows.map((r) => r.data));
      setImportedCount(imported);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Import ไม่สำเร็จ");
      setState("error");
    }
  };

  // ── Download template ───────────────────────────────────────────────────
  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "moph_focus_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Stats ───────────────────────────────────────────────────────────────
  const validCount   = rows.filter((r) =>  r.valid).length;
  const invalidCount = rows.filter((r) => !r.valid).length;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto p-5 space-y-5">

      {/* Header */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">
          Admin
        </p>
        <h1 className="text-[22px] font-extrabold text-gray-900">
          🏥 MOPH Focus — Import
        </h1>
        <p className="text-[14px] mt-0.5 text-gray-500">
          นำเข้าประเด็นสำคัญด้วยไฟล์ CSV หรือ Excel
        </p>
      </div>

      {/* Preset tags */}
      <div className="bg-blue-50 rounded-2xl p-4" style={{ border: "1px solid #BAE6FD" }}>
        <p className="text-[13px] font-bold text-blue-800 mb-2">
          🏷 Tags ที่ใช้ได้ (ใช้ pipe | คั่น):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(MOPH_TAGS).map((t) => (
            <code key={t}
              className="text-[11px] bg-white px-2 py-0.5 rounded-lg border border-blue-200
                         font-mono text-blue-700">
              {t}
            </code>
          ))}
        </div>
      </div>

      {/* Template download */}
      <div className="flex gap-3">
        <button
          onClick={downloadTemplate}
          className="flex-1 py-3 rounded-xl text-[14px] font-semibold
                     flex items-center justify-center gap-2 transition-colors
                     hover:bg-blue-50 active:scale-[0.97]"
          style={{ border: "1px solid #BAE6FD", color: "#0369A1" }}>
          ⬇ ดาวน์โหลด Template CSV
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                   transition-colors hover:border-blue-400 hover:bg-blue-50"
        style={{ borderColor: "#BAE6FD" }}
      >
        <div className="text-4xl mb-3">📂</div>
        <p className="text-[16px] font-semibold text-gray-800">
          ลากวางไฟล์ หรือคลิกเพื่อเลือก
        </p>
        <p className="text-[13px] mt-1 text-gray-500">
          รองรับ .csv และ .xlsx · UTF-8
        </p>
        {fileName && (
          <p className="text-[13px] mt-2 font-medium" style={{ color: "#0369A1" }}>
            📄 {fileName}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Error */}
      {state === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <p className="text-red-600 font-semibold text-[14px]">❌ {errorMsg}</p>
        </div>
      )}

      {/* Parse results */}
      {(state === "parsed" || state === "done") && rows.length > 0 && (
        <div className="space-y-4">

          {/* Summary bar */}
          <div className="flex gap-3">
            <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-[28px] font-extrabold text-green-700">{validCount}</p>
              <p className="text-[13px] font-semibold text-green-600">พร้อม Import</p>
            </div>
            {invalidCount > 0 && (
              <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <p className="text-[28px] font-extrabold text-red-600">{invalidCount}</p>
                <p className="text-[13px] font-semibold text-red-500">มีข้อผิดพลาด</p>
              </div>
            )}
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
              <p className="text-[28px] font-extrabold text-gray-700">{rows.length}</p>
              <p className="text-[13px] font-semibold text-gray-500">รวมทั้งหมด</p>
            </div>
          </div>

          {/* Row preview */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {rows.map((row) => (
              <div key={row.rowNum}
                className="rounded-xl px-4 py-3"
                style={{
                  backgroundColor: row.valid ? "#F0FDF4" : "#FEF2F2",
                  border: `1px solid ${row.valid ? "#BBF7D0" : "#FECACA"}`,
                }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate"
                      style={{ color: row.valid ? "#15803D" : "#DC2626" }}>
                      {row.valid ? "✓" : "✗"} แถว {row.rowNum}:{" "}
                      {row.data.coverEmoji} {row.data.title || "(ไม่มีชื่อ)"}
                    </p>
                    {row.data.tags.length > 0 && (
                      <p className="text-[11px] mt-0.5 text-gray-500">
                        🏷 {row.data.tags.join(" | ")}
                      </p>
                    )}
                    {row.errors.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {row.errors.map((e, i) => (
                          <li key={i} className="text-[12px] text-red-600">• {e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Import button */}
          {state === "parsed" && validCount > 0 && (
            <button
              onClick={handleImport}
              className="w-full py-4 rounded-2xl font-bold text-[17px] text-white
                         transition-transform active:scale-[0.97]"
              style={{ backgroundColor: "#0369A1" }}>
              ✅ Import {validCount} ประเด็น
              {invalidCount > 0 && ` (ข้ามที่มีข้อผิดพลาด ${invalidCount} แถว)`}
            </button>
          )}
        </div>
      )}

      {/* Importing spinner */}
      {state === "importing" && (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="w-7 h-7 rounded-full border-[3px] border-t-transparent animate-spin"
            style={{ borderColor: "#0369A1", borderTopColor: "transparent" }} />
          <p className="text-[16px] font-semibold text-gray-700">กำลัง Import…</p>
        </div>
      )}

      {/* Done */}
      {state === "done" && (
        <div className="bg-green-50 border border-green-300 rounded-2xl p-5 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <p className="text-[18px] font-extrabold text-green-700">
            Import สำเร็จ {importedCount} ประเด็น
          </p>
          <p className="text-[14px] mt-1 text-green-600">
            ข้อมูลถูกบันทึกใน Firestore collection{" "}
            <code className="font-mono bg-green-100 px-1 rounded">mophFocus</code> แล้ว
          </p>
          <div className="flex gap-3 mt-4 justify-center">
            <a
              href="/moph-focus"
              className="px-5 py-2.5 rounded-xl text-[14px] font-semibold text-white"
              style={{ backgroundColor: "#0369A1" }}>
              ดูหน้า MOPH Focus
            </a>
            <button
              onClick={() => { setRows([]); setState("idle"); setFileName(""); }}
              className="px-5 py-2.5 rounded-xl text-[14px] font-semibold"
              style={{ backgroundColor: "#F3F4F6", color: "#374151" }}>
              Import เพิ่มเติม
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
