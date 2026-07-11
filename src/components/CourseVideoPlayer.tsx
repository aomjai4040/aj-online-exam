"use client";
/**
 * CourseVideoPlayer — YouTube player แบบควบคุมเองทั้งหมด
 *
 * เหตุผล: embed ปกติของ YouTube มีปุ่ม "ดูใน YouTube"/ชื่อคลิป/รูปช่อง
 * ที่กดแล้วหลุดออกไปแชร์ลิงก์ได้ → ปิด UI ของ YouTube ทั้งหมด (controls=0)
 * แล้ววาง "โล่ใส" คลุมทั้งจอ: ทุกการแตะโดนเลเยอร์ของเรา ไม่มีทางแตะโดน
 * ลิงก์ของ YouTube · ควบคุมผ่านแถบปุ่มของเราด้านล่าง · จอจบคลิปเป็นของเรา
 * (ทับ end screen ที่มีคลิปแนะนำของ YouTube) · ลายน้ำผู้ชมลอยตลอด
 */

import { useCallback, useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<any> | null = null;
function loadYT(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!ytApiPromise) {
    ytApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return ytApiPromise;
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const s = Math.floor(sec % 60), m = Math.floor((sec / 60) % 60), h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

function Watermark({ label }: { label: string }) {
  const [pos, setPos] = useState({ top: "10%", left: "8%" });
  useEffect(() => {
    const t = setInterval(() => {
      setPos({ top: `${8 + Math.random() * 62}%`, left: `${5 + Math.random() * 55}%` });
    }, 8000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="absolute z-20 pointer-events-none select-none whitespace-nowrap"
      style={{ ...pos, fontSize: 11, fontWeight: 600, color: "white", opacity: 0.35,
        textShadow: "0 0 4px rgba(0,0,0,0.8)", transition: "top 2s ease, left 2s ease" }}>
      {label}
    </span>
  );
}

export default function CourseVideoPlayer({
  ytId, userLabel, hasNext, onNext, initialSeconds = 0, onProgress,
}: {
  ytId:            string;
  userLabel:       string;
  hasNext:         boolean;
  onNext:          () => void;
  /** ตำแหน่งที่ดูค้างไว้ — เล่นต่อจากตรงนี้ */
  initialSeconds?: number;
  /** รายงานความคืบหน้า (ทุก ~15 วิ + ตอนหยุด/จบ/สลับคลิป) — ระบุ ytId เสมอ
   *  เพื่อไม่ให้ความคืบหน้าคลิปเก่าไปบันทึกใต้คลิปใหม่ตอนสลับ */
  onProgress?:     (ytId: string, seconds: number, duration: number, ended: boolean) => void;
}) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const mountRef  = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // refs สำหรับรายงานความคืบหน้า (กัน stale closure + flush ตอน unmount)
  const timeRef        = useRef(0);
  const durRef         = useRef(0);
  const lastReportRef  = useRef(0);
  const activeYtIdRef  = useRef(ytId);
  const onProgressRef  = useRef(onProgress);
  onProgressRef.current = onProgress;

  const report = useCallback((ended: boolean, forYtId?: string) => {
    if (timeRef.current > 3 && durRef.current > 0) {
      onProgressRef.current?.(forYtId ?? activeYtIdRef.current, timeRef.current, durRef.current, ended);
    }
    lastReportRef.current = Date.now();
  }, []);

  const [ready,    setReady]    = useState(false);
  const [playing,  setPlaying]  = useState(false);
  const [ended,    setEnded]    = useState(false);
  const [time,     setTime]     = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed,    setSpeed]    = useState(1);

  // ── สร้าง / เปลี่ยนคลิป ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setReady(false); setPlaying(false); setEnded(false); setTime(0); setDuration(0);

    // reset refs สำหรับคลิปใหม่ (cleanup ของคลิปเก่า flush ไปแล้วก่อนถึงบรรทัดนี้)
    activeYtIdRef.current = ytId;
    timeRef.current = 0;
    durRef.current = 0;
    lastReportRef.current = Date.now();

    const startAt = initialSeconds > 5 ? Math.floor(initialSeconds) : 0;

    loadYT().then((YT) => {
      if (cancelled || !mountRef.current) return;
      if (playerRef.current) {
        playerRef.current.loadVideoById({ videoId: ytId, startSeconds: startAt });
        return;
      }
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: ytId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          controls: 0, rel: 0, fs: 0, disablekb: 1,
          playsinline: 1, iv_load_policy: 3, modestbranding: 1,
          start: startAt,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            setReady(true);
            setDuration(playerRef.current?.getDuration?.() ?? 0);
          },
          onStateChange: (e: any) => {
            if (cancelled) return;
            const S = window.YT?.PlayerState;
            setPlaying(e.data === S?.PLAYING);
            if (e.data === S?.PLAYING) {
              setReady(true);
              setEnded(false);
              setDuration(playerRef.current?.getDuration?.() ?? 0);
            }
            if (e.data === S?.PAUSED) report(false);
            if (e.data === S?.ENDED) {
              timeRef.current = durRef.current || timeRef.current;
              report(true);
              setEnded(true);
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      report(false, ytId); // flush ความคืบหน้าของ "คลิปนี้" ก่อนสลับ/ออกจากหน้า
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId]);

  // ── poll เวลาเล่น + รายงานความคืบหน้าทุก ~15 วิ ─────────────────────────────
  useEffect(() => {
    if (!playing) { if (pollRef.current) clearInterval(pollRef.current); return; }
    pollRef.current = setInterval(() => {
      const t = playerRef.current?.getCurrentTime?.() ?? 0;
      const d = playerRef.current?.getDuration?.() ?? 0;
      setTime(t);
      timeRef.current = t;
      if (d > 0) durRef.current = d;
      if (Date.now() - lastReportRef.current > 15_000) report(false);
    }, 500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [playing, report]);


  // ── controls ────────────────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo?.(); else p.playVideo?.();
  }, [playing]);

  function seekTo(v: number) {
    playerRef.current?.seekTo?.(v, true);
    setTime(v);
    setEnded(false);
  }

  function skip(delta: number) {
    seekTo(Math.max(0, Math.min(duration, time + delta)));
  }

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    playerRef.current?.setPlaybackRate?.(next);
    setSpeed(next);
  }

  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.().catch(() => {});
  }

  function replay() { seekTo(0); playerRef.current?.playVideo?.(); }

  return (
    <div ref={wrapRef} className="relative w-full bg-black select-none" style={{ aspectRatio: "16/9" }}>
      {/* iframe ของ YouTube (โดนโล่คลุม — แตะไม่โดน) */}
      <div className="absolute inset-0">
        <div ref={mountRef} className="w-full h-full" />
      </div>

      {/* โล่ใสเต็มจอ — ทุกการแตะเป็นของเรา (เล่น/หยุด) ไม่มีทางแตะโดนลิงก์ YouTube */}
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={toggle} />

      <Watermark label={userLabel} />

      {/* ปุ่มเล่นใหญ่ตอนหยุด */}
      {ready && !playing && !ended && (
        <button onClick={toggle}
          className="absolute inset-0 z-20 m-auto w-16 h-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1">
            <polygon points="6 3 20 12 6 21 6 3" />
          </svg>
        </button>
      )}

      {/* จอจบคลิปของเรา — ทับ end screen ของ YouTube */}
      {ended && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
          <p className="text-white/80 text-[14px]">จบคลิปแล้ว</p>
          <div className="flex gap-3">
            <button onClick={replay}
              className="px-5 py-2.5 rounded-xl text-[13.5px] font-semibold text-white"
              style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
              ↻ ดูซ้ำ
            </button>
            {hasNext && (
              <button onClick={onNext}
                className="px-5 py-2.5 rounded-xl text-[13.5px] font-bold"
                style={{ backgroundColor: "white", color: "#0B4F48" }}>
                คลิปถัดไป →
              </button>
            )}
          </div>
        </div>
      )}

      {/* แถบควบคุมของเรา */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 pt-6"
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}>
        {/* seek */}
        <input
          type="range" min={0} max={Math.max(duration, 1)} step={1} value={Math.min(time, duration)}
          onChange={(e) => seekTo(Number(e.target.value))}
          className="w-full h-1 cursor-pointer accent-[#5DCAA5]"
        />
        <div className="flex items-center gap-3 mt-1">
          <button onClick={toggle} className="text-white" aria-label={playing ? "หยุด" : "เล่น"}>
            {playing ? (
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <rect x="5" y="4" width="4" height="16" rx="1" /><rect x="15" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            )}
          </button>
          <button onClick={() => skip(-10)} className="text-white/85 text-[11.5px] font-bold">-10s</button>
          <button onClick={() => skip(10)}  className="text-white/85 text-[11.5px] font-bold">+10s</button>
          <span className="text-white/85 text-[11.5px] font-mono tabular-nums">
            {fmt(time)} / {fmt(duration)}
          </span>
          <div className="flex-1" />
          <button onClick={cycleSpeed} className="text-white/85 text-[11.5px] font-bold w-10 text-right">
            {speed}x
          </button>
          <button onClick={toggleFullscreen} className="text-white" aria-label="เต็มจอ">
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
