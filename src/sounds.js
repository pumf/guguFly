function makeEnvelope(audioCtx, peak = 0.25, attack = 0.02, release = 0.3) {
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.001, now + attack + release);
  return gain;
}

function playOsc(audioCtx, type, freq, startOffset, duration, peak = 0.22) {
  const osc = audioCtx.createOscillator();
  const gain = makeEnvelope(audioCtx, peak, 0.01, duration);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startOffset);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(audioCtx.currentTime + startOffset);
  osc.stop(audioCtx.currentTime + startOffset + duration);
}

function freqSweep(audioCtx, type, f1, f2, duration, peak = 0.22) {
  const osc = audioCtx.createOscillator();
  const gain = makeEnvelope(audioCtx, peak, 0.01, duration);
  osc.type = type;
  const now = audioCtx.currentTime;
  osc.frequency.setValueAtTime(f1, now);
  osc.frequency.exponentialRampToValueAtTime(f2, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

const PLAYERS = {
  whoosh(audioCtx) {
    freqSweep(audioCtx, 'sine', 880, 1320, 0.4, 0.3);
  },
  dingdong(audioCtx) {
    playOsc(audioCtx, 'sine', 784, 0, 0.22, 0.3);
    playOsc(audioCtx, 'sine', 988, 0.25, 0.25, 0.3);
  },
  ring(audioCtx) {
    const osc = audioCtx.createOscillator();
    const gain = makeEnvelope(audioCtx, 0.25, 0.01, 0.6);
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.setValueAtTime(6, audioCtx.currentTime);
    lfoGain.gain.setValueAtTime(100, audioCtx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    lfo.start(now);
    osc.start(now);
    osc.stop(now + 0.6);
    lfo.stop(now + 0.6);
  },
  soft(audioCtx) {
    playOsc(audioCtx, 'sine', 528, 0, 0.6, 0.2);
  },
  chime(audioCtx) {
    playOsc(audioCtx, 'triangle', 1046, 0, 0.38, 0.22);
    playOsc(audioCtx, 'triangle', 1318, 0.12, 0.5, 0.22);
  },
  pulse(audioCtx) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(620, audioCtx.currentTime);
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.setValueAtTime(0.18, now + 0.01);
    gain.gain.setValueAtTime(0.18, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.45);
  },
  bird(audioCtx) {
    freqSweep(audioCtx, 'sine', 2200, 2600, 0.08, 0.18);
    freqSweep(audioCtx, 'sine', 2400, 2100, 0.08, 0.18);
    freqSweep(audioCtx, 'sine', 2500, 2800, 0.12, 0.18);
  },
  bell(audioCtx) {
    const fundamental = 523;
    [1, 2.0, 3.01, 4.2].forEach((mult, i) => {
      const osc = audioCtx.createOscillator();
      const gain = makeEnvelope(audioCtx, 0.12 / (i + 1), 0.005, 1.8);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * mult, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.9);
    });
  },
  success(audioCtx) {
    const now = audioCtx.currentTime;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = makeEnvelope(audioCtx, 0.22, 0.005, 0.2);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + i * 0.09);
      osc.stop(now + i * 0.09 + 0.22);
    });
  },
  bubble(audioCtx) {
    const osc = audioCtx.createOscillator();
    const gain = makeEnvelope(audioCtx, 0.18, 0.005, 0.18);
    osc.type = 'sine';
    const now = audioCtx.currentTime;
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  },
  laser(audioCtx) {
    freqSweep(audioCtx, 'sawtooth', 1800, 180, 0.35, 0.18);
  },
  morning(audioCtx) {
    freqSweep(audioCtx, 'sine', 1800, 2400, 0.12, 0.18);
    freqSweep(audioCtx, 'sine', 2200, 2000, 0.1, 0.18);
    playOsc(audioCtx, 'sine', 523, 0.18, 0.5, 0.2);
    playOsc(audioCtx, 'sine', 784, 0.42, 0.5, 0.2);
  },
};

export const SOUND_PRESETS = [
  { value: 'whoosh', label: '咻' },
  { value: 'dingdong', label: '叮咚' },
  { value: 'ring', label: '铃声' },
  { value: 'soft', label: '柔和' },
  { value: 'chime', label: '风铃' },
  { value: 'pulse', label: '脉冲' },
  { value: 'bird', label: '鸟鸣' },
  { value: 'bell', label: '钟声' },
  { value: 'success', label: '成功' },
  { value: 'bubble', label: '水泡' },
  { value: 'laser', label: '激光' },
  { value: 'morning', label: '晨光' },
];

export async function playPreset(audioCtx, sound) {
  const player = PLAYERS[sound] || PLAYERS.whoosh;
  try {
    player(audioCtx);
  } catch (error) {
    console.error('sound preset playback failed:', error);
  }
}
