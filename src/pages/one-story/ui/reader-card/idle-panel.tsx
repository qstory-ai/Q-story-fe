import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { useRecordingConsent } from '@/entities/analytics';
import { useAuth } from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { hasKoreanBatchim } from '@/entities/narration';
import { ChildPickerModal } from '@/features/child-selector';
import { ActionButton, storybookTheme } from '@/shared/ui';

import type { OneStoryRuntime } from '../../model';
import { IDLE_HEADLINE, idleSubtitleFor } from '../../lib/reading-context';
import { styles } from '../styles';
import { RecordingConsentCard } from './recording-consent-card';

/** 시작 버튼 아래 안내 - 긴 문단 대신 짧은 줄 셋(뜻은 그대로). "자세히"에서 전체 문구·설정으로 간다. */
const PRIVACY_LINES = [
  '목소리는 글로 바꿔 한 번 확인한 뒤 보내요.',
  '확인한 질문 글은 이름·연락처를 가리고 1년 보관해요.',
  '화면 이용 기록도 1년 보관하고 끌 수 있어요. 화면 녹화는 허용한 경우만 해요.',
];
const PRIVACY_DETAIL =
  '목소리는 문장으로 바뀐 뒤 한 번 확인하고 질문으로 전송돼요. 확인한 질문 문장은 이름·연락처를 가리고 서비스 개선을 위해 1년 보관해요. 화면 이용 기록(누른 곳·스크롤)도 1년 보관하고 설정에서 끌 수 있어요. 화면 녹화는 허용한 경우에만 해요.';

export function IdlePanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    childNameInput,
    setChildNameInput,
    selectedChildName,
    startStory,
    isClassLesson,
    readingContext,
  } = runtime;
  const { needsPrompt } = useRecordingConsent();
  const { state: authState } = useAuth();
  const { children } = useChildren();
  const navigate = useNavigate();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [privacyExpanded, setPrivacyExpanded] = useState(false);

  if (runtimeState.status !== 'idle') {
    return null;
  }

  // 아이가 둘 이상인 보호자만 여기서 바꿀 수 있다(전역 선택 아이를 바꾸므로 홈·리포트도 같은 아이로 맞춰진다).
  const canChangeChild = Boolean(selectedChildName) && children.length >= 2;
  const openPrivacyDetail = () => {
    if (authState.status === 'authenticated') {
      navigate('/mypage/settings');
      return;
    }
    setPrivacyExpanded((expanded) => !expanded);
  };

  return (
    <View style={styles.contentGroup}>
      <Text style={styles.heroTitle}>{IDLE_HEADLINE}</Text>
      <Text style={styles.introBody}>{idleSubtitleFor(readingContext)}</Text>
      {isClassLesson ? null : selectedChildName ? (
        // 홈에서 이미 아이를 고르고 들어온 경로 - 방금 고른 이름을 여기서 또 타이핑하게 하지
        // 않는다. 누구와 읽는지 보여 주고, 아이가 여럿이면 여기서 바꿀 수 있게 한다.
        <View style={styles.nameKnownRow}>
          <Text style={styles.nameKnownText}>
            {selectedChildName}{hasKoreanBatchim(selectedChildName) ? '이' : ''}와 읽어요
          </Text>
          {canChangeChild ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="함께 읽을 아이 바꾸기"
              hitSlop={8}
              onPress={() => setPickerOpen(true)}
            >
              <Text style={styles.nameChangeLink}>바꾸기</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.nameField}>
          <Text style={styles.nameLabel}>아이 이름 (선택)</Text>
          <TextInput
            value={childNameInput}
            onChangeText={(value) =>
              setChildNameInput(value.replace(/\s{2,}/g, ' ').slice(0, 10))
            }
            placeholder="예: 하윤"
            placeholderTextColor={storybookTheme.color.onLightMuted}
            maxLength={10}
            autoCorrect={false}
            returnKeyType="done"
            style={styles.nameInput}
            onSubmitEditing={startStory}
            accessibilityLabel="아이 이름 (선택)"
          />
          <Text style={styles.nameHint}>
            이어서 읽기에 이 이름으로 표시돼요. 비워 둬도 괜찮아요.
          </Text>
        </View>
      )}
      {/* 반 수업은 선생님이 수업을 시작할 때 정한다 - 여기서 묻지 않는다. */}
      {needsPrompt && !isClassLesson ? <RecordingConsentCard /> : null}
      <ActionButton variant="primary" label="이야기 시작하기" onPress={startStory} />
      <View style={styles.parentHintList}>
        {privacyExpanded ? (
          <Text style={styles.parentHint}>{PRIVACY_DETAIL}</Text>
        ) : (
          PRIVACY_LINES.map((line) => (
            <Text key={line} style={styles.parentHint}>
              {line}
            </Text>
          ))
        )}
        <Pressable accessibilityRole="link" hitSlop={8} onPress={openPrivacyDetail}>
          <Text style={styles.parentHintLink}>
            {authState.status === 'authenticated' ? '자세히 · 설정' : privacyExpanded ? '간단히' : '자세히'}
          </Text>
        </Pressable>
      </View>
      {canChangeChild ? (
        <ChildPickerModal
          visible={pickerOpen}
          subtitle="이 이야기를 어떤 아이와 함께 읽을까요?"
          onClose={() => setPickerOpen(false)}
          onSelected={(child) => {
            setChildNameInput(child.name.slice(0, 10));
            setPickerOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
