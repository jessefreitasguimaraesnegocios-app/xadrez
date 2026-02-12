import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse time control string "X+Y" (minutes + increment in seconds) to initial time per player in seconds. */
export function timeControlToSeconds(timeControl: string | null | undefined): number {
  if (!timeControl || typeof timeControl !== "string") return 600;
  const trimmed = timeControl.trim();
  const match = trimmed.match(/^(\d+)\s*\+\s*(\d+)$/);
  if (!match) return 600;
  const minutes = parseInt(match[1], 10);
  if (!Number.isFinite(minutes) || minutes < 0) return 600;
  return minutes * 60;
}
