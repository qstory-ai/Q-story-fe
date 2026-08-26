import { useCallback, useState } from 'react';

import {
  LaunchNotificationApiError,
  submitLaunchNotification,
  type ChildGender,
} from '@/entities/launch-notification';

const STORAGE_KEY = 'qstory-launch-notification-submitted';

/**
 * 로그인 계정이 있으면 계정별 키를, 없으면(진짜 익명 데모) 기존 브라우저 공통 키를 쓴다 -
 * 그냥 브라우저 하나로만 묶으면, 이 브라우저에서 어느 계정으로든 한 번 통과한 뒤로는 다른
 * 계정으로 로그인해도(혹은 같은 계정이 아니어도) 다시는 안 뜬다는 문제가 있었다.
 */
function storageKeyFor(accountId: string | null): string {
  return accountId ? `${STORAGE_KEY}:account:${accountId}` : STORAGE_KEY;
}

function readPassed(storageKey: string): boolean {
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

function writePassed(storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, '1');
  } catch {
    // localStorage를 못 쓰는 환경(사파리 프라이빗 모드 등)이면 이번 방문에서만 통과 상태를 유지한다.
  }
}

/**
 * DemoStoryRoute 전용 게이트 상태 - 한 번 제출하면 같은 브라우저/같은 계정 조합에서는 다시
 * 묻지 않는다. accountId는 로그인 상태일 때만 넘긴다(LaunchNotificationGate 참고) - auth
 * 상태가 'loading'에서 뒤늦게 확정되며 storageKey가 바뀌는 경우, effect가 아니라 렌더 중
 * 상태를 바로 잡는 React 권장 패턴(https://react.dev/learn/you-might-not-need-an-effect)으로
 * 다시 판단한다.
 */
export function useLaunchNotificationGate(accountId: string | null) {
  const storageKey = storageKeyFor(accountId);
  const [passed, setPassed] = useState(() => readPassed(storageKey));
  const [passedForKey, setPassedForKey] = useState(storageKey);
  if (passedForKey !== storageKey) {
    setPassedForKey(storageKey);
    setPassed(readPassed(storageKey));
  }
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [childGender, setChildGender] = useState<ChildGender | null>(null);
  const [childAge, setChildAge] = useState('');
  const [discoverySource, setDiscoverySource] = useState('');
  const [error, setError] = useState<string | null>(null);
  // 어느 버튼을 눌렀는지 구분해야 그 버튼에만 로딩 스피너가 뜬다.
  const [submittingIntent, setSubmittingIntent] = useState<'contact' | 'decline' | null>(null);

  // 이메일은 선택 입력이지만, 나머지는 "연락 받고 싶어요"/"괜찮아요" 둘 다 동일하게 받는다 -
  // "괜찮아요"도 신청 자체는 남기고 능동적 연락만 안 하는 것이다.
  const canSubmit =
    parentName.trim().length > 0 &&
    phone.trim().length > 0 &&
    childGender !== null &&
    childAge.trim().length > 0 &&
    discoverySource.trim().length > 0;

  const submit = useCallback(
    async (wantsContact: boolean) => {
      if (!canSubmit || childGender === null) return;
      setError(null);
      setSubmittingIntent(wantsContact ? 'contact' : 'decline');
      try {
        await submitLaunchNotification({
          parentName: parentName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim(),
          childGender,
          childAge: childAge.trim(),
          discoverySource: discoverySource.trim(),
          wantsContact,
        });
        writePassed(storageKey);
        setPassed(true);
      } catch (failure) {
        setError(
          failure instanceof LaunchNotificationApiError
            ? failure.message
            : '신청을 저장하지 못했어요. 다시 시도해 주세요.',
        );
      } finally {
        setSubmittingIntent(null);
      }
    },
    [canSubmit, parentName, email, phone, childGender, childAge, discoverySource, storageKey],
  );

  return {
    passed,
    parentName,
    setParentName,
    email,
    setEmail,
    phone,
    setPhone,
    childGender,
    setChildGender,
    childAge,
    setChildAge,
    discoverySource,
    setDiscoverySource,
    error,
    submittingIntent,
    canSubmit,
    submit,
  };
}

export type UseLaunchNotificationGate = ReturnType<typeof useLaunchNotificationGate>;
