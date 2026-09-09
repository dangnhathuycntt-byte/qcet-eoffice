"use client";

import * as React from "react";

interface ConfettiPiece {
  id: number;
  x: number;
  delay: number;
  duration: number;
  color: string;
  shape: "circle" | "square" | "strip";
}

const CONFETTI_COLORS = [
  "bg-primary",
  "bg-emerald-500",
  "bg-amber-400",
  "bg-sky-400",
  "bg-indigo-500",
  "bg-teal-400",
];

export function CelebrationConfetti() {
  const [pieces, setPieces] = React.useState<ConfettiPiece[]>([]);

  React.useEffect(() => {
    // Generate deterministic set of subtle confetti pieces
    const generated: ConfettiPiece[] = Array.from({ length: 18 }, (_, i) => ({
      id: i,
      x: Math.round((i * 100) / 18),
      delay: (i % 6) * 0.15,
      duration: 1.8 + (i % 4) * 0.3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      shape: i % 3 === 0 ? "circle" : i % 3 === 1 ? "square" : "strip",
    }));
    setPieces(generated);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl z-10"
    >
      {pieces.map((p) => (
        <span
          key={p.id}
          className={`absolute rounded-xs opacity-75 animate-in fade-in zoom-in-50 ${p.color} ${
            p.shape === "circle" ? "rounded-full w-1.5 h-1.5" : p.shape === "strip" ? "h-1 w-2.5" : "h-1.5 w-1.5"
          }`}
          style={{
            left: `${p.x}%`,
            top: `${(p.id * 11) % 85}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
