import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';

interface GameTimerProps {
  initialTime: number; // in seconds
  isActive: boolean;
  isPlayer: boolean; // true if this is the current user's timer
  onTimeUp?: () => void;
  className?: string;
}

const GameTimer = ({ initialTime, isActive, isPlayer, onTimeUp, className }: GameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const onTimeUpRef = useRef(onTimeUp);
  const initialTimeRef = useRef(initialTime);
  onTimeUpRef.current = onTimeUp;

  // Reset timer only when initialTime actually changes (e.g. new game)
  useEffect(() => {
    if (initialTimeRef.current !== initialTime) {
      initialTimeRef.current = initialTime;
      setTimeLeft(initialTime);
    }
  }, [initialTime]);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        const newTime = prev - 1;
        if (newTime <= 0) {
          onTimeUpRef.current?.();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isLowTime = timeLeft <= 30;
  const isCriticalTime = timeLeft <= 10;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-xl transition-all duration-300",
        isPlayer ? "ring-2 ring-primary" : "",
        isActive && !isCriticalTime && !isLowTime && "bg-primary text-primary-foreground",
        isActive && isLowTime && !isCriticalTime && "bg-accent text-accent-foreground animate-pulse",
        isActive && isCriticalTime && "bg-destructive text-destructive-foreground animate-pulse",
        !isActive && "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {isCriticalTime && isActive ? (
        <AlertTriangle className="w-5 h-5 animate-bounce" />
      ) : (
        <Clock className="w-5 h-5" />
      )}
      <span className={cn(isCriticalTime && isActive && "font-bold")}>
        {formatTime(timeLeft)}
      </span>
    </div>
  );
};

export default GameTimer;