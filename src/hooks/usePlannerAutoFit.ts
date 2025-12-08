import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePlannerAutoFitProps {
  plannerZoom: number;
  viewportHeight?: string;
}

interface UsePlannerAutoFitReturn {
  viewportRef: React.RefObject<HTMLDivElement>;
  plannerRef: React.RefObject<HTMLDivElement>;
  computedZoom: number;
}

export function usePlannerAutoFit({ plannerZoom }: UsePlannerAutoFitProps): UsePlannerAutoFitReturn {
  const viewportRef = useRef<HTMLDivElement>(null);
  const plannerRef = useRef<HTMLDivElement>(null);
  const [computedZoom, setComputedZoom] = useState(plannerZoom / 100);

  const calculateFit = useCallback(() => {
    if (!viewportRef.current || !plannerRef.current) {
      setComputedZoom(plannerZoom / 100);
      return;
    }

    const viewportWidth = viewportRef.current.clientWidth;
    const viewportHeight = viewportRef.current.clientHeight;
    
    // Temporarily reset scale to measure natural size
    plannerRef.current.style.transform = 'scale(1)';
    const plannerWidth = plannerRef.current.scrollWidth;
    const plannerHeight = plannerRef.current.scrollHeight;

    const baseScale = plannerZoom / 100;
    
    // Only apply fit constraint when zooming out (baseScale < 1)
    if (baseScale < 1) {
      const widthRatio = viewportWidth / plannerWidth;
      const heightRatio = viewportHeight / plannerHeight;
      const fitScale = Math.min(widthRatio, heightRatio);
      const finalScale = Math.min(baseScale, fitScale);
      setComputedZoom(Math.max(0.1, finalScale)); // Minimum 10% to avoid issues
    } else {
      setComputedZoom(baseScale);
    }
  }, [plannerZoom]);

  useEffect(() => {
    calculateFit();

    const handleResize = () => {
      calculateFit();
    };

    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver for more accurate detection
    const resizeObserver = new ResizeObserver(() => {
      calculateFit();
    });

    if (viewportRef.current) {
      resizeObserver.observe(viewportRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [calculateFit]);

  // Recalculate when zoom changes
  useEffect(() => {
    // Small delay to allow DOM to update
    const timer = setTimeout(calculateFit, 50);
    return () => clearTimeout(timer);
  }, [plannerZoom, calculateFit]);

  return {
    viewportRef,
    plannerRef,
    computedZoom,
  };
}
