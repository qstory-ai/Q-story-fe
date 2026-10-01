import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, Icon, LoadingState, RadioGroup, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  createClass,
  dashboardNavItems,
  listClasses,
  useDirectorSession,
  type ClassResponse,
} from '@/entities/auth';
import { listOrganizationTutors, type OrganizationTutorLink } from '@/entities/organization-tutor';
import { messageForError } from '@/shared/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; classes: ClassResponse[] }
  | { status: 'error'; message: string };

const NO_HOMEROOM = '';

/**
 * 원장의 "반/학생 관리" 화면 - 반 생성(담임 선생님 선택) + 반 목록. 반 카드를 누르면 반 상세에서
 * 담임 배정과 학생 명단을 본다.
 */
export function OrganizationClassesPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [homeroomTutorId, setHomeroomTutorId] = useState(NO_HOMEROOM);
  const [tutors, setTutors] = useState<OrganizationTutorLink[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const token = director?.token ?? null;
  const organizationId = director?.organizationId ?? null;

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    listClasses(token, organizationId)
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
  }, [token, organizationId, reloadKey]);

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    listOrganizationTutors(token, organizationId)
      .then((links) => {
        if (!cancelled) setTutors(links);
      })
      .catch(() => {
        // 선생님 목록을 못 불러와도 담임 미정으로 반을 만들 수 있다.
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  const onCreate = useCallback(async () => {
    if (!token || !organizationId) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await createClass(token, organizationId, {
        name: name.trim(),
        homeroomTutorId: homeroomTutorId || undefined,
      });
      setName('');
      setHomeroomTutorId(NO_HOMEROOM);
      setReloadKey((n) => n + 1);
    } catch (failure) {
      setFormError(messageForError(failure, '반을 만들지 못했어요. 반 이름을 확인해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, organizationId, name, homeroomTutorId]);

  const tutorNameById = new Map(tutors.map((link) => [link.tutorId, link.tutorDisplayName]));

  if (!director) return null;

  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">반/학생 관리</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>새 반 만들기</Text>
          <TextField label="반 이름" value={name} onChangeText={setName} />
          <Text style={styles.fieldLabel}>담임 선생님</Text>
          <RadioGroup
            accessibilityLabel="담임 선생님"
            value={homeroomTutorId}
            onChange={setHomeroomTutorId}
            options={[
              { value: NO_HOMEROOM, label: '담임 미정', description: '나중에 반 상세에서 배정해요. 그때까지 들어온 학생은 담임이 정해지면 그 선생님의 학생이 돼요.' },
              ...tutors.map((link) => ({ value: link.tutorId, label: link.tutorDisplayName })),
            ]}
          />
          {tutors.length === 0 ? (
            <Text style={styles.body}>기관에 소속된 선생님이 아직 없어요. 선생님 메뉴에서 초대할 수 있어요.</Text>
          ) : null}
          {formError ? <StatusBanner variant="warning" label={formError} /> : null}
          <ActionButton
            label={submitting ? '만드는 중…' : '반 만들기'}
            loading={submitting}
            onPress={onCreate}
            disabled={!name.trim() || submitting}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>등록된 반</Text>
          {load.status === 'loading' ? (
            <LoadingState compact label="반 목록을 불러오는 중이에요…" />
          ) : load.status === 'error' ? (
            <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
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
                  <Text style={styles.classMeta}>
                    담임 {classGroup.tutorId ? (tutorNameById.get(classGroup.tutorId) ?? '배정됨') : '미정'} · 반 코드 {classGroup.joinCode}
                  </Text>
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
  fieldLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
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
