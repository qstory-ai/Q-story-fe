import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, RadioGroup, SafeAreaView, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import {
  createTutorInvite,
  createTutorStudent,
  type TutorStudent,
} from '@/entities/tutor';

type WizardStep = 'info' | 'invite';

const AGE_BANDS = ['6세', '7세', '8세', '9세'];

/**
 * "새 학생 등록" 2단계(학생 정보 → 부모 연결) - q-story-flow-prototype.tsx의
 * TutorStudentNewScreen→TutorParentConnectSetupScreen 순서를 그대로 따른다. 각 단계가 실제로
 * 서버에 저장한다(학생 생성 → 초대 발급).
 *
 * 예전엔 3단계 끝에 정기 수업 시간(TutorSchedule)까지 여기서 만들었지만, 홈 화면 캘린더가
 * TutorSchedule 대신 Lesson을 데이터 소스로 쓰도록 이미 바뀌어 있었고(TutorHomePage 참고)
 * /tutor/schedule도 어디서도 링크되지 않는 죽은 라우트였다 - 수업 생성 자체는 "수업" 탭의
 * LessonFormModal 하나로 이미 일원화돼 있었던 것. 그래서 이 마법사는 학생 등록/부모 연결까지만
 * 책임지고, 수업(일정) 생성은 등록 후 "수업" 탭에서 하도록 분리했다.
 */
export function TutorStudentNewPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [step, setStep] = useState<WizardStep>('info');
  const [student, setStudent] = useState<TutorStudent | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;
  const token = state.token;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        {step === 'info' && (
          <InfoStep token={token} onCreated={(created) => { setStudent(created); setStep('invite'); }} />
        )}
        {step === 'invite' && student && (
          <InviteStep token={token} student={student} onDone={() => navigate('/tutor', { replace: true })} />
        )}
      </View>
    </SafeAreaView>
  );
}

function InfoStep({ token, onCreated }: { token: string; onCreated: (student: TutorStudent) => void }) {
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState('7세');
  const [classType, setClassType] = useState('가정 방문 독서 수업');
  const [prepNote, setPrepNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const created = await createTutorStudent(token, {
        name: name.trim(),
        ageBand,
        classType: classType.trim() || undefined,
        prepNote: prepNote.trim() || undefined,
      });
      onCreated(created);
    } catch (failure) {
      setError(messageForError(failure, '학생을 등록하지 못했어요. 입력값을 확인 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, name, ageBand, classType, prepNote, onCreated]);

  return (
    <>
      <Text style={styles.stepLabel}>새 학생 등록 · 1 / 2</Text>
      <Text style={styles.title} accessibilityRole="header">아이 이름 또는 별명을 알려주세요</Text>
      <TextField label="아이 이름 또는 별명" value={name} onChangeText={setName} placeholder="예: 민서" />
      <RadioGroup
        accessibilityLabel="연령대"
        options={AGE_BANDS.map((band) => ({ value: band, label: band }))}
        value={ageBand}
        onChange={setAgeBand}
      />
      <TextField label="수업 형태" value={classType} onChangeText={setClassType} />
      <TextareaField
        label="수업 준비 메모 · 선택"
        value={prepNote}
        onChangeText={setPrepNote}
        numberOfLines={3}
        errorText={error ?? undefined}
      />
      <ActionButton label={submitting ? '등록 중…' : '다음'} onPress={onSubmit} loading={submitting} disabled={!name.trim()} />
    </>
  );
}

function InviteStep({ token, student, onDone }: { token: string; student: TutorStudent; onDone: () => void }) {
  const [method, setMethod] = useState<'SMS' | 'LINK'>('SMS');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inviteUrl = useMemo(() => {
    if (!invite) return null;
    return `${globalThis.location?.origin ?? ''}/tutor-invite/${invite.token}`;
  }, [invite]);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const created = await createTutorInvite(token, student.id, {
        method,
        phoneNumber: method === 'SMS' ? phoneNumber.trim() : undefined,
      });
      setInvite(created);
    } catch (failure) {
      setError(messageForError(failure, '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, student.id, method, phoneNumber]);

  return (
    <>
      <Text style={styles.stepLabel}>새 학생 등록 · 2 / 2</Text>
      <Text style={styles.title} accessibilityRole="header">{student.name} 부모님께{'\n'}연결을 요청해요</Text>

      {!invite ? (
        <>
          <RadioGroup
            accessibilityLabel="초대 방법"
            options={[
              { value: 'SMS', label: '문자로 보내기' },
              { value: 'LINK', label: '링크 직접 전달' },
            ]}
            value={method}
            onChange={(next) => setMethod(next as 'SMS' | 'LINK')}
          />
          {method === 'SMS' && (
            <TextField
              label="부모님 휴대폰 번호"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              placeholder="010-0000-0000"
              errorText={error ?? undefined}
            />
          )}
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>부모님이 확인할 내용</Text>
            <Text style={styles.consentItem}>· {student.name}의 수업 연결</Text>
            <Text style={styles.consentItem}>· 개인 리포트 수신과 연결 해제 방법</Text>
            <Text style={styles.consentItem}>· 가정 구독·다른 이야기 기록은 선생님에게 비공개</Text>
          </View>
          <ActionButton
            label={submitting ? '만드는 중…' : '초대 만들기'}
            onPress={onSubmit}
            loading={submitting}
            disabled={method === 'SMS' && !phoneNumber.trim()}
          />
        </>
      ) : (
        <>
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>초대를 만들었어요</Text>
            {method === 'LINK' ? (
              <>
                <Text style={styles.consentItem}>이 링크를 부모님께 전달해 주세요.</Text>
                <Text selectable style={styles.inviteUrl}>{inviteUrl}</Text>
              </>
            ) : (
              <Text style={styles.consentItem}>
                {phoneNumber}로 보낼 링크가 준비됐어요. 실제 문자 발송은 아직 연결돼 있지 않아서, 아래 링크를 직접 전달해 주세요.
              </Text>
            )}
            {method === 'SMS' ? <Text selectable style={styles.inviteUrl}>{inviteUrl}</Text> : null}
          </View>
          <Text style={styles.hint}>수업 일정은 홈으로 돌아가 "수업" 탭에서 만들 수 있어요.</Text>
          <ActionButton label="등록 마치고 홈으로" onPress={onDone} />
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.shellBackground },
  content: {
    flexGrow: 1,
    gap: storybookTheme.spacing.ms,
    paddingHorizontal: storybookTheme.spacing.xl,
    paddingVertical: storybookTheme.spacing.xxl,
    maxWidth: storybookTheme.layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  stepLabel: { fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.gold, letterSpacing: 0.4 },
  title: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onLightHeading, marginBottom: storybookTheme.spacing.xs },
  hint: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onLightMuted, textAlign: 'center' },
  consentCard: {
    gap: storybookTheme.spacing.xs,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.pillBackground,
    padding: storybookTheme.spacing.md,
  },
  consentTitle: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onLightHeading },
  consentItem: { fontSize: storybookTheme.type.xs, lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal, color: storybookTheme.color.onLightBody },
  inviteUrl: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.linkOnLight, marginTop: storybookTheme.spacing.xs },
});
