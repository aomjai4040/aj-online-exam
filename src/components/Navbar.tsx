"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Home page has its own full custom header — suppress generic nav
  if (pathname === "/") return null;

  const isAdmin = pathname.startsWith("/admin");

  return (
    <header
      className="bg-white/90 backdrop-blur-md sticky top-0 z-50"
      style={{ borderBottom: "1px solid #EBEBEA" }}
    >
      <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "#0B6E65" }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </div>
          <span className="font-bold text-[14px] text-gray-900 tracking-tight">
            AJ <span style={{ color: "#0B6E65" }}>ExamOnline</span>
          </span>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {isAdmin ? (
            /* Admin nav */
            <>
              <Link href="/admin"
                className="text-[13px] text-gray-500 hover:text-gray-900 px-2 py-1 transition-colors">
                Dashboard
              </Link>
              <Link href="/admin/exams"
                className="text-[13px] text-gray-500 hover:text-gray-900 px-2 py-1 transition-colors">
                จัดการข้อสอบ
              </Link>
              <Link href="/admin/codes"
                className="text-[13px] text-gray-500 hover:text-gray-900 px-2 py-1 transition-colors">
                Codes
              </Link>
              <Link href="/" className="btn-secondary text-[12px] px-3 py-1.5 rounded-lg">
                ← นักเรียน
              </Link>
            </>
          ) : (
            /* Student nav */
            <>
              <Link href="/"
                className="hidden sm:flex items-center gap-1 text-[13px] text-gray-500
                           hover:text-gray-900 px-2 py-1 transition-colors">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                หน้าหลัก
              </Link>

              {/* Auth area */}
              {loading ? (
                <div className="w-8 h-8 rounded-full animate-pulse bg-gray-100" />
              ) : user ? (
                /* Logged-in: avatar + dropdown */
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((o) => !o)}
                    className="w-8 h-8 rounded-full overflow-hidden border-2 transition-all"
                    style={{ borderColor: menuOpen ? "#0B6E65" : "transparent" }}
                  >
                    {user.photoURL ? (
                      <Image
                        src={user.photoURL}
                        alt={user.displayName ?? ""}
                        width={32} height={32}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white text-[13px] font-bold"
                        style={{ backgroundColor: "#0B6E65" }}
                      >
                        {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
                      </div>
                    )}
                  </button>

                  {menuOpen && (
                    <>
                      {/* Backdrop */}
                      <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                      {/* Dropdown */}
                      <div
                        className="absolute right-0 top-10 z-50 w-52 bg-white rounded-2xl shadow-xl
                                   overflow-hidden py-1.5"
                        style={{ border: "1px solid #EBEBEA" }}
                      >
                        <div className="px-4 py-2.5 border-b" style={{ borderColor: "#F3F2F0" }}>
                          <p className="text-[13px] font-semibold text-gray-900 truncate">
                            {user.displayName ?? "ผู้ใช้"}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: "#A8A8A6" }}>
                            {user.email}
                          </p>
                        </div>
                        <Link
                          href="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700
                                     hover:bg-stone-50 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                            className="w-4 h-4 text-gray-400">
                            <rect x="3" y="3" width="7" height="7" rx="1" />
                            <rect x="14" y="3" width="7" height="7" rx="1" />
                            <rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="14" y="14" width="7" height="7" rx="1" />
                          </svg>
                          Dashboard ของฉัน
                        </Link>
                        <Link
                          href="/exams"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700
                                     hover:bg-stone-50 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                            className="w-4 h-4 text-gray-400">
                            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                          </svg>
                          คลังข้อสอบ
                        </Link>
                        <a
                          href="https://jade-fenglisu-32fb47.netlify.app"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700
                                     hover:bg-stone-50 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                            className="w-4 h-4 text-gray-400">
                            <rect x="2" y="3" width="20" height="14" rx="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                            <polyline points="10 9 12 11 16 7" />
                          </svg>
                          Checklist วิดีโอ
                        </a>
                        <Link
                          href="/activate"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700
                                     hover:bg-stone-50 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                            className="w-4 h-4 text-gray-400">
                            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                          </svg>
                          กรอก Activation Code
                        </Link>
                        <hr style={{ borderColor: "#F3F2F0" }} />
                        <button
                          onClick={() => { setMenuOpen(false); signOut(); }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px]
                                     text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                            className="w-4 h-4">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          ออกจากระบบ
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                /* Not logged in: Sign-in button */
                <button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-1.5 text-[12.5px] font-semibold px-3 py-1.5
                             rounded-xl border transition-all hover:shadow-sm active:scale-[0.97]"
                  style={{ borderColor: "#E0DFDC", color: "#374151" }}
                >
                  {/* Google G icon */}
                  <svg viewBox="0 0 24 24" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  เข้าสู่ระบบ
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
