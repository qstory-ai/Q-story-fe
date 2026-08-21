const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gi;
const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/gi;
const PHONE_PATTERN = /(?:01[016789]|0\d{1,2})[-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const LONG_NUMBER_PATTERN = /\b\d{6,}\b/g;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizeQuestionText(input: string, childName = '') {
  let value = input.normalize('NFKC');
  const normalizedName = childName.trim();
  if (normalizedName.length >= 2) {
    value = value.replace(
      new RegExp(escapeRegExp(normalizedName), 'gi'),
      '[이름]',
    );
  }

  return value
    .replace(EMAIL_PATTERN, '[이메일]')
    .replace(URL_PATTERN, '[링크]')
    .replace(PHONE_PATTERN, '[연락처]')
    .replace(LONG_NUMBER_PATTERN, '[숫자]')
    .replace(/(?:내|제)\s*이름은\s*[\p{L}]{1,20}/gu, '내 이름은 [이름]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}
