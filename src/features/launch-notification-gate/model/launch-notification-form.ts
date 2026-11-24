import type { ChildGender } from '../api/launch-notification-api';

export type LaunchNotificationFormValues = {
  parentName: string;
  phone: string;
  childGender: ChildGender | null;
  childAge: string;
  discoverySource: string;
};

/** 아이 나이는 칩으로 고른다. 서버에는 예전처럼 글자 그대로("5세") 간다. 돌 전 아이는 "3세 이하"에 든다. */
export const CHILD_AGE_OPTIONS = ['3세 이하', '4세', '5세', '6세', '7세', '8세 이상'] as const;

/** 알게 된 경로도 칩으로 고른다. "기타"를 고르면 직접 적는 칸이 열린다. */
export const DISCOVERY_OPTIONS = ['인스타그램', '지인 추천', '검색', '어린이집·유치원', '기타'] as const;
export const DISCOVERY_OTHER = '기타';

/** "기타"면 직접 적은 글을, 아니면 고른 칩 이름을 서버에 보낼 값으로 쓴다. */
export function discoverySourceFrom(choice: string | null, otherText: string): string {
  if (choice === null) return '';
  return choice === DISCOVERY_OTHER ? otherText.trim() : choice;
}

/**
 * 이메일은 항상 선택이다. 전화번호는 "출시 소식 받기"를 켰을 때만 필수다. 끄면 연락처 없이
 * 이름과 아이 정보만으로 신청을 남긴다.
 */
export function canSubmitLaunchNotification(
  values: LaunchNotificationFormValues,
  wantsContact: boolean,
): boolean {
  return (
    values.parentName.trim().length > 0 &&
    (!wantsContact || values.phone.trim().length > 0) &&
    values.childGender !== null &&
    values.childAge.trim().length > 0 &&
    values.discoverySource.trim().length > 0
  );
}

/** 소식 받기를 껐으면 입력해 둔 번호가 있어도 서버로 보내지 않는다. */
export function launchNotificationPhone(phone: string, wantsContact: boolean): string | undefined {
  return wantsContact ? phone.trim() || undefined : undefined;
}
