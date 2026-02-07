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

/**
 * Som de "toc" de madeira: tom grave + decay rápido + leve ruído de impacto.
 */
function playWoodTap(options: { intensity?: number; double?: boolean }) {
  const ctx = getContext();
  if (!ctx) return;
  const intensity = Math.max(0.15, Math.min(1, options.intensity ?? 0.5));
  const double = options.double ?? false;

  try {
    const now = ctx.currentTime;

    // Tom grave (corpo da madeira) — frequência baixa, decay rápido
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 400;
    lowpass.Q.value = 0.5;
    osc.type = "sine";
    osc.frequency.value = 120 + intensity * 40;
    osc.connect(oscGain);
    oscGain.connect(lowpass);
    lowpass.connect(ctx.destination);
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(intensity * 0.25, now + 0.008);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.07);

    // Ruído curto de impacto (madeira batendo)
    const bufferSize = ctx.sampleRate * 0.03;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 800;
    const noiseGain = ctx.createGain();
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseGain.gain.setValueAtTime(intensity * 0.08, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    noise.start(now);
    noise.stop(now + 0.03);

    if (double) {
      const t2 = now + 0.06;
      const osc2 = ctx.createOscillator();
      const osc2Gain = ctx.createGain();
      const lp2 = ctx.createBiquadFilter();
      lp2.type = "lowpass";
      lp2.frequency.value = 350;
      osc2.type = "sine";
      osc2.frequency.value = 90;
      osc2.connect(osc2Gain);
      osc2Gain.connect(lp2);
      lp2.connect(ctx.destination);
      osc2Gain.gain.setValueAtTime(0, t2);
      osc2Gain.gain.linearRampToValueAtTime(intensity * 0.2, t2 + 0.01);
      osc2Gain.gain.exponentialRampToValueAtTime(0.001, t2 + 0.08);
      osc2.start(t2);
      osc2.stop(t2 + 0.09);
    }
  } catch {
    // fallback silencioso
  }
}

/** Som de movimento de peça (não captura) — um toc de madeira. */
export function playMoveSound() {
  if (!shouldPlaySound(getSetting("settings_sound", true), getSetting("settings_move_sound", true))) return;
  playWoodTap({ intensity: 0.5 });
}

/** Som de captura — toc mais forte, como peça batendo e sendo retirada. */
export function playCaptureSound() {
  if (!shouldPlaySound(getSetting("settings_sound", true), getSetting("settings_capture_sound", true))) return;
  playWoodTap({ intensity: 0.85, double: true });
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
