import { useEffect, useRef, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { storybookTheme } from '@/shared/ui';

import type { UseDialogue } from '../model/use-dialogue';

/**
 * Q-31 그레텔 대화 패널. 삽화를 가리지 않도록 화면 아래에만 붙는다 - 아이 말하기·그레텔 답·도움·
 * 행동 확인이 모두 이 패널 하나에서 이어진다. 버튼 묶음은 dialogue.phase 하나로 정해지고,
 * 어느 단계에서든 "이야기 계속"으로 이야기에 돌아갈 수 있다(패널이 막혀 못 돌아가는 일이 없게).
 */
export function DialoguePanel({ dialogue, hidden = false }: { dialogue: UseDialogue; hidden?: boolean }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const { open, turns, phase, character } = dialogue;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [turns.length, phase]);

  if (!open || hidden) return null;

  const continueStory = () => void dialogue.close('CONTINUE');

  return (
    <View style={panel.root} accessibilityLabel={`${character.displayName}와 이야기하기`}>
      <View style={panel.header}>
        <View style={panel.avatarFrame}>
          <Image
            source={{ uri: character.avatarImageUri }}
            style={{
              position: 'absolute',
              width: character.avatarRenderSize.width * AVATAR_SCALE,
              height: character.avatarRenderSize.height * AVATAR_SCALE,
              left: character.avatarOffset.left * AVATAR_SCALE,
              top: character.avatarOffset.top * AVATAR_SCALE,
            }}
            accessibilityLabel={`${character.displayName} 얼굴`}
          />
        </View>
        <Text style={panel.name}>{character.displayName}</Text>
        <View style={panel.headerSpacer} />
        {/* 버튼 줄에 '이야기 계속'이 없는 단계에서도 언제든 이야기로 돌아갈 수 있게 머리에 둔다. */}
        {PHASES_WITHOUT_CONTINUE_CHIP.has(phase) && (
          <Pressable accessibilityRole="button" onPress={continueStory} hitSlop={10}>
            <Text style={panel.continueLink}>이야기 계속 ›</Text>
          </Pressable>
        )}
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={panel.history} contentContainerStyle={panel.historyContent}>
        {turns.map((turn) => (
          <View
            key={turn.id}
            style={[panel.bubble, turn.role === 'CHILD' ? panel.childBubble : panel.characterBubble]}
          >
            <Text style={panel.bubbleText}>{turn.text}</Text>
          </View>
        ))}
        {(phase === 'thinking' || phase === 'transcribing') && (
          <View style={[panel.bubble, phase === 'thinking' ? panel.characterBubble : panel.childBubble]}>
            <ActivityIndicator size="small" color={storybookTheme.color.onCardMuted} />
          </View>
        )}
      </ScrollView>

      {dialogue.errorMessage && phase === 'error' && (
        <Text style={panel.error}>{dialogue.errorMessage}</Text>
      )}

      <PhaseControls dialogue={dialogue} onContinue={continueStory} />
    </View>
  );
}

