import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { hasCompletedOnboarding, homePathFor, markOnboardingDone, useAuth } from '@/entities/auth';
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

  const consented = consentAudio && consentReport;
  const canCreateChild = name.trim().length > 0 && consented && !submitting;

  function finish() {
    if (state.status !== 'authenticated') return;
    markOnboardingDone('parent', state.user.id);
    navigate(next ?? homePathFor(state.user), { replace: true });
  }

  async function submitChild() {
    if (!canCreateChild) return;
    setSubmitting(true);
    setError(null);
    try {
      await addChild({ name: name.trim(), birthYear, ageBand: ageBandFromBirthYear(birthYear), avatarKey });
      finish();
    } catch (failure: unknown) {
      const message = messageForError(failure, '아이 프로필을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      setError(message);
      setSubmitting(false);
    }
  }

  if (state.status !== 'authenticated') return null;

  const finishLabel = next ? '반에 아이 연결하기' : '시작하기';

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {!childExists && (
          <>
            <Text style={styles.eyebrow}>아이 등록</Text>
            <Text style={styles.title} accessibilityRole="header">아이 프로필을 만들어 주세요</Text>
            <Text style={styles.body}>
              이야기 속에서 부를 이름과 아이의 출생연도, 아바타를 골라 주세요. 나이는 자동으로 계산돼요. 언제든 마이페이지에서 바꿀 수 있어요.
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
          </>
        )}

        <Text style={[styles.eyebrow, !childExists && styles.sectionGap]}>아이 관련 필수 동의</Text>
        {childExists ? (
          <Text style={styles.title} accessibilityRole="header">아이 데이터를 안전하게 다뤄요</Text>
        ) : null}
        <Text style={styles.body}>
          아이의 음성과 리포트에 대한 처리 방식을 확인하고 동의해 주세요.
        </Text>

        <ConsentBlock
          title="모두 동의"
          checked={consented}
          onChange={(value) => {
            setConsentAudio(value);
            setConsentReport(value);
          }}
        />
        <ConsentBlock
          title="아이 음성 보관"
          body="아이의 질문 음성은 음성 인식 개선을 위해 90일간 비공개로 보관한 뒤 지워요. 리포트에는 아이가 한 말의 뜻만 남아요. 마이페이지 > 설정에서 언제든 끌 수 있어요."
          checked={consentAudio}
          onChange={setConsentAudio}
        />
        <ConsentBlock
          title="리포트 표시 범위"
          body="완주 리포트는 보호자(그리고 아이가 속한 반의 담임 선생님과 관리자)에게만 노출돼요. 외부 공유는 별도 동의 없이는 하지 않아요."
          checked={consentReport}
          onChange={setConsentReport}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {childExists ? (
          <ActionButton variant="gold" label={`동의하고 ${finishLabel}`} onPress={finish} disabled={!consented} />
        ) : (
          <>
            <ActionButton
              variant="gold"
              label={submitting ? '만드는 중…' : `등록하고 ${finishLabel}`}
              onPress={submitChild}
              disabled={!canCreateChild}
              loading={submitting}
            />
            {/* 아이 등록만 미룬다 - 동의는 그때도 필요하다(아이를 나중에 등록해도 같은 처리 방식이 적용된다). */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="아이 등록 나중에 하기"
              onPress={finish}
              disabled={!consented || submitting}
              style={styles.skipButton}
            >
              <Text style={[styles.skipLabel, (!consented || submitting) && styles.skipLabelDisabled]}>
                아이 등록은 나중에 할게요
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
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
      {body ? <Text style={styles.consentBody}>{body}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  skipButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  skipLabelDisabled: { opacity: 0.5 },
  sectionGap: { marginTop: storybookTheme.spacing.lg },
  skipLabel: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  content: {
    paddingHorizontal: storybookTheme.spacing.lg,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xxl,
    gap: storybookTheme.spacing.ms,
    // 온보딩은 폼(420)보다는 조금 넓고 리스트(560)보다는 좁은 중간 폭이 편해서, 두 페이지가
    // 공통으로 480을 쓴다. 두 곳뿐이라 별도 layout 토큰은 아직 만들지 않는다.
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    letterSpacing: 0.4,
    marginTop: 12,
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
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
  consentCard: {
    padding: 16,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentPanel,
    gap: 6,
  },
  consentCardChecked: { borderColor: storybookTheme.color.gold },
  consentHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  consentTitle: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  consentBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    marginLeft: 30,
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: storybookTheme.radius.control,
    borderWidth: 2,
    borderColor: storybookTheme.color.onContentMuted,
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
