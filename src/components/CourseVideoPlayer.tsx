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

// ช้าลงได้ด้วย (Aj 2026-08-23: น้องขอให้ปรับช้า/เร็วได้) — 0.5 ไว้ฟังตอนจด
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
/** ขยายขนาดที่ YouTube "เห็น" เพื่อให้เลือกส่ง HD (มือถือ ~400px → 1000px ≈ 720p+) */
const HD_SCALE = 2.5;
const SPEED_KEY = "aj-video-speed";
const AUTONEXT_KEY = "aj-video-autonext";

/** ปิดคำบรรยาย (CC) — YouTube เปิดซับกลับเองตอนเริ่มเล่นตาม preference ผู้ชม
 *  ต้องทั้งถอดโมดูล (player เก่า) และล้าง track (player HTML5 ปัจจุบัน)
 *  แล้วเรียกซ้ำจาก polling loop — เรียกครั้งเดียวตอนโหลดไม่พอ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function killCaptions(p: any) {
  try {
    p?.unloadModule?.("captions");
    p?.unloadModule?.("cc");
    p?.setOption?.("captions", "track", {});
    p?.setOption?.("cc", "track", {});
  } catch { /* ignore */ }
}

/** ลายน้ำมุมจอแบบจาง (แทนแบบลอยไปมาที่น้องบอกว่ารบกวนสมาธิ — Aj เลือก 2026-07-28)
 *  เล็ก โปร่งแสง อยู่มุมบนพ้นแถบควบคุม พอให้ตามรอยได้ถ้าคลิปถูกอัดจอไปแชร์
 *  สลับมุมซ้าย-ขวาช้า ๆ ทุก 5 นาที — คนเรียนไม่ทันสังเกต แต่ครอปตัดขอบทิ้งไม่ได้ */
function CornerWatermark({ label }: { label: string }) {
  const [right, setRight] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setRight((r) => !r), 300_000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="absolute top-2 z-20 pointer-events-none select-none whitespace-nowrap"
      style={{ ...(right ? { right: 10 } : { left: 10 }), fontSize: 10, fontWeight: 500,
               color: "white", opacity: 0.2, textShadow: "0 0 3px rgba(0,0,0,0.6)" }}>
      {label}
    </span>
  );
}

