import { Pressable, ScrollView, Text, View } from 'react-native';

import { sceneId } from '@/entities/story-runtime';
import { Icon, storybookTheme } from '@/shared/ui';

import type { OneStoryRuntime } from '../model';
import { styles } from './styles';

/**
 * 왼쪽에서 슬라이드 인/아웃하는 챕터 목록 - AppNavShell의 오른쪽 사이드바 토글과 같은 방식
 * (position:fixed + translateX 트랜지션)을 왼쪽에 거울로 적용한 것. 이미 지난 회차만 눌러서
 * "진짜 되감기"할 수 있고(사용자 확인: 이후 질문/분기 기록은 초기화됨), 아직 안 지난 회차는
 * 보이기만 하고 비활성화한다 - "다시 듣거나 돌아가거나"이지 건너뛰기가 아니라서.
 */
export function ChapterSidebar({
  runtime,
  open,
  onClose,
}: {
  runtime: OneStoryRuntime;
  open: boolean;
  onClose: () => void;
}) {
  const { scenes, scene, sceneIndex, runtimeState, jumpToScene } = runtime;

  if (runtimeState.status === 'idle') return null;

  return (
    <>
      {open && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="챕터 목록 닫기"
          onPress={onClose}
          style={styles.chapterScrim}
        />
      )}
      <View
        style={[styles.chapterSidebar, !open && styles.chapterSidebarClosed]}
        {...({ 'aria-hidden': !open } as any)}
      >
        <View style={styles.chapterHeader}>
          <Text style={styles.chapterHeaderTitle}>챕터</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="챕터 목록 닫기"
            hitSlop={8}
            onPress={onClose}
            style={styles.chapterHeaderClose}
          >
            <Icon name="close" size={18} color={storybookTheme.color.onDark} />
          </Pressable>
        </View>
        <ScrollView
          style={styles.chapterList}
          contentContainerStyle={styles.chapterListContent}
          showsVerticalScrollIndicator={false}
        >
          {scenes.map((chapter, index) => {
            const isCurrent = scene?.id === chapter.id;
            const isReached = index <= sceneIndex;
            return (
              <Pressable
                key={chapter.id}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}화 ${chapter.title}${isCurrent ? ', 현재 재생 중' : !isReached ? ', 아직 안 지남' : ''}`}
                accessibilityState={{ selected: isCurrent, disabled: !isReached }}
                disabled={!isReached}
                onPress={() => {
                  if (!isCurrent) void jumpToScene(sceneId(chapter.id));
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.chapterRow,
                  isCurrent && styles.chapterRowActive,
                  !isReached && styles.chapterRowDisabled,
                  pressed && isReached && styles.chapterRowPressed,
                ]}
              >
                <View
                  style={[
                    styles.chapterRowIndex,
                    isCurrent && styles.chapterRowIndexActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chapterRowIndexText,
                      isCurrent && styles.chapterRowIndexTextActive,
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.chapterRowTitle,
                    isCurrent && styles.chapterRowTitleActive,
                    !isReached && styles.chapterRowTitleDisabled,
                  ]}
                  numberOfLines={2}
                >
                  {chapter.title}
                </Text>
                {isCurrent && (
                  <Icon name="play" size={12} color={storybookTheme.color.gold} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </>
  );
}
