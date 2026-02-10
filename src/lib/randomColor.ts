const MAX_SAME_IN_A_ROW = 3;
let lastChosen: ("white" | "black")[] = [];

/**
 * Retorna a próxima cor (white/black) para partida aleatória.
 * A mesma cor pode se repetir no máximo MAX_SAME_IN_A_ROW vezes seguidas.
 */
export function getNextRandomColor(): "white" | "black" {
  const last = lastChosen.slice(-MAX_SAME_IN_A_ROW);
  const allWhite = last.length === MAX_SAME_IN_A_ROW && last.every((c) => c === "white");
  const allBlack = last.length === MAX_SAME_IN_A_ROW && last.every((c) => c === "black");
  const chosen: "white" | "black" = allWhite ? "black" : allBlack ? "white" : Math.random() < 0.5 ? "white" : "black";
  lastChosen = [...lastChosen, chosen].slice(-MAX_SAME_IN_A_ROW);
  return chosen;
}

/** Regista uma cor já atribuída (ex.: quem abriu a partida como convidado) para respeitar o máximo em sequência. */
export function pushChosenColor(color: "white" | "black"): void {
  lastChosen = [...lastChosen, color].slice(-MAX_SAME_IN_A_ROW);
}
