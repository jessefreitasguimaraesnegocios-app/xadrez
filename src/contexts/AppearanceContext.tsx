import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "dark" | "light" | "system";
type BoardTheme = "classic" | "green" | "blue" | "brown";
type PieceStyle = "classic" | "neo" | "alpha" | "chess24";

type AppearanceState = {
  theme: Theme;
  boardTheme: BoardTheme;
  pieceStyle: PieceStyle;
};

const defaultState: AppearanceState = {
  theme: (typeof localStorage !== "undefined" ? localStorage.getItem("settings_theme") : null) as Theme | null || "dark",
  boardTheme: (typeof localStorage !== "undefined" ? localStorage.getItem("settings_board_theme") : null) as BoardTheme | null || "classic",
  pieceStyle: (typeof localStorage !== "undefined" ? localStorage.getItem("settings_piece_style") : null) as PieceStyle | null || "classic",
};

type AppearanceContextValue = AppearanceState & {
  setTheme: (v: Theme) => void;
  setBoardTheme: (v: BoardTheme) => void;
  setPieceStyle: (v: PieceStyle) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(defaultState.theme);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>(defaultState.boardTheme);
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>(defaultState.pieceStyle);
  const [resolvedTheme, setResolvedTheme] = useState<"dark" | "light">(() =>
    theme === "system" ? getSystemTheme() : theme
  );

  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme;
    setResolvedTheme(resolved);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== "system") return;
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolvedTheme(m.matches ? "dark" : "light");
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("settings_theme", theme);
    localStorage.setItem("settings_board_theme", boardTheme);
    localStorage.setItem("settings_piece_style", pieceStyle);
  }, [theme, boardTheme, pieceStyle]);

  const setTheme = useCallback((v: Theme) => setThemeState(v), []);
  const setBoardThemeCb = useCallback((v: BoardTheme) => setBoardTheme(v), []);
  const setPieceStyleCb = useCallback((v: PieceStyle) => setPieceStyle(v), []);

  return (
    <AppearanceContext.Provider
      value={{
        theme,
        boardTheme,
        pieceStyle,
        setTheme,
        setBoardTheme: setBoardThemeCb,
        setPieceStyle: setPieceStyleCb,
      }}
    >
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
