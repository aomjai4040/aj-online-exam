/**
 * รายชื่ออีเมลที่มีสิทธิ์เข้า Admin Panel
 * เพิ่ม/ลบ email ที่นี่เท่านั้น
 */
export const ADMIN_EMAILS: string[] = [
  "aomjai.4040@gmail.com",
];

export function isAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(email ?? "");
}
