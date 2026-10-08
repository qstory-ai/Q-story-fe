import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, RadioGroup, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useBackOr } from '@/shared/lib';
import { TUTOR_PATHS, dashboardNavItems, useAuth } from '@/entities/auth';
import { createTutorClass } from '@/entities/tutor';
import { listMyOrganizations, type TutorOrganizationLink } from '@/entities/organization-tutor';

const NO_ORGANIZATION = 'none';

/**
 * 반 만들기 - 학생을 미리 등록하지 않아도 된다. 반을 만들면 반 초대 링크가 생기고, 보호자가 링크로 들어와
 * 아이 프로필을 고르면 명단에 자동으로 올라간다. 소속 기관이 있으면 그 기관의 반으로 만들 수 있다.
 */
export function TutorClassGroupNewPage() {
  const navigate = useNavigate();
  const goBack = useBackOr(TUTOR_PATHS.classes);
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [name, setName] = useState('');
  const [organizations, setOrganizations] = useState<TutorOrganizationLink[]>([]);
  const [organizationId, setOrganizationId] = useState<string>(NO_ORGANIZATION);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listMyOrganizations(token)
      .then((items) => {
        if (cancelled) return;
        setOrganizations(items);
        // 소속 기관이 하나면 대개 그 유치원의 반이다 - 기본으로 골라 둔다.
        if (items.length === 1) setOrganizationId(items[0].organizationId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status !== 'authenticated') return null;

  async function submit() {
    if (!token || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createTutorClass(token, {
        name: name.trim(),
        organizationId: organizationId === NO_ORGANIZATION ? undefined : organizationId,
      });
      navigate(TUTOR_PATHS.classDetail(created.id), { replace: true });
    } catch (failure: unknown) {
      setError(messageForError(failure, '반을 만들지 못했어요.'));
      setSubmitting(false);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title} accessibilityRole="header">새 반 만들기</Text>
        <Text style={styles.body}>
          학생을 미리 등록하지 않아도 돼요. 반을 만들면 초대 링크가 생기고, 보호자가 링크로 들어와 아이를 고르면 명단에 자동으로 올라가요.
        </Text>
        <View style={styles.card}>
          <TextField label="반 이름" value={name} onChangeText={setName} placeholder="예: 햇님반" maxLength={60} />
          {organizations.length > 0 ? (
            <RadioGroup
              accessibilityLabel="어느 기관의 반인가요"
              value={organizationId}
              onChange={setOrganizationId}
              options={[
                ...organizations.map((org) => ({ value: org.organizationId, label: org.organizationName })),
                { value: NO_ORGANIZATION, label: '기관 없이 내 반으로' },
              ]}
            />
          ) : null}
          {error ? <StatusBanner variant="warning" label={error} /> : null}
          <ActionButton
            variant="gold"
            label={submitting ? '만드는 중…' : '반 만들고 초대 링크 받기'}
            onPress={() => {
              void submit();
            }}
            loading={submitting}
            disabled={!name.trim() || submitting}
          />
        </View>
      </ScrollView>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ms,
  },
});
