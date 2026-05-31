"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const ACCENT = "#0B6E65";
const MUTED  = "#A8A8A6";

function isActive(pathname: string, href: string) {
  if (href === "/")          return pathname === "/" || pathname.startsWith("/exams") || pathname.startsWith("/exam/");
  if (href === "/dashboard") return pathname.startsWith("/dashboard");
  return pathname === href || pathname.startsWith(href + "/");
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = [
    {
      label: "หน้าหลัก",
      href:  "/",
      icon:  (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
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
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        </svg>
      ),
    },
    {
      label: "ข่าวสาร",
      href:  "/news",
      icon:  (a: boolean) => (
        <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
          strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
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
        // Show avatar for logged-in user, generic icon otherwise
        if (user?.photoURL) {
          return (
            <div
              className="w-[22px] h-[22px] rounded-full overflow-hidden border-2 transition-all"
              style={{ borderColor: a ? ACCENT : "transparent" }}
            >
              <Image src={user.photoURL} alt="" width={22} height={22} className="w-full h-full object-cover" />
            </div>
          );
        }
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke={a ? ACCENT : MUTED}
            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-[22px] h-[22px]">
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
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-3 relative"
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-b-full"
                  style={{ backgroundColor: ACCENT }}
                />
              )}
              {item.icon(active)}
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: active ? ACCENT : MUTED }}
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
