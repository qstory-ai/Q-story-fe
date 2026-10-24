import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  ActionButton,
  AuthLink,
  AuthScreen,
  authText,
  Checkbox,
  enterFadeUp,
  SELECTABLE_MARK,
  selectableCardStyle,
  StatusBanner,
  storybookTheme,
  TextField,
} from '@/shared/ui';
import { messageForError } from '@/shared/api';
import {
  CONSENT_VERSION,
  hasCompletedOnboarding,
  homePathFor,
  markOnboardingDone,
  recordConsents,
  useAuth,
} from '@/entities/auth';
import { ageYearsFromBirthYear, grantVoiceResearchAccountConsent, trackBetaEvent } from '@/entities/analytics';
import {
  BirthYearChips,
  ageBandFromBirthYear,
  defaultBirthYearForBand,
  CHILD_AVATARS,
  useChildren,
  type ChildAvatarKey,
} from '@/entities/child';


/** 온보딩을 마친 뒤 갈 앱 내부 경로 - 반 코드로 가입했으면 그 반에 아이를 연결하는 화면(/join?code=). */
function readNext(state: unknown): string | null {
  const next = (state as { next?: unknown } | null)?.next;
  return typeof next === 'string' && /^\/(?![/\\])[^\\\s]*$/.test(next) ? next : null;
}

/**
 * IA "보호자 온보딩" - 회원가입 성공 직후 자동 진입. 보호자 정보는 가입 폼에서 이미 받았으므로 아이 등록과
 * 아이 관련 필수 동의만 다룬다. 둘을 한 화면에 두고 완료 확인 화면 없이 곧장 홈(또는 반 연결 화면)으로
 * 보낸다(Q-36: 단계 2개 + 완료 화면 → 한 화면). 아이 등록은 "나중에" 할 수 있지만 동의는 그때도 받는다.
 * 마친 계정이 다시 들어오면 홈으로 보낸다.
 */
