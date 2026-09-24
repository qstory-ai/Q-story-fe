import { useCallback, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { SafeAreaView } from '@/shared/ui';
import type { StoryRuntimePackage } from '@/entities/story';
import { CompletionSurveyModal } from '@/features/completion-survey-modal';

import { useCompanionChat, useOneStoryRuntime } from '../model';
import { ChapterSidebar } from './chapter-sidebar';
import { CompanionChatModal } from './modals/companion-chat-modal';
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
}: {
  storyPackage: StoryRuntimePackage;
  /** 선생님이 자신이 등록한 학생과 진행하는 세션일 때만 넘긴다(StoryPlayerRoute 참고). */
  tutorStudentId?: string;
  /** 수업 상세에서 시작한 세션이면 그 수업 id - 완주 기록이 수업과 참여 학생 전원에 연결된다. */
  lessonId?: string;
}) {
  // conversationId는 세션 하나 = 하나. runtime의 완주 저장과 chat의 대화 요청이 같은 id를
  // 공유해야 서버가 companion_chat_turn 태그를 story_completion에 스냅샷으로 붙일 수 있다.
  const companionConversationIdRef = useRef<string>(crypto.randomUUID());
  const runtime = useOneStoryRuntime(storyPackage, tutorStudentId, companionConversationIdRef.current, lessonId);
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
  const chat = useCompanionChat({
    storyId: storyPackage.storyId,
    sceneId: scene?.id ?? null,
    conversationId: companionConversationIdRef.current,
    childId: runtime.conversationAttribution.childId,
    tutorStudentId,
    lessonId,
  });
  const [chaptersOpen, setChaptersOpen] = useState(false);
  // 사이드바의 Escape 리스너·되감기 핸들러가 이 콜백에 의존한다 - 렌더마다 새 함수를 주면 리스너가
  // 매 렌더(재생 진행률 갱신마다) 떼었다 붙었다 한다.
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
          accessibilityLabel={`${scene?.title ?? '헨젤과 그레텔'} 삽화`}
        />
        <View
          style={[
            styles.imageShade,
            isParentReport && styles.reportPageBackground,
          ]}
        />

        {/* onOpenChapters를 항상 넘겨도 된다 - TopBar 자신이 이미 같은 조건(idle 아님 && 리포트
            아님)으로 다른 버튼들과 함께 보임/숨김을 판단한다. */}
        <TopBar runtime={runtime} chat={chat} onOpenChapters={() => setChaptersOpen(true)} />
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
          <ReaderCard runtime={runtime} />
        </ScrollView>

        <PlaybackDock runtime={runtime} />

        <ChapterSidebar
          runtime={runtime}
          open={chaptersOpen}
          onClose={closeChapters}
        />

        <ResumeModal runtime={runtime} />
        <HomeMenuModal runtime={runtime} />
        <CompanionChatModal chat={chat} homeMenuOpen={runtime.homeMenuVisible} />
        <CompletionSurveyModal
          visible={runtime.completionSurveyVisible}
          storyId={storyPackage.storyId}
          onClose={runtime.closeCompletionSurvey}
        />
      </View>
    </SafeAreaView>
  );
}
