let audioCtx = null;
let audioUnlocked = false;

export function getAudioContext() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') {
    try {
      audioCtx.resume();
    } catch (error) {
      console.error('audio resume failed:', error);
    }
  }
  return audioCtx;
}

export async function unlockAudioIfNeeded() {
  if (audioUnlocked) return true;
  try {
    const ctx = getAudioContext();
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    audioUnlocked = true;
    return true;
  } catch {
    return false;
  }
}
