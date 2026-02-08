/**
 * Sons do jogo via Web Audio API (sem arquivos externos).
 * Som de madeira: peças de xadrez batendo no tabuleiro.
 * Respeitam as configurações em localStorage.
 */

function getSetting(key: string, defaultValue: boolean): boolean {
  if (typeof localStorage === "undefined") return defaultValue;
  const saved = localStorage.getItem(key);
  return saved !== null ? JSON.parse(saved) : defaultValue;
}

function shouldPlaySound(global: boolean, specific: boolean): boolean {
  return global && specific;
}

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext?.state === "suspended") return audioContext;
  if (audioContext?.state === "running") return audioContext;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!audioContext) audioContext = new Ctx();
    return audioContext;
  } catch {
    return null;
  }
}

/** Volume geral dos sons de madeira (aumentado para audibilidade). */
const WOOD_VOLUME = 2.2;

/**
 * Som de "toc" de madeira: peça no tabuleiro de madeira — tom grave, corpo ressonante, ruído de impacto.
 */
function playWoodTap(options: { intensity?: number; double?: boolean }) {
  const ctx = getContext();
  if (!ctx) return;
  const intensity = Math.max(0.2, Math.min(1, options.intensity ?? 0.55));
  const double = options.double ?? false;

  try {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = WOOD_VOLUME;
    master.connect(ctx.destination);

    // Tom grave (corpo da madeira) — mais grave, decay um pouco mais longo
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 380;
    lowpass.Q.value = 0.8;
    osc.type = "triangle";
    osc.frequency.value = 95 + intensity * 35;
    osc.connect(oscGain);
    oscGain.connect(lowpass);
    lowpass.connect(master);
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(intensity * 0.48, now + 0.012);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.1);

    // Ruído de impacto (madeira batendo) — mais presente, filtro em “toc” de madeira
    const bufferSize = ctx.sampleRate * 0.04;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = 1 - (i / bufferSize) * (i / bufferSize);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 1100;
    noiseFilter.Q.value = 0.6;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noiseGain.gain.setValueAtTime(intensity * 0.2, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    noise.start(now);
    noise.stop(now + 0.04);

    if (double) {
      const t2 = now + 0.065;
      const osc2 = ctx.createOscillator();
      const osc2Gain = ctx.createGain();
      const lp2 = ctx.createBiquadFilter();
      lp2.type = "lowpass";
      lp2.frequency.value = 320;
      osc2.type = "triangle";
      osc2.frequency.value = 75;
      osc2.connect(osc2Gain);
      osc2Gain.connect(lp2);
      lp2.connect(master);
      osc2Gain.gain.setValueAtTime(0, t2);
      osc2Gain.gain.linearRampToValueAtTime(intensity * 0.42, t2 + 0.014);
      osc2Gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.1);
      osc2.start(t2);
      osc2.stop(t2 + 0.11);
    }
  } catch {
    // fallback silencioso
  }
}

/** Som de movimento de peça (não captura) — toc de madeira, peça no tabuleiro. */
export function playMoveSound() {
  if (!shouldPlaySound(getSetting("settings_sound", true), getSetting("settings_move_sound", true))) return;
  playWoodTap({ intensity: 0.6 });
}

/** Som de captura — toc mais forte, peça batendo e sendo retirada (madeira). */
export function playCaptureSound() {
  if (!shouldPlaySound(getSetting("settings_sound", true), getSetting("settings_capture_sound", true))) return;
  playWoodTap({ intensity: 0.95, double: true });
}

/** Alerta de tempo baixo — toc de madeira mais agudo e perceptível. */
export function playTimerWarningSound() {
  if (!shouldPlaySound(getSetting("settings_sound", true), getSetting("settings_timer_warning", true))) return;
  const ctx = getContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1200;
    osc.type = "sine";
    osc.frequency.value = 280;
    osc.connect(gain);
    gain.connect(lp);
    lp.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.13);
  } catch {
    // ignore
  }
}
