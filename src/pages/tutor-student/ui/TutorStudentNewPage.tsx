import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, RadioGroup, SafeAreaView, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import {
  createTutorInvite,
  createTutorStudent,
  type TutorInvite,
  type TutorStudent,
} from '@/entities/tutor';
import { InviteCodeCard, formatInviteExpiry, tutorInviteLink, tutorInviteShareMessage } from '@/features/invite-issue';

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
      {/* 폼 + 초대 카드가 폰 세로 화면보다 길어질 수 있어 ScrollView - 예전엔 View라 아래쪽
          버튼이 화면 밖으로 잘린 채 닿지 않았다. */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 'info' && (
          <InfoStep token={token} onCreated={(created) => { setStudent(created); setStep('invite'); }} />
        )}
        {step === 'invite' && student && (
          <InviteStep token={token} student={student} onDone={() => navigate('/tutor', { replace: true })} />
        )}
      </ScrollView>
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
  // 기본은 LINK - 문자 발송은 아직 연결돼 있지 않아서(번호만 저장) SMS를 기본으로 두면 번호를
  // 입력하게 만든 뒤 "사실 직접 전달하세요"라고 하는 꼴이었다.
  const [method, setMethod] = useState<'SMS' | 'LINK'>('LINK');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [invite, setInvite] = useState<TutorInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const inviteUrl = useMemo(() => (invite ? tutorInviteLink(invite.token) : null), [invite]);

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
          <Text style={styles.hintLeft}>
            초대 코드나 링크를 만들어 부모님께 전달하면, 부모님이 계정을 만들거나 로그인해서 {student.name}의 기록을 받을 수 있어요.
          </Text>
          <RadioGroup
            accessibilityLabel="초대 방법"
            options={[
              { value: 'LINK', label: '코드·링크 직접 전달 (카카오톡, 문자 등)' },
              { value: 'SMS', label: '부모님 번호 남겨두기 · 문자 자동 발송은 준비 중' },
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
              autoComplete="tel"
              placeholder="010-0000-0000"
              description="지금은 번호만 저장돼요. 초대 코드·링크는 아래에서 직접 전달해 주세요."
              errorText={error ?? undefined}
            />
          )}
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>부모님이 확인할 내용</Text>
            <Text style={styles.consentItem}>· {student.name}의 수업 연결</Text>
            <Text style={styles.consentItem}>· 개인 리포트 수신과 연결 해제 방법</Text>
            <Text style={styles.consentItem}>· 가정 구독·다른 이야기 기록은 선생님에게 비공개</Text>
          </View>
          {error && method !== 'SMS' ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton
            label={submitting ? '만드는 중…' : '초대 만들기'}
            onPress={onSubmit}
            loading={submitting}
            disabled={method === 'SMS' && !phoneNumber.trim()}
          />
        </>
      ) : (
        <>
          {/* 학생 목록/상세 화면과 같은 InviteCodeCard - 예전엔 여기만 복사 버튼도 짧은 코드도
              없는 손수 만든 카드를 써서, 선생님이 등록 직후엔 긴 토큰 URL을 손으로 긁어 복사해야 했다. */}
          <InviteCodeCard
            shortCode={invite.shortCode}
            link={inviteUrl ?? ''}
            expiresLabel={formatInviteExpiry(invite.expiresAt)}
            shareMessage={tutorInviteShareMessage(student.name)}
          />
          <Text style={styles.hint}>초대는 학생 목록에서 언제든 다시 만들 수 있어요. 수업 일정은 홈의 "수업" 탭에서 만들어요.</Text>
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
  hint: { fontSize: storybookTheme.type.xs, lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal, color: storybookTheme.color.onLightMuted, textAlign: 'center' },
  hintLeft: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onLightBody },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
  consentCard: {
    gap: storybookTheme.spacing.xs,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.pillBackground,
    padding: storybookTheme.spacing.md,
  },
  consentTitle: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onLightHeading },
  consentItem: { fontSize: storybookTheme.type.xs, lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal, color: storybookTheme.color.onLightBody },
});
