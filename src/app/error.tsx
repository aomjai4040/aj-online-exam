"use client";
/** ดัก error ระดับหน้า (ใต้ root layout) — โชว์หน้ากู้คืนภาษาไทยแทนจอขาวของ Next */
import CrashRecovery from "@/components/CrashRecovery";

export default function PageError({ error }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <CrashRecovery error={error} />;
}
