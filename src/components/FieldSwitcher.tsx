"use client";
/**
 * FieldSwitcher — แถบสลับสนามบนหัวหน้า list (คลังข้อสอบ / Mock Exam)
 *
 * โชว์เมื่อผู้ใช้มีสิทธิ์สนาม คร. หรือกำลังดูสนาม คร. อยู่ — คนที่มีแต่ สป.สธ.
 * ไม่เห็นแถบนี้เลย (ไม่มีอะไรให้สลับ ประสบการณ์เดิมไม่เปลี่ยน)
 * เลือกแล้วจำค้างทั้งแอปผ่าน active-field
 */
import { FIELD_SHORT, type ExamFieldKey } from "@/lib/exam-fields";
import { setActiveField } from "@/lib/active-field";
import { BRAND } from "@/lib/subjects";

export default function FieldSwitcher({
  current, show, onChange,
}: {
  current: ExamFieldKey;
  show: boolean;
  onChange: (f: ExamFieldKey) => void;
}) {
  if (!show) return null;
  return (
    <div className="flex gap-2 mb-4">
      {(Object.keys(FIELD_SHORT) as ExamFieldKey[]).map((f) => {
        const sel = current === f;
        return (
          <button key={f}
            onClick={() => { setActiveField(f); onChange(f); }}
            className="flex-1 py-2.5 rounded-xl text-[13.5px] font-semibold transition-colors"
            style={{
              backgroundColor: sel ? BRAND.primary : "white",
              color: sel ? "white" : "#6B7280",
              border: `1.5px solid ${sel ? BRAND.primary : "#EBEBEA"}`,
            }}>
            สนาม{FIELD_SHORT[f]}
          </button>
        );
      })}
    </div>
  );
}