export default function CourseVideoPlayer({
  ytId, userLabel, hasNext, onNext, initialSeconds = 0, onProgress,
}: {
  ytId:            string;
  /** อีเมล/ชื่อผู้ชม — แสดงเป็นลายน้ำมุมจอแบบจาง (ตามรอยคลิปหลุด) */
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

  // ── แถบควบคุมซ่อนเองแบบ YouTube: โชว์เมื่อแตะ/ขยับเมาส์ · หายเองหลัง 3 วิ ขณะเล่น ──
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);
  const playingRef   = useRef(false);
  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      if (playingRef.current) setControlsVisible(false); // ซ่อนเฉพาะตอนกำลังเล่น
    }, 3000);
  }, []);
  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  }, []);
  const [time,     setTime]     = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed,    setSpeed]    = useState(1);
  const speedRef = useRef(1);            // ให้ onReady ของ player ตัวใหม่อ่านค่าล่าสุดได้
  const [speedMenu, setSpeedMenu] = useState(false);
  useEffect(() => {
    // โหลดความเร็วที่จำไว้ (หลัง mount เท่านั้น — SSR ไม่มี localStorage)
    try {
      const s = Number(localStorage.getItem(SPEED_KEY));
      if (SPEEDS.includes(s)) { speedRef.current = s; setSpeed(s); }
    } catch {}
  }, []);
  // แถบควบคุมซ่อนตัว → ปิดเมนูความเร็วตามไปด้วย
  useEffect(() => { if (!controlsVisible) setSpeedMenu(false); }, [controlsVisible]);

  // ── double-tap seek (แบบ YouTube) ──
  const lastTapRef = useRef<{ t: number; side: "l" | "r" | null }>({ t: 0, side: null });
  const tapTimerRef = useRef<number | null>(null);
  const [seekFlash, setSeekFlash] = useState<{ side: "l" | "r"; n: number } | null>(null);
  useEffect(() => {
    if (!seekFlash) return;
    const t = window.setTimeout(() => setSeekFlash(null), 650);
    return () => window.clearTimeout(t);
  }, [seekFlash]);
  useEffect(() => () => { if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current); }, []);

  // ── เล่นคลิปถัดไปอัตโนมัติ (จำ preference ต่อเครื่อง — ค่าเริ่มต้น: เปิด) ──
  const [autoNext, setAutoNext] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null); // null = ไม่ได้นับ
  useEffect(() => {
    try { setAutoNext(localStorage.getItem(AUTONEXT_KEY) !== "off"); } catch {}
  }, []);
  function setAutoNextPref(on: boolean) {
    setAutoNext(on);
    try { localStorage.setItem(AUTONEXT_KEY, on ? "on" : "off"); } catch {}
  }
  // เริ่มนับเมื่อคลิปจบ (มีคลิปถัดไป + เปิด auto) — ยกเลิกเมื่อผู้ใช้กดอะไรก็ตาม
  useEffect(() => {
    if (!ended || !hasNext || !autoNext) { setCountdown(null); return; }
    setCountdown(5);
    const iv = window.setInterval(() => {
      setCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => window.clearInterval(iv);
  }, [ended, hasNext, autoNext]);
  useEffect(() => {
    if (countdown === 0) { setCountdown(null); onNextRef.current?.(); }
  }, [countdown]);
  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);
  function chooseSpeed(s: number) {
    speedRef.current = s;
    setSpeed(s);
    setSpeedMenu(false);
    playerRef.current?.setPlaybackRate?.(s);
    try { localStorage.setItem(SPEED_KEY, String(s)); } catch {}
  }

  // เต็มจอ: nativeFull = Fullscreen API จริง · fakeFull = จำลองด้วย CSS
  // (iPhone Safari / เบราว์เซอร์ใน LINE ไม่มี Fullscreen API สำหรับ div เลย)
  const [nativeFull, setNativeFull] = useState(false);
  const [fakeFull,   setFakeFull]   = useState(false);
  const isFull = nativeFull || fakeFull;

  useEffect(() => {
    const onFs = () => setNativeFull(!!(
      document.fullscreenElement
      ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
    ));
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
    };
  }, []);

  // ระหว่างเต็มจอแบบจำลอง: ล็อกสกอลล์หน้าเว็บ + กด Esc ออกได้
  // + ติด class ที่ body ให้ globals.css ซ่อนแถบหัว/แถบล่างของแอป — ตัวเล่นอยู่ใน
  //   กล่อง sticky z-30 (stacking context) ทำให้ z-9999 ของเราแพ้ header z-40 /
  //   BottomNav z-50 (iPhone: น้องเห็นเมนูแอปบังคลิปตอนหมุนจอ 2026-08-21)
  useEffect(() => {
    if (!fakeFull) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("video-fake-full");
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFakeFull(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove("video-fake-full");
      window.removeEventListener("keydown", onKey);
    };
  }, [fakeFull]);

  // หมุนเครื่องเป็นแนวนอนตอนคลิปกำลังเล่น = เข้าเต็มจอเอง (เหมือนแอป YouTube)
  // หมุนกลับแนวตั้ง = ออกจากเต็มจอที่เข้าเพราะการหมุน — น้อง Android ขอมา:
  // requestFullscreen ต้องมี gesture ซึ่งการหมุนไม่นับ → พลาดเมื่อไหร่ใช้เต็มจอจำลองแทน
  const autoFullRef      = useRef(false);
  const lastLandscapeRef = useRef<boolean | null>(null);
  useEffect(() => {
    // ฟังทั้ง resize + orientationchange (มือถือบางรุ่น/บาง browser ไม่ยิง
    // matchMedia change) แล้วเทียบแนวจอเองว่า "เพิ่งเปลี่ยน" จริงไหม
    const isLandscape = () => window.matchMedia("(orientation: landscape)").matches;
    if (lastLandscapeRef.current === null) lastLandscapeRef.current = isLandscape();

    const check = () => {
      const land = isLandscape();
      if (lastLandscapeRef.current === land) return;
      lastLandscapeRef.current = land;

      // เฉพาะจอสัมผัส/จอเล็ก — เดสก์ท็อปย่อหน้าต่างไม่ควรเด้งเต็มจอ
      const touchy = window.matchMedia("(pointer: coarse)").matches
        || Math.max(window.innerWidth, window.innerHeight) < 1024;
      if (!touchy) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = document as any;
      const inNativeFs = !!(document.fullscreenElement ?? doc.webkitFullscreenElement);

      if (land) {
        if (!playing || inNativeFs || fakeFull) return;
        autoFullRef.current = true;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const el = wrapRef.current as any;
        if (el?.requestFullscreen) {
          // ⚠️ ห้าม lock แนวจอในเคสนี้ — ผู้ใช้หมุนเครื่องเองอยู่แล้ว และการ lock
          // จะบล็อกการหมุนกลับ (event ไม่ยิง) จนจอค้างแนวนอนอย่างที่น้องเจอ
          el.requestFullscreen().catch(() => setFakeFull(true));
        } else if (el?.webkitRequestFullscreen) {
          try { el.webkitRequestFullscreen(); } catch { setFakeFull(true); }
        } else {
          setFakeFull(true);
        }
      } else if (autoFullRef.current) {
        autoFullRef.current = false;
        try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
        if (inNativeFs) {
          (document.exitFullscreen?.bind(document) ?? doc.webkitExitFullscreen?.bind(doc))?.()?.catch?.(() => {});
        }
        setFakeFull(false);
      }
    };

    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, [playing, fakeFull]);

  // ออกจากเต็มจอ "ด้วยวิธีไหนก็ตาม" (ปุ่มย้อนกลับ Android / Esc / ปุ่มเรา)
  // → ปลดล็อกแนวจอเสมอ — กันจอค้างแนวนอนทั้งที่ถือเครื่องแนวตั้ง
  useEffect(() => {
    const onFsChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = document as any;
      const inFs = !!(document.fullscreenElement ?? doc.webkitFullscreenElement);
      if (!inFs) {
        autoFullRef.current = false;
        try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
      }
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onReady:     (e: any) => {
            killCaptions(e.target);
            // ใช้ความเร็วที่น้องเลือกไว้ล่าสุดกับทุกคลิป (จำใน localStorage)
            if (speedRef.current !== 1) e.target.setPlaybackRate?.(speedRef.current);
          },
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

      killCaptions(p); // YouTube เปิดซับกลับได้ตลอด — กดปิดซ้ำทุกรอบ poll

      const t = (() => { try { return p.getCurrentTime?.() ?? 0; } catch { return 0; } })();
      const d = (() => { try { return p.getDuration?.() ?? 0; } catch { return 0; } })();

      if (d > 0) { durRef.current = d; setDuration(d); }
      if (t > 0) { timeRef.current = t; }
      setTime(t);

      const isPlaying = state === 1 || state === 3; // playing / buffering
      setPlaying(isPlaying);
      if (playingRef.current !== isPlaying) {
        playingRef.current = isPlaying;
        if (isPlaying) bumpControls();          // เริ่มเล่น → นับถอยหลังซ่อนแถบ
        else setControlsVisible(true);          // หยุด/จบ → แถบโชว์ค้าง
      }


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
  }, [report, bumpControls]);

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

  /** Android: ล็อกจอแนวนอนตอนเข้าเต็มจอ (ต้องอยู่ในเต็มจอจริงก่อน lock ถึงทำงาน) */
  function lockLandscape() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (screen.orientation as any)?.lock?.("landscape")?.catch?.(() => {});
    } catch { /* iOS ไม่มี lock — ข้าม */ }
  }
  function unlockOrientation() {
    try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
  }

  function toggleFullscreen() {
    const el = wrapRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?:    () => void;
    };
    if (doc.fullscreenElement ?? doc.webkitFullscreenElement) {
      unlockOrientation();
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      else doc.webkitExitFullscreen?.();
      return;
    }
    if (fakeFull) { setFakeFull(false); return; }
    // ลองเต็มจอจริงก่อน (desktop/Android/iPad ใหม่) — พลาดเมื่อไหร่ค่อยจำลองด้วย CSS
    try {
      if (el.requestFullscreen) {
        // Android: เต็มจอแล้วหมุนจอเป็นแนวนอนให้เลย (เหมือนแอป YouTube)
        el.requestFullscreen().then(lockLandscape).catch(() => setFakeFull(true));
        return;
      }
      if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return; }
    } catch { /* ตกลงไป fallback */ }
    setFakeFull(true); // iPhone / เบราว์เซอร์ใน LINE: ไม่มี Fullscreen API
  }

  function replay() { seekTo(0); playerRef.current?.playVideo?.(); }

  return (
    <div ref={wrapRef}
      className={fakeFull
        ? "fixed inset-0 z-[9999] w-full h-full bg-black select-none"
        : "relative w-full bg-black select-none"}
      style={fakeFull ? undefined : { aspectRatio: "16/9" }}>
      {/* iframe ของ YouTube (โดนโล่คลุม — แตะไม่โดน)
          เรนเดอร์ใหญ่ HD_SCALE เท่าแล้วย่อด้วย CSS — YouTube เลือกความชัดตามขนาด
          กล่องที่มันเห็น บนมือถือกล่องเล็กเลยได้ 360p ทั้งที่จอคม (น้องบ่นภาพไม่ชัด
          2026-08-25) · แบนด์วิดท์ไม่บาน: เน็ตช้า YouTube ยังลดคุณภาพให้เอง */}
      <div className="absolute inset-0 overflow-hidden">
        <div style={{
          width: `${HD_SCALE * 100}%`, height: `${HD_SCALE * 100}%`,
          transform: `scale(${1 / HD_SCALE})`, transformOrigin: "top left",
        }}>
          <div ref={mountRef} className="w-full h-full" />
        </div>
      </div>

      {/* โล่ใสเต็มจอ — ทุกการแตะเป็นของเรา ไม่มีทางแตะโดนลิงก์ YouTube
          แตะตอนแถบซ่อน = โชว์แถบก่อน (แบบ YouTube) · แตะตอนแถบโชว์ = เล่น/หยุด
          แตะสองครั้งครึ่งซ้าย/ขวา = ถอย/เดินหน้า 10 วิ (น้องขอแบบ YouTube 2026-08-27) */}
      <div className="absolute inset-0 z-10 cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientX - rect.left) / Math.max(1, rect.width);
          const side: "l" | "r" | null = frac < 0.35 ? "l" : frac > 0.65 ? "r" : null;
          const now = Date.now();
          const isDouble = side !== null
            && now - lastTapRef.current.t < 320 && lastTapRef.current.side === side;
          lastTapRef.current = { t: now, side };

          if (isDouble) {
            // แตะครั้งที่สอง — ยกเลิกงานแตะเดี่ยวที่ตั้งเวลาไว้ แล้ว seek
            if (tapTimerRef.current) { window.clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
            skip(side === "l" ? -10 : 10);
            setSeekFlash({ side: side!, n: Date.now() });
            bumpControls();
            return;
          }
          // แตะเดี่ยว — หน่วงสั้น ๆ เผื่อเป็นจังหวะแรกของ double tap
          if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
          tapTimerRef.current = window.setTimeout(() => {
            tapTimerRef.current = null;
            if (!controlsVisible && playingRef.current) { bumpControls(); return; }
            toggle();
            bumpControls();
          }, 260);
        }}
        onMouseMove={bumpControls} />

      {/* ไฟกระพริบบอกว่า seek แล้ว — โผล่ข้างที่แตะแล้วจางหาย */}
      {seekFlash && (
        <div key={seekFlash.n}
          className={`absolute top-1/2 -translate-y-1/2 z-20 pointer-events-none seek-flash
                      ${seekFlash.side === "l" ? "left-6" : "right-6"}`}>
          <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-full"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
            <span className="text-white text-[18px] leading-none">
              {seekFlash.side === "l" ? "⏪" : "⏩"}
            </span>
            <span className="text-white/90 text-[11px] font-bold">10 วินาที</span>
          </div>
        </div>
      )}

      <CornerWatermark label={userLabel} />

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

      {/* จอจบคลิปของเรา — ทับ end screen ของ YouTube
          มีคลิปถัดไป + เปิดเล่นต่ออัตโนมัติ → นับถอยหลัง 5 วิแล้วไปเอง (น้องขอ 2026-08-27) */}
      {ended && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4"
          style={{ backgroundColor: "rgba(0,0,0,0.92)" }}>
          {hasNext && autoNext && countdown !== null ? (
            <p className="text-white/80 text-[14px]">
              จบคลิปแล้ว ✓ · เล่นคลิปถัดไปใน{" "}
              <span className="text-[18px] font-extrabold" style={{ color: "#5DCAA5" }}>{countdown}</span>
            </p>
          ) : (
            <p className="text-white/80 text-[14px]">จบคลิปแล้ว ✓</p>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setCountdown(null); replay(); }}
              className="px-5 py-2.5 rounded-xl text-[13.5px] font-semibold text-white"
              style={{ border: "1px solid rgba(255,255,255,0.4)" }}>
              ↻ ดูซ้ำ
            </button>
            {hasNext && (
              <button onClick={() => { setCountdown(null); onNext?.(); }}
                className="px-5 py-2.5 rounded-xl text-[13.5px] font-bold"
                style={{ backgroundColor: "white", color: "#0B4F48" }}>
                คลิปถัดไป →
              </button>
            )}
          </div>
          {hasNext && (
            autoNext && countdown !== null ? (
              <button onClick={() => setCountdown(null)}
                className="text-white/60 text-[12.5px] underline">
                ยกเลิกเล่นอัตโนมัติครั้งนี้
              </button>
            ) : (
              <button onClick={() => setAutoNextPref(!autoNext)}
                className="text-white/50 text-[12px] underline">
                เล่นคลิปถัดไปอัตโนมัติ: {autoNext ? "เปิดอยู่" : "ปิดอยู่ — แตะเพื่อเปิด"}
              </button>
            )
          )}
        </div>
      )}

      {/* แถบควบคุมของเรา — จางหายเองตอนเล่น (โผล่เมื่อแตะจอ/ขยับเมาส์) */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-20 px-3 pb-2 pt-6
                    transition-opacity duration-300
                    ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.75))" }}
        onClick={bumpControls} onMouseMove={bumpControls} onTouchStart={bumpControls}>
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
          {/* ความเร็ว — ปุ่มเม็ดยาเห็นชัด กดแล้วเปิดเมนูเลือก 0.5–2x */}
          <div className="relative">
            <button onClick={() => { setSpeedMenu((m) => !m); bumpControls(); }}
              className="text-[11.5px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: speed === 1 ? "rgba(255,255,255,0.16)" : "#5DCAA5",
                       color: speed === 1 ? "rgba(255,255,255,0.9)" : "#083B36" }}
              aria-label="ความเร็ว">
              {speed}x
            </button>
            {speedMenu && (
              <div className="absolute bottom-8 right-0 rounded-xl py-1 min-w-[96px] shadow-lg"
                style={{ backgroundColor: "rgba(20,20,20,0.96)", border: "1px solid rgba(255,255,255,0.12)" }}>
                <p className="text-[10.5px] px-3 pt-1 pb-1" style={{ color: "rgba(255,255,255,0.5)" }}>ความเร็ว</p>
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => chooseSpeed(s)}
                    className="w-full text-left px-3 py-1.5 text-[13px] font-semibold"
                    style={{ color: s === speed ? "#5DCAA5" : "white" }}>
                    {s === speed ? "✓ " : ""}{s === 1 ? "ปกติ (1x)" : `${s}x`}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={toggleFullscreen} className="text-white"
            aria-label={isFull ? "ออกจากเต็มจอ" : "เต็มจอ"}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
              {isFull
                ? <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
                : <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />}
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