function PhaseControls({ dialogue, onContinue }: { dialogue: UseDialogue; onContinue: () => void }) {
  const { phase } = dialogue;

  if (phase === 'recording') {
    return (
      <View style={panel.controls}>
        <View style={panel.meterTrack}>
          <View style={[panel.meterFill, { width: `${dialogue.meterPercent}%` }]} />
        </View>
        <Chip primary label="다 말했어" onPress={dialogue.stopTalking} />
        <Chip label="그만" onPress={dialogue.cancelInput} />
      </View>
    );
  }

  if (phase === 'confirm') {
    return (
      <View style={panel.column}>
        <Text style={panel.confirmText}>“{dialogue.draft}”</Text>
        <View style={panel.controls}>
          <Chip primary label="응, 이렇게 말했어" onPress={dialogue.confirmTranscript} />
          <Chip label="다시 말하기" onPress={() => void dialogue.startTalking()} />
          <Chip label="고쳐 쓰기" onPress={dialogue.startTyping} />
        </View>
      </View>
    );
  }

  if (phase === 'typing') {
    return (
      <View style={panel.column}>
        <TextInput
          value={dialogue.draft}
          onChangeText={dialogue.setDraft}
          placeholder="그레텔에게 하고 싶은 말"
          placeholderTextColor={storybookTheme.color.onCardMuted}
          accessibilityLabel="그레텔에게 할 말을 써 주세요"
          maxLength={160}
          autoFocus
          returnKeyType="send"
          onSubmitEditing={dialogue.sendTyped}
          style={panel.input}
        />
        <View style={panel.controls}>
          <Chip primary label="보내기" disabled={!dialogue.draft.trim()} onPress={dialogue.sendTyped} />
          <Chip label="말로 할래" onPress={() => void dialogue.startTalking()} />
          <Chip label="취소" onPress={dialogue.cancelInput} />
        </View>
      </View>
    );
  }

  if (phase === 'transcribing' || phase === 'thinking') {
    return (
      <View style={panel.controls}>
        <Text style={panel.status}>
          {phase === 'transcribing' ? '무슨 말인지 듣는 중…' : '그레텔이 생각하는 중…'}
        </Text>
        <Chip label="이야기 계속" onPress={onContinue} />
      </View>
    );
  }

  if (phase === 'proposal') {
    return (
      <View style={panel.column}>
        {dialogue.proposalLabel && <Text style={panel.status}>{dialogue.proposalLabel}</Text>}
        <View style={panel.controls}>
          <Chip primary label="그렇게 해보기" onPress={dialogue.acceptProposal} />
          <Chip label="더 이야기하기" onPress={dialogue.keepTalking} />
        </View>
      </View>
    );
  }

  if (phase === 'suggest-return') {
    return (
      <View style={panel.controls}>
        <Chip primary label="이야기로 돌아가기" onPress={onContinue} />
        <Chip label="더 이야기하기" onPress={dialogue.keepTalking} />
      </View>
    );
  }

  if (phase === 'offer-help') {
    return (
      <View style={panel.controls}>
        <Chip primary label="응, 도와줘" onPress={() => void dialogue.askHelp()} />
        <Chip label="말하기" onPress={() => void dialogue.startTalking()} />
        <Chip label="이야기 계속" onPress={onContinue} />
      </View>
    );
  }

  // ready · speaking · error - 아이 차례. 그레텔이 말하는 중에 말하기를 누르면 음성을 끊고 듣는다.
  return (
    <View style={panel.column}>
      {phase === 'ready' && dialogue.suggestions.length > 0 && (
        <View style={panel.controls}>
          {dialogue.suggestions.map((suggestion) => (
            <Chip
              key={suggestion.familyId}
              label={suggestion.label}
              onPress={() => dialogue.chooseSuggestion(suggestion.familyId, suggestion.label)}
            />
          ))}
        </View>
      )}
      <View style={panel.controls}>
        <Chip primary label={phase === 'error' ? '● 다시 말하기' : '● 말하기'} onPress={() => void dialogue.startTalking()} />
        <Chip label="글로 쓰기" onPress={dialogue.startTyping} />
        {dialogue.canAskHelp && <Chip label="도와줘" onPress={() => void dialogue.askHelp()} />}
        <Chip label="이야기 계속" onPress={onContinue} />
      </View>
    </View>
  );
}

function Chip({
  label,
  onPress,
  primary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        panel.chip,
        primary && panel.chipPrimary,
        disabled && panel.chipDisabled,
        pressed && panel.chipPressed,
      ]}
    >
      <Text style={[panel.chipText, primary && panel.chipTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

const AVATAR_SCALE = 36 / 64;

const PHASES_WITHOUT_CONTINUE_CHIP = new Set<UseDialogue['phase']>([
  'recording',
  'confirm',
  'typing',
  'proposal',
]);

/** 숲 그림 위에 얹는 어두운 패널 - 말풍선만 밝게 둬서 글이 그림과 섞이지 않게 한다. */
const PANEL_BACKGROUND = 'rgba(18, 20, 12, 0.9)';
const CHILD_BUBBLE = '#E7EAD8';

const panel = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '44%',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
    backgroundColor: PANEL_BACKGROUND,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatarFrame: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: storybookTheme.color.storybookCard,
  },
  name: { color: storybookTheme.color.onDark, fontSize: 15, fontWeight: '700' },
  headerSpacer: { flex: 1 },
  continueLink: { color: storybookTheme.color.onDarkMuted, fontSize: 14, fontWeight: '600' },
  history: { flexGrow: 0, flexShrink: 1 },
  historyContent: { gap: 8, paddingBottom: 2 },
  bubble: { maxWidth: '86%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  characterBubble: {
    alignSelf: 'flex-start',
    backgroundColor: storybookTheme.color.storybookCard,
    borderBottomLeftRadius: 4,
  },
  childBubble: { alignSelf: 'flex-end', backgroundColor: CHILD_BUBBLE, borderBottomRightRadius: 4 },
  bubbleText: { color: storybookTheme.color.onCardTitle, fontSize: 16, lineHeight: 23 },
  error: { color: storybookTheme.color.gold, fontSize: 14 },
  column: { gap: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  status: { color: storybookTheme.color.onDarkMuted, fontSize: 14, flexGrow: 1 },
  confirmText: { color: storybookTheme.color.onDark, fontSize: 16, lineHeight: 23 },
  input: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: storybookTheme.color.storybookCard,
    color: storybookTheme.color.onCardTitle,
    fontSize: 16,
  },
  meterTrack: {
    flexGrow: 1,
    minWidth: 80,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    overflow: 'hidden',
  },
  meterFill: { height: 8, backgroundColor: storybookTheme.color.gold },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 253, 246, 0.16)',
  },
  chipPrimary: { backgroundColor: storybookTheme.color.gold },
  chipDisabled: { opacity: 0.5 },
  chipPressed: { opacity: 0.8 },
  chipText: { color: storybookTheme.color.onDark, fontSize: 15, fontWeight: '600' },
  chipTextPrimary: { color: storybookTheme.color.onCardTitle },
});
