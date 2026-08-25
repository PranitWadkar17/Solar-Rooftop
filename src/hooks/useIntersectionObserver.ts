import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const { threshold = 0.05, rootMargin = '50px 0px 50px 0px', triggerOnce = true } = options;
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasTriggered = useRef(false);

  const callbackRef = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setIsVisible(true);
        if (triggerOnce) {
          hasTriggered.current = true;
        }
      } else if (!triggerOnce) {
        setIsVisible(false);
      }
    },
    [triggerOnce]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || hasTriggered.current) return;

    // Check if element is already in viewport on mount
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight + 50 && rect.bottom > -50) {
      setIsVisible(true);
      if (triggerOnce) {
        hasTriggered.current = true;
        return;
      }
    }

    const observer = new IntersectionObserver(callbackRef, {
      threshold,
      rootMargin,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, callbackRef, triggerOnce]);

  return { ref, isVisible };
}
