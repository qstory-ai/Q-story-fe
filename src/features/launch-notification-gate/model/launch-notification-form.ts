import type { ChildGender } from '@/entities/launch-notification';

export type LaunchNotificationFormValues = {
  parentName: string;
  phone: string;
  childGender: ChildGender | null;
  childAge: string;
  discoverySource: string;
};

/**
 * 이메일은 항상 선택이다. 전화번호는 "연락 받고 싶어요"일 때만 필수 - "괜찮아요"는 연락처 없이
 * 이름·아이 정보만으로 신청을 남긴다.
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

/** 거절이면 입력해 둔 번호가 있어도 서버로 보내지 않는다. */
export function launchNotificationPhone(phone: string, wantsContact: boolean): string | undefined {
  return wantsContact ? phone.trim() || undefined : undefined;
}
