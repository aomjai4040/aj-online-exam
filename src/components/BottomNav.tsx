"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ACCENT = "#0B6E65";
const MUTED  = "#9CA3AF";

function active(pathname: string, href: string): boolean {
  if (href === "/")          return pathname === "/" || pathname.startsWith("/exam");
  if (href === "/flashcard") return pathname.startsWith("/flashcard");
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
  return pathname === href || pathname.startsWith(href + "/");
}

// icon size ลดเหลือ 20 px เพื่อรองรับ 5 เมนูบนหน้าจอ 375 px
const SZ = "w-5 h-5";

export default function BottomNav() {
  const pathname = usePathname();
  const { user }  = useAuth();

  const items = [
    {
      label: "หน้าแรก",
      href:  "/",
      icon:  (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={SZ}>
          <path d="M3 9L12 2l9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: "ข้อสอบ",
      href:  "/exams",
      icon:  (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={SZ}>
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      ),
    },
    {
      label: "Flash Card",
      href:  "/flashcard",
      icon:  (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={SZ}>
          <rect x="2" y="6" width="18" height="13" rx="2" />
          <path d="M6 6V4a2 2 0 012-2h12a2 2 0 012 2v11a2 2 0 01-2 2" />
        </svg>
      ),
    },
    {
      label: "ข่าวสาร",
      href:  "/news",
      icon:  (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={SZ}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="12" y2="17" />
        </svg>
      ),
    },
    {
      label: "โปรไฟล์",
      href:  "/dashboard",
      icon:  (a: boolean) => {
        if (user?.photoURL) {
          return (
            <div
              className="w-5 h-5 rounded-full overflow-hidden border-2 transition-all"
              style={{ borderColor: a ? ACCENT : "transparent" }}
            >
              <Image src={user.photoURL} alt="" width={20} height={20}
                className="w-full h-full object-cover" />
            </div>
          );
        }
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={SZ}>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      },
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md"
      style={{ borderTop: "1px solid #EBEBEA" }}
    >
      <div className="flex max-w-lg mx-auto pb-safe">
        {items.map((item) => {
          const isActive = active(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-[3px] py-2.5 relative"
            >
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-b-full"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
              {item.icon(isActive)}
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: isActive ? ACCENT : MUTED }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
