import type { Settings } from '../logic/settings';

/** 画面全体に関わる設定を反映する（キーパッド固有のものは keypad.applySettings） */
export function applyAppSettings(s: Settings) {
  const root = document.documentElement;
  root.style.setProperty('--key-h', `${s.keyHeight}px`);
  root.style.setProperty('--gap', `${s.gap}px`);
  root.style.setProperty('--math-scale', String(s.mathScale / 100));
  if (s.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  document.body.classList.toggle('onehand-left', s.oneHand === 'left');
  document.body.classList.toggle('onehand-right', s.oneHand === 'right');
}

let audio: AudioContext | null = null;

/** 振動・クリック音（設定でオンのときだけ） */
export function feedback(s: Settings) {
  if (s.vibrate) navigator.vibrate?.(30);
  if (!s.click) return;
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.04);
  } catch {
    /* 音が出せなくても入力は続ける */
  }
}
