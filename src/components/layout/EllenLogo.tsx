import { useState, useEffect } from 'react';

export function EllenLogo() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
        <span className="text-lg font-bold text-primary-foreground">E</span>
      </div>
      <span className="text-xl font-semibold text-foreground overflow-hidden">
        {showIntro ? (
          <span className="inline-block animate-flip-up">AI LLEN</span>
        ) : (
          <span className="inline-block animate-flip-up">ELLEN</span>
        )}
      </span>
    </div>
  );
}
