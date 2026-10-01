/** 받침 유무에 따라 고르는 조사 쌍 - 앞이 받침 있을 때 / 없을 때. */
export type KoreanParticle = '을/를' | '이/가' | '은/는' | '과/와' | '이에요/예요';

function trailingHangulSyllableCode(text: string): number | null {
  const last = text.trim().at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? code : null;
}

/** 마지막 글자가 받침 있는 한글 음절로 끝나는지 - 을/를, 이/가 같은 조사 선택에 쓴다. 한글이 아니면(영문 이름 등) false. */
export function hasKoreanBatchim(text: string): boolean {
  const code = trailingHangulSyllableCode(text);
  return code !== null && (code - 0xac00) % 28 !== 0;
}

/**
 * 단어 뒤에 받침에 맞는 조사를 붙인다 - "하윤이", "헨젤과 그레텔을". 한글로 끝나지 않는 단어(영문·숫자)는
 * 받침을 알 수 없으니 예전처럼 "을(를)" 꼴로 둘 다 보여 준다.
 */
export function withParticle(word: string, particle: KoreanParticle): string {
  const [withBatchim, withoutBatchim] = particle.split('/');
  if (trailingHangulSyllableCode(word) === null) return `${word}${withBatchim}(${withoutBatchim})`;
  return `${word}${hasKoreanBatchim(word) ? withBatchim : withoutBatchim}`;
}

/** "김하늘" → "김하늘 선생님". 가입 때 이름에 이미 "선생님"을 넣은 경우("하늘선생님")엔 한 번 더 붙이지 않는다. */
export function teacherTitle(displayName: string): string {
  const name = displayName.trim();
  return /선생님$/.test(name) ? name : `${name} 선생님`;
}
