"use client";
/** ดัก error ระดับ root layout — ตัวนี้คือหน้าที่แทน
 *  "Application error: a client-side exception has occurred" ของ Next โดยตรง
 *  ต้องมี <html><body> เองเพราะเรนเดอร์แทน layout ทั้งก้อน (ไม่มี globals.css) */
import CrashRecovery from "@/components/CrashRecovery";

export default function GlobalError({ error }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body style={{ margin: 0 }}>
        <CrashRecovery error={error} />
      </body>
    </html>
  );
}
