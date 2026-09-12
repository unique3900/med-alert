'use client';

type AlarmHandle = {
  context: AudioContext;
  timer: number;
};

let handle: AlarmHandle | null = null;
let primed: AudioContext | null = null;

/**
 * Browsers only allow audio that follows a user gesture. Calling this from any
 * click keeps a live context around so a dose alert can ring immediately.
 */
export function primeAlarm() {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  primed ??= new Ctor();
  if (primed.state === 'suspended') void primed.resume();
}

function burst(context: AudioContext, at: number) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(880, at);
  oscillator.frequency.setValueAtTime(660, at + 0.18);

  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(at);
  oscillator.stop(at + 0.36);
}

export function startAlarm() {
  if (handle) return;
  primeAlarm();
  if (!primed) return;

  const context = primed;
  void context.resume();

  const ring = () => {
    const now = context.currentTime;
    burst(context, now);
    burst(context, now + 0.45);
    burst(context, now + 0.9);
    navigator.vibrate?.([600, 200, 600, 200, 600]);
  };

  ring();
  handle = { context, timer: window.setInterval(ring, 2200) };
}

export function stopAlarm() {
  if (!handle) return;
  window.clearInterval(handle.timer);
  navigator.vibrate?.(0);
  handle = null;
}

export function alarmRinging() {
  return handle !== null;
}
