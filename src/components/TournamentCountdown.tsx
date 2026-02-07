import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface TournamentCountdownProps {
  startsAt: string;
  className?: string;
  onReachedZero?: () => void;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function TournamentCountdown({ startsAt, className = "", onReachedZero }: TournamentCountdownProps) {
  const target = new Date(startsAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const msLeft = target - now;
  if (msLeft <= 0) {
    if (onReachedZero) onReachedZero();
    return (
      <div className={`flex items-center gap-2 text-sm text-accent ${className}`}>
        <Clock className="w-4 h-4" />
        <span>Em andamento</span>
      </div>
    );
  }

  const totalSec = Math.floor(msLeft / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground ${className}`}>
      <Clock className="w-4 h-4" />
      <span className="font-mono tabular-nums">
        {hours > 0 ? `${pad(hours)}:` : ""}
        {pad(minutes)}:{pad(seconds)}
      </span>
      <span className="text-xs">para o início</span>
    </div>
  );
}
