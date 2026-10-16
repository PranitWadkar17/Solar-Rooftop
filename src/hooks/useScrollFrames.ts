import { useEffect, useRef, useCallback, useState } from 'react';

interface UseScrollFramesOptions {
  /** Total number of frames available */
  frameCount: number;
  /** Function that returns the image URL for a given 1-based frame index */
  getFrameSrc: (index: number) => string;
  /** The scroll container ref (the tall wrapper that provides scroll height) */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Custom hook for scroll-driven frame-by-frame canvas animation.
 *
 * Preloads all images into an Image[] array, then on every scroll tick
 * picks the frame that corresponds to the scroll progress and draws it
 * onto a <canvas> via requestAnimationFrame. Uses cover-fit logic to
 * fill the canvas viewport without distortion.
 */
export function useScrollFrames({
  frameCount,
  getFrameSrc,
  scrollContainerRef,
}: UseScrollFramesOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // ── Draw a specific frame on the canvas (cover-fit) ─────────────────
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imagesRef.current[index];

    if (!canvas || !ctx || !img || !img.complete || img.naturalWidth === 0) return;

    // Set canvas to match its CSS display size for crisp rendering
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    // Cover-fit: scale image to fill canvas, cropping overflow
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const canvasAspect = displayWidth / displayHeight;

    let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

    if (canvasAspect > imgAspect) {
      // Canvas is wider than image: fit to width, crop height
      drawWidth = displayWidth;
      drawHeight = displayWidth / imgAspect;
      drawX = 0;
      drawY = (displayHeight - drawHeight) / 2;
    } else {
      // Canvas is taller than image: fit to height, crop width
      drawHeight = displayHeight;
      drawWidth = displayHeight * imgAspect;
      drawX = (displayWidth - drawWidth) / 2;
      drawY = 0;
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }, []);

  // ── Preload all frames ──────────────────────────────────────────────
  useEffect(() => {
    let loaded = 0;
    const images: HTMLImageElement[] = [];

    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.src = getFrameSrc(i + 1); // 1-based index (frame_001.png …)
      img.onload = () => {
        loaded++;
        setLoadingProgress(Math.round((loaded / frameCount) * 100));

        if (loaded === frameCount) {
          setIsLoaded(true);
          // Draw the first frame immediately
          drawFrame(0);
        }
      };
      img.onerror = () => {
        loaded++;
        setLoadingProgress(Math.round((loaded / frameCount) * 100));
        if (loaded === frameCount) {
          setIsLoaded(true);
          drawFrame(0);
        }
      };
      images.push(img);
    }

    imagesRef.current = images;

    return () => {
      imagesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameCount]);

  // ── Handle canvas resize ────────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;

    const handleResize = () => {
      drawFrame(currentFrameRef.current);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoaded, drawFrame]);

  // ── Scroll handler: map scroll progress to frame index ──────────────
  useEffect(() => {
    if (!isLoaded) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect();
        const containerTop = rect.top;
        const containerHeight = rect.height;
        const viewportHeight = window.innerHeight;

        // scrollableDistance is how much we can scroll within the container
        const scrollableDistance = containerHeight - viewportHeight;
        if (scrollableDistance <= 0) return;

        // How far we've scrolled into the container
        const scrolled = -containerTop;

        // Clamp between 0 and 1
        const progress = Math.min(Math.max(scrolled / scrollableDistance, 0), 1);
        setScrollProgress(progress);

        // Map to frame index
        const frameIndex = Math.min(
          Math.floor(progress * frameCount),
          frameCount - 1
        );

        if (frameIndex !== currentFrameRef.current && frameIndex >= 0) {
          currentFrameRef.current = frameIndex;
          drawFrame(frameIndex);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Initial draw
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafRef.current);
    };
  }, [isLoaded, frameCount, scrollContainerRef, drawFrame]);

  return {
    canvasRef,
    loadingProgress,
    isLoaded,
    scrollProgress,
  };
}
