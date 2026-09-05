import { useCallback } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from 'react-native';

import { ActionButton, Modal, ModalBody, storybookTheme } from '@/shared/ui';

import type { UseCompanionChat } from '../../model/use-companion-chat';
import { formatDuration } from '../../lib/runtime-view';
import { styles } from '../styles';

/**
 * 스토리 캐릭터와의, 앵커에 종속되지 않는 자유 채팅 - 앵커로 트리거되는 질문 흐름과 달리
 * 스토리를 절대 일시정지하거나 분기시키지 않는다. TopBar에서 열리며, runtimeState와
 * 무관하게 독립적으로 닫힌다(use-companion-chat.ts 자체의 open/close 상태 참고).
 *
 * homeMenuOpen이 true인 동안은 open이어도 표시하지 않는다 - Solid 2.0의 "팝업 위에 또 다른
 * 팝업을 쓰지 않는다" 규칙을 지키기 위한 방어용 가드 (지금은 홈 메뉴의 전체 화면 스크림이
 * TopBar를 가려 우연히 안 겹치지만, 명시적으로 보장해 둔다).
 */
export function CompanionChatModal({
  chat,
  homeMenuOpen = false,
}: {
  chat: UseCompanionChat;
  homeMenuOpen?: boolean;
}) {
  const {
    open,
    close,
    character,
    turns,
    draft,
    setDraft,
    send,
    sending,
    recorder,
    voiceError,
    transcribing,
    startVoiceInput,
    stopVoiceInput,
  } = chat;

  const onSend = useCallback(() => {
    void send(draft);
  }, [draft, send]);

  const meterPercent = Math.max(
    8,
    Math.min(100, ((recorder.meteringDb ?? -60) + 60) / 48 * 100),
  );

  return (
    <Modal
      visible={open && !homeMenuOpen}
      eyebrow="이야기 밖에서 살짝"
      title="궁금한 걸 편하게 물어보세요"
      linkAction={{ label: '이야기로 돌아가기', onPress: close }}
      accessibilityLabel={`${character.displayName}에게 물어보기`}
    >
      <View style={styles.companionChatProfileRow}>
        <View style={styles.companionChatAvatarFrame}>
          <Image
            source={{ uri: character.avatarImageUri }}
            style={[
              styles.companionChatAvatarImage,
              {
                width: character.avatarRenderSize.width,
                height: character.avatarRenderSize.height,
                left: character.avatarOffset.left,
                top: character.avatarOffset.top,
              },
            ]}
            accessibilityLabel={`${character.displayName} 얼굴`}
          />
        </View>
        <Text style={styles.companionChatProfileName}>{character.displayName}</Text>
      </View>
      <ModalBody>여기서 나누는 이야기는 오늘의 줄거리를 바꾸지 않아요.</ModalBody>

      {turns.length > 0 && (
        <ScrollView style={styles.companionChatHistory}>
          {turns.map((turn) => (
            <View key={turn.id} style={styles.companionChatTurn}>
              {turn.childText && (
                <Text style={styles.companionChatChildText}>{turn.childText}</Text>
              )}
              {turn.status === 'sending' && (
                <ActivityIndicator color={storybookTheme.color.gold} style={styles.companionChatSpinner} />
              )}
              {turn.status === 'done' && turn.replyText && (
                <Text style={styles.companionChatReplyText}>{turn.replyText}</Text>
              )}
              {turn.status === 'error' && (
                <Text style={styles.companionChatErrorText}>
                  {turn.errorMessage ?? '지금은 대답을 준비하지 못했어요.'}
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {recorder.isRecording ? (
        <View style={styles.contentGroup}>
          <Text style={styles.recordingTitle}>목소리를 듣고 있어요</Text>
          <Text style={styles.recordingTime}>
            {formatDuration(recorder.durationMillis)}
          </Text>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${meterPercent}%` }]} />
          </View>
          <ActionButton
            variant="stop"
            label="말 다 했어요 · 문장 확인하기"
            onPress={() => void stopVoiceInput()}
          />
        </View>
      ) : (
        <>
          <TextInput
            value={draft}
            onChangeText={(value) => setDraft(value.slice(0, 160))}
            placeholder="예: 마녀는 왜 사탕으로 집을 만들었을까?"
            placeholderTextColor={storybookTheme.color.onLightMuted}
            accessibilityLabel="궁금한 것을 입력해 주세요"
            maxLength={160}
            multiline
            returnKeyType="send"
            onSubmitEditing={onSend}
            style={styles.typedQuestionInput}
          />
          {transcribing && (
            <ActivityIndicator color={storybookTheme.color.gold} style={styles.companionChatSpinner} />
          )}
          {voiceError && (
            <Text style={styles.companionChatErrorText}>{voiceError}</Text>
          )}
          <ActionButton
            variant="record"
            label="말로 물어보기"
            disabled={transcribing}
            onPress={() => void startVoiceInput()}
          />
          <ActionButton
            variant="primary"
            label="이야기 걸기"
            loading={sending}
            disabled={!draft.trim()}
            onPress={onSend}
          />
        </>
      )}
    </Modal>
  );
}
