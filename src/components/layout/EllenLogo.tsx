import { useState, useEffect } from 'react';

export function EllenLogo() {
  const [showE, setShowE] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowE(true), 700);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center gap-3">
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
