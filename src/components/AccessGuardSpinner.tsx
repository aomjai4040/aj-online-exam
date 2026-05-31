/**
 * แสดงระหว่างที่ useAccessGuard กำลัง checking
 * ใช้ร่วมกันทุกหน้าที่ต้อง guard
 */
export default function AccessGuardSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-8 h-8 border-[3px] rounded-full animate-spin"
        style={{ borderColor: "#C3E5DE", borderTopColor: "#0B6E65" }}
      />
    </div>
  );
}
