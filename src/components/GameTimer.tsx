import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';
import { playTimerWarningSound } from '@/lib/sound';

interface GameTimerProps {
  initialTime: number; // in seconds (used when displayTime is not provided)
  isActive: boolean;
  isPlayer: boolean; // true if this is the current user's timer
  onTimeUp?: () => void;
  className?: string;
  /** When set, display this value (server-driven time). Timer does not count down locally; parent updates this. */
  displayTime?: number;
}

const TICK_MS = 100;

const GameTimer = ({ initialTime, isActive, isPlayer, onTimeUp, className, displayTime }: GameTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const onTimeUpRef = useRef(onTimeUp);
  const initialTimeRef = useRef(initialTime);
  const activeStartRef = useRef<number | null>(null);
  const remainingAtStartRef = useRef(initialTime);
  const timeUpFiredRef = useRef(false);
  onTimeUpRef.current = onTimeUp;

  const isServerDriven = displayTime !== undefined;

  // Reset timer only when initialTime actually changes (e.g. new game)
  useEffect(() => {
    if (initialTimeRef.current !== initialTime) {
      initialTimeRef.current = initialTime;
      setTimeLeft(initialTime);
      remainingAtStartRef.current = initialTime;
      activeStartRef.current = null;
    }
  }, [initialTime]);

  // When becoming active: record start time and remaining at that moment (only for local countdown)
  useEffect(() => {
    if (isServerDriven) return;
    if (isActive) {
      activeStartRef.current = Date.now();
      remainingAtStartRef.current = timeLeft;
    } else {
      activeStartRef.current = null;
    }
  }, [isActive, isServerDriven]); // eslint-disable-line react-hooks/exhaustive-deps -- we only want to capture when isActive toggles; timeLeft is read on purpose

  // Elapsed-time-based countdown: works even for very short turns (e.g. bot moving in <1s). Skip when server-driven.
  useEffect(() => {
    if (!isActive || isServerDriven) return;

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
  }, [isActive, isServerDriven]);

  // Server-driven: when displayTime <= 0 and active, fire onTimeUp once
  useEffect(() => {
    if (!isServerDriven || !isActive || displayTime == null) return;
    if (displayTime <= 0 && !timeUpFiredRef.current) {
      timeUpFiredRef.current = true;
      onTimeUpRef.current?.();
    }
    if (displayTime > 0) timeUpFiredRef.current = false;
  }, [isServerDriven, isActive, displayTime]);

  const formatTime = useCallback((seconds: number) => {
    const totalSecs = Math.floor(seconds);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const displaySeconds = isServerDriven && displayTime != null ? displayTime : timeLeft;
  const isLowTime = displaySeconds <= 30;
  const isCriticalTime = displaySeconds <= 10;

  // Alerta de tempo baixo: um beep por segundo quando ativo e ≤10s
  const displaySecondsRef = useRef(displaySeconds);
  displaySecondsRef.current = displaySeconds;
  useEffect(() => {
    if (!isActive || !isCriticalTime) return;
    const id = setInterval(() => {
      if (displaySecondsRef.current <= 0) return;
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
        {formatTime(displaySeconds)}
      </span>
    </div>
  );
};

export default GameTimer;