import { initialState, parseState, type ProfilesState } from './profile';

const KEY = 'flick-math:profiles';

/** localStorage が使えない環境（プライベートモード等）でも動くようにする。サーバーには何も送らない。 */
export function loadState(): ProfilesState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseState(JSON.parse(raw)) ?? initialState();
  } catch {
    /* 読めなければ初期状態 */
  }
  return initialState();
}

export function saveState(s: ProfilesState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}
