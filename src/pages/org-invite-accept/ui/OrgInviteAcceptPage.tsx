import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';
import { homePathFor, useAuth } from '@/entities/auth';
import { messageForError } from '@/shared/api';
import {
  acceptOrganizationTutorInvite,
  acceptOrganizationTutorInviteByCode,
  previewOrganizationTutorInvite,
  previewOrganizationTutorInviteByCode,
  type OrganizationTutorInvitePreview,
} from '@/entities/organization-tutor';

type Stage = 'loading' | 'preview' | 'error' | 'success';

/**
 * IA "기관 관리자 → 선생님 초대 → 선생님 수락" 흐름의 수락 페이지. ParentLinkAcceptPage와 달리
 * 여기는 "새 계정을 만들며 수락" 흐름을 지원하지 않는다 - 기관 소속은 이미 TUTOR로 활동 중인
 * 선생님이 자기 계정에 붙이는 일이라(BE OrganizationTutorService.consumeInvite 주석 참조),
 * 비로그인 접근은 /signup?role=tutor로 안내한다.
 *
 * <p>라우트는 /org-invite/:token 과 /org-invite/code/:code 두 형태 모두 이 컴포넌트로 붙는다.
 */
export function OrgInviteAcceptPage() {
  const { token: rawToken, code: rawCode } = useParams<{ token?: string; code?: string }>();
  const isCodeFlow = Boolean(rawCode && !rawToken);
  const identifier = isCodeFlow ? (rawCode ?? '') : (rawToken ?? '');
  const navigate = useNavigate();
  const { state } = useAuth();

  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<OrganizationTutorInvitePreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!identifier) return;
    const previewPromise = isCodeFlow
      ? previewOrganizationTutorInviteByCode(identifier)
      : previewOrganizationTutorInvite(identifier);
    previewPromise
      .then((response) => {
        setPreview(response);
        setStage('preview');
      })
      .catch((failure: unknown) => {
        setErrorMessage(
          messageForError(failure, isCodeFlow ? '초대 코드를 확인하지 못했어요.' : '초대 링크를 확인하지 못했어요.'),
        );
        setStage('error');
      });
  }, [identifier, isCodeFlow]);

  // 파라미터 자체가 없으면 파생 상태로 오류 렌더 - setState를 effect에서 즉시 부르면 cascading
  // 렌더 lint에 걸린다(react-hooks/set-state-in-effect).
  const effectiveStage: Stage = !identifier ? 'error' : stage;
  const effectiveErrorMessage = !identifier ? '초대 링크 또는 코드가 올바르지 않아요.' : errorMessage;

  const onAccept = useCallback(async () => {
    if (!identifier) return;
    if (state.status !== 'authenticated') {
      // 비로그인 - 선생님 가입으로 안내. IA 상 신규 계정 만들며 수락은 지원 범위 밖.
      navigate(`/signup?role=tutor&redirect=${encodeURIComponent(isCodeFlow ? `/org-invite/code/${identifier}` : `/org-invite/${identifier}`)}`);
      return;
    }
    if (state.user.role !== 'TUTOR') {
      setErrorMessage('선생님 계정으로만 기관 초대를 수락할 수 있어요.');
      setStage('error');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      if (isCodeFlow) {
        await acceptOrganizationTutorInviteByCode(state.token, identifier);
      } else {
        await acceptOrganizationTutorInvite(state.token, identifier);
      }
      setStage('success');
    } catch (failure: unknown) {
      setErrorMessage(messageForError(failure, '초대 수락에 실패했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [identifier, isCodeFlow, state, navigate]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        {effectiveStage === 'loading' && (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        )}

        {effectiveStage === 'error' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{effectiveErrorMessage}</Text>
            <ActionButton
              variant="secondary"
              label="홈으로"
              onPress={() => navigate(state.status === 'authenticated' ? homePathFor(state.user) : '/')}
            />
          </View>
        )}

        {effectiveStage === 'preview' && preview && (
          <>
            <Text style={styles.eyebrow}>기관 소속 초대</Text>
            <Text style={styles.title} accessibilityRole="header">
              {preview.organizationName}
              {'\n'}선생님으로 함께하시겠어요?
            </Text>
            <Text style={styles.body}>
              수락하면 이 기관의 관리자에게 선생님으로 등록돼요. 계정과 학생 데이터는 그대로 유지되고,
              필요할 땐 마이페이지에서 소속을 해제할 수 있어요.
            </Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <ActionButton
              variant="gold"
              label={
                state.status !== 'authenticated'
                  ? '선생님으로 가입하고 수락'
                  : submitting ? '수락하는 중…' : '수락'
              }
              onPress={onAccept}
              loading={submitting}
            />
          </>
        )}

        {effectiveStage === 'success' && (
          <>
            <Text style={styles.eyebrow}>연결 완료</Text>
            <Text style={styles.title} accessibilityRole="header">기관 소속이 완료됐어요</Text>
            <Text style={styles.body}>
              이제 이 기관의 관리자가 선생님의 소속을 확인할 수 있어요. 홈으로 돌아가 수업을 계속해 주세요.
            </Text>
            <ActionButton
              variant="gold"
              label="홈으로"
              onPress={() => navigate(state.status === 'authenticated' ? homePathFor(state.user) : '/')}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: storybookTheme.spacing.ms,
    paddingHorizontal: storybookTheme.spacing.xl,
    paddingVertical: storybookTheme.spacing.xxl,
    maxWidth: storybookTheme.layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: { alignItems: 'center', paddingVertical: storybookTheme.spacing.xxl, gap: storybookTheme.spacing.ms },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.bold,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  errorText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});
