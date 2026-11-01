// ให้สิทธิ์แพ็กคู่ซ้อมภาค ค (partc-duo-69) กับน้องที่จ่ายเงินสดกับ Aj โดยตรง
// ใช้: node grant-partc-duo.mjs <email>
//   - น้องเคย login แล้ว  → เขียน userCourses ให้เลย (source: manual-cash)
//   - ยังไม่เคย login     → สร้างโค้ด activation ใช้ครั้งเดียว ให้ Aj ส่งโค้ดไปกรอกเอง
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const COURSE_ID   = "partc-duo-69";
const COURSE_NAME = "ซ้อมสัมภาษณ์ภาค ค แพ็กคู่ สป.สธ. + คร. 2569";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) { console.error("ใส่อีเมล: node grant-partc-duo.mjs <email>"); process.exit(1); }

const sa = JSON.parse(readFileSync("C:/Users/UNS_CT/.secrets/aj-online-exam-sa.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// ── หา user จากอีเมล ──
let user = null;
try {
  user = await getAuth().getUserByEmail(email);
} catch (e) {
  if (e.code !== "auth/user-not-found") throw e;
}

if (user) {
  console.log(`พบบัญชี: ${user.email} (uid ${user.uid}) สมัครเมื่อ ${user.metadata.creationTime}`);

  const existing = await db.collection("userCourses").where("userId", "==", user.uid).get();
  const ids = existing.docs.map((d) => String(d.data().courseId ?? ""));
  console.log(`คอร์สที่มีอยู่: ${ids.length ? ids.join(", ") : "(ไม่มี)"}`);

  if (ids.some((id) => id.toLowerCase().startsWith("partc-duo"))) {
    console.log("มีแพ็กคู่ภาค ค อยู่แล้ว — ไม่เพิ่มซ้ำ");
    process.exit(0);
  }

  await db.collection("userCourses").add({
    userId:         user.uid,
    email:          user.email,
    courseId:       COURSE_ID,
    courseName:     COURSE_NAME,
    activatedAt:    FieldValue.serverTimestamp(),
    activationCode: "CASH-PARTC-DUO",
    source:         "manual-cash",
  });
  console.log(`✅ ให้สิทธิ์ ${COURSE_NAME} เรียบร้อย — น้องรีเฟรชแอปแล้วเข้าเมนูภาค ค ได้ทั้งสองสนามทันที`);
} else {
  console.log("ยังไม่พบบัญชีนี้ในระบบ (น้องยังไม่เคย login) → สร้างโค้ดใช้ครั้งเดียวแทน");
  const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "AJ";
  for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

  const dup = await db.collection("activationCodes").where("code", "==", code).limit(1).get();
  if (!dup.empty) { console.error("โค้ดชนกัน (โอกาสน้อยมาก) — รันใหม่อีกครั้ง"); process.exit(1); }

  await db.collection("activationCodes").add({
    code,
    courseId:   COURSE_ID,
    courseName: COURSE_NAME,
    status:     "active",
    maxUses:    1,
    usedCount:  0,
    expiresAt:  null,
    createdAt:  FieldValue.serverTimestamp(),
    note:       `เงินสด — ${email}`,
  });
  console.log(`✅ โค้ดสำหรับน้อง: ${code}`);
  console.log("ส่งโค้ดนี้ให้น้อง → login ด้วย Google แล้วกรอกที่หน้า /activate (ใช้ได้ครั้งเดียว)");
}
process.exit(0);
