"use client";
/**
 * CourseVideoPlayer — YouTube player แบบควบคุมเองทั้งหมด
 *
 * เหตุผล: embed ปกติของ YouTube มีปุ่ม "ดูใน YouTube"/ชื่อคลิป/รูปช่อง
 * ที่กดแล้วหลุดออกไปแชร์ลิงก์ได้ → ปิด UI ของ YouTube ทั้งหมด (controls=0)
 * แล้ววาง "โล่ใส" คลุมทั้งจอ + แถบควบคุม/จอจบคลิปของเราเอง + ลายน้ำผู้ชม
 *
 * ความทนทาน: ไม่พึ่ง event ของ YouTube (onStateChange ไม่ยิงในบางสภาพแวดล้อม
 * ทำให้เวลา/ปุ่มหยุด/seek ตายทั้งแผง) — ใช้ polling ถามสถานะตรงทุก 500ms แทน
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
  /** รายงานความคืบหน้า (ทุก ~15 วิ + หยุด/จบ/สลับคลิป) — ระบุ ytId เสมอ */
  onProgress?:     (ytId: string, seconds: number, duration: number, ended: boolean) => void;
}) {
  const wrapRef   = useRef<HTMLDivElement>(null);
  const mountRef  = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);

  const timeRef        = useRef(0);
  const durRef         = useRef(0);
  const lastReportRef  = useRef(0);
  const endedRef       = useRef(false);
  const activeYtIdRef  = useRef(ytId);
  const onProgressRef  = useRef(onProgress);
  onProgressRef.current = onProgress;

  const [playing,  setPlaying]  = useState(false);
  const [ended,    setEnded]    = useState(false);
  const [time,     setTime]     = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed,    setSpeed]    = useState(1);

  const report = useCallback((isEnded: boolean, forYtId?: string) => {
    if (timeRef.current > 3 && durRef.current > 0) {
      onProgressRef.current?.(forYtId ?? activeYtIdRef.current, timeRef.current, durRef.current, isEnded);
    }
    lastReportRef.current = Date.now();
  }, []);

  // ── สร้าง / เปลี่ยนคลิป ─────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setPlaying(false); setEnded(false); setTime(0); setDuration(0);

    activeYtIdRef.current = ytId;
    timeRef.current = 0;
    durRef.current = 0;
    endedRef.current = false;
    lastReportRef.current = Date.now();

    const startAt = initialSeconds > 5 ? Math.floor(initialSeconds) : 0;

    // ปิดคำบรรยาย (CC) — YouTube เปิดซับอัตโนมัติตาม preference ของผู้ชม
    // ผู้ชมเปิดกลับเองไม่ได้อยู่แล้ว (controls=0 + โล่ใส) → ถอดโมดูลทิ้งเลย
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const killCaptions = (p: any) => {
      try { p?.unloadModule?.("captions"); p?.unloadModule?.("cc"); } catch { /* ignore */ }
    };

    loadYT().then(() => {
      if (cancelled || !mountRef.current) return;
      if (playerRef.current) {
        // สลับจาก playlist/ปุ่มถัดไป = ผู้ใช้ตั้งใจดู → เล่นเลย
        playerRef.current.loadVideoById({ videoId: ytId, startSeconds: startAt });
        // โมดูลซับโหลดใหม่ต่อคลิป — ถอดซ้ำหลังเริ่มโหลด
        setTimeout(() => killCaptions(playerRef.current), 800);
        return;
      }
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId: ytId,
        width: "100%",
        height: "100%",
        playerVars: {
          controls: 0, rel: 0, fs: 0, disablekb: 1,
          playsinline: 1, iv_load_policy: 3, modestbranding: 1,
          start: startAt,
          origin: window.location.origin,
        },
        events: {
          // onApiChange ยิงตอนโมดูลซับพร้อม — จุดที่ถอดได้ผลแน่นอนที่สุด
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady:     (e: any) => killCaptions(e.target),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onApiChange: (e: any) => killCaptions(e.target),
        },
      });
      // ให้ iframe เต็มกรอบเสมอ
      const fix = setInterval(() => {
        const f = playerRef.current?.getIframe?.();
        if (f) {
          f.style.position = "absolute";
          f.style.inset = "0";
          f.style.width = "100%";
          f.style.height = "100%";
          clearInterval(fix);
        }
      }, 200);
    });

    return () => {
      cancelled = true;
      report(false, ytId); // flush ความคืบหน้าของ "คลิปนี้" ก่อนสลับ/ออกจากหน้า
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ytId]);

  // ── Polling: แหล่งความจริงเดียวของสถานะ (ไม่พึ่ง event) ────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getPlayerState) return;
      let state = -1;
      try { state = p.getPlayerState(); } catch { return; }

      const t = (() => { try { return p.getCurrentTime?.() ?? 0; } catch { return 0; } })();
      const d = (() => { try { return p.getDuration?.() ?? 0; } catch { return 0; } })();

      if (d > 0) { durRef.current = d; setDuration(d); }
      if (t > 0) { timeRef.current = t; }
      setTime(t);

      const isPlaying = state === 1 || state === 3; // playing / buffering
      setPlaying(isPlaying);


      if (state === 0 && durRef.current > 0) {       // ended
        if (!endedRef.current) {
          endedRef.current = true;
          timeRef.current = durRef.current;
          report(true);
        }
        setEnded(true);
      } else if (state === 1) {
        endedRef.current = false;
        setEnded(false);
        if (Date.now() - lastReportRef.current > 15_000) report(false);
      } else if (state === 2) {                       // paused
        if (Date.now() - lastReportRef.current > 3_000) report(false);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [report]);

  // ── controls (ถามสถานะจริงจาก player — ไม่พึ่ง state ที่อาจค้าง) ─────────────
  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p?.getPlayerState) return;
    let state = -1;
    try { state = p.getPlayerState(); } catch { /* noop */ }
    if (state === 1 || state === 3) p.pauseVideo?.();
    else p.playVideo?.();
  }, []);

  function seekTo(v: number) {
    playerRef.current?.seekTo?.(v, true);
    setTime(v);
    timeRef.current = v;
    endedRef.current = false;
    setEnded(false);
  }

  function skip(delta: number) {
    const d = durRef.current || duration;
    seekTo(Math.max(0, Math.min(d > 0 ? d - 1 : timeRef.current + delta, timeRef.current + delta)));
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
      <div className="absolute inset-0 overflow-hidden">
        <div ref={mountRef} className="w-full h-full" />
      </div>

      {/* โล่ใสเต็มจอ — ทุกการแตะเป็นของเรา (เล่น/หยุด) ไม่มีทางแตะโดนลิงก์ YouTube */}
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={toggle} />

      <Watermark label={userLabel} />

      {/* ปุ่มเล่นใหญ่ตอนยังไม่เล่น/หยุดพัก */}
      {!playing && !ended && (
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
          <p className="text-white/80 text-[14px]">จบคลิปแล้ว ✓</p>
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
          type="range" min={0} max={Math.max(duration, 1)} step={1}
          value={Math.min(time, Math.max(duration, 1))}
          onChange={(e) => seekTo(Number(e.target.value))}
          disabled={duration <= 0}
          className="w-full h-1 cursor-pointer accent-[#5DCAA5] disabled:opacity-40"
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
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
