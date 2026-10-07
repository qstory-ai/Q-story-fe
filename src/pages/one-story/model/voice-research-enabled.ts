/**
 * 이야기 세션이 질문 원음을 올릴지 정한다. 기본은 꺼짐이고, 보호자 계정이 명시적으로 켠 경우에만 true다.
 * 조회에 실패했거나(consent null) 선생님·관리자·비로그인이면 false - 서버도 같은 기준으로 거절한다.
 */
export function resolveVoiceResearchEnabled(
  role: string | null | undefined,
  consent: { enabled: boolean; explicit: boolean } | null,
): boolean {
  return role === 'PARENT' && consent !== null && consent.explicit && consent.enabled;
}
