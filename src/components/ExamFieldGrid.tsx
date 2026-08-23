"use client";
/**
 * ExamFieldGrid — การ์ดเลือก "สนามสอบ" บนหน้าแรก
 *
 * วาดจากทะเบียน lib/exam-fields.ts ทั้งหมด — เพิ่มสนามใหม่ไม่ต้องแก้ไฟล์นี้
 *
 * การ์ดใบเดียวทำหน้าที่สองอย่าง:
 *   - สมาชิกที่มีสิทธิ์แล้ว → ปุ่ม "เข้าเรียน" (ใช้เป็นเมนูหลักได้เลย)
 *   - คนยังไม่มีสิทธิ์      → ราคา + นับถอยหลังวันสอบ (เป็นหน้าขาย)
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { getUserAccess, EMPTY_ACCESS, type UserAccess } from "@/lib/access";
import {
  EXAM_FIELDS, ownsField, daysUntil, sortFields, type ExamField,
} from "@/lib/exam-fields";
import { setActiveField } from "@/lib/active-field";
import { dcdCurrentPrice } from "@/lib/pricing";

/** กดการ์ดสนามไหน = เลือกสนามนั้นทั้งแอป (คลังข้อสอบ/Mock ตามไปหมด) */
function rememberField(field: ExamField) {
  setActiveField(field.id === "dcd" ? "dcd" : "moph");
}

function statusChip(field: ExamField, owned: boolean) {
  if (owned) return { text: "มีสิทธิ์แล้ว", bg: "#F0FDF4", fg: "#15803D" };
  if (field.status === "open") return { text: "เปิดรับสมัคร", bg: "#FDF6E9", fg: "#B45309" };
  if (field.status === "soon") return { text: "เร็ว ๆ นี้",   bg: "#F5F5F3", fg: "#A8A8A6" };
  return { text: "สอบไปแล้ว", bg: "#F5F5F3", fg: "#A8A8A6" };
}

