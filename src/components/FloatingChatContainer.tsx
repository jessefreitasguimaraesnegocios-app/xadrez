import { useState, useRef, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingChatContainerProps {
  /** Conteúdo do header (título, avatar, botões de ação). O header inteiro é a área de arrastar. */
  header: React.ReactNode;
  /** Conteúdo principal do chat (mensagens, input). */
  children: React.ReactNode;
  /** Conteúdo da bolha quando minimizado (ex.: ícone ou avatar). */
  bubbleContent: React.ReactNode;
  /** Largura do painel quando expandido. */
  width?: number | string;
  /** Altura do painel quando expandido. */
  height?: number | string;
  /** Posição inicial. */
  defaultPosition?: { x: number; y: number };
  className?: string;
  onClose?: () => void;
}

export function FloatingChatContainer({
  header,
  children,
  bubbleContent,
  width = 320,
  height = 380,
  defaultPosition,
  className,
  onClose,
}: FloatingChatContainerProps) {
  const getDefaultPos = useCallback(() => {
    if (defaultPosition) return defaultPosition;
    if (typeof window === "undefined") return { x: 24, y: 24 };
    return {
      x: Math.max(16, window.innerWidth - (typeof width === "number" ? width : 320) - 24),
      y: Math.max(16, window.innerHeight - (typeof height === "number" ? height : 400) - 24),
    };
  }, [defaultPosition, width, height]);

  const [position, setPosition] = useState(getDefaultPos);
  const [isMinimized, setIsMinimized] = useState(false);
  const dragStart = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const didDragRef = useRef(false);

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button") || target.closest("[data-no-drag]")) return;
      didDragRef.current = false;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      dragStart.current = { x: position.x, y: position.y, startX: clientX, startY: clientY };
    },
    [position]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStart.current) return;
      didDragRef.current = true;
      if (e.cancelable) e.preventDefault();
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      setPosition({
        x: Math.max(0, dragStart.current.x + clientX - dragStart.current.startX),
        y: Math.max(0, dragStart.current.y + clientY - dragStart.current.startY),
      });
    };
    const onUp = () => {
      dragStart.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const handleBubbleClick = useCallback(() => {
    if (!didDragRef.current) setIsMinimized(false);
  }, []);

  const style: React.CSSProperties = {
    left: position.x,
    top: position.y,
    width: typeof width === "number" ? `${width}px` : width,
    height: isMinimized ? undefined : typeof height === "number" ? `${height}px` : height,
  };

  if (isMinimized) {
    return (
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "fixed z-50 flex items-center justify-center rounded-full shadow-xl border-2 border-border bg-primary text-primary-foreground cursor-pointer select-none touch-none",
          "w-14 h-14 hover:scale-105 active:scale-95 transition-transform",
          className
        )}
        style={{ left: position.x, top: position.y }}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onClick={handleBubbleClick}
        onKeyDown={(e) => e.key === "Enter" && setIsMinimized(false)}
      >
        {bubbleContent}
      </div>
    );
  }

  return (
    <Card
      className={cn("fixed flex flex-col shadow-xl border-border z-50 overflow-hidden", className)}
      style={style}
    >
      <div
        className="flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing select-none touch-none bg-secondary border-b border-border"
        style={{ touchAction: "none" }}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2 py-2 pl-2 pr-1">
          {header}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 pr-1" data-no-drag>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(true)}
            title="Minimizar"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="Fechar">
              ×
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
    </Card>
  );
}