export function OnboardingParentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useAuth();
  const { addChild, children, load } = useChildren();
  const [next] = useState(() => readNext(location.state));

  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState<number>(() => defaultBirthYearForBand());
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>(CHILD_AVATARS[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentAudio, setConsentAudio] = useState(false);
  const [consentReport, setConsentReport] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    } else if (hasCompletedOnboarding('parent', state.user.id)) {
      navigate(next ?? homePathFor(state.user), { replace: true });
    }
  }, [state, navigate, next]);

  // 이미 아이 프로필이 있는 계정이면 같은 아이를 또 만들지 않도록 아이 입력을 숨기고 동의만 받는다.
  // 프로필 수정(아바타 등)은 홈의 아이 관리에서 할 수 있다.
  const childExists = load.status === 'ready' && children.length > 0;

  // 리포트 표시 범위만 필수다. 음성 원본 보관은 선택이라 체크하지 않아도 다음으로 넘어간다.
  const consented = consentReport;
  const canCreateChild = name.trim().length > 0 && consented && !submitting;

  /** 동의 이력을 서버에 남긴다. 하나라도 실패하면 던져서 다음 단계로 넘어가지 않게 한다. */
  async function saveConsents() {
    if (state.status !== 'authenticated') throw new Error('not authenticated');
    await recordConsents(state.token, {
      source: 'ONBOARDING',
      items: [{ type: 'CHILD_REPORT_SCOPE', agreed: true, version: CONSENT_VERSION }],
    });
    if (consentAudio) await grantVoiceResearchAccountConsent(state.token, 'ONBOARDING');
    void trackBetaEvent('consent_saved', { voice_research: consentAudio, report_scope: true });
  }

  async function finish() {
    if (state.status !== 'authenticated' || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveConsents();
    } catch (failure: unknown) {
      setError(messageForError(failure, '동의 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setSubmitting(false);
      return;
    }
    markOnboardingDone('parent', state.user.id);
    navigate(next ?? homePathFor(state.user), { replace: true });
  }

  async function submitChild() {
    if (!canCreateChild) return;
    setSubmitting(true);
    setError(null);
    try {
      await saveConsents();
    } catch (failure: unknown) {
      setError(messageForError(failure, '동의 내용을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setSubmitting(false);
      return;
    }
    try {
      const ageBand = ageBandFromBirthYear(birthYear);
      await addChild({ name: name.trim(), birthYear, ageBand, avatarKey });
      void trackBetaEvent('child_registered', { age_years: ageYearsFromBirthYear(birthYear), age_band: ageBand });
    } catch (failure: unknown) {
      const message = messageForError(failure, '아이 프로필을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      setError(message);
      setSubmitting(false);
      return;
    }
    if (state.status !== 'authenticated') return;
    markOnboardingDone('parent', state.user.id);
    navigate(next ?? homePathFor(state.user), { replace: true });
  }

  if (state.status !== 'authenticated') return null;

  const finishLabel = next ? '반에 아이 연결하기' : '시작하기';

  return (
    <AuthScreen>
      <View style={styles.content}>
        {!childExists && (
          <>
            <Text style={authText.eyebrow}>아이 등록</Text>
            <Text style={authText.title} accessibilityRole="header">아이 프로필을 만들어 주세요</Text>
            <Text style={authText.lead}>
              아이 이름과 출생연도, 아바타를 골라 주세요. 나이는 자동으로 계산돼요. 언제든 마이페이지에서 바꿀 수 있어요.
            </Text>

            <TextField
              label="이름 또는 별명"
              value={name}
              onChangeText={setName}
              placeholder="예: 민준"
              maxLength={40}
            />

            <BirthYearChips value={birthYear} onChange={setBirthYear} />

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
                      aria-checked={selected}
                      onPress={() => setAvatarKey(preset.key)}
                      style={({ pressed }) => [
                        styles.avatarChoice,
                        // 고른 아바타 테두리는 다른 선택 표시와 같은 보라.
                        { borderColor: selected ? SELECTABLE_MARK.selected : 'transparent', backgroundColor: `${preset.accent}33` },
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <Text style={[authText.eyebrow, !childExists && styles.sectionGap]}>아이 관련 필수 동의</Text>
        {childExists ? (
          <Text style={authText.title} accessibilityRole="header">아이 데이터를 안전하게 다뤄요</Text>
        ) : null}
        <Text style={authText.lead}>
          아이의 음성과 리포트에 대한 처리 방식을 확인하고 동의해 주세요.
        </Text>

        <Checkbox
          checked={consentReport && consentAudio}
          onChange={(next) => {
            setConsentReport(next);
            setConsentAudio(next);
          }}
          label="전체 동의"
        />
        <ConsentBlock
          title="리포트 표시 범위 (필수)"
          body="완주 리포트는 보호자(그리고 아이가 속한 반의 담임 선생님과 관리자)에게만 노출돼요. 리포트에는 아이가 한 말이 그대로 보이고, 전화번호·이메일 같은 연락처만 가려요. 외부 공유는 별도 동의 없이는 하지 않아요."
          checked={consentReport}
          onChange={setConsentReport}
        />
        <ConsentBlock
          title="아이 음성 원본 보관 (선택)"
          body="아이의 질문 음성 원본을 음성 인식 개선을 위해 1년간 비공개로 보관해요. 체크하지 않아도 질문은 문장으로 바뀌어 그대로 이용할 수 있어요. 마이페이지에서 언제든 끌 수 있어요."
          checked={consentAudio}
          onChange={setConsentAudio}
        />

        {error ? <StatusBanner variant="warning" label={error} /> : null}
        {childExists ? (
          <ActionButton variant="gold" label={`동의하고 ${finishLabel}`} onPress={finish} disabled={!consented} loading={submitting} />
        ) : (
          <>
            <ActionButton
              variant="gold"
              label={`등록하고 ${finishLabel}`}
              onPress={submitChild}
              disabled={!canCreateChild}
              loading={submitting}
            />
            {/* 아이 등록만 미룬다 - 동의는 그때도 필요하다(아이를 나중에 등록해도 같은 처리 방식이 적용된다). */}
            <AuthLink
              accessibilityRole="button"
              accessibilityLabel="아이 등록 나중에 하기"
              label="아이 등록은 나중에 할게요"
              onPress={() => { void finish(); }}
              disabled={!consented || submitting}
            />
          </>
        )}
      </View>
    </AuthScreen>
  );
}

/* -------------------------------------------------------------- helpers */

function ConsentBlock({
  title,
  body,
  checked,
  onChange,
}: {
  title: string;
  body?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  // 카드 전체를 눌러도 체크된다 - 체크 표시·라벨은 공용 Checkbox, 설명은 그 아래(체크박스 폭만큼 들여서).
  return (
    <Pressable accessible={false} onPress={() => onChange(!checked)} style={({ pressed }) => selectableCardStyle(checked, pressed)}>
      <Checkbox checked={checked} onChange={onChange} label={title} />
      {body ? <Text style={styles.consentBody}>{body}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionGap: { marginTop: storybookTheme.spacing.lg },
  content: { gap: storybookTheme.spacing.ms, ...enterFadeUp },
  group: { gap: 8, marginTop: 12 },
  groupLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContentMuted,
  },
  chipPressed: { opacity: 0.85 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarChoice: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: { fontSize: storybookTheme.type.xxl },
  consentBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    // Checkbox 상자(22) + 간격(10)만큼 들여 라벨과 줄을 맞춘다.
    marginLeft: 32,
  },
});
