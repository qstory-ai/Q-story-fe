import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  CHILD_AVATARS,
  useChildren,
  type AgeBand,
  type ChildAvatarKey,
} from '@/entities/child';

const ONBOARDING_DONE_KEY_PREFIX = 'qstory.onboarding.parent.done.';

type Step = 'child' | 'consent' | 'done';

/**
 * IA "부모 온보딩" - 회원가입 성공 직후 자동 진입. IA의 네 스텝(보호자 정보/아이 등록/필수
 * 동의/완료) 중 보호자 정보는 signup 폼에서 이미 받았으므로 여기선 아이 등록 → 필수 동의 →
 * 완료 세 스텝만 다룬다. 완료 마크는 localStorage에 남기고, 사용자가 "나중에" 링크를 누르면
 * 아이 없이도 홈으로 진입할 수 있다(이후 마이페이지에서 언제든 아이 등록 가능).
 */
export function OnboardingParentPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { addChild } = useChildren();

  const [step, setStep] = useState<Step>('child');
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('6-7');
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>(CHILD_AVATARS[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentAudio, setConsentAudio] = useState(false);
  const [consentReport, setConsentReport] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const canCreateChild = useMemo(() => name.trim().length > 0 && !submitting, [name, submitting]);
  const canConfirmConsent = consentAudio && consentReport;

  async function submitChild() {
    if (!canCreateChild) return;
    setSubmitting(true);
    setError(null);
    try {
      await addChild({ name: name.trim(), ageBand, avatarKey });
      setStep('consent');
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '아이 프로필을 만들지 못했어요.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function markDoneAndGoHome() {
    if (state.status !== 'authenticated') return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`${ONBOARDING_DONE_KEY_PREFIX}${state.user.id}`, '1');
      }
    } catch {
      // 프라이빗 모드 등에서 실패해도 홈 진입은 그대로 - 다음 로그인에 온보딩이 다시 뜨는 정도.
    }
    navigate(homePathFor(state.user), { replace: true });
  }

  if (state.status !== 'authenticated') return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          <ProgressPip filled={step !== 'child' || step === 'child'} />
          <ProgressPip filled={step === 'consent' || step === 'done'} />
          <ProgressPip filled={step === 'done'} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="온보딩 나중에 하기"
          onPress={markDoneAndGoHome}
          hitSlop={8}
        >
          <Text style={styles.skipLabel}>나중에</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {step === 'child' && (
          <>
            <Text style={styles.eyebrow}>1 · 아이 등록</Text>
            <Text style={styles.title} accessibilityRole="header">아이 프로필을 만들어 주세요</Text>
            <Text style={styles.body}>
              이야기 속에서 부를 이름과 아이의 연령대, 아바타를 골라 주세요. 언제든 마이페이지에서 바꿀 수 있어요.
            </Text>

            <TextField
              label="이름 또는 별명"
              value={name}
              onChangeText={setName}
              placeholder="예: 민준"
              maxLength={40}
            />

            <View style={styles.group}>
              <Text style={styles.groupLabel}>연령대</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {AGE_BANDS.map((band) => {
                  const selected = band === ageBand;
                  return (
                    <Pressable
                      key={band}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setAgeBand(band)}
                      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
                    >
                      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                        {AGE_BAND_LABELS[band]}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.group}>
              <Text style={styles.groupLabel}>아바타</Text>
              <View style={styles.avatarGrid}>
                {CHILD_AVATARS.map((preset) => {
                  const selected = preset.key === avatarKey;
                  return (
                    <Pressable
                      key={preset.key}
                      accessibilityRole="radio"
                      accessibilityLabel={preset.label}
                      accessibilityState={{ selected }}
                      onPress={() => setAvatarKey(preset.key)}
                      style={({ pressed }) => [
                        styles.avatarChoice,
                        { borderColor: selected ? preset.accent : 'transparent', backgroundColor: `${preset.accent}33` },
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <ActionButton
              variant="gold"
              label={submitting ? '만드는 중…' : '아이 등록하고 다음'}
              onPress={submitChild}
              disabled={!canCreateChild}
              loading={submitting}
            />
          </>
        )}

        {step === 'consent' && (
          <>
            <Text style={styles.eyebrow}>2 · 아이 관련 필수 동의</Text>
            <Text style={styles.title} accessibilityRole="header">아이 데이터를 안전하게 다뤄요</Text>
            <Text style={styles.body}>
              아이의 음성과 리포트에 대한 처리 방식을 확인하고 동의해 주세요.
            </Text>

            <ConsentBlock
              title="음성 원본 저장 안 함"
              body="아이의 목소리 원본은 이야기 진행이 끝나면 폐기해요. 리포트에는 아이의 뜻(childRelevantMeaning)만 남아요."
              checked={consentAudio}
              onChange={setConsentAudio}
            />
            <ConsentBlock
              title="리포트 표시 범위"
              body="완주 리포트는 부모(그리고 반 코드로 참여한 기관의 관리자)에게만 노출돼요. 외부 공유는 별도 동의 없이는 하지 않아요."
              checked={consentReport}
              onChange={setConsentReport}
            />

            <ActionButton
              variant="gold"
              label="동의하고 다음"
              onPress={() => setStep('done')}
              disabled={!canConfirmConsent}
            />
          </>
        )}

        {step === 'done' && (
          <>
            <Text style={styles.eyebrow}>3 · 완료</Text>
            <Text style={styles.title} accessibilityRole="header">준비가 끝났어요</Text>
            <Text style={styles.body}>
              지금부터 아이와 함께 이야기를 시작해 보세요. 홈에서 오늘의 이야기와 지난 리포트를 확인할 수 있어요.
            </Text>
            <ActionButton variant="gold" label="홈으로" onPress={markDoneAndGoHome} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 부모 온보딩이 완료됐는지(재진입 시 자동 스킵할지) 판단. 서버 저장 없이 브라우저 로컬 마크만. */
export function hasCompletedParentOnboarding(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${ONBOARDING_DONE_KEY_PREFIX}${userId}`) === '1';
  } catch {
    return true;
  }
}

/* -------------------------------------------------------------- helpers */

function ProgressPip({ filled }: { filled: boolean }) {
  return <View style={[styles.progressPip, filled && styles.progressPipFilled]} />;
}

function ConsentBlock({
  title,
  body,
  checked,
  onChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.consentCard,
        checked && styles.consentCardChecked,
        pressed && styles.chipPressed,
      ]}
    >
      <View style={styles.consentHeader}>
        <View style={[styles.checkboxBox, checked && styles.checkboxBoxChecked]}>
          {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
        </View>
        <Text style={styles.consentTitle}>{title}</Text>
      </View>
      <Text style={styles.consentBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressRow: { flexDirection: 'row', gap: 6, flex: 1 },
  progressPip: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: storybookTheme.color.panelOnDarkBorder,
    maxWidth: 60,
  },
  progressPipFilled: { backgroundColor: storybookTheme.color.gold },
  skipLabel: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  content: {
    paddingHorizontal: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xxl,
    gap: storybookTheme.spacing.ms,
    // 온보딩은 폼(420)보다는 조금 넓고 리스트(560)보다는 좁은 중간 폭이 편해서, 두 페이지가
    // 공통으로 480을 쓴다. 두 곳뿐이라 별도 layout 토큰은 아직 만들지 않는다.
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.4,
    marginTop: 12,
  },
  title: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xl,
    lineHeight: storybookTheme.type.xl * storybookTheme.lineHeight.tight,
    fontWeight: storybookTheme.type.weight.black,
    letterSpacing: storybookTheme.type.xl * storybookTheme.tracking.heading,
  },
  body: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    marginTop: 4,
  },
  group: { gap: 8, marginTop: 12 },
  groupLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDarkMuted,
  },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
  },
  chipSelected: {
    backgroundColor: storybookTheme.color.gold,
    borderColor: storybookTheme.color.gold,
  },
  chipPressed: { opacity: 0.85 },
  chipLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDarkMuted,
  },
  chipLabelSelected: { color: storybookTheme.color.background },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarChoice: {
    width: 56,
    height: 56,
    // 56/2 = 28 - 원형 아바타. radius.pill(999)를 써도 시각적으로 같지만 의도(정원)을 명시.
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: { fontSize: storybookTheme.type.xxl },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
  consentCard: {
    padding: 16,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    gap: 6,
  },
  consentCardChecked: { borderColor: storybookTheme.color.gold },
  consentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consentTitle: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDark,
  },
  consentBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onDarkMuted,
    marginLeft: 30,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: storybookTheme.radius.control,
    borderWidth: 2,
    borderColor: storybookTheme.color.onDarkMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    borderColor: storybookTheme.color.gold,
    backgroundColor: storybookTheme.color.gold,
  },
  checkboxMark: {
    color: storybookTheme.color.background,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.black,
    // 체크 마크는 박스 안에 정확히 눈금선이 맞아야 해서 lineHeight를 fontSize와 동일하게 잠근다.
    lineHeight: storybookTheme.type.sm,
  },
});
