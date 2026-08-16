/**
 * line-groups.server.ts — ทรัพยากรลับต่อสนาม: ลิงก์ LINE + Google Drive (ฝั่ง server เท่านั้น)
 *
 * ⚠️ ห้าม import จาก component ฝั่ง client เด็ดขาด — เจตนาของ Aj คือสมาชิกกดเข้า
 * ได้จากในแอปโดย "ไม่เห็นลิงก์/รหัส" (กันเอาไปบอกต่อ) ลิงก์จึงต้องไม่อยู่ใน
 * client bundle · ผู้ใช้ได้ลิงก์ผ่าน /api/line/[field] ที่เช็คสิทธิ์ก่อนเท่านั้น
 *
 * ตั้งค่าห้อง OpenChat: ต้องเป็นแบบ "เข้าร่วมผ่านลิงก์ได้เลย ไม่ต้องอนุมัติ"
 * (ห้องแบบกรอกรหัสอนุมัติ แอปกดข้ามให้ไม่ได้ — LINE ไม่มี API อนุมัติแทนคน)
 *
 * driveUrl: โฟลเดอร์ชีท/ไฟล์เรียนของสนามนั้น — ว่าง = ปุ่มดาวน์โหลดไม่โผล่
 * (Aj วางลิงก์เมื่อพร้อม แล้วปุ่มโผล่เองไม่ต้องแตะโค้ดอื่น)
 *
 * เพิ่มสนามใหม่ = เติม entry ใหม่ (key ตรงกับ ExamField.id ใน lib/exam-fields.ts)
 */

import "server-only";

export const LINE_GROUPS: Record<string, {
  name: string; url: string; joinCode?: string; driveUrl?: string;
}> = {
  dcd: {
    name: "นวก.สธ | คร.69 | AJ",
    url:  "https://line.me/ti/g2/4xPNDRow9WS8FsU7dHbXSLyPTf_cMZ5l0Uszuw?utm_source=invitation&utm_medium=link_copy&utm_campaign=default",
    // Aj เลือกห้องแบบกรอกรหัสอนุมัติ (2026-08-16) — รหัสโชว์ใต้ปุ่มเฉพาะคนจ่ายแล้ว
    joinCode: "16082569",
    // ชีท/ไฟล์เรียนสนาม คร. (Aj ส่งลิงก์ 2026-08-16)
    driveUrl: "https://drive.google.com/drive/folders/1qq0FsvaXrrILFz1Zp7W5g0mMr5ihYAhD?usp=sharing",
  },
};
