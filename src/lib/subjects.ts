/**
 * subjects.ts — สีประจำวิชา (แหล่งเดียวทั้งแอป)
 *
 * เดิม SUBJECT_COLOR ถูก copy ไว้ 4 ไฟล์และค่าไม่ตรงกัน — ห้าม copy เพิ่ม
 * ใช้ subjectColor(s) เสมอ
 */

export const BRAND = {
  primary:   "#0B6E65", // เขียวแบรนด์หลัก
  primaryDark: "#0B4F48", // hero / พื้นเข้ม
  primarySoft: "#EBF5F3", // พื้นอ่อนของแบรนด์ (chip/badge)
  primaryRing: "#C3E5DE", // เส้นขอบโทนแบรนด์
} as const;

export const SUBJECT_COLOR: Record<string, string> = {
  // วิชาสายสาธารณสุข (ชื่อเก่า)
  ระบาดวิทยา:          "#3B82F6",
  อนามัยสิ่งแวดล้อม:   "#10B981",
  กฎหมาย:              "#F97316",
  บริหารสาธารณสุข:     "#8B5CF6",
  ชีวสถิติ:            "#0D9488",
  "นโยบาย สป.สธ.":     "#EF4444",
  // subject code ใหม่ (types.ts SUBJECTS)
  BASIC:   "#3B82F6",
  APPLIED: "#8B5CF6",
  POLICY:  "#EF4444",
  CURRENT: "#F59E0B",
  REFORM:  "#10B981",
  LAWIT:   "#F97316",
  MOPH:    "#0D9488",
  // วิชาทั่วไป (legacy)
  คณิตศาสตร์:          "#3B82F6",
  ภาษาไทย:            "#EC4899",
  วิทยาศาสตร์:         "#10B981",
  ภาษาอังกฤษ:         "#8B5CF6",
  สังคมศึกษา:          "#F59E0B",
  ประวัติศาสตร์:        "#EF4444",
  คอมพิวเตอร์:         "#06B6D4",
};

export function subjectColor(s: string): string {
  return SUBJECT_COLOR[s] ?? BRAND.primary;
}

/** พื้นหลังจาง ๆ ของสีวิชา (ไว้ทำ chip) */
export function subjectChipBg(s: string): string {
  const hex = subjectColor(s).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.1)`;
}
