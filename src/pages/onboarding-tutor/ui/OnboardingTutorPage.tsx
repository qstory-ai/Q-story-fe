import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import {
  ActionButton,
  AuthLink,
  AuthScreen,
  authText,
  enterFadeUp,
  Radio,
  selectableCardStyle,
  StatusBanner,
  storybookTheme,
  TextField,
} from '@/shared/ui';
import { normalizeInviteCode, isValidInviteCode } from '@/shared/lib';
import { hasCompletedOnboarding, homePathFor, markOnboardingDone, useAuth } from '@/entities/auth';
import { previewHomeroomInviteByCode, tutorInviteCodeDestination } from '@/entities/homeroom-invite';

type Choice = 'independent' | 'organization';

/**
 * IA "선생님 온보딩" - 회원가입 성공 직후 자동 진입. IA의 두 스텝(선생님 정보/소속 설정) 중
 * 이름·프로필 이미지는 signup 폼에서 이미 받았으므로 소속 설정만 다룬다. 개인 활동은 곧바로
 * 완료, 기관 참여는 코드 입력 → /org-invite/code/:code로 위임한다(그 페이지가 미리보기 +
 * 수락을 처리). 관리자에게 받은 코드가 담임 초대 코드면 /homeroom-invite로 보낸다.
 */
export function OnboardingTutorPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [choice, setChoice] = useState<Choice>('independent');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    } else if (hasCompletedOnboarding('tutor', state.user.id)) {
      navigate(homePathFor(state.user), { replace: true });
    }
  }, [state, navigate]);

  function markDone() {
    if (state.status !== 'authenticated') return;
    markOnboardingDone('tutor', state.user.id);
  }

  async function finish() {
    if (state.status !== 'authenticated') return;
    if (choice === 'independent') {
      markDone();
      navigate(homePathFor(state.user), { replace: true });
      return;
    }
    // 기관 참여 - 코드 검증 후 org-invite 흐름으로 위임한다. 완료 표시는 수락이 성공했을 때 그 화면이 남긴다 -
    // 여기서 미리 남기면 코드가 틀려 뒤로 돌아왔을 때 온보딩으로 다시 들어올 수 없었다.
    setCodeError(null);
    const normalized = normalizeInviteCode(code);
    if (!isValidInviteCode(normalized)) {
      setCodeError('영문·숫자 4-16자리 코드를 입력해 주세요.');
      return;
    }
    setChecking(true);
    const destination = await tutorInviteCodeDestination(normalized, previewHomeroomInviteByCode);
    setChecking(false);
    navigate(destination);
  }

  if (state.status !== 'authenticated') return null;

  return (
    // 작은 화면에서 코드 입력·안내까지 잘리지 않게 AuthScreen이 스크롤한다.
    <AuthScreen>
      <View style={styles.content}>
        <Text style={authText.eyebrow}>소속 설정</Text>
        <Text style={authText.title} accessibilityRole="header">
          어떻게 활동하시나요?
        </Text>
        <Text style={authText.lead}>
          지금 결정하지 않아도 돼요. 기관 소속은 나중에 마이페이지 &gt; 소속에서 추가할 수 있어요.
        </Text>

        <View style={styles.choiceList} accessibilityRole="radiogroup" accessibilityLabel="활동 방식">
          <ChoiceCard
            selected={choice === 'independent'}
            title="개인으로 활동해요"
            body="어떤 기관에도 소속되지 않고, 직접 학생과 보호자를 관리해요."
            onPress={() => setChoice('independent')}
          />
          <ChoiceCard
            selected={choice === 'organization'}
            title="기관에 소속돼 있어요"
            body="관리자에게 받은 기관 초대나 담임 초대 코드를 입력해 소속을 완성해요."
            onPress={() => setChoice('organization')}
          />
        </View>

        {choice === 'organization' ? (
          <TextField
            label="초대 코드(기관·담임)"
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

        {choice === 'independent' ? (
          <StatusBanner
            label="개인 선생님으로 시작해요"
            body="나중에 기관 초대를 받으면 마이페이지의 '기관 참여'에서 코드를 입력할 수 있어요."
          />
        ) : null}

        <ActionButton
          variant="gold"
          label={choice === 'independent' ? '개인으로 시작하기' : '코드로 소속 완성하기'}
          onPress={() => { void finish(); }}
          loading={checking}
          disabled={choice === 'organization' && code.trim().length === 0}
        />

        {/* 소속 설정 한 단계뿐이라 진행 표시(예전 2칸)는 두지 않는다(Q-35). */}
        <AuthLink
          accessibilityRole="button"
          accessibilityLabel="온보딩 나중에 하기"
          label="나중에 할게요"
          onPress={() => {
            markDone();
            navigate(homePathFor(state.user), { replace: true });
          }}
        />
      </View>
    </AuthScreen>
  );
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
  // 카드 전체를 눌러도 고른다 - 표시·라벨은 공용 Radio, 설명은 그 아래(라디오 폭만큼 들여서).
  return (
    <Pressable accessible={false} onPress={onPress} style={({ pressed }) => selectableCardStyle(selected, pressed)}>
      <Radio selected={selected} onSelect={onPress} label={title} />
      <Text style={styles.choiceBody}>{body}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: storybookTheme.spacing.ms, ...enterFadeUp },
  choiceList: { marginTop: 12, gap: 10 },
  choiceBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    // Radio 원(22) + 간격(10)만큼 들여 라벨과 줄을 맞춘다.
    marginLeft: 32,
  },
});
