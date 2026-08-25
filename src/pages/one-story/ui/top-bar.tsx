import { Image, Pressable, Text, View } from 'react-native';

import { Icon } from '@/shared/ui';

import type { OneStoryRuntime } from '../model';
import type { UseCompanionChat } from '../model/use-companion-chat';
import { styles } from './styles';

const TOP_ICON_COLOR = '#F6C64D';

export function TopBar({
  runtime,
  chat,
}: {
  runtime: OneStoryRuntime;
  chat: UseCompanionChat;
}) {
  const {
    isWide,
    isCompactPlayback,
    isParentReport,
    runtimeState,
    scene,
    parentReport,
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
            {isParentReport ? '오늘의 질문 기록' : parentReport.storyTitle}
          </Text>
          {runtimeState.status !== 'idle' && !isParentReport && scene?.title && (
            <Text style={styles.chapterTitle} numberOfLines={1}>
              {displayedSceneIndex + 1}화 · {scene.title}
            </Text>
          )}
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
            <Icon name="home" size={16} color={TOP_ICON_COLOR} />
            {isWide && <Text style={styles.topControlText}>홈</Text>}
          </Pressable>
        )}
        {runtimeState.status !== 'idle' && !isParentReport && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${chat.character.displayName}에게 물어보기`}
            style={styles.topControlButton}
            onPress={() => {
              // 스토리 내레이션이 계속되는 동안 캐릭터와 대화하면 아이의 주의를 두고
              // 경쟁하게 되므로 - 먼저 일시정지한다(단, 실제로 재생 중일 때만; 이미
              // 일시정지된 상태에서 토글하면 오히려 재생이 재개되어 버리기 때문).
              if (!narrationState.isPaused) {
                void toggleNarration();
              }
              chat.setOpen(true);
            }}
          >
            <Icon name="chat" size={16} color={TOP_ICON_COLOR} />
            {isWide && (
              <Text style={styles.topControlText}>
                {chat.character.displayName}에게 물어보기
              </Text>
            )}
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
              <Icon
                name={narrationState.isPaused ? 'play' : 'pause'}
                size={15}
                color={TOP_ICON_COLOR}
              />
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
              <Icon name="replay" size={15} color={TOP_ICON_COLOR} />
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
              <Icon name="next" size={15} color={TOP_ICON_COLOR} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={captionVisible ? '자막 숨기기' : '자막 보기'}
              style={styles.topControlButton}
              onPress={() => setCaptionVisible((visible) => !visible)}
            >
              <Icon
                name="captions"
                size={15}
                color={captionVisible ? TOP_ICON_COLOR : 'rgba(255,255,255,0.55)'}
              />
              {isWide && (
                <Text style={styles.topControlText}>
                  {captionVisible ? '자막 끄기' : '자막 켜기'}
                </Text>
              )}
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
