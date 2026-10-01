import { hasKoreanBatchim } from '@/shared/lib';

export { hasKoreanBatchim };

const DEFAULT_CHILD_NAME = '친구';

function endsWithHangul(text: string): boolean {
  const code = text.at(-1)?.charCodeAt(0);
  return code !== undefined && code >= 0xac00 && code <= 0xd7a3;
}

export function childCall(childName: string) {
  const name = childName.trim() || DEFAULT_CHILD_NAME;
  if (!endsWithHangul(name)) {
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
