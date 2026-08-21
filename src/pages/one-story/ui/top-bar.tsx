import { Image, Pressable, Text, View } from 'react-native';

import type { OneStoryRuntime } from '../model';
import { styles } from './styles';

export function TopBar({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isWide,
    isCompactPlayback,
    isParentReport,
    runtimeState,
    displayedSceneIndex,
    totalScenes,
    isPlaybackDockState,
    currentClip,
    isBranchPlaybackState,
    narrationState,
    captionVisible,
    setCaptionVisible,
    openHomeMenu,
    toggleNarration,
    replayCurrent,
    skipCurrentScene,
    closeParentReport,
  } = runtime;

  return (
    <View
      style={[
        styles.topBar,
        isCompactPlayback && styles.topBarCompactPlayback,
        isParentReport && styles.reportTopBar,
      ]}
    >
      <View
        style={[
          styles.brandLockup,
          isCompactPlayback && styles.brandLockupCompactPlayback,
        ]}
      >
        <View
          style={[
            styles.brandLogoFrame,
            isParentReport && styles.reportBrandLogoFrame,
          ]}
        >
          <Image
            source={{ uri: '/brand/q-story-question-book-logo.svg' }}
            resizeMode="contain"
            style={styles.brandLogo}
            accessibilityLabel="Q-Story 로고"
          />
        </View>
        <View style={styles.brandTextLockup}>
          <Text style={styles.brand}>
            <Text style={styles.brandQ}>Q</Text>
            <Text style={isParentReport && styles.reportTopText}>
              -STORY
            </Text>
          </Text>
          <Text
            style={[
              styles.storyTitle,
              isParentReport && styles.reportStoryTitle,
            ]}
          >
            {isParentReport ? '우리 아이 사고흔적 리포트' : '헨젤과 그레텔'}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.topRight,
          isCompactPlayback && styles.topRightCompactPlayback,
        ]}
      >
        {runtimeState.status !== 'idle' && !isParentReport && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이야기 홈 메뉴"
            style={styles.topControlButton}
            onPress={openHomeMenu}
          >
            <Text style={styles.topControlIcon}>⌂</Text>
            {isWide && <Text style={styles.topControlText}>홈</Text>}
          </Pressable>
        )}
        {isCompactPlayback && (
          <View style={styles.progressPillCompact}>
            <Text style={styles.progressText}>
              {Math.min(displayedSceneIndex + 1, totalScenes)} /{' '}
              {totalScenes}
            </Text>
          </View>
        )}
        {isPlaybackDockState && (currentClip || isBranchPlaybackState) && (
          <View
            style={[
              styles.topPlaybackControls,
              isCompactPlayback && styles.topPlaybackControlsCompact,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                narrationState.isPaused ? '이어 듣기' : '일시정지'
              }
              style={[styles.topControlButton, styles.topControlButtonPrimary]}
              onPress={toggleNarration}
            >
              <Text style={styles.topControlIcon}>
                {narrationState.isPaused ? '▶' : 'Ⅱ'}
              </Text>
              {isWide && (
                <Text style={styles.topControlText}>
                  {narrationState.isPaused ? '이어 듣기' : '일시정지'}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isBranchPlaybackState
                  ? '선택한 전개 처음부터 다시 듣기'
                  : '현재 문장 다시 듣기'
              }
              style={styles.topControlButton}
              onPress={replayCurrent}
            >
              <Text style={styles.topControlIcon}>↺</Text>
              {isWide && (
                <Text style={styles.topControlText}>
                  {isBranchPlaybackState ? '선택 전개 다시' : '현재 문장 다시'}
                </Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="다음 장면"
              style={styles.topControlButton}
              onPress={skipCurrentScene}
            >
              {isWide && <Text style={styles.topControlText}>다음 장면</Text>}
              <Text style={styles.topControlIcon}>→</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={captionVisible ? '자막 숨기기' : '자막 보기'}
              style={styles.topControlButton}
              onPress={() => setCaptionVisible((visible) => !visible)}
            >
              <Text style={styles.topControlText}>
                {isWide ? (captionVisible ? '자막 끄기' : '자막 켜기') : '자'}
              </Text>
            </Pressable>
          </View>
        )}
        {isParentReport ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="완주 화면으로 돌아가기"
            style={styles.reportBackButton}
            onPress={closeParentReport}
          >
            <Text style={styles.reportBackButtonText}>← 완주로</Text>
          </Pressable>
        ) : !isCompactPlayback ? (
          <View style={styles.progressPill}>
            <Text style={styles.progressText}>
              {Math.min(displayedSceneIndex + 1, totalScenes)} /{' '}
              {totalScenes}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
