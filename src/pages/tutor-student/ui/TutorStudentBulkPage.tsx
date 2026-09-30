import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextareaField, storybookTheme } from '@/shared/ui';
import { BirthYearChips } from '@/entities/child';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import { createTutorStudentsBulk, type BulkTutorStudentResult } from '@/entities/tutor';
import { InviteCodeCard, formatInviteExpiry, tutorInviteLink, tutorInviteShareMessage } from '@/features/invite-issue';
import { TutorClassPicker, type TutorClassSelection } from '@/features/tutor-class-picker';
import { BULK_STUDENT_LIMIT, parseStudentNames } from '../lib/parse-student-names';

/**
 * "여러 명 한 번에 등록" - 반 명단을 붙여넣으면 학생을 전부 등록하고 학생마다 부모 초대(코드·링크)를 한
 * 화면에서 받는다. 서버는 전부 성공하거나 전부 실패하므로 "어디까지 됐지?"가 생기지 않는다.
 */
export function TutorStudentBulkPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [raw, setRaw] = useState('');
  const [birthYear, setBirthYear] = useState<number>(() => new Date().getFullYear() - 7);
  const [classSel, setClassSel] = useState<TutorClassSelection>({ lessonType: 'CLASS', classGroupId: null });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BulkTutorStudentResult[] | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const { names, duplicates } = useMemo(() => parseStudentNames(raw), [raw]);

  if (state.status !== 'authenticated') return null;
  const token = state.token;
  const needsClass = classSel.lessonType === 'CLASS' && !classSel.classGroupId;
  const tooMany = names.length > BULK_STUDENT_LIMIT;

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const created = await createTutorStudentsBulk(token, {
        students: names.map((name) => ({ name })),
        defaultBirthYear: birthYear,
        lessonType: classSel.lessonType,
        classGroupId: classSel.classGroupId ?? undefined,
      });
      setResults(created);
    } catch (failure) {
      setError(messageForError(failure, '학생을 등록하지 못했어요. 명단을 확인하고 다시 시도해 주세요. 아무도 등록되지 않았어요.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {results ? (
          <>
            <Text style={styles.stepLabel}>여러 명 등록 완료</Text>
            <Text style={styles.title} accessibilityRole="header">{results.length}명을 등록했어요{'\n'}부모님께 초대를 보내 주세요</Text>
            {results.map(({ student, invite }) => (
              <View key={student.id} style={styles.resultBlock}>
                <Text style={styles.fieldHeading}>{student.name}</Text>
                <InviteCodeCard
                  shortCode={invite.shortCode}
                  link={tutorInviteLink(invite.token)}
                  expiresLabel={formatInviteExpiry(invite.expiresAt)}
                  shareMessage={tutorInviteShareMessage(student.name)}
                />
              </View>
            ))}
            <Text style={styles.hint}>초대는 학생 목록에서 언제든 다시 만들 수 있어요.</Text>
            <ActionButton label="학생 목록으로" onPress={() => navigate('/tutor/students', { replace: true })} />
          </>
        ) : (
          <>
            <Text style={styles.stepLabel}>여러 명 한 번에 등록</Text>
            <Text style={styles.title} accessibilityRole="header">반 명단을 붙여넣어 주세요</Text>
            <Text style={styles.hintLeft}>
              이름을 줄바꿈이나 쉼표로 구분해 넣으면 한 번에 등록하고, 학생마다 부모 초대를 만들어 드려요. 한 번에 {BULK_STUDENT_LIMIT}명까지예요.
            </Text>
            <TextareaField
              label="학생 이름 또는 별명"
              value={raw}
              onChangeText={setRaw}
              numberOfLines={8}
              errorText={error ?? undefined}
            />
            <Text style={styles.hintLeft}>
              {names.length}명 인식{duplicates.length > 0 ? ` · 중복 ${duplicates.length}건은 제외했어요 (${duplicates.join(', ')})` : ''}
            </Text>
            {tooMany ? <Text style={styles.error}>{BULK_STUDENT_LIMIT}명을 넘었어요. 나눠서 등록해 주세요.</Text> : null}
            <Text style={styles.fieldHeading}>출생연도 (전원 공통)</Text>
            <BirthYearChips value={birthYear} onChange={setBirthYear} minAge={5} maxAge={10} tone="content" />
            <Text style={styles.fieldHeading}>수업 형태</Text>
            <TutorClassPicker token={token} value={classSel} onChange={setClassSel} />
            {needsClass ? <Text style={styles.hintLeft}>반 수업이면 반을 고르거나 새 반을 만들어 주세요.</Text> : null}
            <ActionButton
              label={submitting ? '등록 중…' : `${names.length}명 등록하고 초대 만들기`}
              onPress={onSubmit}
              loading={submitting}
              disabled={names.length === 0 || tooMany || needsClass}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  resultBlock: { gap: storybookTheme.spacing.xs },
  fieldHeading: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onLightHeading },
  stepLabel: { fontSize: storybookTheme.type.xs, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.primary, letterSpacing: 0.4 },
  title: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.black, color: storybookTheme.color.onLightHeading, marginBottom: storybookTheme.spacing.xs },
  hint: { fontSize: storybookTheme.type.xs, lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal, color: storybookTheme.color.onLightMuted, textAlign: 'center' },
  hintLeft: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onLightBody },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
});
