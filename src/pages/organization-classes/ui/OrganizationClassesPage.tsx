import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Icon, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  createClass,
  dashboardNavItems,
  listClasses,
  useAuth,
  type ClassResponse,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; classes: ClassResponse[] }
  | { status: 'error'; message: string };

/**
 * IA "기관 관리자 > 반/학생 관리" 화면. 반 생성 폼 + 반 목록. 각 반 카드 탭 → 반 상세로 이동해
 * 반 코드/초대/부모 목록을 관리한다. 이전엔 OrganizationSignupPage의 인라인 섹션이었는데,
 * 대시보드 리팩터에 맞춰 여기로 옮겼다.
 */
export function OrganizationClassesPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR' && Boolean(state.user.organizationId);
  const organizationId = state.status === 'authenticated' ? state.user.organizationId : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !organizationId) return;
    let cancelled = false;
    listClasses(state.token, organizationId)
      .then((classes) => {
        if (!cancelled) setLoad({ status: 'ready', classes });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: messageForError(failure, '반 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, organizationId, reloadKey]);

  const onCreate = useCallback(async () => {
    if (state.status !== 'authenticated' || !organizationId) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await createClass(state.token, organizationId, { name: name.trim(), initialPassword });
      setName('');
      setInitialPassword('');
      setReloadKey((n) => n + 1);
    } catch (failure) {
      setFormError(messageForError(failure, '반을 만들지 못했어요. 반 이름과 초기 비밀번호를 확인해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [state, organizationId, name, initialPassword]);

  if (!canView) return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">반/학생 관리</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>새 반 만들기</Text>
          <TextField label="반 이름" value={name} onChangeText={setName} />
          <TextField
            label="반 계정 초기 비밀번호"
            value={initialPassword}
            onChangeText={setInitialPassword}
            secureTextEntry
          />
          {formError ? <StatusBanner variant="warning" label={formError} /> : null}
          <ActionButton
            label={submitting ? '만드는 중…' : '반 만들기'}
            loading={submitting}
            onPress={onCreate}
            disabled={!name.trim() || !initialPassword || submitting}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>등록된 반</Text>
          {load.status === 'loading' ? (
            <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.primary} /></View>
          ) : load.status === 'error' ? (
            <Text style={styles.errorText}>{load.message}</Text>
          ) : load.classes.length === 0 ? (
            <Text style={styles.body}>아직 등록된 반이 없어요. 위 폼으로 첫 반을 만들어 보세요.</Text>
          ) : (
            load.classes.map((classGroup) => (
              <Pressable
                key={classGroup.id}
                accessibilityRole="link"
                accessibilityLabel={`${classGroup.name} 반 상세 열기`}
                onPress={() => navigate(`/organization/classes/${classGroup.id}`)}
                style={({ pressed }) => [styles.classRow, pressed && styles.classRowPressed]}
              >
                <View style={styles.classBody}>
                  <Text style={styles.className}>{classGroup.name}</Text>
                  <Text style={styles.classMeta}>반 코드: {classGroup.joinCode}</Text>
                </View>
                <Icon name="chevronRight" size={16} color={storybookTheme.color.onCardMuted} />
              </Pressable>
            ))
          )}
        </View>
      </View>
    </AppNavShell>
  );
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
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
  },
  centerBox: { alignItems: 'center', paddingVertical: 12 },
  errorText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
  },
  classRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
    gap: 10,
  },
  classRowPressed: { opacity: 0.85 },
  classBody: { flex: 1, gap: 2 },
  className: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  classMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
});
