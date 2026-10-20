export type Dir = 'c' | 'u' | 'r' | 'd' | 'l';

export interface KeyItem {
  label: string;
  latex: string;
  word?: string;
  speak?: string;
}

export interface Key {
  id: string;
  c?: KeyItem;
  u?: KeyItem;
  r?: KeyItem;
  d?: KeyItem;
  l?: KeyItem;
}

export interface Tab {
  id: string;
  name: string;
  level: 'common' | 'exam' | 'university' | 'custom';
  columns: number;
  keys: Key[];
}

export interface KeySetFile {
  version: 1;
  tabs: Tab[];
}
