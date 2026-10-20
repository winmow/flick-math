import { isWithinGuard, judgeRelease } from '../logic/touchGuard';
import { DIRS, DIR_NAMES, dirFrom, hasAnyItem, itemFor, keyAccessibleName } from '../logic/flick';
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
  downAt: number;
  ignored: boolean;
  moved: boolean;
  consumed: boolean;
  cancelled?: boolean;
  timers: number[];
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function mountKeypad(root: HTMLElement, keyset: KeySetFile, settings: Settings, h: KeypadHandlers) {
  let tabId = keyset.tabs[0].id;
  let active: Active | null = null;
  let suppressClick = false;
  let lastInputAt: number | null = null;

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

  // ---- 「タップして選ぶ」選択画面 ----
  const dialog = document.createElement('dialog');
  dialog.className = 'chooser';
  dialog.setAttribute('aria-label', '入力する候補を選ぶ');
  document.body.append(dialog);

  function openChooser(key: Key) {
    const cell = (d: Dir | null) => {
      if (!d || !key[d]) return '<span class="gap"></span>';
      const it = key[d]!;
      return `<button type="button" class="opt" data-d="${d}" aria-label="${DIR_NAMES[d]} ${esc(it.speak ?? it.label)}">${esc(it.label)}<small>${DIR_NAMES[d]}</small></button>`;
    };
    dialog.innerHTML = `<div class="cross">
      <span class="gap"></span>${cell('u')}<span class="gap"></span>
      ${cell('l')}${cell('c')}${cell('r')}
      <span class="gap"></span>${cell('d')}<span class="gap"></span></div>
      <div class="drow"><button type="button" class="act" data-close>やめる</button></div>`;
    dialog.querySelectorAll<HTMLButtonElement>('.opt').forEach((o) =>
      o.addEventListener('click', () => {
        dialog.close();
        commit(key[o.dataset.d as Dir]!);
      }),
    );
    dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
    dialog.showModal();
  }

  const candidates = (key: Key) => DIRS.filter((d) => key[d]).length;

  function commit(item: KeyItem) {
    lastInputAt = performance.now();
    h.onInsert(item);
  }

  function attach(b: HTMLButtonElement, key: Key) {
    b.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); // エディタのフォーカス・選択を保つ
      if (active || (ev.button !== undefined && ev.button !== 0)) return; // 2本目の指・手のひらは無視
      if (!hasAnyItem(key)) return;
      const now = performance.now();
      const ignored = isWithinGuard(now, lastInputAt, settings.guardMs);
      active = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, dir: 'c', el: b, key, downAt: now, ignored, moved: false, consumed: false, timers: [] };
      if (ignored) return;
      try {
        b.setPointerCapture(ev.pointerId); // 指がキー外に出ても判定を続ける
      } catch {
        /* 合成イベントなど */
      }
      b.classList.add('on');
      showBubble(active);
      const a = active;
      if (settings.mode === 'hold' && candidates(key) > 1) {
        a.timers.push(
          window.setTimeout(() => {
            if (active !== a || a.moved) return;
            a.consumed = true;
            finish(a);
            openChooser(key);
          }, settings.holdMs),
        );
      } else if (settings.holdCancelMs > 0) {
        a.timers.push(
          window.setTimeout(() => {
            if (active !== a) return;
            a.cancelled = true;
            bubble.textContent = '取りやめます';
            bubble.classList.add('none');
          }, settings.holdCancelMs),
        );
      }
    });
    b.addEventListener('pointermove', (ev) => {
      if (!active || active.ignored || active.id !== ev.pointerId || active.consumed) return;
      const d = dirFrom(ev.clientX - active.x, ev.clientY - active.y, settings.flickDistance);
      if (d !== 'c') active.moved = true;
      if (d !== active.dir && !active.cancelled) {
        active.dir = d;
        showBubble(active);
      }
    });
    const end = (ev: PointerEvent, cancel: boolean) => {
      if (!active || active.id !== ev.pointerId) return;
      const a = active;
      if (a.consumed) {
        active = null;
        suppressClick = true;
        return;
      }
      finish(a);
      suppressClick = true;
      if (cancel || a.ignored) return;
      const result = judgeRelease(performance.now() - a.downAt, settings.minPressMs, settings.mode === 'hold' ? 0 : settings.holdCancelMs);
      if (result === 'cancelled') return h.announce('入力を取りやめました');
      if (result === 'tooShort') return;
      if (settings.mode === 'tap' && !a.moved && candidates(a.key) > 1) return openChooser(a.key);
      const item = itemFor(a.key, a.dir);
      if (item) commit(item);
    };
    b.addEventListener('pointerup', (ev) => end(ev, false));
    b.addEventListener('pointercancel', (ev) => end(ev, true));
    b.addEventListener('click', () => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      // キーボード(Enter/Space)・スイッチ操作は「タップして選ぶ」と同じ動き
      if (candidates(key) > 1) openChooser(key);
      else {
        const item = itemFor(key, 'c');
        if (item) commit(item);
      }
    });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function finish(a: Active) {
    a.timers.forEach(clearTimeout);
    if (active === a) active = null;
    a.el.classList.remove('on');
    bubble.hidden = true;
    a.el.querySelectorAll('.hit').forEach((n) => n.classList.remove('hit'));
  }

  applySettings();
  drawTabs();
  drawGrid();
  return { applySettings };
}
