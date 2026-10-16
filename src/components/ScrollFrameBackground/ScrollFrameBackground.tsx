import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 301-Frame Scroll-Driven 3D Canvas Engine — High Performance Edition
 *
 * Performance Optimizations:
 * 1. Zero-Reflow Drawing: Window/canvas dimensions cached in ref; zero `clientWidth` queries in RAF.
 * 2. Background Asynchronous Decoding (`img.decode()`): Prevents main-thread JPEG decode stutters.
 * 3. Batched State Updates: No 301 re-renders while buffering.
 * 4. Velocity-Adaptive Physics: Responsive 0.24-0.32 lerp factor for immediate zero-lag tracking.
 * 5. Nearest-Frame Fallback: Instant display of closest buffered frame, 0 black flicker.
 */

const FRAME_COUNT = 301;

function getFrameSrc(index: number): string {
  const frameNum = String(index + 1).padStart(4, '0');
  return `/framify_frames/frame_${frameNum}.jpg`;
}

export function ScrollFrameBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(FRAME_COUNT).fill(null));
  const loadedFlagsRef = useRef<boolean[]>(new Array(FRAME_COUNT).fill(false));
  const loadedCountRef = useRef<number>(0);

  // Cached dimensions (no DOM queries inside 60fps loop!)
  const dimensionsRef = useRef<{ w: number; h: number; dpr: number }>({
    w: 1920,
    h: 1080,
    dpr: 1,
  });

  // Frame animation state
  const targetFrameRef = useRef<number>(0);
  const currentFrameFloatRef = useRef<number>(0);
  const lastDrawnIndexRef = useRef<number>(-1);
  const rafIdRef = useRef<number>(0);

  // Mouse interaction state for subtle 3D tilt
  const mouseTargetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseCurrentRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // UI state
  const [initialReady, setInitialReady] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

  // ── Find nearest loaded frame index to prevent blank screens ────────
  const getNearestLoadedFrameIndex = useCallback((targetIndex: number): number => {
    const flags = loadedFlagsRef.current;
    if (flags[targetIndex]) return targetIndex;

    for (let offset = 1; offset < FRAME_COUNT; offset++) {
      const prev = targetIndex - offset;
      if (prev >= 0 && flags[prev]) return prev;

      const next = targetIndex + offset;
      if (next < FRAME_COUNT && flags[next]) return next;
    }

    return 0;
  }, []);

  // ── Draw cover-fit frame with pre-cached dimensions (Zero Reflow!) ──
  const drawFrame = useCallback((frameIdx: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const actualIdx = getNearestLoadedFrameIndex(frameIdx);
    const img = imagesRef.current[actualIdx];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const { w: targetW, h: targetH } = dimensionsRef.current;

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    // Cover-fit math
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const imgRatio = imgW / imgH;
    const canvasRatio = targetW / targetH;

    let srcW = imgW;
    let srcH = imgH;
    let srcX = 0;
    let srcY = 0;

    if (canvasRatio > imgRatio) {
      srcH = imgW / canvasRatio;
      srcY = (imgH - srcH) / 2;
    } else {
      srcW = imgH * canvasRatio;
      srcX = (imgW - srcW) / 2;
    }

    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, targetW, targetH);
    lastDrawnIndexRef.current = actualIdx;
  }, [getNearestLoadedFrameIndex]);

  // ── Update cached dimensions on resize ──────────────────────────────
  const updateDimensions = useCallback(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    dimensionsRef.current = { w, h, dpr };

    if (canvasRef.current) {
      canvasRef.current.width = w;
      canvasRef.current.height = h;
    }
    if (lastDrawnIndexRef.current >= 0) {
      drawFrame(lastDrawnIndexRef.current);
    }
  }, [drawFrame]);

  // ── Load individual frame safely with async decode ──────────────────
  const loadFrame = useCallback((index: number): Promise<void> => {
    return new Promise((resolve) => {
      if (imagesRef.current[index]) {
        resolve();
        return;
      }

      const img = new Image();
      img.src = getFrameSrc(index);

      const onReady = async () => {
        try {
          if ('decode' in img) {
            await img.decode();
          }
        } catch {
          // ignore decode errors if browser aborted
        }
        loadedFlagsRef.current[index] = true;
        loadedCountRef.current += 1;
        resolve();
      };

      img.onload = onReady;
      img.onerror = () => {
        loadedFlagsRef.current[index] = false;
        resolve();
      };

      imagesRef.current[index] = img;
    });
  }, []);

  // ── Preload pipeline (Anchor keyframes first, then remaining) ───────
  useEffect(() => {
    let cancelled = false;
    updateDimensions();

    async function startPreloader() {
      // Tier 1: Keyframe anchors (first 10 frames + every 5th frame)
      const tier1: number[] = [];
      for (let i = 0; i < 12; i++) tier1.push(i);
      for (let i = 12; i < FRAME_COUNT; i += 5) tier1.push(i);

      // Rapidly load first 6 frames for instant unlock (< 800ms)
      await Promise.all(tier1.slice(0, 6).map((idx) => loadFrame(idx)));
      if (cancelled) return;

      setInitialReady(true);
      drawFrame(0);

      // Finish Tier 1 keyframes
      await Promise.all(tier1.slice(6).map((idx) => loadFrame(idx)));
      if (cancelled) return;

      // Tier 2: Stream remaining intermediate frames in background
      const tier2: number[] = [];
      for (let i = 0; i < FRAME_COUNT; i++) {
        if (!loadedFlagsRef.current[i]) tier2.push(i);
      }

      // Load in small concurrent chunks without clogging main thread
      const CHUNK_SIZE = 8;
      for (let i = 0; i < tier2.length; i += CHUNK_SIZE) {
        if (cancelled) break;
        const chunk = tier2.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map((idx) => loadFrame(idx)));

        // Throttle state update to every 24 frames to avoid React re-render thrashing
        if (i % 24 === 0 || i + CHUNK_SIZE >= tier2.length) {
          setBufferProgress(Math.round((loadedCountRef.current / FRAME_COUNT) * 100));
        }
      }
    }

    startPreloader();

    return () => {
      cancelled = true;
    };
  }, [loadFrame, drawFrame, updateDimensions]);

  // ── Continuous 60/120fps physics render loop with snappy lerp ───────
  useEffect(() => {
    if (!initialReady) return;

    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const diff = targetFrameRef.current - currentFrameFloatRef.current;
      const absDiff = Math.abs(diff);

      // Dynamic adaptive lerp: faster when scrubbing hard, velvety when settling
      const lerpFactor = absDiff > 10 ? 0.32 : absDiff > 3 ? 0.24 : 0.18;

      if (absDiff > 0.005) {
        currentFrameFloatRef.current += diff * lerpFactor;
      } else {
        currentFrameFloatRef.current = targetFrameRef.current;
      }

      const targetIntFrame = Math.round(currentFrameFloatRef.current);
      if (targetIntFrame !== lastDrawnIndexRef.current) {
        drawFrame(targetIntFrame);
      }

      // Smooth mouse parallax interpolation on container wrapper
      const mouseDiffX = mouseTargetRef.current.x - mouseCurrentRef.current.x;
      const mouseDiffY = mouseTargetRef.current.y - mouseCurrentRef.current.y;
      if (Math.abs(mouseDiffX) > 0.001 || Math.abs(mouseDiffY) > 0.001) {
        mouseCurrentRef.current.x += mouseDiffX * 0.05;
        mouseCurrentRef.current.y += mouseDiffY * 0.05;

        if (containerRef.current) {
          const tiltX = (mouseCurrentRef.current.x * 8).toFixed(1);
          const tiltY = (mouseCurrentRef.current.y * 6).toFixed(1);
          containerRef.current.style.transform = `scale(1.02) translate3d(${tiltX}px, ${tiltY}px, 0)`;
        }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [initialReady, drawFrame]);

  // ── Scroll event listener (calculates precise target frame) ────────
  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;

      const progress = Math.min(Math.max(scrollTop / docHeight, 0), 1);
      targetFrameRef.current = progress * (FRAME_COUNT - 1);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Mousemove event listener for 3D parallax micro-movement ────────
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      mouseTargetRef.current = {
        x: (e.clientX - halfW) / halfW,
        y: (e.clientY - halfH) / halfH,
      };
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMouseMove);
  }, []);

  // ── Resize handler ──────────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [updateDimensions]);

  return (
    <>
      {/* Fixed Canvas Container with 3D Depth & Zero-lag Rendering */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          backgroundColor: '#050811',
        }}
      >
        <div
          ref={containerRef}
          style={{
            position: 'absolute',
            inset: '-1.5%',
            width: '103%',
            height: '103%',
            willChange: 'transform',
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              opacity: initialReady ? 1 : 0,
              transition: 'opacity 0.4s ease',
            }}
          />
        </div>

        {/* Ambient solar blue & warm gold lighting — perfectly matches frame palette */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `
              linear-gradient(180deg, rgba(7, 12, 22, 0.5) 0%, rgba(7, 12, 22, 0.05) 15%, rgba(7, 12, 22, 0.05) 85%, rgba(7, 12, 22, 0.6) 100%)
            `,
            pointerEvents: 'none',
          }}
        />

        {/* Subtle solar flare glow matching photovoltaic reflection */}
        <div
          style={{
            position: 'absolute',
            top: '8%',
            right: '8%',
            width: '40vw',
            height: '40vw',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, rgba(245, 158, 11, 0.05) 40%, transparent 70%)',
            filter: 'blur(60px)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Subtle bottom-right floating badge while background caching completes */}
      {initialReady && bufferProgress < 100 && (
        <aside
          aria-label="3D Experience Status"
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '24px',
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '9999px',
            background: 'rgba(7, 12, 22, 0.8)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '0.72rem',
            color: 'rgba(255, 255, 255, 0.85)',
            letterSpacing: '0.04em',
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#38bdf8',
              boxShadow: '0 0 8px #38bdf8',
              animation: 'solarPulse 1.5s ease-in-out infinite',
            }}
          />
          <span>3D FRAMES BUFFERING {bufferProgress}%</span>
        </aside>
      )}

      {/* Initial fast loader overlay — fades out as soon as initial 6 keyframes are ready */}
      {!initialReady && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#070a12',
            transition: 'opacity 0.5s ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ position: 'relative', width: 68, height: 68 }}>
              <svg viewBox="0 0 60 60" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(56,189,248,0.15)" strokeWidth="3" />
                <circle
                  cx="30"
                  cy="30"
                  r="26"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="40 163.36"
                  style={{ animation: 'spin 1.2s linear infinite' }}
                />
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'rgba(255, 255, 255, 0.9)',
                  margin: 0,
                  marginBottom: '4px',
                }}
              >
                Initializing 3D Rooftop Engine
              </p>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'rgba(56, 189, 248, 0.85)',
                  fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                Streaming 301 High-Res Photovoltaic Frames
              </span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes solarPulse {
          0%, 100% { opacity: 0.4; transform: scale(0.9); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes spin {
          100% { transform: rotate(270deg); }
        }
      `}</style>
    </>
  );
}
