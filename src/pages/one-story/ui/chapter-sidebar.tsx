import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { sceneId } from '@/entities/story-runtime';
import { Icon, Modal, ModalBody, storybookTheme } from '@/shared/ui';
import { usePresenceAnimation } from '@/shared/ui/motion';

import type { OneStoryRuntime } from '../model';
import { splitQuestionOutcomesAtScene } from '../lib/runtime-view';
import { styles } from './styles';

/** styles.chapterSidebar/chapterScrim의 transitionDuration과 같은 값 - mount/unmount 타이밍을 맞춘다. */
export const CHAPTER_SIDEBAR_SLIDE_MS = 220;
/** 열릴 때 현재 회차가 리스트 맨 위에 딱 붙지 않고 앞 회차 하나가 살짝 보이도록 남기는 여백. */
const CURRENT_ROW_SCROLL_MARGIN = 64;

type RewindTarget = {
  id: string;
  index: number;
  title: string;
  discardedCount: number;
};

/**
 * 왼쪽에서 슬라이드 인/아웃하는 챕터 목록 - AppNavShell의 오른쪽 사이드바 토글과 같은 방식
 * (position:fixed + translateX 트랜지션)을 왼쪽에 거울로 적용한 것.
 *
 * - 이미 지난 회차는 눌러서 "진짜 되감기"할 수 있고, 현재 회차는 눌러서 처음부터 다시 듣는다.
 *   아직 안 지난 회차는 보이기만 하고 비활성화한다 - "다시 듣거나 돌아가거나"이지 건너뛰기가
 *   아니라서(건너뛰기는 상단 "다음 장면" 버튼이 담당).
 * - 되감으면 그 장면 이후의 질문 기록이 사라진다(runtime.jumpToScene 참고). 사라질 기록이
 *   하나라도 있으면 확인 모달을 먼저 띄우고, 없으면(아직 질문을 안 했거나 전부 더 앞 장면의
 *   기록이면) 곧바로 되감는다 - 아이가 실수로 눌러 리포트 내용을 날리는 일은 막되, 잃을 게
 *   없을 때까지 매번 묻지는 않는다.
 * - mount/unmount는 usePresenceAnimation(모달과 같은 훅)으로 슬라이드 시간과 맞춘다. 닫힌
 *   뒤엔 DOM에서 아예 빠지므로 aria-hidden/tabIndex를 따로 관리할 필요가 없다(예전엔 화면 밖에
 *   숨겨둔 채 남아 있어 키보드 Tab이 보이지 않는 버튼들에 들어갔다).
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
  const {
    scenes,
    sceneIndex,
    totalScenes,
    runtimeState,
    storyPackage,
    questionOutcomes,
    jumpToScene,
  } = runtime;
  const { mounted, entered } = usePresenceAnimation(open, CHAPTER_SIDEBAR_SLIDE_MS);
  // target은 모달이 닫히는 애니메이션 동안에도 제목/본문을 유지해야 해서 confirmOpen과 분리한다.
  const [target, setTarget] = useState<RewindTarget | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const currentRowY = useRef(0);

  const close = useCallback(() => {
    setConfirmOpen(false);
    onClose();
  }, [onClose]);

  // Escape: 확인 모달이 떠 있으면 모달만, 아니면 사이드바를 닫는다(웹 오버레이 관례).
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (confirmOpen) {
        setConfirmOpen(false);
      } else {
        close();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, confirmOpen, close]);

  // 열리면 현재 회차가 보이는 위치로 스크롤 - 회차가 많거나(또는 폰 가로 모드처럼 높이가 낮아)
  // 리스트가 스크롤되는 경우, 사용자가 찾는 건 거의 항상 "지금 어디쯤인지"라서.
  useEffect(() => {
    if (!entered) return;
    scrollRef.current?.scrollTo({
      y: Math.max(0, currentRowY.current - CURRENT_ROW_SCROLL_MARGIN),
      animated: false,
    });
  }, [entered]);

  const rememberCurrentRow = useCallback((event: LayoutChangeEvent) => {
    currentRowY.current = event.nativeEvent.layout.y;
  }, []);

  const requestRewind = useCallback(
    (chapter: { id: string; title: string }, index: number) => {
      const { discarded } = splitQuestionOutcomesAtScene(
        questionOutcomes,
        storyPackage.manifest,
        sceneId(chapter.id),
      );
      if (discarded.length === 0) {
        void jumpToScene(sceneId(chapter.id));
        close();
        return;
      }
      setTarget({ id: chapter.id, index, title: chapter.title, discardedCount: discarded.length });
      setConfirmOpen(true);
    },
    [close, jumpToScene, questionOutcomes, storyPackage.manifest],
  );

  const confirmRewind = useCallback(() => {
    if (!target) return;
    void jumpToScene(sceneId(target.id));
    close();
  }, [close, jumpToScene, target]);

  if (runtimeState.status === 'idle') return null;

  const isComplete = runtimeState.status === 'complete';
  const storyTitle = storyPackage.manifest.title;

  // 확인 모달은 mounted 가드 바깥에 둔다 - "다시 듣기"를 누르면 사이드바는 220ms 뒤에
  // 언마운트되는데, 모달이 그 안에 있으면 모달 자신의 퇴장 애니메이션(500ms)이 중간에 잘린다.
  return (
    <>
      {mounted && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="챕터 목록 닫기"
            onPress={close}
            style={[styles.chapterScrim, !entered && styles.chapterScrimHidden]}
          />
          <View
            style={[styles.chapterSidebar, !entered && styles.chapterSidebarClosed]}
            accessibilityViewIsModal
            {...({ role: 'dialog', 'aria-modal': true, 'aria-label': '챕터 목록' } as any)}
          >
            <View style={styles.chapterHeader}>
              <View style={styles.chapterHeaderCopy}>
                <Text style={styles.chapterHeaderTitle} accessibilityRole="header">
                  챕터
                </Text>
                <Text style={styles.chapterHeaderMeta} numberOfLines={1}>
                  {storyTitle} · {Math.min(sceneIndex + 1, totalScenes)} / {totalScenes}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="챕터 목록 닫기"
                hitSlop={8}
                onPress={close}
                style={({ pressed }) => [
                  styles.chapterHeaderClose,
                  pressed && styles.chapterRowPressed,
                ]}
              >
                <Icon name="close" size={18} color={storybookTheme.color.onDark} />
              </Pressable>
            </View>
            <ScrollView
              ref={scrollRef}
              style={styles.chapterList}
              contentContainerStyle={styles.chapterListContent}
              showsVerticalScrollIndicator={false}
            >
              {scenes.map((chapter, index) => {
                const isCurrent = index === sceneIndex;
                const isPast = index < sceneIndex;
                const isReached = isPast || isCurrent;
                const stateLabel = isCurrent
                  ? isComplete
                    ? ', 마지막 회차, 눌러서 처음부터 다시 듣기'
                    : ', 지금 듣는 중, 눌러서 처음부터 다시 듣기'
                  : isPast
                    ? ', 지난 회차, 눌러서 다시 듣기'
                    : ', 아직 안 지난 회차';
                return (
                  <Pressable
                    key={chapter.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${index + 1}화 ${chapter.title}${stateLabel}`}
                    accessibilityState={{ selected: isCurrent, disabled: !isReached }}
                    disabled={!isReached}
                    onLayout={isCurrent ? rememberCurrentRow : undefined}
                    onPress={() => requestRewind(chapter, index)}
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
                    <View style={styles.chapterRowCopy}>
                      <Text
                        style={[
                          styles.chapterRowTitle,
                          isCurrent && styles.chapterRowTitleActive,
                        ]}
                        numberOfLines={2}
                      >
                        {chapter.title}
                      </Text>
                      {isCurrent && (
                        <Text style={styles.chapterRowCaption}>
                          {isComplete
                            ? '눌러서 처음부터 다시 듣기'
                            : '지금 듣는 중 · 눌러서 처음부터'}
                        </Text>
                      )}
                    </View>
                    {isCurrent ? (
                      <Icon name="play" size={12} color={storybookTheme.color.gold} />
                    ) : isPast ? (
                      <Icon name="check" size={14} color={storybookTheme.color.onDarkMuted} />
                    ) : (
                      <Icon name="lock" size={13} color={storybookTheme.color.onDarkMuted} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.chapterFooter}>
              <Text style={styles.chapterFooterText}>
                지난 회차를 누르면 그 장면부터 다시 들어요. 아직 안 간 회차는 이야기를
                따라가면 열려요.
              </Text>
            </View>
          </View>
        </>
      )}

      <Modal
        visible={confirmOpen}
        eyebrow="되감기"
        title={target ? `${target.index + 1}화부터 다시 들을까요?` : undefined}
        positiveAction={{ label: '다시 듣기', onPress: confirmRewind }}
        negativeAction={{ label: '그냥 계속 듣기', onPress: () => setConfirmOpen(false) }}
        accessibilityLabel="되감기 확인"
      >
        {target && (
          <ModalBody>
            「{target.title}」부터 다시 들어요. 그 장면과 그 뒤에서 한 질문{' '}
            {target.discardedCount}개의 기록은 사라지고, 다시 들으면서 새로 쌓여요.
          </ModalBody>
        )}
      </Modal>
    </>
  );
}
