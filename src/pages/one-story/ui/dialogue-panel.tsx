import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

import { countdownSeconds, createAutoConfirm } from '../lib/auto-confirm';
import { AUTO_CONFIRM_MS } from '../lib/constants';
import { punctuateChildQuestion } from '../lib/question-punctuation';
import { scaledText, useReaderTextScale } from '../lib/reader-text-scale';
import type { UseDialogue } from '../model/use-dialogue';
import { QuestionSpace, type QuestionMenuAction, type QuestionMicState } from './question-space';

/**
 * Q-31 그레텔 대화 패널. 삽화를 가리지 않도록 화면 아래에만 붙는다 - 아이 말하기·그레텔 답·도움·
 * 행동 확인이 모두 이 패널 하나에서 이어진다. 버튼 묶음은 dialogue.phase 하나로 정해지고,
 * 어느 단계에서든 "이야기 계속 듣기"로 이야기에 돌아갈 수 있다(패널이 막혀 못 돌아가는 일이 없게).
 */
export function DialoguePanel({
  dialogue,
  hidden = false,
  onHeightChange,
}: {
  dialogue: UseDialogue;
  hidden?: boolean;
  /** 예전 아래 패널이 그림 높이를 맞추던 값. 이제 화면 전체를 쓰므로 열릴 때 0을 알린다. */
  onHeightChange?: (height: number) => void;
}) {
  const { open, turns, phase, character } = dialogue;

  useEffect(() => {
    if (open && !hidden) onHeightChange?.(0);
  }, [hidden, onHeightChange, open]);

  if (!open || hidden) return null;

  const continueStory = () => void dialogue.close('CONTINUE');

  // 화면에는 마지막 그레텔 말과, 그 뒤에 아이가 한 말만 말풍선으로 보인다(피그마 질문 화면).
  const lastCharacterIndex = turns.map((turn) => turn.role).lastIndexOf('CHARACTER');
  const lastCharacter = lastCharacterIndex >= 0 ? turns[lastCharacterIndex] : null;
  const lastTurn = turns[turns.length - 1];
  const childAfter = lastTurn?.role === 'CHILD' && turns.length - 1 > lastCharacterIndex ? lastTurn.text : '';

  const recording = phase === 'recording';
  const busy = phase === 'thinking' || phase === 'transcribing';
  const childTurn = phase === 'ready' || phase === 'error' || phase === 'speaking';
  const mic: QuestionMicState = recording
    ? 'recording'
    : busy
      ? 'disabled'
      : childTurn && !(phase === 'speaking' && dialogue.proposalLabel)
        ? 'idle'
        : 'hidden';

  const childText = recording
    ? ''
    : phase === 'confirm'
      ? punctuateChildQuestion(dialogue.draft)
      : childAfter;
  const childPending = recording ? dialogue.livePartial || dialogue.listenPrompt : phase === 'transcribing' && !childText ? '…' : '';

  const menuActions: QuestionMenuAction[] = [
    { key: 'continue', label: '이야기 계속 듣기', onPress: continueStory },
    ...(childTurn || phase === 'offer-help' ? [{ key: 'type', label: '글로 쓰기', onPress: dialogue.startTyping }] : []),
    ...(dialogue.canAskHelp && childTurn ? [{ key: 'help', label: '도와줘', onPress: () => void dialogue.askHelp() }] : []),
  ];

  return (
    <QuestionSpace
      characterName={character.displayName}
      avatarUri={character.avatarImageUri}
      bubbleText={lastCharacter?.text ?? dialogue.listenPrompt}
      bubbleDim={phase === 'thinking'}
      onReplay={lastCharacter && (phase === 'ready' || phase === 'error') ? () => void dialogue.replayLastLine() : undefined}
      replayAccent={phase === 'ready'}
      childText={childText}
      childPending={childPending}
      childListening={recording}
      meterPercent={dialogue.meterPercent}
      thinking={phase === 'thinking'}
      mic={mic}
      onMicPress={() => void dialogue.startTalking()}
      onCancel={dialogue.cancelInput}
      onDone={dialogue.stopTalking}
      menuActions={menuActions}
    >
      {dialogue.errorMessage && (phase === 'error' || phase === 'typing') && (
        <View style={panel.errorRow} accessibilityRole="alert">
          <Icon name="alert" size={18} color={storybookTheme.color.error} />
          <Text style={panel.error}>{dialogue.errorMessage}</Text>
        </View>
      )}
      {!recording && !busy && <PhaseControls dialogue={dialogue} onContinue={continueStory} />}
    </QuestionSpace>
  );
}

