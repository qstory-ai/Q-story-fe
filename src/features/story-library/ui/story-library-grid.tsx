import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { SectionHeader, StoryCard, storybookTheme } from '@/shared/ui';
import { useAuth, type AuthState } from '@/entities/auth';
import {
  DEFAULT_BETA_STORY_ID,
  StoryApiError,
  listStories,
  unlockStateFor,
  type StoryCatalogEntry,
} from '@/entities/story';

type LoadState = { status: 'loading' } | { status: 'ready'; stories: StoryCatalogEntry[] } | { status: 'error' };

function subtitleFor(auth: AuthState): string {
  if (auth.status === 'authenticated' && auth.user.grantsAccess) {
    return '모든 이야기가 열려 있어요.';
  }
  if (auth.status === 'authenticated') {
    return '구독하면 서재의 모든 이야기를 볼 수 있어요. 지금은 무료 데모 한 편을 먼저 만나보세요.';
  }
  return '무료 데모 한 편을 지금 바로 만나보세요. 로그인하면 서재가 더 넓어져요.';
}

/**
 * 홈("/")과 부모 홈("/parent")이 함께 쓰는 책장 그리드 - listStories()로 카탈로그를 가져와
 * unlockStateFor()로 카드마다 잠금 상태를 계산한다. 잠긴 카드도 눌리긴 하지만(비활성화하지
 * 않는다) 어디로 보낼지는 여기서 auth 상태를 보고 정한다: 비로그인이면 로그인 화면으로,
 * 로그인은 했지만 아직 결제 전이면 구독 안내가 있을 마이페이지로 - 실제 결제 플로우는 아직
 * 없어서(SubscriptionStatus.java 주석 참고) 지금은 그 임시 목적지가 최선이다.
 */
export function StoryLibraryGrid() {
  const navigate = useNavigate();
  const { state: auth } = useAuth();
  const { width } = useWindowDimensions();
  const columns = width >= 860 ? 3 : width >= 520 ? 2 : 1;
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((stories) => {
        if (!cancelled) setLoad({ status: 'ready', stories });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        // 카탈로그 실패는 서재 전체를 막을 이유가 아니다 - 조용히 빈 상태로 접는다.
        setLoad({ status: 'error' });
        if (import.meta.env?.DEV) {
          const message = error instanceof StoryApiError ? error.message : String(error);
          console.warn('[StoryLibraryGrid] listStories failed:', message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // auth가 아직 'loading'이면 언락 여부를 확정할 수 없다 - 전부 잠긴 것처럼 그렸다가 한 박자
  // 뒤에 열리는 깜빡임을 피하려고, 카드 자체를 아직 그리지 않는다.
  if (load.status === 'loading' || auth.status === 'loading') {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator color={storybookTheme.color.gold} />
      </View>
    );
  }

  if (load.status === 'error' || load.stories.length === 0) {
    return null;
  }

  const goToLocked = () => {
    navigate(auth.status === 'authenticated' ? '/mypage' : '/login');
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="우리 서재" subtitle={subtitleFor(auth)} />
      <View style={styles.grid}>
        {load.stories.map((story) => {
          const unlock = unlockStateFor(story, auth);
          const locked = unlock === 'locked';
          return (
            <View key={story.storyId} style={[styles.cardSlot, { width: `${100 / columns}%` }]}>
              <StoryCard
                title={story.title}
                coverImageUrl={story.coverImageUrl}
                description={story.description}
                category={story.category}
                locked={locked}
                lockedCaption={
                  locked ? (auth.status === 'authenticated' ? '구독하고 잠금 해제' : '로그인하고 잠금 해제') : undefined
                }
                onPress={() => {
                  if (locked) {
                    goToLocked();
                    return;
                  }
                  if (story.storyId === DEFAULT_BETA_STORY_ID) {
                    navigate('/demo');
                    return;
                  }
                  navigate(`/stories/${story.storyId}`);
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    gap: 16,
  },
  centerBox: {
    width: '100%',
    paddingVertical: 32,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cardSlot: {
    padding: 8,
  },
});
