# ขั้นตอนการติดตั้งและใช้งาน

## 1. ติดตั้ง Node.js
ดาวน์โหลดและติดตั้ง Node.js (v18+) จาก https://nodejs.org

## 2. ติดตั้ง dependencies
```bash
cd Desktop/online-exam
npm install
```

## 3. สร้าง Firebase Project
1. ไปที่ https://console.firebase.google.com
2. คลิก **Add project** → ตั้งชื่อโปรเจกต์
3. เปิดใช้งาน **Firestore Database** (Start in test mode ก่อน)
4. เปิดใช้งาน **Authentication** → Email/Password
5. สร้าง Admin User:
   - ไปที่ Authentication → Users → Add user
   - กรอก email และ password ที่ต้องการใช้เข้า admin
6. คัดลอก Firebase config:
   - Project Settings → General → Your apps → Add app (Web)
   - คัดลอกค่า firebaseConfig

## 4. ตั้งค่า Environment Variables
```bash
cp .env.local.example .env.local
```
แก้ไขไฟล์ `.env.local` ใส่ค่า Firebase config ที่ได้จากขั้นตอนที่ 3

## 5. ตั้งค่า Firestore Security Rules
ไปที่ Firestore → Rules → วางเนื้อหาจากไฟล์ `firestore.rules` แล้วกด Publish

## 6. สร้าง Firestore Indexes
Firestore จะแจ้งใน console เมื่อต้องการ index เพิ่มเติม
คลิกลิงก์ที่แสดงใน error เพื่อสร้าง index อัตโนมัติ

## 7. รันโปรเจกต์
```bash
npm run dev
```
เปิดเบราว์เซอร์ไปที่ http://localhost:3000

## โครงสร้างหน้าต่างๆ
- `/` — หน้าแรก: รายการชุดข้อสอบ
- `/exam/[id]` — หน้าทำข้อสอบ
- `/result/[id]` — หน้าผลและเฉลย
- `/admin` — Admin dashboard (ต้อง login)
- `/admin/exams` — จัดการชุดข้อสอบ
- `/admin/exams/new` — สร้างข้อสอบใหม่
- `/admin/exams/[id]/edit` — แก้ไขข้อสอบ

## Build สำหรับ Production
```bash
npm run build
npm start
```

## Deploy บน Vercel (แนะนำ)
1. Push โค้ดขึ้น GitHub
2. ไปที่ https://vercel.com → Import project
3. ใส่ environment variables จาก .env.local
4. Deploy!
