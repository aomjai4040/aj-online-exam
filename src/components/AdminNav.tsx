"use client";
/**
 * AdminNav — แถบเมนู admin แบบ sticky บนสุดของทุกหน้า admin
 *
 * ที่มา (Aj 17 ส.ค. 2569): เดิมแถบ "การดำเนินการ" อยู่ล่างสุดของหน้า Dashboard
 * ต้องเลื่อนลงไปหาทุกครั้ง และปุ่ม 13 อันเรียงกันเป็นพรืดไม่มีหัวข้อ
 *
 * แก้เป็น: อยู่บนสุด · ติดหน้าจอ (sticky) · จัด 3 กลุ่มพร้อมหัวข้อกำกับ
 * เมนูที่ผูกกับสนามเฉพาะกิจถูกยุบตามข้อ 7 — ใช้เมนูเดียวแล้วเลือกสนามข้างใน
 */
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/subjects";

interface Item { href: string; label: string; external?: boolean }

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: "ดูข้อมูล",
    items: [
      { href: "/admin",            label: "Dashboard" },
      { href: "/admin/insights",   label: "ภาพรวมธุรกิจ" },
      { href: "/admin/revenue",    label: "รายงานยอดขาย" },
      { href: "/admin/users",      label: "สมาชิก" },
      { href: "/admin/feedback",   label: "ผลประเมิน" },
      { href: "/admin/dcd-intake", label: "แบบสอบถาม" },
    ],
  },
  {
    title: "จัดการเนื้อหา",
    items: [
      { href: "/admin/exams",      label: "ข้อสอบ" },
      { href: "/admin/videos",     label: "คอร์สวิดีโอ" },
      { href: "/admin/flashcards", label: "Flash Card" },
      { href: "/admin/recall",     label: "คลังความจำผู้สอบ" },
      { href: "/admin/moph-focus", label: "เนื้อหารายสนาม" },
      { href: "/admin/plan",       label: "ปฏิทินคอร์ส" },
    ],
  },
  {
    title: "ระบบ",
    items: [
      { href: "/admin/exams/new",  label: "สร้างข้อสอบใหม่" },
      { href: "/admin/codes",      label: "โค้ด (ส่วนลด/เปิดคอร์ส)" },
      { href: "/admin/seed",       label: "Seed ข้อสอบ" },
      { href: "/exams",            label: "ดูหน้านักเรียน ↗", external: true },
    ],
  },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // หน้าปัจจุบันอยู่กลุ่มไหน — เอาไว้โชว์ชื่อบนแถบตอนยุบ
  const current = GROUPS.flatMap((g) => g.items)
    .filter((i) => !i.external)
    .sort((a, b) => b.href.length - a.href.length)
    .find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));

  return (
    <div className="sticky top-0 z-40 bg-white"
      style={{ borderBottom: "1px solid #EBEBEA", boxShadow: "0 1px 8px rgba(0,0,0,0.04)" }}>
      <div className="max-w-5xl mx-auto px-5">

        {/* แถบหลัก */}
        <div className="h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Link href="/admin" className="flex items-center gap-2 flex-shrink-0">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[11px] font-bold"
                style={{ background: "linear-gradient(135deg, #10857A, #0B6E65)" }}>
                AJ
              </span>
              <span className="text-[13.5px] font-bold text-gray-900 hidden sm:block">Admin</span>
            </Link>
            {current && (
              <>
                <span className="text-[13px]" style={{ color: "#C4C4C0" }}>/</span>
                <span className="text-[13.5px] font-semibold truncate" style={{ color: BRAND.primary }}>
                  {current.label}
                </span>
              </>
            )}
          </div>

          <button onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5 rounded-lg flex-shrink-0"
            style={{ backgroundColor: open ? BRAND.primary : "#EBF5F3", color: open ? "white" : BRAND.primary }}>
            เมนู
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"
              style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>

        {/* เมนูกาง — 3 กลุ่มพร้อมหัวข้อ */}
        {open && (
          <div className="pb-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
            style={{ borderTop: "1px solid #F3F2F0", paddingTop: "0.875rem" }}>
            {GROUPS.map((g) => (
              <div key={g.title}>
                <p className="text-[11.5px] font-bold mb-1.5" style={{ color: "#A8A8A6" }}>
                  {g.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {g.items.map((it) => {
                    const active = !it.external &&
                      (pathname === it.href || pathname.startsWith(it.href + "/"));
                    return (
                      <Link key={it.href} href={it.href}
                        onClick={() => setOpen(false)}
                        {...(it.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-[13.5px] px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{
                          backgroundColor: active ? "#EBF5F3" : "transparent",
                          color: active ? BRAND.primary : "#374151",
                          fontWeight: active ? 600 : 400,
                        }}>
                        {it.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
