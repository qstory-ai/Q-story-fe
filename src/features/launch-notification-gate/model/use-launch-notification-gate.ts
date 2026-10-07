import { useCallback, useState } from 'react';

import {
  submitLaunchNotification,
  type ChildGender,
} from '@/entities/launch-notification';
import { messageForError } from '@/shared/api';

import {
  canSubmitLaunchNotification,
  launchNotificationPhone,
} from './launch-notification-form';

/**
 * 데모 앞 연락처를 이미 남긴 브라우저인지. 계정이 아니라 브라우저 기준이다 - 같은 브라우저에서 로그인·로그아웃하거나
 * 다른 계정으로 바꿔도(대개 같은 가정) 다시 묻지 않는다. 예전 버전이 남긴 계정별 키(`…:account:<id>`)는 항상 이
 * 공통 키와 함께 저장됐으므로 이 키 하나만 보면 된다.
 */
const STORAGE_KEY = 'qstory-launch-notification-submitted';

function readPassed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writePassed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage를 못 쓰는 환경(사파리 프라이빗 모드 등)이면 이번 방문에서만 통과 상태를 유지한다.
  }
}

/** DemoStoryRoute 전용 게이트 상태 - 한 번 제출하면 이 브라우저에서는 다시 묻지 않는다. */
export function useLaunchNotificationGate() {
  const [passed, setPassed] = useState(readPassed);
  const [parentName, setParentName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [childGender, setChildGender] = useState<ChildGender | null>(null);
  const [childAge, setChildAge] = useState('');
  const [discoverySource, setDiscoverySource] = useState('');
  const [error, setError] = useState<string | null>(null);
  // 어느 버튼을 눌렀는지 구분해야 그 버튼에만 로딩 스피너가 뜬다.
  const [submittingIntent, setSubmittingIntent] = useState<'contact' | 'decline' | null>(null);

  // 이메일은 항상 선택, 전화번호는 "연락 받고 싶어요"일 때만 필수다.
  const values = { parentName, phone, childGender, childAge, discoverySource };
  const canSubmitFor = useCallback(
    (wantsContact: boolean) => canSubmitLaunchNotification(values, wantsContact),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parentName, phone, childGender, childAge, discoverySource],
  );

  const submit = useCallback(
    async (wantsContact: boolean) => {
      if (!canSubmitFor(wantsContact) || childGender === null) return;
      setError(null);
      setSubmittingIntent(wantsContact ? 'contact' : 'decline');
      try {
        await submitLaunchNotification({
          parentName: parentName.trim(),
          email: email.trim() || undefined,
          phone: launchNotificationPhone(phone, wantsContact),
          childGender,
          childAge: childAge.trim(),
          discoverySource: discoverySource.trim(),
          wantsContact,
        });
        writePassed();
        setPassed(true);
      } catch (failure) {
        setError(messageForError(failure, '신청 정보를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      } finally {
        setSubmittingIntent(null);
      }
    },
    [canSubmitFor, parentName, email, phone, childGender, childAge, discoverySource],
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
    canSubmitFor,
    submit,
  };
}
