import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, Icon, LoadingState, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import {
  createClass,
  dashboardNavItems,
  listClasses,
  ORGANIZATION_PATHS,
  useDirectorSession,
  type ClassResponse,
} from '@/entities/auth';
import { listOrganizationTutors, type OrganizationTutorLink } from '@/entities/organization-tutor';
import { createHomeroomInvite } from '@/entities/homeroom-invite';
import { messageForError } from '@/shared/api';
import { archivedOnLabel } from '@/entities/class-lifecycle';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; classes: ClassResponse[] }
  | { status: 'error'; message: string };

/**
 * 관리자의 "반/학생 관리" 화면 - 반 생성(반 이름만) + 반 목록. 반을 만들면 담임 초대를 바로 만들어 반 상세로
 * 보낸다 - 거기서 보호자용 반 초대와 선생님용 담임 초대를 함께 보낸다. 이미 소속된 선생님을 담임으로 정하는 일도
 * 반 상세에서 한다.
 */
export function OrganizationClassesPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [name, setName] = useState('');
  const [tutors, setTutors] = useState<OrganizationTutorLink[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pastOpen, setPastOpen] = useState(false);

  const token = director?.token ?? null;
  const organizationId = director?.organizationId ?? null;

  useEffect(() => {
    if (!token || !organizationId) return;
    let cancelled = false;
    // 지난 반도 함께 받아 아래 "지난 반" 접이식 칸에 따로 보여 준다.
    listClasses(token, organizationId, { includeArchived: true })
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
        // 선생님 목록은 반 목록의 담임 이름에만 쓴다 - 못 불러와도 반은 만들 수 있다.
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
      const created = await createClass(token, organizationId, { name: name.trim() });
      // 담임 초대를 바로 만들어 둔다 - 실패해도 반은 만들어졌으니 반 상세의 "담임 초대 만들기"로 다시 만들면 된다.
      await createHomeroomInvite(token, created.id).catch(() => undefined);
      setName('');
      setReloadKey((n) => n + 1);
      // 만든 반의 반 초대·담임 초대를 바로 볼 수 있게 반 상세로 보낸다.
      navigate(ORGANIZATION_PATHS.classDetail(created.id));
    } catch (failure) {
      setFormError(messageForError(failure, '반을 만들지 못했어요. 반 이름을 확인해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, organizationId, name, navigate]);

  const tutorNameById = new Map(tutors.map((link) => [link.tutorId, link.tutorDisplayName]));
  const activeClasses = load.status === 'ready' ? load.classes.filter((classGroup) => !classGroup.archivedAt) : [];
  const pastClasses =
    load.status === 'ready'
      ? load.classes
          .filter((classGroup) => Boolean(classGroup.archivedAt))
          .sort((a, b) => Date.parse(b.archivedAt ?? '') - Date.parse(a.archivedAt ?? ''))
      : [];

  if (!director) return null;

  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={() => navigate('/organization')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">반/학생 관리</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>새 반 만들기</Text>
          <TextField label="반 이름" value={name} onChangeText={setName} />
          <Text style={styles.body}>
            반을 만들면 보호자용 반 초대와 선생님용 담임 초대가 함께 생겨요. 담임 선생님이 초대 링크로 가입하면 바로 이 반 담임으로 연결돼요.
          </Text>
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
          ) : activeClasses.length === 0 ? (
            <Text style={styles.body}>
              {pastClasses.length > 0 ? '지금 쓰는 반이 없어요. 위 폼으로 새 반을 만들어 보세요.' : '아직 등록된 반이 없어요. 위 폼으로 첫 반을 만들어 보세요.'}
            </Text>
          ) : (
            activeClasses.map((classGroup) => (
              <Pressable
                key={classGroup.id}
                accessibilityRole="link"
                accessibilityLabel={`${classGroup.name} 반 상세 열기`}
                onPress={() => navigate(ORGANIZATION_PATHS.classDetail(classGroup.id))}
                style={({ pressed }) => [styles.classRow, pressed && styles.classRowPressed]}
              >
                <View style={styles.classBody}>
                  <Text style={styles.className}>{classGroup.name}</Text>
                  <Text style={styles.classMeta}>
                    {classGroup.tutorId ? `담임 ${tutorNameById.get(classGroup.tutorId) ?? '배정됨'}` : '담임 초대 대기'} · 반 코드 {classGroup.joinCode}
                  </Text>
                </View>
                <Icon name="chevronRight" size={16} color={storybookTheme.color.onCardMuted} />
              </Pressable>
            ))
          )}
        </View>

        {pastClasses.length > 0 ? (
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: pastOpen }}
              accessibilityLabel={`지난 반 ${pastClasses.length}개 ${pastOpen ? '접기' : '펼치기'}`}
              onPress={() => setPastOpen((open) => !open)}
              style={({ pressed }) => [styles.pastToggle, pressed && styles.classRowPressed]}
            >
              <View style={styles.classBody}>
                <Text style={styles.sectionTitle}>지난 반 {pastClasses.length}개</Text>
                <Text style={styles.classMeta}>보관한 반이에요. 기록과 리포트는 그대로 볼 수 있어요.</Text>
              </View>
              <View style={pastOpen ? styles.flipped : undefined}>
                <Icon name="chevronDown" size={16} color={storybookTheme.color.onCardMuted} />
              </View>
            </Pressable>
            {pastOpen
              ? pastClasses.map((classGroup) => (
                  <Pressable
                    key={classGroup.id}
                    accessibilityRole="link"
                    accessibilityLabel={`지난 반 ${classGroup.name} 상세 열기`}
                    onPress={() => navigate(ORGANIZATION_PATHS.classDetail(classGroup.id))}
                    style={({ pressed }) => [styles.classRow, pressed && styles.classRowPressed]}
                  >
                    <View style={styles.classBody}>
                      <Text style={styles.className}>{classGroup.name}</Text>
                      <Text style={styles.classMeta}>
                        {archivedOnLabel(classGroup.archivedAt)}
                        {classGroup.tutorId ? ` · 담임 ${tutorNameById.get(classGroup.tutorId) ?? '배정됨'}` : ''}
                      </Text>
                    </View>
                    <Icon name="chevronRight" size={16} color={storybookTheme.color.onCardMuted} />
                  </Pressable>
                ))
              : null}
          </View>
        ) : null}
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
  pastToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 44 },
  flipped: { transform: [{ rotate: '180deg' }] },
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
