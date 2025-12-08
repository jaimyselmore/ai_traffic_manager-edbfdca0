import { useState, useEffect } from 'react';

export function EllenLogo() {
  const [showE, setShowE] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowE(true), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center gap-3">
      {/* Blue AI square */}
      <div className="h-9 w-9 rounded-xl bg-sky-500 flex items-center justify-center text-white font-semibold text-xs">
        AI
      </div>

      {/* Wordmark: LLEN + animated E */}
      <div className="font-semibold text-lg tracking-wide text-foreground">
        <span
          className={
            showE
              ? "inline-block animate-slide-in-up"
              : "inline-block opacity-0 translate-y-1.5"
          }
        >
          E
        </span>
        LLEN
      </div>
    </div>
  );
}
