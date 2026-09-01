import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { StoryLibraryGrid } from '@/features/story-library';

/**
 * 선생님용 서재 탭("/tutor/library") - 부모용 LibraryPage와 컨셉은 같지만 상단 세그먼트를
 * 생략했다. 선생님은 "읽는 중/저장한 작품" 개념이 아직 없고(수업 단위로 관리) 대신 곧
 * 각 학생에게 "이 이야기를 다음 수업에 사용" 액션이 붙어야 하지만, 그 흐름은 다음 세션.
 * 지금은 카탈로그 그리드 자체만 노출.
 */
export function TutorLibraryPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'library')}>
      <View style={styles.scroll}>
        <Text style={styles.title} accessibilityRole="header">서재</Text>
        <Text style={styles.body}>
          다음 수업에 어떤 이야기를 쓸지 미리 살펴볼 수 있어요.
        </Text>
        <StoryLibraryGrid />
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onDarkMuted,
  },
});
