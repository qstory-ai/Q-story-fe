import { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { SafeAreaView } from '@/shared/ui';
import type { StoryRuntimePackage } from '@/entities/story';
import { CompletionSurveyModal } from '@/features/completion-survey-modal';

import { useDialogue, useOneStoryRuntime } from '../model';
import { ChapterSidebar } from './chapter-sidebar';
import { DialoguePanel } from './dialogue-panel';
import { HomeMenuModal } from './modals/home-menu-modal';
import { ResumeModal } from './modals/resume-modal';
import { PlaybackDock } from './playback-dock';
import { ReaderCard } from './reader-card/reader-card';
import { SceneProgressBar } from './scene-progress-bar';
import { styles } from './styles';
import { TopBar } from './top-bar';

export function OneStoryPage({
  storyPackage,
  tutorStudentId,
  lessonId,
  entry,
}: {
  storyPackage: StoryRuntimePackage;
  /** 선생님이 자신이 등록한 학생과 진행하는 세션일 때만 넘긴다(StoryPlayerRoute 참고). */
  tutorStudentId?: string;
  /** 수업 상세에서 시작한 세션이면 그 수업 id - 완주 기록이 수업과 참여 학생 전원에 연결된다. */
  lessonId?: string;
  /** 홈에서 바로 들어온 재생(Q-36) - use-one-story-runtime의 entry 참고. */
  entry?: 'resume' | 'start';
}) {
  // conversationId는 회차 하나 = 하나. runtime의 완주 저장·대화 기록과 chat의 대화 요청이 같은 id를
  // 공유해야 서버가 companion_chat_turn 태그와 대화 줄을 story_completion에 붙일 수 있다. 처음 값만 여기서
  // 만들고, 처음부터 다시 읽기·이어서 읽기로 바뀌는 지금 회차 id는 runtime.sessionId가 갖는다(Q-39).
  const [companionConversationId] = useState(() => crypto.randomUUID());
  const runtime = useOneStoryRuntime(storyPackage, tutorStudentId, companionConversationId, lessonId, entry);
  const {
    isWide,
    isShort,
    isNarrow,
    isPlaybackDockState,
    showPlaybackDock,
    isParentReport,
    scene,
    illustration,
  } = runtime;
  const dialogue = useDialogue({
    runtime,
    conversationId: runtime.sessionId,
    tutorStudentId,
    lessonId,
  });
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const closeChapters = useCallback(() => setChaptersOpen(false), []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.app}>
        <Image
          source={illustration}
          resizeMode="cover"
          style={[
            StyleSheet.absoluteFill,
            isParentReport && styles.reportHiddenIllustration,
          ]}
          accessibilityLabel={`${scene?.title ?? runtime.storyPackage.manifest.title} 삽화`}
        />
        <View
          style={[
            styles.imageShade,
            isParentReport && styles.reportPageBackground,
          ]}
        />

        {/* onOpenChapters를 항상 넘겨도 된다 - TopBar 자신이 이미 같은 조건(idle 아님 && 리포트
            아님)으로 다른 버튼들과 함께 보임/숨김을 판단한다. */}
        <TopBar runtime={runtime} dialogue={dialogue} onOpenChapters={() => setChaptersOpen(true)} />
        <SceneProgressBar runtime={runtime} />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWide && styles.scrollContentWide,
            isShort && styles.scrollContentShort,
            isPlaybackDockState && styles.scrollContentPlayback,
            isNarrow && !isParentReport && styles.scrollContentNarrow,
            showPlaybackDock && styles.scrollContentNarrowPlayback,
            !isPlaybackDockState && styles.scrollContentCentered,
            isShort && !isPlaybackDockState && styles.scrollContentShortCentered,
            isParentReport && styles.reportScrollContent,
            isParentReport && isWide && styles.reportScrollContentWide,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isPlaybackDockState && (
            <View
              style={[
                styles.spacer,
                styles.playbackSpacer,
                isNarrow && styles.playbackSpacerCompact,
              ]}
            />
          )}
          {!dialogue.open && <ReaderCard runtime={runtime} />}
        </ScrollView>

        {!dialogue.open && <PlaybackDock runtime={runtime} />}
        <DialoguePanel dialogue={dialogue} hidden={runtime.homeMenuVisible || chaptersOpen} />

        <ChapterSidebar
          runtime={runtime}
          open={chaptersOpen}
          onClose={closeChapters}
        />

        <ResumeModal runtime={runtime} />
        <HomeMenuModal runtime={runtime} />
        <CompletionSurveyModal
          visible={runtime.completionSurveyVisible}
          storyId={storyPackage.storyId}
          onClose={runtime.closeCompletionSurvey}
        />
      </View>
    </SafeAreaView>
  );
}
