/** 誤入力防止の判定（SPEC §4.2）。時刻は呼び出し側から渡すので、テストしやすい。 */

/** 直前の入力から guardMs 以内のタッチは無視する（二度押し防止） */
export function isWithinGuard(now: number, lastInputAt: number | null, guardMs: number): boolean {
  return lastInputAt !== null && now - lastInputAt < guardMs;
}

export type ReleaseResult = 'accept' | 'tooShort' | 'cancelled';

/**
 * 指を離したときの判定。
 * holdCancelMs が 0 のときは「押し続けて取り消し」オフ。
 */
export function judgeRelease(pressMs: number, minPressMs: number, holdCancelMs: number): ReleaseResult {
  if (holdCancelMs > 0 && pressMs >= holdCancelMs) return 'cancelled';
  if (pressMs < minPressMs) return 'tooShort';
  return 'accept';
}
