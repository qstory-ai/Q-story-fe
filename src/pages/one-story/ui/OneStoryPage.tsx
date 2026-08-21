import { Image, ScrollView, StyleSheet, View } from 'react-native';

import { SafeAreaView } from '@/shared/ui';

import { useOneStoryRuntime } from '../model';
import { HomeMenuModal } from './modals/home-menu-modal';
import { ResumeModal } from './modals/resume-modal';
import { ReaderCard } from './reader-card/reader-card';
import { SceneProgressBar } from './scene-progress-bar';
import { styles } from './styles';
import { TopBar } from './top-bar';

export function OneStoryPage() {
  const runtime = useOneStoryRuntime();
  const {
    isWide,
    isShort,
    isCompactPlayback,
    isPlaybackDockState,
    isParentReport,
    scene,
    illustration,
  } = runtime;

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

        <TopBar runtime={runtime} />
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
      </View>
    </SafeAreaView>
  );
}
