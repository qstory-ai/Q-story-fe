import { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';

import { ActionButton, ErrorState, LoadingState, SafeAreaView, radius, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { TUTOR_PATHS, fetchClass, listClassStudents, useAuth, type ClassStudentResponse } from '@/entities/auth';
import { classInviteLink } from '@/features/invite-issue';

import { kioskDoneView, type KioskDoneView } from '../model/kiosk';
import { kioskStyles } from './ClassKioskPage';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; student: ClassStudentResponse; view: KioskDoneView; qr: string | null }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 체험 모드에서 아이가 다 읽은 뒤(플레이어 나가기) 오는 화면. 보호자가 이어져 있으면 리포트를 보냈다고 알리고, 현장에서 올린
 * 아이면 보호자 연결 QR(반 초대 링크 + claim 코드)을 띄운다. 보호자가 휴대폰으로 찍어 가입하면 이 아이에 이어지고 오늘 기록이 보인다.
 * "다음 친구"를 누르면 이름 화면으로 돌아간다.
 */
export function ClassKioskDonePage() {
  const { classId, studentId } = useParams<{ classId: string; studentId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const token = state.status === 'authenticated' ? state.token : null;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${classId ?? ''}:${studentId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });

  useEffect(() => {
    if (!token || !classId || !studentId) return;
    let cancelled = false;
    Promise.all([fetchClass(token, classId), listClassStudents(token, classId)])
      .then(async ([classGroup, students]) => {
        const student = students.find((entry) => entry.id === studentId);
        if (!student) throw new Error('이 반 명단에서 학생을 찾지 못했어요.');
        const inviteLink = classGroup.joinCode && !classGroup.archivedAt ? classInviteLink(classGroup.joinCode) : null;
        const view = kioskDoneView(student, inviteLink);
        const qr = view.kind === 'claim' ? await QRCode.toDataURL(view.link, { width: 480, margin: 1 }).catch(() => null) : null;
        if (!cancelled) setLoad({ requestKey, status: 'ready', student, view, qr });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ requestKey, status: 'error', message: messageForError(error, '기록을 확인하지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, studentId, requestKey]);

  const next = () => navigate(classId ? TUTOR_PATHS.classKiosk(classId) : TUTOR_PATHS.classes, { replace: true });
  const effective: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={kioskStyles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {effective.status === 'loading' ? <LoadingState /> : null}
        {effective.status === 'error' ? (
          <>
            <ErrorState message={effective.message} onRetry={() => setAttempt((value) => value + 1)} />
            <ActionButton label="다음 친구" size="lg" onPress={next} />
          </>
        ) : null}
        {effective.status === 'ready' ? (
          <>
            <Text style={styles.title} accessibilityRole="header">
              {effective.student.name} 친구, 잘 읽었어요!
            </Text>
            {effective.view.kind === 'linked' ? (
              <Text style={styles.body}>
                {effective.view.parentName ? `${effective.view.parentName}님께` : '보호자께'} 오늘 리포트를 보냈어요.
              </Text>
            ) : null}
            {effective.view.kind === 'claim' ? (
              <View style={styles.claim}>
                <Text style={styles.body}>보호자님, 휴대폰 카메라로 찍어 주세요.</Text>
                <Text style={styles.muted}>가입하면 오늘 {effective.student.name} 친구가 읽은 리포트를 볼 수 있어요.</Text>
                {effective.qr ? (
                  <Image
                    source={{ uri: effective.qr }}
                    style={styles.qr}
                    accessibilityLabel={`${effective.student.name} 보호자 연결 QR 코드`}
                  />
                ) : null}
                <Text selectable style={styles.link}>
                  {effective.view.link}
                </Text>
              </View>
            ) : null}
            {effective.view.kind === 'teacher' ? (
              <Text style={styles.body}>기록은 남았어요. 보호자 연결은 선생님께 부탁해 주세요.</Text>
            ) : null}
            <ActionButton label="다음 친구" size="lg" onPress={next} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: storybookTheme.spacing.lg,
    paddingVertical: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.lg,
  },
  title: {
    fontSize: storybookTheme.type.xxl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
    textAlign: 'center',
  },
  body: { fontSize: storybookTheme.type.md, color: storybookTheme.color.onCardBody, textAlign: 'center' },
  muted: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted, textAlign: 'center' },
  claim: {
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    padding: storybookTheme.spacing.lg,
    borderRadius: radius[24],
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  qr: { width: 280, height: 280 },
  link: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted, textAlign: 'center' },
});
