import { createContext, useContext } from 'react';

/**
 * 리더 글씨 크기 - 자막·그레텔 대화 패널·질문 카드의 글자를 함께 키운다. 반 수업은 태블릿 한 대를 여러 아이가
 * 함께 보니 처음부터 "크게"로 시작하고, 상단 [글씨] 버튼으로 보통 → 크게 → 아주 크게를 돌아가며 고른다.
 * 고른 크기는 이 기기에만 남는다(가정·반 수업 각각 따로).
 */
export type ReaderTextScaleKey = 'normal' | 'large' | 'xlarge';

export const READER_TEXT_SCALES: readonly { key: ReaderTextScaleKey; label: string; factor: number }[] = [
  { key: 'normal', label: '보통', factor: 1 },
  { key: 'large', label: '크게', factor: 1.25 },
  { key: 'xlarge', label: '아주 크게', factor: 1.5 },
];

export function textScaleFactor(key: ReaderTextScaleKey): number {
  return READER_TEXT_SCALES.find((scale) => scale.key === key)?.factor ?? 1;
}

export function textScaleLabel(key: ReaderTextScaleKey): string {
  return READER_TEXT_SCALES.find((scale) => scale.key === key)?.label ?? '보통';
}

export function nextTextScale(key: ReaderTextScaleKey): ReaderTextScaleKey {
  const index = READER_TEXT_SCALES.findIndex((scale) => scale.key === key);
  return READER_TEXT_SCALES[(index + 1) % READER_TEXT_SCALES.length].key;
}

export function defaultTextScale(isClassLesson: boolean): ReaderTextScaleKey {
  return isClassLesson ? 'large' : 'normal';
}

function storageKey(isClassLesson: boolean): string {
  return `qstory.reader.text-scale.${isClassLesson ? 'class' : 'home'}.v1`;
}

function isScaleKey(value: unknown): value is ReaderTextScaleKey {
  return READER_TEXT_SCALES.some((scale) => scale.key === value);
}

export function loadTextScale(isClassLesson: boolean): ReaderTextScaleKey {
  try {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(storageKey(isClassLesson));
      if (isScaleKey(saved)) return saved;
    }
  } catch {
    // 프라이빗 모드 등 - 저장된 값 없이 기본 크기로.
  }
  return defaultTextScale(isClassLesson);
}

export function saveTextScale(isClassLesson: boolean, key: ReaderTextScaleKey): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(storageKey(isClassLesson), key);
  } catch {
    // 저장에 실패해도 지금 화면의 크기는 바뀐다.
  }
}

type TextStyleLike = { fontSize?: number; lineHeight?: number };

/** 글자 스타일의 fontSize·lineHeight만 배율만큼 키운 덧입힘 스타일 - 기존 스타일 뒤에 붙여 쓴다. */
export function scaledText(style: TextStyleLike | null | undefined, factor: number): TextStyleLike {
  if (!style || factor === 1) return {};
  const scaled: TextStyleLike = {};
  if (typeof style.fontSize === 'number') scaled.fontSize = Math.round(style.fontSize * factor);
  if (typeof style.lineHeight === 'number') scaled.lineHeight = Math.round(style.lineHeight * factor);
  return scaled;
}

export const ReaderTextScaleContext = createContext<number>(1);

export function useReaderTextScale(): number {
  return useContext(ReaderTextScaleContext);
}
