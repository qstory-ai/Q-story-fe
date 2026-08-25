const DEFAULT_CHILD_NAME = '친구';

function trailingHangulSyllableCode(text: string): number | null {
  const last = text.at(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3 ? code : null;
}

/** 마지막 글자가 받침 있는 한글 음절로 끝나는지 - 을/를, 이/가 같은 조사 선택에 쓴다. 한글이 아니면(영문 이름 등) false. */
export function hasKoreanBatchim(text: string): boolean {
  const code = trailingHangulSyllableCode(text);
  return code !== null && (code - 0xac00) % 28 !== 0;
}

export function childCall(childName: string) {
  const name = childName.trim() || DEFAULT_CHILD_NAME;
  if (trailingHangulSyllableCode(name) === null) {
    return name;
  }
  return `${name}${hasKoreanBatchim(name) ? '아' : '야'}`;
}

export function personalizeStoryText(text: string, childName: string) {
  const name = childName.trim() || DEFAULT_CHILD_NAME;
  return text
    .replaceAll('{child_name}', name)
    .replaceAll('{child_call}', childCall(name));
}
