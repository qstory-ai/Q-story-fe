import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { SafeAreaView } from '@/shared/ui';
import type { StoryRuntimePackage } from '@/entities/story';
import { CompletionSurveyModal } from '@/features/completion-survey-modal';

import { useCompanionChat, useOneStoryRuntime } from '../model';
import { CompanionChatModal } from './modals/companion-chat-modal';
import { HomeMenuModal } from './modals/home-menu-modal';
import { ResumeModal } from './modals/resume-modal';
import { ReaderCard } from './reader-card/reader-card';
import { SceneProgressBar } from './scene-progress-bar';
import { styles } from './styles';
import { TopBar } from './top-bar';

export function OneStoryPage({
  storyPackage,
  tutorStudentId,
}: {
  storyPackage: StoryRuntimePackage;
  /** 선생님이 자신이 등록한 학생과 진행하는 세션일 때만 넘긴다(StoryPlayerRoute 참고). */
  tutorStudentId?: string;
}) {
  const runtime = useOneStoryRuntime(storyPackage, tutorStudentId);
  const {
    isWide,
    isShort,
    isCompactPlayback,
    isPlaybackDockState,
    isParentReport,
    scene,
    illustration,
  } = runtime;
  const chat = useCompanionChat({
    storyId: storyPackage.storyId,
    sceneId: scene?.id ?? null,
  });

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

        <TopBar runtime={runtime} chat={chat} />
        <SceneProgressBar runtime={runtime} />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isWide && styles.scrollContentWide,
            isShort && styles.scrollContentShort,
            isPlaybackDockState && styles.scrollContentPlayback,
            isCompactPlayback && styles.scrollContentCompactPlayback,
            !isPlaybackDockState && styles.scrollContentCentered,
            isShort && !isPlaybackDockState && styles.scrollContentShortCentered,
            isParentReport && styles.reportScrollContent,
            isParentReport && isWide && styles.reportScrollContentWide,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isPlaybackDockState && (
            <View style={[styles.spacer, styles.playbackSpacer]} />
          )}
          <ReaderCard runtime={runtime} />
        </ScrollView>

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