function FieldCard({ field, access }: { field: ExamField; access: UserAccess }) {
  const owned = ownsField(field, access);
  const chip  = statusChip(field, owned);
  const left  = field.examDate ? daysUntil(field.examDate) : null;
  const price = field.id === "dcd" ? dcdCurrentPrice().amount : field.price;

  // มีสิทธิ์ → หน้าคอร์ส · ยังไม่มีสิทธิ์แต่เปิดขาย → หน้าคอร์สเหมือนกัน (จะเจอหน้า "ล็อก"
  // บอกให้สมัคร — Aj 2026-08-23: ไม่เด้งไปหน้าจ่ายเงินทันที จะได้ไม่งงถ้ากดผิดคอร์ส)
  // ยังไม่เปิดขาย → การ์ดกดไม่ได้
  const href = owned ? field.hrefOwned : field.hrefBuy ? field.hrefOwned : undefined;
  const Wrapper = href ? Link : "div";
  const wrapperProps = href ? { href } : {};

  // สนามที่เปิดขายและยังไม่ซื้อ = ใบเด่น (พื้นเข้ม gradient ตามสีสนาม)
  const featured = field.status === "open" && !owned;

  if (featured) {
    return (
      <Wrapper
        {...(wrapperProps as { href: string })}
        onClick={() => rememberField(field)}
        className="card-elev-hover relative block rounded-2xl overflow-hidden active:scale-[0.98]"
        style={{
          background: `linear-gradient(150deg, ${field.accent} 0%, #0B4F48 80%)`,
          boxShadow: `0 2px 6px rgba(16,24,40,.06), 0 14px 30px -10px ${field.accent}59`,
        }}>
        <div aria-hidden className="absolute -top-12 -right-10 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(closest-side, rgba(255,255,255,0.18), transparent)" }} />
        <div className="relative px-4 py-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "white" }}>
              {field.code}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "#FBBF24", color: "#7C2D12" }}>
              เปิดรับสมัคร
            </span>
          </div>

          <p className="text-[16px] font-bold text-white leading-snug">{field.name}</p>
          <p className="text-[12.5px] mt-0.5" style={{ color: "rgba(255,255,255,0.72)" }}>
            {field.blurb}
          </p>

          <div className="flex items-end justify-between mt-3.5 gap-2">
            {left !== null && left >= 0 ? (
              <p className="text-[12.5px] font-semibold" style={{ color: "#9FE1CB" }}>
                เหลือ <span className="text-[15px] font-extrabold" style={{ color: "#FBBF24" }}>{left}</span> วัน
                · {field.examLabel}
              </p>
            ) : (
              <p className="text-[12.5px] font-semibold" style={{ color: "#9FE1CB" }}>
                {field.examLabel ?? "วันสอบรอประกาศ"}
              </p>
            )}
            {price && (
              <span className="text-[17px] font-extrabold text-white flex-shrink-0">฿{price}</span>
            )}
          </div>
        </div>
      </Wrapper>
    );
  }

  return (
    <Wrapper
      {...(wrapperProps as { href: string })}
      onClick={() => rememberField(field)}
      className={`card-elev block overflow-hidden ${
        href ? "card-elev-hover active:scale-[0.98]" : "opacity-60"
      }`}>
      <div className="h-[3px]" style={{ backgroundColor: field.accent }} />
      <div className="px-4 py-3.5">
        <div className="flex items-start gap-2 mb-1.5">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md flex-shrink-0"
            style={{ backgroundColor: `${field.accent}15`, color: field.accent }}>
            {field.code}
          </span>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: chip.bg, color: chip.fg }}>
            {chip.text}
          </span>
        </div>

        <p className="text-[14.5px] font-bold text-gray-900 leading-snug">{field.name}</p>
        <p className="text-[12.5px] mt-0.5" style={{ color: "#A8A8A6" }}>{field.blurb}</p>

        <div className="flex items-end justify-between mt-3 gap-2">
          <div className="min-w-0">
            {field.status === "ended" && (
              <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>
                {owned ? "ยังเข้าทบทวนได้" : field.examLabel}
              </p>
            )}
            {field.status === "soon" && (
              <p className="text-[12.5px]" style={{ color: "#A8A8A6" }}>
                กำลังเตรียมคอร์ส
              </p>
            )}
            {field.status === "open" && (
              <p className="text-[12.5px] font-semibold" style={{ color: field.accent }}>
                {left !== null && left >= 0
                  ? `เหลือ ${left} วัน · ${field.examLabel}`
                  : (field.examLabel ?? "วันสอบรอประกาศ")}
              </p>
            )}
          </div>

          {owned && (
            <span className="text-[13px] font-bold flex-shrink-0" style={{ color: field.accent }}>
              เข้าเรียน →
            </span>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

/** "คอร์สอื่นที่เปิดรับสมัคร" — ท้ายหน้าคอร์ส โชว์เฉพาะสนามที่เปิดขายและผู้ใช้ยังไม่มี
 *  (Aj 2026-08-23: ให้น้องในคอร์สหนึ่งเห็นทางไปสมัครอีกคอร์สโดยไม่ต้องหาเมนู) */
export function OtherCourses({ access }: { access: UserAccess }) {
  const others = EXAM_FIELDS.filter((f) => f.status === "open" && !ownsField(f, access));
  if (others.length === 0) return null;
  return (
    <section className="max-w-lg md:max-w-4xl mx-auto px-5 pt-2 pb-4">
      <div className="section-head mb-1">
        <h2 className="text-[17px] font-bold text-gray-900">คอร์สอื่นที่เปิดรับสมัคร</h2>
      </div>
      <p className="text-[12.5px] mb-3" style={{ color: "#A8A8A6" }}>
        สมัครเพิ่มได้ในบัญชีเดียวกัน — สลับคอร์สได้จากปุ่มบนหัวหน้า
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {others.map((f) => <FieldCard key={f.id} field={f} access={access} />)}
      </div>
    </section>
  );
}

export default function ExamFieldGrid() {
  const { user } = useAuth();
  const [access, setAccess] = useState<UserAccess>(EMPTY_ACCESS);

  useEffect(() => {
    if (!user) { setAccess(EMPTY_ACCESS); return; }
    let cancelled = false;
    getUserAccess(user.uid)
      .then((a) => { if (!cancelled) setAccess(a); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  const fields = sortFields(EXAM_FIELDS, access);

  return (
    <section className="max-w-lg md:max-w-4xl mx-auto px-5 pt-6">
      <div className="flex items-baseline justify-between mb-1">
        <div className="section-head">
          <h2 className="text-[17px] font-bold text-gray-900">สนามสอบ</h2>
        </div>
        <Link href="/packages" className="text-[13px] font-medium" style={{ color: "#0B6E65" }}>
          ดูแพ็กเกจ →
        </Link>
      </div>
      <p className="text-[12.5px] mb-4" style={{ color: "#A8A8A6" }}>
        เลือกสนามที่จะสอบ — แต่ละสนามมีคลังข้อสอบและแผนติวของตัวเอง
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((f) => <FieldCard key={f.id} field={f} access={access} />)}
      </div>
    </section>
  );
}
