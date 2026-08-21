const DEFAULT_CHILD_NAME = '친구';

export function childCall(childName: string) {
  const name = childName.trim() || DEFAULT_CHILD_NAME;
  const last = name.at(-1);
  if (!last) {
    return DEFAULT_CHILD_NAME;
  }
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return name;
  }
  const hasBatchim = (code - 0xac00) % 28 !== 0;
  return `${name}${hasBatchim ? '아' : '야'}`;
}

export function personalizeStoryText(text: string, childName: string) {
  const name = childName.trim() || DEFAULT_CHILD_NAME;
  return text
    .replaceAll('{child_name}', name)
    .replaceAll('{child_call}', childCall(name));
}
