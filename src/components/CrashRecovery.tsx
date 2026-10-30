"use client";
/**
 * CrashRecovery — หน้ากู้คืนเมื่อแอป crash ฝั่ง client
 * (แทนหน้า "Application error: a client-side exception..." ภาษาอังกฤษของ Next)
 *
 * สาเหตุอันดับหนึ่งในโปรดักชัน: deploy เวอร์ชันใหม่ระหว่างที่เครื่องน้องยังเปิด
 * แอปเวอร์ชันเก่าค้างไว้ (PWA บนมือถือ) — ชิ้นส่วน JS เก่าหายจากเซิร์ฟเวอร์
 * → ChunkLoadError (เจอจริงเครื่องน้อง 2026-10-30 วัน deploy 2 รอบหลังประกาศผลภาค ข)
 *
 * เคส chunk เก่า: เคลียร์แคช + โหลดใหม่ให้เองเงียบ ๆ 1 ครั้ง (sessionStorage กันวนลูป)
 * เคสอื่น: การ์ดภาษาไทย + ปุ่มล้างแคชแล้วโหลดใหม่
 *
 * ใช้ inline style ล้วน — global-error.tsx เรนเดอร์แทน root layout ทั้งก้อน
 * ตอนนั้นไม่มี globals.css/Tailwind ให้พึ่ง
 */
import { useEffect, useState } from "react";

const STALE_RE =
  /ChunkLoadError|Loading chunk|chunk .* failed|dynamically imported module|Importing a module script failed/i;
const GUARD_KEY = "aj-crash-autoreload-at";

async function clearCachesAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  window.location.reload();
}

export default function CrashRecovery({ error }: { error: Error & { digest?: string } }) {
  const [busy, setBusy] = useState(false);

  const stale = STALE_RE.test(`${error?.name ?? ""} ${error?.message ?? ""}`);
  useEffect(() => {
    if (!stale) return;
    let last = 0;
    try { last = Number(sessionStorage.getItem(GUARD_KEY) ?? 0); } catch {}
    if (Date.now() - last < 60_000) return; // เพิ่งรีโหลดอัตโนมัติไป — ให้คนกดเอง
    try { sessionStorage.setItem(GUARD_KEY, String(Date.now())); } catch {}
    void clearCachesAndReload();
  }, [stale]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      backgroundColor: "#F5FAF9", padding: "24px",
      fontFamily: "'Prompt', -apple-system, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        maxWidth: 380, width: "100%", textAlign: "center",
        backgroundColor: "white", border: "1.5px solid #C3E5DE", borderRadius: 20,
        padding: "28px 22px",
      }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#0B4F48", margin: 0 }}>
          แอปเพิ่งอัปเดตเวอร์ชันใหม่ค่ะ
        </p>
        <p style={{ fontSize: 13.5, lineHeight: 1.7, color: "#0B6E65", margin: "10px 0 20px" }}>
          หน้าที่เปิดอยู่เป็นเวอร์ชันเก่า เลยแสดงผลไม่ได้ —
          กดปุ่มด้านล่างเพื่อโหลดเวอร์ชันล่าสุด ข้อมูลและสิทธิ์ของคุณอยู่ครบเหมือนเดิม
        </p>
        <button
          onClick={() => { setBusy(true); void clearCachesAndReload(); }}
          disabled={busy}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
            backgroundColor: "#0B6E65", color: "white", fontSize: 15, fontWeight: 700,
            fontFamily: "inherit", cursor: "pointer", opacity: busy ? 0.6 : 1,
          }}>
          {busy ? "กำลังโหลดใหม่…" : "โหลดแอปเวอร์ชันล่าสุด"}
        </button>
        <p style={{ fontSize: 11.5, color: "#A8A8A6", margin: "14px 0 0" }}>
          ถ้ายังเจอหน้านี้ซ้ำ ปิดแอปแล้วเปิดใหม่อีกครั้ง หรือทักไลน์บอกพี่อ้อมได้เลยค่ะ
        </p>
      </div>
    </div>
  );
}
