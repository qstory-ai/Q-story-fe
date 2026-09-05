import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, TextField, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import {
  listMyOrganizations,
  type TutorOrganizationLink,
} from '@/entities/organization-tutor';
import { messageForError } from '@/shared/api';

type OrgsLoad = { status: 'loading' } | { status: 'ready'; organizations: TutorOrganizationLink[] } | { status: 'error'; message: string };

/**
 * IA "선생님 온보딩 > 소속 설정 > 기관 연결(고유 코드)" + 이미 활동 중인 선생님이 나중에 기관에
 * 합류하는 경우를 모두 커버하는 코드 입력 화면. 코드를 확인하면 /org-invite/code/:code로 이동해
 * OrgInviteAcceptPage가 미리보기 + 수락을 처리한다.
 */
export function TutorJoinOrganizationPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [codeInput, setCodeInput] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<OrgsLoad>({ status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    listMyOrganizations(state.token)
      .then((organizations) => {
        if (!cancelled) setOrgs({ status: 'ready', organizations });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setOrgs({
          status: 'error',
          message: messageForError(failure, '소속 기관을 불러오지 못했어요. 네트워크 상태를 확인해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state]);

  function goToCode() {
    setCodeError(null);
    const normalized = codeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,16}$/.test(normalized)) {
      setCodeError('영문·숫자 4-16자리 코드를 입력해 주세요.');
      return;
    }
    navigate(`/org-invite/code/${encodeURIComponent(normalized)}`);
  }

  function goToLink() {
    setInviteError(null);
    const token = extractOrgInviteToken(inviteInput);
    if (!token) {
      setInviteError('초대 링크 또는 토큰을 확인해 주세요.');
      return;
    }
    navigate(`/org-invite/${encodeURIComponent(token)}`);
  }

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">기관 소속 참여</Text>
        <Text style={styles.subtitle}>
          기관 관리자에게 받은 초대 코드나 링크로 소속을 완성해요.
        </Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>초대 코드로 참여</Text>
          <TextField
            label="초대 코드"
            value={codeInput}
            onChangeText={(value) => {
              setCodeInput(value);
              if (codeError) setCodeError(null);
            }}
            placeholder="예: 42QRKM3P"
            autoCapitalize="characters"
            errorText={codeError ?? undefined}
          />
          <ActionButton label="코드로 확인하기" onPress={goToCode} disabled={codeInput.trim().length === 0} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>초대 링크로 참여</Text>
          <TextField
            label="초대 링크 또는 토큰"
            value={inviteInput}
            onChangeText={(value) => {
              setInviteInput(value);
              if (inviteError) setInviteError(null);
            }}
            placeholder="https://... 또는 토큰 문자열"
            errorText={inviteError ?? undefined}
          />
          <ActionButton
            label="링크로 확인하기"
            variant="secondaryFull"
            onPress={goToLink}
            disabled={inviteInput.trim().length === 0}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>지금 소속된 기관</Text>
          {orgs.status === 'loading' ? (
            <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.primary} /></View>
          ) : orgs.status === 'error' ? (
            <Text style={[styles.body, styles.errorText]}>{orgs.message}</Text>
          ) : orgs.organizations.length === 0 ? (
            <Text style={styles.body}>아직 소속된 기관이 없어요. 위의 코드/링크로 참여해 보세요.</Text>
          ) : (
            <View style={styles.list}>
              {orgs.organizations.map((organization) => (
                <View key={organization.id} style={styles.orgRow}>
                  <Text style={styles.orgName}>{organization.organizationName}</Text>
                  <Text style={styles.orgMeta}>합류: {formatDate(organization.joinedAt)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </AppNavShell>
  );
}

/** MyPageClassesPage.extractInviteToken과 같은 규약(경로 마지막 세그먼트를 뽑음), 다른 라우트 이름을 위한 사본. */
function extractOrgInviteToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, 'https://placeholder.local');
    const match = url.pathname.match(/\/org-invite\/([^/?#]+)/);
    if (match) return decodeURIComponent(match[1]);
  } catch {
    // URL 파싱 실패 - 아래 fallback으로.
  }
  const pathMatch = trimmed.match(/org-invite\/([^/?#\s]+)/);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  if (!/\s/.test(trimmed)) return trimmed;
  return null;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 16,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  subtitle: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
  centerBox: { alignItems: 'center', paddingVertical: 12 },
  list: { gap: 8 },
  orgRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
    gap: 2,
  },
  orgName: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  orgMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  errorText: { color: storybookTheme.color.error },
});
