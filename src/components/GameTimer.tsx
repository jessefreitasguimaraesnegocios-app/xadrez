import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';
import { playTimerWarningSound } from '@/lib/sound';

interface GameTimerProps {
  initialTime: number; // in seconds
  isActive: boolean;
  isPlayer: boolean; // true if this is the current user's timer
  onTimeUp?: () => void;
  className?: string;
}

const TICK_MS = 100;

const GameTimer = ({ initialTime, isActive, isPlayer, onTimeUp, className }: GameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const onTimeUpRef = useRef(onTimeUp);
  const initialTimeRef = useRef(initialTime);
  const activeStartRef = useRef<number | null>(null);
  const remainingAtStartRef = useRef(initialTime);
  onTimeUpRef.current = onTimeUp;

  // Reset timer only when initialTime actually changes (e.g. new game)
  useEffect(() => {
    if (initialTimeRef.current !== initialTime) {
      initialTimeRef.current = initialTime;
      setTimeLeft(initialTime);
      remainingAtStartRef.current = initialTime;
      activeStartRef.current = null;
    }
  }, [initialTime]);

  // When becoming active: record start time and remaining at that moment
  useEffect(() => {
    if (isActive) {
      activeStartRef.current = Date.now();
      remainingAtStartRef.current = timeLeft;
    } else {
      activeStartRef.current = null;
    }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps -- we only want to capture when isActive toggles; timeLeft is read on purpose

  // Elapsed-time-based countdown: works even for very short turns (e.g. bot moving in <1s)
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      const start = activeStartRef.current;
      if (start == null) return;
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, remainingAtStartRef.current - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        onTimeUpRef.current?.();
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [isActive]);

  const formatTime = useCallback((seconds: number) => {
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isLowTime = timeLeft <= 30;
  const isCriticalTime = timeLeft <= 10;

  // Alerta de tempo baixo: um beep por segundo quando ativo e ≤10s
  const timeLeftRef = useRef(timeLeft);
  timeLeftRef.current = timeLeft;
  useEffect(() => {
    if (!isActive || !isCriticalTime) return;
    const id = setInterval(() => {
      if (timeLeftRef.current <= 0) return;
      playTimerWarningSound();
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, isCriticalTime]);

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