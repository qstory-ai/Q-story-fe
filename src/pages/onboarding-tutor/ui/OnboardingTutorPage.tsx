import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';

const ONBOARDING_DONE_KEY_PREFIX = 'qstory.onboarding.tutor.done.';

type Choice = 'independent' | 'organization';

/**
 * IA "선생님 온보딩" - 회원가입 성공 직후 자동 진입. IA의 두 스텝(선생님 정보/소속 설정) 중
 * 이름·프로필 이미지는 signup 폼에서 이미 받았으므로 소속 설정만 다룬다. 개인 활동은 곧바로
 * 완료, 기관 참여는 코드 입력 → /org-invite/code/:code로 위임한다(그 페이지가 미리보기 +
 * 수락을 처리).
 */
export function OnboardingTutorPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [choice, setChoice] = useState<Choice>('independent');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  function markDone() {
    if (state.status !== 'authenticated') return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`${ONBOARDING_DONE_KEY_PREFIX}${state.user.id}`, '1');
      }
    } catch {
      // 실패해도 홈 진입은 그대로.
    }
  }

  function finish() {
    if (state.status !== 'authenticated') return;
    if (choice === 'independent') {
      markDone();
      navigate(homePathFor(state.user), { replace: true });
      return;
    }
    // 기관 참여 - 코드 검증 후 org-invite 흐름으로 위임. 완료 마크는 org-invite 수락 페이지가
    // 성공하면 홈으로 리다이렉트한 다음 사용자가 다시 온보딩에 돌아오지 않아도 되게 여기서 미리 남긴다.
    setCodeError(null);
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(normalized)) {
      setCodeError('영문·숫자 4-16자리 코드를 입력해 주세요.');
      return;
    }
    markDone();
    navigate(`/org-invite/code/${encodeURIComponent(normalized)}`);
  }

  if (state.status !== 'authenticated') return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.progressRow}>
          <View style={[styles.progressPip, styles.progressPipFilled]} />
          <View style={styles.progressPip} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="온보딩 나중에 하기"
          onPress={() => {
            markDone();
            navigate(homePathFor(state.user), { replace: true });
          }}
          hitSlop={8}
        >
          <Text style={styles.skipLabel}>나중에</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.eyebrow}>소속 설정</Text>
        <Text style={styles.title} accessibilityRole="header">
          어떻게 활동하시나요?
        </Text>
        <Text style={styles.body}>
          지금 결정하지 않아도 돼요. 나중에 마이페이지 &gt; 소속에서 언제든 바꿀 수 있어요.
        </Text>

        <View style={styles.choiceList}>
          <ChoiceCard
            selected={choice === 'independent'}
            title="개인으로 활동해요"
            body="어떤 기관에도 소속되지 않고, 직접 학생과 부모를 관리해요."
            onPress={() => setChoice('independent')}
          />
          <ChoiceCard
            selected={choice === 'organization'}
            title="기관에 소속돼 있어요"
            body="기관 관리자에게 받은 코드를 입력해 소속을 완성해요."
            onPress={() => setChoice('organization')}
          />
        </View>

        {choice === 'organization' ? (
          <TextField
            label="기관 초대 코드"
            value={code}
            onChangeText={(value) => {
              setCode(value);
              if (codeError) setCodeError(null);
            }}
            placeholder="예: 42QRKM3P"
            autoCapitalize="characters"
            errorText={codeError ?? undefined}
          />
        ) : null}

        <ActionButton
          variant="gold"
          label={choice === 'independent' ? '개인으로 시작' : '코드로 소속 완성'}
          onPress={finish}
          disabled={choice === 'organization' && code.trim().length === 0}
        />

        {choice === 'independent' ? (
          <StatusBanner
            label="개인 선생님으로 시작해요"
            body="나중에 기관 초대를 받으면 마이페이지의 '기관 참여'에서 코드를 입력할 수 있어요."
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/** 선생님 온보딩이 완료됐는지 판단. 서버 저장 없이 브라우저 로컬 마크만. */
export function hasCompletedTutorOnboarding(userId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(`${ONBOARDING_DONE_KEY_PREFIX}${userId}`) === '1';
  } catch {
    return true;
  }
}

/* -------------------------------------------------------------- helpers */

function ChoiceCard({
  selected,
  title,
  body,
  onPress,
}: {
  selected: boolean;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        selected && styles.choiceCardSelected,
        pressed && styles.choicePressed,
      ]}
    >
      <View style={styles.choiceHeader}>
        <View style={[styles.radioBox, selected && styles.radioBoxSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
        <Text style={styles.choiceTitle}>{title}</Text>
      </View>
      <Text style={styles.choiceBody}>{body}</Text>
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
    backgroundColor: storybookTheme.color.contentPanelBorder,
    maxWidth: 60,
  },
  progressPipFilled: { backgroundColor: storybookTheme.color.gold },
  skipLabel: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  content: {
    flex: 1,
    paddingHorizontal: storybookTheme.spacing.lg,
    paddingTop: storybookTheme.spacing.ms,
    gap: storybookTheme.spacing.ms,
    // OnboardingParentPage와 같은 중간 폭 - 두 곳뿐이라 별도 layout 토큰은 아직 만들지 않는다.
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.4,
  },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.xl,
    lineHeight: storybookTheme.type.xl * storybookTheme.lineHeight.tight,
    fontWeight: storybookTheme.type.weight.black,
    letterSpacing: storybookTheme.type.xl * storybookTheme.tracking.heading,
  },
  body: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    marginTop: 4,
  },
  choiceList: { marginTop: 12, gap: 10 },
  choiceCard: {
    padding: 16,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentPanel,
    gap: 6,
  },
  choiceCardSelected: { borderColor: storybookTheme.color.gold },
  choicePressed: { opacity: 0.85 },
  choiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  choiceTitle: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  choiceBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    marginLeft: 30,
  },
  radioBox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: storybookTheme.color.onContentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioBoxSelected: { borderColor: storybookTheme.color.gold },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: storybookTheme.color.gold,
  },
});
