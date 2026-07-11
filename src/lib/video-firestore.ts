/**
 * video-firestore.ts — คอร์สวิดีโอในแอป (collection: videos)
 *
 * วิดีโอโฮสต์บน YouTube (unlisted) — เก็บเฉพาะ videoId ใน Firestore
 * เพื่อให้สลับ/หมุนลิงก์ได้ทันทีถ้ามีการรั่ว โดยไม่ต้อง deploy ใหม่
 *
 * สิทธิ์การดู: เฉพาะ "คอร์สเต็ม" — ดู hasFullAccess ใน lib/access.ts
 */

import {
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export interface CourseVideo {
  id:          string;
  title:       string;
  ytId:        string;   // YouTube video id (unlisted)
  chapter:     string;   // ชื่อหัวข้อ เช่น "1. ความรู้พื้นฐานสาธารณสุข"
  order:       number;   // ลำดับรวมทั้งคอร์ส (ใช้เรียงและทำ ก่อนหน้า/ถัดไป)
  duration:    string;   // "12:34" — กรอกเองเพื่อโชว์ในลิสต์ (ไม่บังคับ)
  isPublished: boolean;
  createdAt:   Date;
}

function toVideo(id: string, x: Record<string, unknown>): CourseVideo {
  return {
    id,
    title:       String(x.title ?? ""),
    ytId:        String(x.ytId ?? ""),
    chapter:     String(x.chapter ?? ""),
    order:       Number(x.order ?? 0),
    duration:    String(x.duration ?? ""),
    isPublished: Boolean(x.isPublished ?? false),
    createdAt:   x.createdAt instanceof Timestamp ? x.createdAt.toDate() : new Date(),
  };
}

/** ดึงวิดีโอที่เผยแพร่ เรียงตาม order (หน้า user) */
export async function getPublishedVideos(): Promise<CourseVideo[]> {
  const snap = await getDocs(query(collection(db, "videos"), orderBy("order", "asc")));
  return snap.docs.map((d) => toVideo(d.id, d.data())).filter((v) => v.isPublished);
}

/** Admin: ดึงทั้งหมด */
export async function getAllVideos(): Promise<CourseVideo[]> {
  const snap = await getDocs(query(collection(db, "videos"), orderBy("order", "asc")));
  return snap.docs.map((d) => toVideo(d.id, d.data()));
}

export interface VideoInput {
  title:       string;
  ytId:        string;
  chapter:     string;
  order:       number;
  duration:    string;
  isPublished: boolean;
}

/** Admin: สร้าง/แก้ไข */
export async function saveVideo(id: string | null, data: VideoInput): Promise<void> {
  if (id) {
    await updateDoc(doc(db, "videos", id), { ...data });
  } else {
    await setDoc(doc(collection(db, "videos")), { ...data, createdAt: serverTimestamp() });
  }
}

export async function deleteVideo(id: string): Promise<void> {
  await deleteDoc(doc(db, "videos", id));
}

/** แปลงลิงก์/ID ที่ผู้ใช้วางมาเป็น YouTube video id */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s; // วาง id ตรง ๆ
  const m = s.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? m[1] : null;
}
