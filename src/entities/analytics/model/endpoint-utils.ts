/** beta-events/voice-research가 공유하는 식별자·엔드포인트 헬퍼. */

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isHttpUrl(value: string) {
  try {
    // 동일 출처(same-origin) 프록시 경로(예: `/api/qstory/v1/beta-events`)는 그 자체로는 스킴이
    // 없으므로, 스킴을 확인하기 전에 현재 origin을 기준으로 해석(resolve)한다.
    const base = typeof window === 'undefined' ? undefined : window.location.origin;
    const url = new URL(value, base);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}
