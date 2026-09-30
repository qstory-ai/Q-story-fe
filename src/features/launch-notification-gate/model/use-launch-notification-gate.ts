import { useCallback, useState } from 'react';

import {
  submitLaunchNotification,
  type ChildGender,
} from '@/entities/launch-notification';
import { messageForError } from '@/shared/api';

const STORAGE_KEY = 'qstory-launch-notification-submitted';

/** 로그인 상태면 계정별 키, 익명 데모면 브라우저 공통 키. */
function storageKeyFor(accountId: string | null): string {
  return accountId ? `${STORAGE_KEY}:account:${accountId}` : STORAGE_KEY;
}

/**
 * 계정 키와 익명 키 중 하나라도 '1'이면 통과 - 익명↔로그인 전환으로 키가 바뀌어도
 * 이미 통과한 사용자에게 다시 뜨지 않게 한다.
 */
function readPassed(storageKey: string): boolean {
  try {
    return (
      window.localStorage.getItem(storageKey) === '1' ||
      window.localStorage.getItem(STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

function writePassed(storageKey: string) {
  try {
    window.localStorage.setItem(storageKey, '1');
    // 익명 키도 함께 남겨 두면, 이후 로그인/로그아웃으로 키가 바뀌어도 readPassed()가 찾을 수 있다.
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage를 못 쓰는 환경(사파리 프라이빗 모드 등)이면 이번 방문에서만 통과 상태를 유지한다.
  }
}

/**
 * DemoStoryRoute 전용 게이트 상태 - 한 번 제출하면 다시 묻지 않는다. auth가 뒤늦게 확정되며
 * storageKey가 바뀌면 effect 대신 렌더 중에 통과 여부를 다시 읽는다.
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
        setError(messageForError(failure, '신청 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
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
