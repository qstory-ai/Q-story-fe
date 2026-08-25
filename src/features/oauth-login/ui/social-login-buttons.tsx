import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';
import {
  AuthApiError,
  googleOAuthConfigured,
  kakaoOAuthConfigured,
  oauthLogin,
  renderGoogleButton,
  requestKakaoAccessToken,
  type Role,
  type UserSummary,
} from '@/entities/auth';

type SocialLoginButtonsProps = {
  /** 처음 가입하는 경우에만 쓰인다 - 이미 role이 없는 로그인 화면(SignInStep/LoginPage)에서는 생략한다. */
  role?: Role;
  onAuthed: (token: string, user: UserSummary) => void;
  /** LoginPage처럼 밝은 배경 위에 놓일 때는 false - 구분선 색이 반대로 뒤집힌다. */
  onDark?: boolean;
};

/**
 * 이미 연결된 소셜 계정이면 로그인, role이 있고 처음 보는 계정이면 그 role로 가입한다
 * (AuthService.loginOrSignupWithOAuth와 동일한 규칙). role 없이 처음 보는 계정으로 로그인을
 * 시도하면 백엔드가 OAUTH_ROLE_REQUIRED로 거부하는데, 그 경우 "먼저 회원가입에서 역할을
 * 선택해 주세요"로 안내한다 - 로그인 화면에 처음 온 사람에게 자연스러운 다음 행동이다.
 *
 * 두 provider 모두 아직 설정 안 됐으면(client-id/JS 키 미발급) 아무것도 렌더링하지 않는다 -
 * 눌러도 실패하는 버튼을 보여주는 것보다 조용히 숨기는 편이 낫다.
 */
export function SocialLoginButtons({ role, onAuthed, onDark = true }: SocialLoginButtonsProps) {
  // react-native-web의 View ref 타입(ReactNativeElement)은 그대로 쓰기 번거롭고, 아래
  // effect에서 곧바로 HTMLElement로 캐스팅해 구글 SDK에 넘길 뿐이라 any로 충분하다.
  const googleContainerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [kakaoSubmitting, setKakaoSubmitting] = useState(false);

  const handleFailure = useCallback((failure: unknown) => {
    setError(
      failure instanceof AuthApiError
        ? failure.code === 'OAUTH_ROLE_REQUIRED'
          ? '아직 가입되지 않은 계정이에요. 역할을 선택해서 먼저 가입해 주세요.'
          : failure.message
        : '로그인하지 못했어요. 다시 시도해 주세요.',
    );
  }, []);

  useEffect(() => {
    if (!googleOAuthConfigured) return;
    // react-native-web의 View는 실제 DOM div로 렌더링되므로, ref를 그대로 HTMLElement로 써서
    // 구글 SDK가 자기 버튼을 그 안에 직접 그려 넣게 한다.
    const node = googleContainerRef.current as unknown as HTMLElement | null;
    if (!node) return;
    void renderGoogleButton(node, (idToken) => {
      setError(null);
      oauthLogin('GOOGLE', { token: idToken, role })
        .then((response) => onAuthed(response.token, response.user))
        .catch(handleFailure);
    });
  }, [role, onAuthed, handleFailure]);

  const onKakaoPress = useCallback(async () => {
    setError(null);
    setKakaoSubmitting(true);
    try {
      const accessToken = await requestKakaoAccessToken();
      const response = await oauthLogin('KAKAO', { token: accessToken, role });
      onAuthed(response.token, response.user);
    } catch (failure) {
      handleFailure(failure);
    } finally {
      setKakaoSubmitting(false);
    }
  }, [role, onAuthed, handleFailure]);

  if (!googleOAuthConfigured && !kakaoOAuthConfigured) {
    return null;
  }

  return (
    <View style={styles.group}>
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, onDark ? styles.dividerLineOnDark : styles.dividerLineOnLight]} />
        <Text style={[styles.dividerText, onDark ? styles.dividerTextOnDark : styles.dividerTextOnLight]}>또는</Text>
        <View style={[styles.dividerLine, onDark ? styles.dividerLineOnDark : styles.dividerLineOnLight]} />
      </View>
      {googleOAuthConfigured && <View ref={googleContainerRef} style={styles.googleContainer} />}
      {kakaoOAuthConfigured && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="카카오로 계속하기"
          style={[styles.kakaoButton, kakaoSubmitting && styles.kakaoButtonDisabled]}
          onPress={onKakaoPress}
          disabled={kakaoSubmitting}
        >
          <Text style={styles.kakaoButtonText}>{kakaoSubmitting ? '카카오 로그인 중…' : '카카오로 계속하기'}</Text>
        </Pressable>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 10, marginTop: 4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dividerLine: { flex: 1, height: 1 },
  dividerLineOnDark: { backgroundColor: storybookTheme.color.panelOnDarkBorder },
  dividerLineOnLight: { backgroundColor: storybookTheme.color.pillBorder },
  dividerText: { fontSize: storybookTheme.type.xs },
  dividerTextOnDark: { color: storybookTheme.color.onDarkMuted },
  dividerTextOnLight: { color: storybookTheme.color.onLightMuted },
  googleContainer: { alignItems: 'center', minHeight: 44 },
  kakaoButton: {
    minHeight: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE500',
  },
  kakaoButtonDisabled: { opacity: 0.6 },
  kakaoButtonText: { fontSize: storybookTheme.type.md, fontWeight: '700', color: '#191919' },
  errorText: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.error, textAlign: 'center' },
});
