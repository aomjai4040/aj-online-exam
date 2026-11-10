// ออกโค้ด activation ใช้ครั้งเดียว สำหรับแพ็กซ้อมภาค ค (ขายเงินสด/แจก)
// ใช้: node gen-partc-code.mjs <moph|dcd|duo> [โน้ต เช่น อีเมล/ชื่อน้อง]
// น้องเอาโค้ดไปกรอกที่หน้า /activate หลัง login ด้วย Google
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PACKS = {
  moph: { courseId: "partc-moph-69", courseName: "ซ้อมสัมภาษณ์ภาค ค สป.สธ. 2569" },
  dcd:  { courseId: "partc-dcd-69",  courseName: "ซ้อมสัมภาษณ์ภาค ค กรมควบคุมโรค 2569" },
  duo:  { courseId: "partc-duo-69",  courseName: "ซ้อมสัมภาษณ์ภาค ค แพ็กคู่ สป.สธ. + คร. 2569" },
};

const pack = PACKS[(process.argv[2] ?? "").trim().toLowerCase()];
if (!pack) { console.error("ใส่สนาม: node gen-partc-code.mjs <moph|dcd|duo> [โน้ต]"); process.exit(1); }
const note = process.argv.slice(3).join(" ").trim() || "เงินสด";

const sa = JSON.parse(readFileSync("C:/Users/UNS_CT/.secrets/aj-online-exam-sa.json", "utf8"));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let code = "AJ";
for (let i = 0; i < 5; i++) code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

const dup = await db.collection("activationCodes").where("code", "==", code).limit(1).get();
if (!dup.empty) { console.error("โค้ดชนกัน (โอกาสน้อยมาก) — รันใหม่อีกครั้ง"); process.exit(1); }

await db.collection("activationCodes").add({
  code,
  courseId:   pack.courseId,
  courseName: pack.courseName,
  status:     "active",
  maxUses:    1,
  usedCount:  0,
  expiresAt:  null,
  createdAt:  FieldValue.serverTimestamp(),
  note,
});
console.log(`✅ โค้ด ${pack.courseName}: ${code}`);
console.log("ส่งโค้ดให้น้อง → login ด้วย Google แล้วกรอกที่หน้า /activate (ใช้ได้ครั้งเดียว)");
process.exit(0);