function PhaseControls({ dialogue, onContinue }: { dialogue: UseDialogue; onContinue: () => void }) {
  const { phase } = dialogue;
  const textScale = useReaderTextScale();

  if (phase === 'confirm') {
    return <ConfirmControls dialogue={dialogue} />;
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
          style={[panel.input, scaledText(panel.input, textScale)]}
        />
        <View style={panel.controls}>
          <Chip primary label="보내기" disabled={!dialogue.draft.trim()} onPress={dialogue.sendTyped} />
          <Chip label="말로 할래" onPress={() => void dialogue.startTalking()} />
          <Chip label="취소" onPress={dialogue.cancelInput} />
        </View>
        {dialogue.canMarkGuardianProxy && (
          // 리포트에 "보호자가 대신 입력"으로 남긴다 - 아이 말과 구분해 관심 분석에서 빼기 위한 작은 표시.
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: dialogue.guardianProxy }}
            onPress={() => dialogue.setGuardianProxy(!dialogue.guardianProxy)}
            style={panel.proxyRow}
            hitSlop={8}
          >
            <View style={[panel.proxyBox, dialogue.guardianProxy && panel.proxyBoxChecked]}>
              {dialogue.guardianProxy && <Text style={panel.proxyCheck}>✓</Text>}
            </View>
            <Text style={panel.proxyLabel}>보호자가 대신 입력</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // 행동 확인 - 그레텔이 제안 답을 말하는 동안에도 카드를 먼저 보인다(답이 끝날 때까지 말하기 버튼이 먼저 떠서
  // 아이가 다른 말을 하던 문제, 10/19 QA).
  if (phase === 'proposal' || (phase === 'speaking' && dialogue.proposalLabel)) {
    return (
      <View style={panel.column}>
        {dialogue.proposalLabel && (
          <Text style={[panel.proposalText, scaledText(panel.proposalText, textScale)]}>
            이렇게 해 볼까? · {dialogue.proposalLabel}
          </Text>
        )}
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
        <Chip primary label="응, 도와줘" onPress={() => void dialogue.askHelp('응, 도와줘')} />
        <Chip label="말하기" onPress={() => void dialogue.startTalking()} />
      </View>
    );
  }

  // ready · speaking · error - 아이 차례. 말하기는 아래 큰 마이크가, 글로 쓰기·도와줘는 왼쪽 위 메뉴가 맡는다.
  // 예시는 마지막 도움 대사를 듣는 중에도 고를 수 있게 한다(아이는 다 듣기 전에 누르기도 한다).
  if ((phase === 'ready' || phase === 'speaking') && dialogue.suggestions.length > 0) {
    return (
      <View style={panel.controls}>
        {dialogue.suggestions.map((suggestion) => (
          <Chip
            key={suggestion.familyId}
            label={suggestion.label}
            onPress={() => dialogue.chooseSuggestion(suggestion.familyId, suggestion.label)}
          />
        ))}
      </View>
    );
  }
  return null;
}

/**
 * 받아 적은 말 확인(Q-34 결정 5) - 5초 카운트다운(남은 시간 막대) 뒤 저절로 보낸다. 아이가 확인 영역을 건드리면
 * (문장을 누르기, "다시 말하기"·"고쳐 쓰기") 자동 전송을 멈춘다 - 멈춘 뒤엔 "응, 이렇게 말했어"로만 보낸다.
 * 닫기·단계 변경이면 이 컴포넌트가 사라지며 카운트다운도 취소된다. 확인 버튼을 먼저 눌러도 한 번만 보낸다
 * (confirmTranscript 가드).
 */
function ConfirmControls({ dialogue }: { dialogue: UseDialogue }) {
  const confirmRef = useRef(dialogue.confirmTranscript);
  useEffect(() => {
    confirmRef.current = dialogue.confirmTranscript;
  }, [dialogue.confirmTranscript]);
  const { draft } = dialogue;
  const [remainingMs, setRemainingMs] = useState(AUTO_CONFIRM_MS);
  // 아이가 건드려 자동 전송을 멈춘 문장 - 다른 문장을 받아 적으면 다시 카운트다운한다.
  const [heldDraft, setHeldDraft] = useState<string | null>(null);
  const held = heldDraft === draft;
  const controllerRef = useRef<ReturnType<typeof createAutoConfirm> | null>(null);

  useEffect(() => {
    if (held) return undefined;
    const controller = createAutoConfirm(AUTO_CONFIRM_MS, () => {
      confirmRef.current();
    });
    controllerRef.current = controller;
    controller.start();
    const ticker = setInterval(() => {
      setRemainingMs(controller.remainingMs());
    }, 100);
    return () => {
      clearInterval(ticker);
      controller.cancel();
      setRemainingMs(AUTO_CONFIRM_MS);
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [draft, held]);

  const hold = () => {
    controllerRef.current?.cancel();
    setHeldDraft(draft);
  };
  const textScale = useReaderTextScale();
  const secondsLeft = countdownSeconds(remainingMs);
  const counting = !held && secondsLeft > 0;

  return (
    <View style={panel.column}>
      {/* 받아 적은 문장은 위 아이 말풍선에 보인다. 이 줄을 누르면 자동 전송을 멈춘다. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="보내지 말고 기다리기"
        accessibilityHint="누르면 자동으로 보내지 않아요"
        onPress={hold}
      >
        {counting ? (
          <View style={panel.countdownRow}>
            <Text style={[panel.status, scaledText(panel.status, textScale)]} accessibilityLiveRegion="polite">
              {secondsLeft}초 뒤에 {dialogue.characterName}에게 보낼게
            </Text>
            <View style={panel.countdownTrack}>
              <View style={[panel.countdownFill, { width: `${(remainingMs / AUTO_CONFIRM_MS) * 100}%` }]} />
            </View>
          </View>
        ) : (
          <Text style={[panel.status, scaledText(panel.status, textScale)]}>맞으면 "응, 이렇게 말했어"를 눌러 줘</Text>
        )}
      </Pressable>
      <View style={panel.controls}>
        <Chip primary label="응, 이렇게 말했어" onPress={dialogue.confirmTranscript} />
        <Chip
          label="다시 말하기"
          onPress={() => {
            hold();
            void dialogue.startTalking();
          }}
        />
        <Chip
          label="고쳐 쓰기"
          onPress={() => {
            hold();
            dialogue.startTyping();
          }}
        />
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
  /** 단계의 주 버튼 - 크기는 다른 버튼과 같고 색만 강조한다. */
  primary?: boolean;
  disabled?: boolean;
}) {
  const textScale = useReaderTextScale();
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
      <Text
        style={[
          panel.chipText,
          primary && panel.chipTextPrimary,
          scaledText(primary ? panel.chipTextPrimary : panel.chipText, textScale),
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}


/** 하늘색 「그레텔의 공간」 위 단계 버튼 - 흰 알약 버튼, 주 버튼은 보라. */
const INK = '#2a1f45';
const MUTED = '#6b6178';

const panel = StyleSheet.create({
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: '#fff2f5',
  },
  error: { flexShrink: 1, color: storybookTheme.color.error, fontSize: 17, fontWeight: '600' },
  column: { gap: 12 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  status: { color: MUTED, fontSize: 18, fontWeight: '600', flexGrow: 1 },
  proposalText: {
    alignSelf: 'flex-start',
    color: INK,
    fontSize: 22,
    lineHeight: 32,
    fontWeight: '700',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#ffffff',
  },
  countdownRow: { gap: 8 },
  countdownTrack: { height: 6, borderRadius: 3, backgroundColor: '#ffffff', overflow: 'hidden' },
  countdownFill: { height: 6, backgroundColor: '#7550d3' },
  input: {
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e8e2ee',
    backgroundColor: '#ffffff',
    color: INK,
    fontSize: 20,
  },
  // 한 줄 버튼은 높이·글자 크기를 모두 같게 - 주 버튼은 색으로만 구분한다(10/25 PM).
  chip: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#e8e2ee',
    backgroundColor: '#ffffff',
  },
  chipPrimary: { backgroundColor: '#7550d3', borderColor: '#7550d3' },
  chipDisabled: { opacity: 0.5 },
  chipPressed: { opacity: 0.8 },
  chipText: { color: INK, fontSize: 18, fontWeight: '700' },
  chipTextPrimary: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  proxyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  proxyBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: MUTED,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proxyBoxChecked: { backgroundColor: '#7550d3', borderColor: '#7550d3' },
  proxyCheck: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  proxyLabel: { color: MUTED, fontSize: 15 },
});
