import { DIRS, dirFrom, hasAnyItem, itemFor, keyAccessibleName } from '../logic/flick';
import type { Settings } from '../logic/settings';
import type { Dir, Key, KeyItem, KeySetFile } from '../logic/types';

export interface KeypadHandlers {
  onInsert(item: KeyItem): void;
  announce(text: string): void;
}

const CORNER_CLASS: Record<Exclude<Dir, 'c'>, string> = { u: 'u', r: 'r', d: 'dn', l: 'l' };

interface Active {
  id: number;
  x: number;
  y: number;
  dir: Dir;
  el: HTMLButtonElement;
  key: Key;
}

export function mountKeypad(root: HTMLElement, keyset: KeySetFile, settings: Settings, h: KeypadHandlers) {
  let tabId = keyset.tabs[0].id;
  let active: Active | null = null;
  let suppressClick = false;

  root.innerHTML = `<div class="tabs" role="group" aria-label="キーの種類"></div><div class="grid"></div>`;
  const tabsEl = root.querySelector<HTMLElement>('.tabs')!;
  const grid = root.querySelector<HTMLElement>('.grid')!;
  const bubble = document.createElement('div');
  bubble.id = 'bubble';
  bubble.hidden = true;
  bubble.setAttribute('aria-hidden', 'true');
  document.body.append(bubble);

  const applySettings = () => {
    root.style.setProperty('--key-h', `${settings.keyHeight}px`);
    root.classList.toggle('nolabels', !settings.showCorners);
  };

  function drawTabs() {
    tabsEl.replaceChildren();
    for (const t of keyset.tabs) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab';
      b.textContent = t.name;
      b.setAttribute('aria-pressed', String(t.id === tabId));
      b.addEventListener('click', () => {
        tabId = t.id;
        drawTabs();
        drawGrid();
        h.announce(`${t.name}のキーに切り替えました`);
      });
      tabsEl.append(b);
    }
  }

  function drawGrid() {
    const tab = keyset.tabs.find((t) => t.id === tabId)!;
    grid.style.setProperty('--cols', String(tab.columns));
    grid.replaceChildren();
    for (const key of tab.keys) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'key';
      b.dataset.keyId = key.id;
      if (!hasAnyItem(key)) {
        b.classList.add('empty');
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = '空き';
        b.append(c);
      } else {
        const center = itemFor(key, 'c')!;
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = center.label;
        b.append(c);
        for (const d of DIRS) {
          if (d === 'c' || !key[d]) continue;
          const s = document.createElement('span');
          s.className = `d ${CORNER_CLASS[d]}`;
          s.dataset.d = d;
          // 四隅の文字はCSS生成にして、名前との不一致を避ける(WCAG 2.5.3)。読み上げは aria-label にまとめる
          s.dataset.label = key[d]!.label;
          b.append(s);
        }
      }
      b.setAttribute('aria-label', keyAccessibleName(key));
      attach(b, key);
      grid.append(b);
    }
  }

  function showBubble(a: Active) {
    const item = itemFor(a.key, a.dir);
    a.el.querySelectorAll('.d').forEach((n) => n.classList.toggle('hit', (n as HTMLElement).dataset.d === a.dir));
    bubble.textContent = item ? item.label : '入力なし';
    bubble.classList.toggle('none', !item);
    bubble.hidden = false;
    const r = a.el.getBoundingClientRect();
    const half = bubble.offsetWidth / 2;
    const x = Math.min(Math.max(r.left + r.width / 2, half + 8), window.innerWidth - half - 8);
    bubble.style.left = `${x}px`;
    bubble.style.top = `${Math.max(r.top - 8, bubble.offsetHeight + 8)}px`;
  }

  function attach(b: HTMLButtonElement, key: Key) {
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); // エディタのフォーカス・選択を保つ
      if (active || (ev.button !== undefined && ev.button !== 0)) return; // 2本目の指・手のひらは無視
      if (!hasAnyItem(key)) return;
      active = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, dir: 'c', el: b, key };
      try {
        b.setPointerCapture(ev.pointerId); // 指がキー外に出ても判定を続ける
      } catch {
        /* 合成イベントなど */
      }
      b.classList.add('on');
      showBubble(active);
    });
    b.addEventListener('pointermove', (ev) => {
      if (!active || active.id !== ev.pointerId) return;
      const d = dirFrom(ev.clientX - active.x, ev.clientY - active.y, settings.flickDistance);
      if (d !== active.dir) {
        active.dir = d;
        showBubble(active);
      }
    });
    const end = (ev: PointerEvent, cancel: boolean) => {
      if (!active || active.id !== ev.pointerId) return;
      const a = active;
      active = null;
      b.classList.remove('on');
      bubble.hidden = true;
      b.querySelectorAll('.hit').forEach((n) => n.classList.remove('hit'));
      suppressClick = true;
      if (cancel) return;
      const item = itemFor(a.key, a.dir);
      if (item) h.onInsert(item);
    };
    b.addEventListener('pointerup', (ev) => end(ev, false));
    b.addEventListener('pointercancel', (ev) => end(ev, true));
    b.addEventListener('click', () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      // キーボード(Enter/Space)・スイッチ操作。段階4で「タップして選ぶ」画面に置き換える
      const item = itemFor(key, 'c');
      if (item) h.onInsert(item);
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  applySettings();
  drawTabs();
  drawGrid();
  return { applySettings };
}
