import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Scroll-driven frame-by-frame canvas animation that maps the entire
 * page scroll to a sequence of images, producing a smooth "3D video" effect.
 *
 * Renders a fixed, full-viewport canvas behind all content. Uses
 * requestAnimationFrame for silky 60 fps frame switching with zero layout
 * thrashing. Cover-fits every frame to fill the viewport regardless of
 * aspect ratio.
 */

const FRAME_COUNT = 95;

/** Actual file numbers (some are missing: 091, 095, 097) */
const FRAME_NUMBERS: number[] = [
  1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
  21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
  41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,
  61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,
  81,82,83,84,85,86,87,88,89,90,92,93,94,96,98,
];

function getFrameSrc(index: number): string {
  const num = FRAME_NUMBERS[index] ?? 1;
  return `/frames/frame_${String(num).padStart(3, '0')}.png`;
}

export function ScrollFrameBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(-1);
  const rafRef = useRef<number>(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // ── Draw a single frame with cover-fit ──────────────────────────────
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = imagesRef.current[index];
    if (!ctx || !img || !img.complete || img.naturalWidth === 0) return;

    const dw = canvas.clientWidth * devicePixelRatio;
    const dh = canvas.clientHeight * devicePixelRatio;

    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }

    // Cover-fit
    const imgAr = img.naturalWidth / img.naturalHeight;
    const canAr = dw / dh;
    let sw: number, sh: number, sx: number, sy: number;

    if (canAr > imgAr) {
      sw = img.naturalWidth;
      sh = img.naturalWidth / canAr;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    } else {
      sh = img.naturalHeight;
      sw = img.naturalHeight * canAr;
      sy = 0;
      sx = (img.naturalWidth - sw) / 2;
    }

    ctx.clearRect(0, 0, dw, dh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
  }, []);

  // ── Preload all frames ──────────────────────────────────────────────
  useEffect(() => {
    let loaded = 0;
    const imgs: HTMLImageElement[] = [];

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = getFrameSrc(i);
      const onDone = () => {
        loaded++;
        setLoadingProgress(Math.round((loaded / FRAME_COUNT) * 100));
        if (loaded === FRAME_COUNT) {
          setIsLoaded(true);
          drawFrame(0);
          currentFrameRef.current = 0;
        }
      };
      img.onload = onDone;
      img.onerror = onDone;
      imgs.push(img);
    }

    imagesRef.current = imgs;
    return () => { imagesRef.current = []; };
  }, [drawFrame]);

  // ── Resize handler ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const onResize = () => {
      if (currentFrameRef.current >= 0) drawFrame(currentFrameRef.current);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isLoaded, drawFrame]);

  // ── Map document scroll → frame index ───────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight <= 0) return;

        const progress = Math.min(Math.max(scrollTop / docHeight, 0), 1);
        const idx = Math.min(Math.floor(progress * FRAME_COUNT), FRAME_COUNT - 1);

        if (idx !== currentFrameRef.current) {
          currentFrameRef.current = idx;
          drawFrame(idx);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isLoaded, drawFrame]);

  return (
    <>
      {/* Fixed canvas behind everything */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: -1,
          display: 'block',
          opacity: isLoaded ? 1 : 0,
          transition: 'opacity 0.8s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Loading overlay */}
      {!isLoaded && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-bg-main)',
            transition: 'opacity 0.5s ease',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ position: 'relative', width: 68, height: 68 }}>
              <svg viewBox="0 0 60 60" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(245,158,11,0.15)" strokeWidth="3" />
                <circle
                  cx="30" cy="30" r="26"
                  fill="none"
                  stroke="var(--color-solar)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(loadingProgress / 100) * 163.36} 163.36`}
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
              </svg>
              <span
                style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  color: 'var(--color-solar)',
                  letterSpacing: '0.02em',
                }}
              >
                {loadingProgress}%
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-text-tertiary)',
                animation: 'scrollBgPulse 1.8s ease-in-out infinite',
              }}
            >
              Loading Experience
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scrollBgPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
