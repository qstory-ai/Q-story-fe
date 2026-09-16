import { Image, Pressable, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { Icon, storybookTheme } from '@/shared/ui';

import type { OneStoryRuntime } from '../model';
import type { UseCompanionChat } from '../model/use-companion-chat';
import { styles } from './styles';

const TOP_ICON_COLOR = storybookTheme.color.gold;
// topControlButton은 시각적으로 38px로 촘촘하게 배치돼 있어(기존 gap 6~9px 유지),
// 터치 영역만 WCAG 44px 권장치에 가깝게 넓힌다 - 인접 버튼과는 겹치지 않는 선에서.
const TOP_CONTROL_HIT_SLOP = { top: 4, bottom: 4, left: 3, right: 3 };

/**
 * 넓은 화면: [로고+제목+회차] … [챕터][홈][채팅] [재생 컨트롤 4개] [N / M]
 * 휴대폰(isNarrow): [작은 로고 + "N화 · 제목" 한 줄] … [챕터][홈][채팅] [N / M]
 *   - 재생 컨트롤은 PlaybackDock(하단)으로 옮겼다. 예전엔 폰에서도 이 바에 전부 욱여넣어
 *     아이콘 8개가 두 줄로 쌓였고, 질문 화면에선 브랜드 락업이 "Q-\nSTORY" / "헨젤과 그\n레텔"로
 *     줄바꿈돼 깨졌다.
 */
export function TopBar({
  runtime,
  chat,
  onOpenChapters,
}: {
  runtime: OneStoryRuntime;
  chat: UseCompanionChat;
  /** 챕터 사이드바 토글 - 없으면(예: 스토리를 아직 안 시작해 챕터 개념이 없는 idle 화면) 버튼을 숨긴다. */
  onOpenChapters?: () => void;
}) {
  const {
    isWide,
    isNarrow,
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
  const navigate = useNavigate();
  const inStory = runtimeState.status !== 'idle' && !isParentReport;
  const chapterCaption = inStory && scene?.title ? `${displayedSceneIndex + 1}화 · ${scene.title}` : null;
  const progressLabel = `${Math.min(displayedSceneIndex + 1, totalScenes)} / ${totalScenes}`;
  const compactLockup = isNarrow && !isParentReport;

  return (
    <View
      style={[
        styles.topBar,
        isNarrow && styles.topBarNarrow,
        isParentReport && styles.reportTopBar,
      ]}
    >
      <View style={styles.topBarRow}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Q-Story 처음으로"
        onPress={() => navigate('/')}
        style={[styles.brandLockup, compactLockup && styles.brandLockupNarrow]}
      >
        <View
          style={[
            styles.brandLogoFrame,
            compactLockup && styles.brandLogoFrameNarrow,
            isParentReport && styles.reportBrandLogoFrame,
          ]}
        >
          <Image
            source={{ uri: '/brand/q-story-question-book-logo.svg' }}
            resizeMode="contain"
            style={[styles.brandLogo, compactLockup && styles.brandLogoNarrow]}
            accessibilityLabel="Q-Story 로고"
          />
        </View>
        {compactLockup ? (
          // 폰에선 "Q-STORY" 워드마크를 빼고 회차 캡션 한 줄만 - 이 자리에서 실제로 필요한
          // 정보는 "지금 몇 화, 무슨 장면인지"뿐이고 브랜드는 로고로 충분하다.
          <Text style={styles.storyTitleNarrow} numberOfLines={1}>
            {chapterCaption ?? parentReport.storyTitle}
          </Text>
        ) : (
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
              numberOfLines={1}
            >
              {isParentReport ? '오늘의 질문 기록' : parentReport.storyTitle}
            </Text>
            {chapterCaption && (
              <Text style={styles.chapterTitle} numberOfLines={1}>
                {chapterCaption}
              </Text>
            )}
          </View>
        )}
      </Pressable>
      <View style={styles.topRight}>
        {inStory && onOpenChapters && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="챕터 목록 열기"
            style={styles.topControlButton}
            hitSlop={TOP_CONTROL_HIT_SLOP}
            onPress={onOpenChapters}
          >
            <Icon name="book" size={16} color={TOP_ICON_COLOR} />
            {isWide && <Text style={styles.topControlText}>챕터</Text>}
          </Pressable>
        )}
        {inStory && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이야기 홈 메뉴"
            style={styles.topControlButton}
            hitSlop={TOP_CONTROL_HIT_SLOP}
            onPress={openHomeMenu}
          >
            <Icon name="home" size={16} color={TOP_ICON_COLOR} />
            {isWide && <Text style={styles.topControlText}>홈</Text>}
          </Pressable>
        )}
        {inStory && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${chat.character.displayName}에게 물어보기`}
            style={styles.topControlButton}
            hitSlop={TOP_CONTROL_HIT_SLOP}
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
        {/* 재생 컨트롤 - 폰에선 PlaybackDock이 같은 네 버튼을 하단에 라벨과 함께 그린다. */}
        {!isNarrow && isPlaybackDockState && (currentClip || isBranchPlaybackState) && (
          <View style={styles.topPlaybackControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                narrationState.isPaused ? '이어 듣기' : '일시정지'
              }
              style={[styles.topControlButton, styles.topControlButtonPrimary]}
              hitSlop={TOP_CONTROL_HIT_SLOP}
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
              hitSlop={TOP_CONTROL_HIT_SLOP}
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
              hitSlop={TOP_CONTROL_HIT_SLOP}
              onPress={skipCurrentScene}
            >
              {isWide && <Text style={styles.topControlText}>다음 장면</Text>}
              <Icon name="next" size={15} color={TOP_ICON_COLOR} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={captionVisible ? '자막 숨기기' : '자막 보기'}
              style={styles.topControlButton}
              hitSlop={TOP_CONTROL_HIT_SLOP}
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
        ) : (
          <View
            style={[styles.progressPill, isNarrow && styles.progressPillNarrow]}
            accessibilityLabel={`${progressLabel} 회차`}
          >
            <Text style={styles.progressText}>{progressLabel}</Text>
          </View>
        )}
      </View>
      </View>
    </View>
  );
}
