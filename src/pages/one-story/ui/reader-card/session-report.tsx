import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';
import type { QuestionOutcome } from '@/entities/analytics';
import type { PlayTurn } from '@/entities/play-session';
import type { StoryRuntimePackage } from '@/entities/story';
import type { ReportAnalysis, ReportFollowUp, StoryEndStatus, TeacherNote } from '@/entities/story-completion';

import {
  childReplyPairs,
  classSceneRows,
  evidenceTurns,
  groupExchanges,
  hasChildLines,
  inputTags,
  readRangeLabel,
  sceneDialogue,
  sceneNumberOf,
  sceneTitleOf,
  skippedInviteScenes,
  storyChanges,
  type SceneExchange,
} from '../../lib/session-report';
import type { SessionReportAction } from '../../lib/report-tracking';
import { styles } from '../styles';

export type { SessionReportAction };

/** 리포트 한 회차에 필요한 저장값 - 상세 API 응답이나 방금 끝난 회차의 화면 상태에서 만든다. */
export type SessionReportData = {
  sessionKind: 'HOME' | 'CLASS' | 'TUTOR';
  childName?: string | null;
  className?: string | null;
  tutorDisplayName?: string | null;
  completedAt?: string | null;
  endStatus?: StoryEndStatus | null;
  readFromSceneId?: string | null;
  readThroughSceneId?: string | null;
  turns: PlayTurn[];
  outcomes: QuestionOutcome[];
  analysis?: ReportAnalysis | null;
  teacherNote?: TeacherNote | null;
};

/**
 * home: 아이 한 명의 기록(가정·개별 수업) - ①~⑤.
 * teacher: 반·개별 수업을 선생님(기관 관리자)이 볼 때 - 장면별 수업 기록·교사 메모·다음 행동.
 * class-parent: 반 수업을 부모가 볼 때 - 어느 아이 말인지 모르니 아이 말 없이 진행된 이야기와 대화 거리만.
 */
export type SessionReportView = 'home' | 'teacher' | 'class-parent';

const FOLLOW_UP_LABEL: Record<ReportFollowUp['type'], string> = {
  RECALL: '이야기 돌아보기',
  REASON: '이유 살펴보기',
  POSSIBILITY: '다른 가능성',
  EXPERIENCE: '자기 경험',
  LOOK_TOGETHER: '함께 살펴보기',
};

function formatDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

/**
 * Q-39 리포트 - 당시 장면 → 실제로 주고받은 말 → 관심과 생각 → 이어갈 대화. 그림·아이 말·그레텔 답·실행
 * 결과는 저장값을 그대로 쓰고, 분석이 아직이거나 실패해도 기본 기록은 먼저 보여 준다.
 */
export function SessionReport({
  data,
  storyPackage,
  view,
  isWide,
  onRetryAnalysis,
  teacherNoteSlot,
  readAgainSlot,
  onAction,
}: {
  data: SessionReportData;
  storyPackage: StoryRuntimePackage;
  view: SessionReportView;
  isWide: boolean;
  onRetryAnalysis?: () => void;
  /** 선생님 화면의 메모 편집기(저장은 부모 화면이 맡는다). */
  teacherNoteSlot?: ReactNode;
  /** "아이랑 다시 읽기" 버튼 묶음. */
  readAgainSlot?: ReactNode;
  /** 리포트에서 누른 것(Q-40 UT 통계) - 펼치기는 열 때만 알린다. */
  onAction?: (action: SessionReportAction) => void;
}) {
  // 크게 펼친 장면 대화 - 한 번에 하나만.
  const [openSceneId, setOpenSceneId] = useState<string | null>(null);
  const closeSheet = useCallback(() => setOpenSceneId(null), []);
  const retryAnalysis = onRetryAnalysis
    ? () => {
        onAction?.('retry_analysis');
        onRetryAnalysis();
      }
    : undefined;
  const changes = storyChanges(storyPackage, data.turns, data.outcomes);
  const range = readRangeLabel(storyPackage, data.readFromSceneId, data.readThroughSceneId, data.endStatus);
  const title = storyPackage.reportCopy.storyTitle;

  if (view === 'teacher') {
    const rows = classSceneRows(storyPackage, data.turns);
    const skipped = skippedInviteScenes(storyPackage, data.turns);
    return (
      <View style={sr.stack}>
        <Section title="기본 정보">
          <Text style={sr.body}>
            {[formatDate(data.completedAt), data.className, title, range].filter(Boolean).join(' · ')}
          </Text>
        </Section>
        <Section title="수업 내용" description="앱에 전달한 말과 그레텔의 답, 실행한 행동이에요. 반 수업에서는 누가 말했는지 앱이 알 수 없어 아이별로 나누지 않아요.">
          {rows.length === 0 ? (
            <Text style={sr.empty}>이번 수업에서는 질문 초대에 답하거나 그레텔과 이야기한 기록이 없어요.</Text>
          ) : (
            rows.map((row) => (
              <View key={row.sceneId} style={[sr.tableRow, isWide && sr.tableRowWide]}>
                <Text style={[sr.tableScene, isWide && sr.tableCellWide]}>
                  {sceneNumberOf(storyPackage, row.sceneId)}화 {row.sceneTitle}
                </Text>
                <TableCell label="앱에 전달한 말" values={row.sent} isWide={isWide} />
                <TableCell label="그레텔 답" values={row.replies} isWide={isWide} />
                <TableCell label="실행한 행동·결과" values={[row.result || '원래 이야기대로']} isWide={isWide} />
              </View>
            ))
          )}
        </Section>
        <Section title="교사 메모">{teacherNoteSlot ?? <TeacherNoteView note={data.teacherNote} showInternal />}</Section>
        <Section title="다음 행동">
          <Text style={sr.body}>
            {skipped.length > 0
              ? `건너뛴 질문: ${skipped.join(', ')}. 다음 수업에서 이어 볼 수 있어요.`
              : '이번 수업의 질문 초대는 모두 진행했어요.'}
            {' '}보호자에게는 공유용 한마디와 집에서 나눌 대화 거리가 함께 가요.
          </Text>
        </Section>
      </View>
    );
  }

  if (view === 'class-parent') {
    return (
      <View style={sr.stack}>
        <Section title="오늘 기관에서 읽은 이야기">
          <Text style={sr.body}>
            {[formatDate(data.completedAt), data.className, title, range].filter(Boolean).join(' · ')}
          </Text>
        </Section>
        <Section title="실제로 진행된 이야기">
          <ProgressedStory storyPackage={storyPackage} turns={data.turns} changes={changes} isWide={isWide} />
        </Section>
        {data.teacherNote?.forParents ? (
          <Section title="선생님 한마디">
            <Text style={sr.memo}>{data.teacherNote.forParents}</Text>
          </Section>
        ) : null}
        <Section
          title="집에서 나눌 대화 거리"
          description="반 수업에서 나온 말은 우리 아이 말인지 알 수 없어 넣지 않았어요. 실제로 읽은 장면으로만 만들었어요."
        >
          <AnalysisState analysis={data.analysis} onRetry={retryAnalysis} personal={false} />
          <TalkCards analysis={data.analysis} storyPackage={storyPackage} isWide={isWide} />
        </Section>
        {readAgainSlot}
      </View>
    );
  }

  const exchanges = groupExchanges(storyPackage, data.turns);
  const openExchange = exchanges.find((exchange) => exchange.sceneId === openSceneId) ?? null;
  const spoke = hasChildLines(data.turns);
  return (
    <View style={sr.stack}>
      <Section title="① 오늘 읽은 이야기">
        <Text style={sr.body}>
          {[data.childName, title, formatDate(data.completedAt), range].filter(Boolean).join(' · ')}
        </Text>
      </Section>

      <Section title="② 아이가 남긴 말" description="아이가 한 말과 그레텔의 답을 그대로 담았어요. 장면을 누르면 그 장면에서 나눈 대화 전체를 크게 볼 수 있어요. 말로 한 것은 앱이 받아 적은 문장이에요.">
        {exchanges.length === 0 ? (
          <Text style={sr.empty}>이번 회차에는 아이가 남긴 말이 없어요.</Text>
        ) : (
          <View style={[sr.sceneGrid, isWide && sr.sceneGridWide]}>
            {exchanges.map((exchange) => (
              <SceneTalkCard
                key={exchange.sceneId}
                storyPackage={storyPackage}
                exchange={exchange}
                isWide={isWide}
                onOpen={() => {
                  onAction?.('expand_dialogue');
                  setOpenSceneId(exchange.sceneId);
                }}
              />
            ))}
          </View>
        )}
        {openExchange ? (
          <SceneDialogueSheet storyPackage={storyPackage} exchange={openExchange} onClose={closeSheet} />
        ) : null}
      </Section>

      {changes.length > 0 && (
        <Section title="③ 아이가 바꾼 이야기">
          {changes.map((change) => (
            <View key={change.familyId} style={[sr.change, isWide && sr.changeWide]}>
              {change.resultVisualId ? (
                <Image
                  source={storyPackage.illustrationForAssetId(change.resultVisualId)}
                  style={[sr.thumb, isWide && sr.thumbWide]}
                  resizeMode="cover"
                  accessibilityLabel={change.meaning}
                />
              ) : null}
              <View style={sr.changeText}>
                <View style={sr.tagRow}>
                  <Text style={sr.strong}>{change.meaning}</Text>
                  {change.viaSuggestion && <Tag label="예시 보고 고름" />}
                </View>
                {change.summary ? <Text style={sr.body}>{change.summary}</Text> : null}
                <Text style={sr.muted}>
                  {change.viaSuggestion
                    ? `그레텔의 도움 예시 "${change.suggestionLabel ?? change.meaning}"를 보고 고른 방법이에요. 아이 스스로 낸 생각과 구분해 표시해요.`
                    : '아이가 말한 방법을 그레텔이 확인하고 실행했어요.'}
                </Text>
              </View>
            </View>
          ))}
        </Section>
      )}

      <Section title="④ 이번에 드러난 관심과 생각">
        {!spoke ? (
          <Text style={sr.empty}>아이가 남긴 말이 없어 이번에는 관심을 추측하지 않았어요.</Text>
        ) : (
          <>
            <AnalysisState analysis={data.analysis} onRetry={retryAnalysis} personal />
            {data.analysis?.status === 'READY' && data.analysis.observations.length === 0 && (
              <Text style={sr.empty}>관심이나 생각을 판단할 만한 말이 없어 이번에는 개인 분석을 하지 않았어요.</Text>
            )}
            {data.analysis?.status === 'READY' &&
              data.analysis.observations.map((observation) => (
                <ObservationItem
                  key={observation.key}
                  observation={observation.observation}
                  evidence={evidenceTurns(data.turns, observation.evidenceSeqs)}
                  explanation={data.analysis?.cards.find((card) => card.key === observation.key)?.explanation ?? null}
                  onExpand={() => onAction?.('expand_reason')}
                />
              ))}
          </>
        )}
      </Section>

      <Section title="⑤ 함께 이야기할 카드" description="질문을 순서대로 다 묻기보다, 아이 반응에 맞춰 골라 써 보세요.">
        {!data.analysis || data.analysis.status === 'PENDING' ? (
          <AnalysisState analysis={data.analysis} onRetry={retryAnalysis} personal={false} />
        ) : null}
        <TalkCards analysis={data.analysis} storyPackage={storyPackage} isWide={isWide} />
      </Section>
      {readAgainSlot}
    </View>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.reportPanel, width < 640 && sr.panelNarrow]}>
      <Text style={styles.reportPanelTitle}>{title}</Text>
      {description ? <Text style={styles.reportPanelDescription}>{description}</Text> : null}
      <View style={sr.sectionBody}>{children}</View>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={sr.tag}>
      <Text style={sr.tagText}>{label}</Text>
    </View>
  );
}

function TableCell({ label, values, isWide }: { label: string; values: string[]; isWide: boolean }) {
  return (
    <View style={[sr.tableCell, isWide && sr.tableCellWide]}>
      {!isWide && <Text style={sr.muted}>{label}</Text>}
      <Text style={sr.body}>{values.length > 0 ? values.join('\n') : '-'}</Text>
    </View>
  );
}

/** 시스템 줄(행동 실행·건너뜀 등)을 부모가 읽을 문장으로. 보여 줄 게 없으면 빈 문자열. */
function systemLineText(turn: PlayTurn) {
  if (turn.event === 'ACTION_CONFIRMED') return `행동 실행${turn.viaSuggestion ? ' · 예시 보고 고름' : ''}`;
  if (turn.event === 'ACTION_DECLINED') return '제안한 행동은 하지 않고 이야기를 이어 감';
  if (turn.event === 'INVITE_SKIPPED') return '질문 초대를 건너뜀';
  if (turn.event === 'INVITE_CLOSED') return '대화를 마치고 이야기로 돌아감';
  return '';
}

function speakerLabel(turn: PlayTurn) {
  if (turn.role === 'CHILD') return '아이';
  if (turn.helpStep && turn.fixed) return `그레텔 · 도움 ${turn.helpStep}단계`;
  if (turn.fixed) return '그레텔 · 준비된 말';
  return '그레텔';
}

/**
 * 대화 한 줄 - 말한 사람 이름을 줄 위에 두고, 아이 말은 따뜻한 색·그레텔 말은 푸른 색 띠로 구분한다.
 * 말풍선 좌우 정렬 대신 한쪽 정렬로 둬서 긴 대화도 위에서 아래로 끊김 없이 읽힌다.
 */
function DialogueLine({ turn, large }: { turn: PlayTurn; large?: boolean }) {
  if (turn.role === 'SYSTEM') {
    const text = systemLineText(turn);
    return text ? (
      <View style={sr.systemRow}>
        <Text style={sr.systemText}>{text}</Text>
      </View>
    ) : null;
  }
  const isChild = turn.role === 'CHILD';
  return (
    <View style={[sr.line, isChild ? sr.childLine : sr.characterLine]}>
      <View style={sr.tagRow}>
        <Text style={[sr.who, isChild ? sr.childWho : sr.characterWho]}>{speakerLabel(turn)}</Text>
        {inputTags(turn).map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
      </View>
      <Text style={[sr.lineText, large && sr.lineTextLarge]}>{turn.text ?? ''}</Text>
    </View>
  );
}

/** 장면 카드에 바로 보여 줄 아이 말 수 - 나머지는 "전체 대화 보기"에서. */
const CARD_PAIR_LIMIT = 2;

/**
 * "아이가 남긴 말"의 장면 하나 - 삽화와 화 제목, 아이 말과 그레텔의 바로 다음 답만 짧게 보여 주고,
 * 카드를 누르면 그 장면 대화 전체를 큰 글씨로 연다.
 */
function SceneTalkCard({
  storyPackage,
  exchange,
  isWide,
  onOpen,
}: {
  storyPackage: StoryRuntimePackage;
  exchange: SceneExchange;
  isWide: boolean;
  onOpen: () => void;
}) {
  const sceneNo = sceneNumberOf(storyPackage, exchange.sceneId);
  const pairs = childReplyPairs(exchange);
  const shown = pairs.slice(0, CARD_PAIR_LIMIT);
  const hiddenCount = pairs.length - shown.length;
  const lineCount = sceneDialogue(exchange).filter((turn) => turn.role !== 'SYSTEM' || systemLineText(turn)).length;
  const sceneLabel = `${sceneNo ? `${sceneNo}화 · ` : ''}${exchange.sceneTitle}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sceneLabel} 대화 전체 보기`}
      onPress={onOpen}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        sr.sceneCard,
        isWide && sr.sceneCardWide,
        hovered && sr.sceneCardHover,
        pressed && sr.pressed,
      ]}
    >
      {exchange.visualId ? (
        <Image
          source={storyPackage.illustrationForAssetId(exchange.visualId)}
          style={[sr.sceneImage, isWide && sr.sceneImageWide]}
          resizeMode="cover"
          accessibilityLabel={`${exchange.sceneTitle} 삽화`}
        />
      ) : null}
      <View style={sr.sceneBody}>
        <Text style={sr.sceneTitle}>{sceneLabel}</Text>
        {shown.map((pair) => (
          <View key={pair.child.seq} style={sr.pair}>
            <DialogueLine turn={pair.child} />
            {pair.reply ? <DialogueLine turn={pair.reply} /> : null}
          </View>
        ))}
        {hiddenCount > 0 ? <Text style={sr.muted}>아이 말 {hiddenCount}개가 더 있어요.</Text> : null}
        <View style={sr.openRow}>
          <Text style={sr.openText}>장면 대화 전체 보기 · {lineCount}줄</Text>
          <Icon name="chevronRight" size={18} color={ACCENT} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 장면 대화 전체를 크게 - 그레텔이 먼저 건넨 말부터 이야기로 돌아갈 때까지 순서대로. 바깥을 누르거나
 * Esc·닫기 버튼으로 닫는다(읽기 전용 화면이라 실수로 닫혀도 잃는 것이 없다).
 */
function SceneDialogueSheet({
  storyPackage,
  exchange,
  onClose,
}: {
  storyPackage: StoryRuntimePackage;
  exchange: SceneExchange;
  onClose: () => void;
}) {
  const { width } = useWindowDimensions();
  const narrow = width < 640;
  const closeRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus?.();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);
  const sceneNo = sceneNumberOf(storyPackage, exchange.sceneId);
  const sheet = (
    <View
      style={[sr.scrim, narrow && sr.scrimNarrow, { position: 'fixed' } as never]}
      {...({ role: 'dialog', 'aria-modal': true } as object)}
      accessibilityLabel={`${exchange.sceneTitle} 대화`}
    >
      <Pressable accessibilityLabel="닫기" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[sr.sheet, narrow && sr.sheetNarrow]}>
        <View style={sr.sheetHeader}>
          {exchange.visualId ? (
            <Image
              source={storyPackage.illustrationForAssetId(exchange.visualId)}
              style={sr.sheetThumb}
              resizeMode="cover"
              accessibilityLabel={`${exchange.sceneTitle} 삽화`}
            />
          ) : null}
          <View style={sr.sheetHeading}>
            <Text style={sr.sheetEyebrow}>{sceneNo ? `${sceneNo}화` : '장면'} 대화 전체</Text>
            <Text style={sr.sheetTitle} accessibilityRole="header">
              {exchange.sceneTitle}
            </Text>
          </View>
          <Pressable
            ref={closeRef as never}
            accessibilityRole="button"
            accessibilityLabel="대화 닫기"
            onPress={onClose}
            hitSlop={8}
            style={({ pressed }) => [sr.closeButton, pressed && sr.pressed]}
          >
            <Icon name="close" size={22} color={storybookTheme.color.onCardTitle} />
          </Pressable>
        </View>
        <ScrollView style={sr.sheetScroll} contentContainerStyle={sr.sheetLines}>
          {sceneDialogue(exchange).map((turn) => (
            <DialogueLine key={turn.seq} turn={turn} large />
          ))}
        </ScrollView>
      </View>
    </View>
  );
  if (typeof document === 'undefined') return sheet;
  return createPortal(sheet, document.body);
}

function ObservationItem({
  observation,
  evidence,
  explanation,
  onExpand,
}: {
  observation: string;
  evidence: PlayTurn[];
  explanation: string | null;
  onExpand?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const reason = explanation?.trim() ?? '';
  return (
    <View style={sr.observation}>
      <Text style={sr.observationText}>{observation}</Text>
      {evidence.length > 0 && (
        <View style={sr.evidence}>
          <Text style={sr.evidenceLabel}>아이가 한 말</Text>
          {evidence.map((turn) => (
            <Text key={turn.seq} style={sr.evidenceQuote}>
              “{turn.text}”
            </Text>
          ))}
        </View>
      )}
      {reason ? (
        <>
          <Pressable
            accessibilityRole="button"
            aria-expanded={open}
            onPress={() => {
              if (!open) onExpand?.();
              setOpen(!open);
            }}
            hitSlop={6}
            style={({ pressed }) => [sr.reasonToggle, pressed && sr.pressed]}
          >
            <Text style={sr.reasonToggleText}>{open ? '이유 접기' : '이렇게 본 이유 보기'}</Text>
            <View style={open ? sr.chevronOpen : undefined}>
              <Icon name="chevronDown" size={16} color={ACCENT} />
            </View>
          </Pressable>
          {open && (
            <View style={sr.reasonBox}>
              <Text style={sr.body}>{reason}</Text>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

/** 분석 상태 안내 - 기다리는 중·실패(다시 시도)·생략. 완료면 아무것도 그리지 않는다. */
function AnalysisState({
  analysis,
  onRetry,
  personal,
}: {
  analysis: ReportAnalysis | null | undefined;
  onRetry?: () => void;
  personal: boolean;
}) {
  if (!analysis || analysis.status === 'PENDING') {
    return (
      <View style={sr.tagRow}>
        <ActivityIndicator size="small" color={storybookTheme.color.onCardMuted} />
        <Text style={sr.muted}>{personal ? '아이 말을 살펴보는 중이에요. 기본 기록은 위에서 먼저 볼 수 있어요.' : '대화 거리를 만드는 중이에요.'}</Text>
      </View>
    );
  }
  if (analysis.status === 'FAILED') {
    return (
      <View style={sr.failed}>
        <Text style={sr.body}>분석을 만들지 못했어요. 기록은 그대로 있어요.</Text>
        {onRetry && (
          <Pressable accessibilityRole="button" onPress={onRetry} style={sr.retry}>
            <Text style={sr.retryText}>분석 다시 시도</Text>
          </Pressable>
        )}
      </View>
    );
  }
  if (analysis.status === 'SKIPPED' && personal) {
    return <Text style={sr.empty}>이번 회차는 개인 분석을 생략했어요.</Text>;
  }
  return null;
}

function TalkCards({
  analysis,
  storyPackage,
  isWide,
}: {
  analysis: ReportAnalysis | null | undefined;
  storyPackage: StoryRuntimePackage;
  isWide: boolean;
}) {
  if (!analysis || (analysis.cards.length === 0 && analysis.commonScenes.length === 0)) return null;
  return (
    <View style={[sr.cards, isWide && sr.cardsWide]}>
      {analysis.cards.map((card) => (
        <View key={card.key} style={[sr.card, isWide ? sr.cardWide : sr.cardNarrow]}>
          <Text style={sr.cardEyebrow}>아이가 남긴 말에서</Text>
          <Text style={sr.cardHeadline}>{card.headline}</Text>
          {card.acknowledge ? <SayLine label="먼저 받아주기" text={card.acknowledge} tone="soft" /> : null}
          <SayLine label="처음 꺼낼 말" text={card.openingLine} tone="lead" />
          <FollowUpList followUps={card.followUps} />
        </View>
      ))}
      {analysis.commonScenes.map((scene) => {
        const sceneNo = sceneNumberOf(storyPackage, scene.sceneId);
        return (
          <View key={scene.sceneId} style={[sr.card, sr.commonCard, isWide ? sr.cardWide : sr.cardNarrow]}>
            <Text style={sr.cardEyebrow}>
              이 장면으로 나눌 수 있는 이야기{sceneNo ? ` · ${sceneNo}화 ${sceneTitleOf(storyPackage, scene.sceneId)}` : ''}
            </Text>
            <SayLine label="처음 꺼낼 말" text={scene.openingLine} tone="lead" />
            <FollowUpList followUps={scene.followUps} />
          </View>
        );
      })}
    </View>
  );
}

/** 부모가 아이에게 건넬 말 - "처음 꺼낼 말"은 카드에서 가장 먼저 눈에 들어오도록 색 상자로 둔다. */
function SayLine({ label, text, tone }: { label: string; text: string; tone: 'lead' | 'soft' }) {
  return (
    <View style={[sr.say, tone === 'lead' ? sr.sayLead : sr.saySoft]}>
      <Text style={[sr.sayLabel, tone === 'lead' && sr.sayLabelLead]}>{label}</Text>
      <Text style={[sr.sayText, tone === 'lead' && sr.sayTextLead]}>“{text}”</Text>
    </View>
  );
}

/** 이어서 골라 쓸 질문 - 갈래 표시를 질문 위 한 줄에 두어 질문 글이 늘 같은 왼쪽 선에서 시작한다. */
function FollowUpList({ followUps }: { followUps: ReportFollowUp[] }) {
  if (followUps.length === 0) return null;
  return (
    <View style={sr.followUps}>
      <Text style={sr.followUpsLabel}>아이 반응에 따라 이어서</Text>
      {followUps.map((followUp) => (
        <View key={followUp.text} style={sr.followUp}>
          <Tag label={FOLLOW_UP_LABEL[followUp.type] ?? followUp.type} />
          <Text style={sr.followUpText}>{followUp.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** 반 수업에서 실제로 진행된 이야기 - 질문 지점마다 실행된 행동이나 원래 이야기. 아이 말은 넣지 않는다. */
function ProgressedStory({
  storyPackage,
  turns,
  changes,
  isWide,
}: {
  storyPackage: StoryRuntimePackage;
  turns: PlayTurn[];
  changes: ReturnType<typeof storyChanges>;
  isWide: boolean;
}) {
  const anchors = storyPackage.manifest.questionAnchors.filter((anchor) =>
    turns.some((turn) => turn.sceneId === anchor.sceneId) || changes.some((change) => change.sceneId === anchor.sceneId),
  );
  if (anchors.length === 0) {
    return <Text style={sr.empty}>이번 수업은 원래 이야기대로 진행됐어요.</Text>;
  }
  return (
    <>
      {anchors.map((anchor) => {
        const change = changes.find((candidate) => candidate.sceneId === anchor.sceneId);
        const talked = turns.some((turn) => turn.sceneId === anchor.sceneId && turn.role === 'CHILD');
        const imageId = change?.resultVisualId ?? storyPackage.reportCopy.anchors?.[anchor.id]?.reportImageAssetId ?? null;
        const text = change
          ? (change.summary ?? change.meaning)
          : talked
            ? '그레텔과 이야기를 나눈 뒤 이야기가 이어졌어요.'
            : '이 장면은 원래 이야기대로 이어졌어요.';
        return (
          <View key={anchor.id} style={[sr.change, isWide && sr.changeWide]}>
            {imageId ? (
              <Image
                source={storyPackage.illustrationForAssetId(imageId)}
                style={[sr.thumb, isWide && sr.thumbWide]}
                resizeMode="cover"
                accessibilityLabel={sceneTitleOf(storyPackage, anchor.sceneId)}
              />
            ) : null}
            <View style={sr.changeText}>
              <Text style={sr.strong}>
                {sceneNumberOf(storyPackage, anchor.sceneId)}화 · {sceneTitleOf(storyPackage, anchor.sceneId)}
              </Text>
              <Text style={sr.body}>{text}</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

/** 교사 메모를 읽기 전용으로 - 관리자 화면이나 편집기가 없을 때. */
export function TeacherNoteView({ note, showInternal }: { note: TeacherNote | null | undefined; showInternal: boolean }) {
  if (!note || (!note.forParents && !(showInternal && note.internal))) {
    return <Text style={sr.empty}>아직 남긴 메모가 없어요.</Text>;
  }
  return (
    <View style={sr.memoBox}>
      {showInternal && note.internal ? (
        <View style={sr.tagRow}>
          <Tag label="나만 보기" />
          <Text style={sr.body}>{note.internal}</Text>
        </View>
      ) : null}
      {note.forParents ? (
        <View style={sr.tagRow}>
          <Tag label="보호자에게 공유" />
          <Text style={sr.body}>{note.forParents}</Text>
        </View>
      ) : null}
    </View>
  );
}

const CHILD_TINT = '#FBF1DE';
const CHILD_RULE = '#D9A441';
const CHILD_LABEL = '#8A5A00';
const CHARACTER_TINT = '#EEF3F8';
const CHARACTER_RULE = '#7C9AB8';
const TAG_BACKGROUND = '#E6EDF5';
const TAG_TEXT = '#3F5F7A';
const ACCENT = TAG_TEXT;
const LEAD_BACKGROUND = '#FFF4D6';
const LEAD_BORDER = '#EBCB7A';

// 보호자가 태블릿으로 읽는 화면 - 본문 16px·줄간격 26px을 기준으로 두고, 보조 글도 14px 밑으로 내리지 않는다.
const sr = StyleSheet.create({
  stack: { gap: 18 },
  panelNarrow: { padding: 20, borderRadius: 22 },
  sectionBody: { gap: 16, marginTop: 6 },
  body: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.md, lineHeight: 26 },
  strong: { color: storybookTheme.color.onCardTitle, fontSize: storybookTheme.type.md, lineHeight: 26, fontWeight: storybookTheme.type.weight.bold },
  muted: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.sm, lineHeight: 21 },
  empty: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.md, lineHeight: 26 },
  memo: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.md, lineHeight: 26 },
  memoBox: { gap: 8 },
  pressed: { opacity: 0.85 },
  tag: { alignSelf: 'flex-start', borderRadius: 999, backgroundColor: TAG_BACKGROUND, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: TAG_TEXT, fontSize: storybookTheme.type.xs, lineHeight: 16, fontWeight: storybookTheme.type.weight.semibold },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },

  // ② 장면 카드
  sceneGrid: { gap: 14 },
  sceneGridWide: { gap: 16 },
  sceneCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.background,
    padding: 14,
    gap: 14,
  },
  sceneCardWide: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, gap: 20 },
  sceneCardHover: { borderColor: CHARACTER_RULE },
  sceneImage: { width: '100%', aspectRatio: 16 / 10, borderRadius: 12, backgroundColor: '#E8E4DA' },
  sceneImageWide: { width: 220 },
  sceneBody: { flex: 1, minWidth: 0, gap: 12 },
  sceneTitle: { color: storybookTheme.color.onCardTitle, fontSize: 17, lineHeight: 24, fontWeight: storybookTheme.type.weight.bold },
  pair: { gap: 6 },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  openText: { color: ACCENT, fontSize: storybookTheme.type.sm, lineHeight: 20, fontWeight: storybookTheme.type.weight.bold },

  // 대화 한 줄
  line: { borderLeftWidth: 4, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  childLine: { backgroundColor: CHILD_TINT, borderLeftColor: CHILD_RULE },
  characterLine: { backgroundColor: CHARACTER_TINT, borderLeftColor: CHARACTER_RULE },
  who: { fontSize: storybookTheme.type.sm, lineHeight: 18, fontWeight: storybookTheme.type.weight.bold },
  childWho: { color: CHILD_LABEL },
  characterWho: { color: TAG_TEXT },
  lineText: { color: storybookTheme.color.onCardTitle, fontSize: storybookTheme.type.md, lineHeight: 25 },
  lineTextLarge: { fontSize: 18, lineHeight: 29 },
  systemRow: { alignItems: 'center', paddingVertical: 2 },
  systemText: {
    color: storybookTheme.color.onCardMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    paddingHorizontal: 12,
    paddingVertical: 3,
    textAlign: 'center',
  },

  // 장면 대화 전체 보기
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: storybookTheme.zIndex.overlay,
    backgroundColor: storybookTheme.color.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scrimNarrow: { padding: 0, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 760,
    maxHeight: '90%',
    borderRadius: 24,
    backgroundColor: storybookTheme.color.surfaceWhite,
    overflow: 'hidden',
    ...storybookTheme.elevation.modal,
  },
  sheetNarrow: { maxHeight: '92%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: storybookTheme.color.surfaceCardBorder,
  },
  sheetThumb: { width: 88, aspectRatio: 16 / 10, borderRadius: 10, backgroundColor: '#E8E4DA' },
  sheetHeading: { flex: 1, minWidth: 0, gap: 2 },
  sheetEyebrow: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.semibold },
  sheetTitle: { color: storybookTheme.color.onCardTitle, fontSize: 20, lineHeight: 27, fontWeight: storybookTheme.type.weight.bold },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: TAG_BACKGROUND },
  sheetScroll: { flexGrow: 0 },
  sheetLines: { padding: 20, gap: 12 },

  // ③ 바뀐 이야기·반 수업 진행
  thumb: { width: '100%', aspectRatio: 16 / 10, borderRadius: 12, backgroundColor: '#E8E4DA' },
  thumbWide: { width: 200 },
  change: { gap: 12 },
  changeWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  changeText: { flex: 1, gap: 6, minWidth: 0 },

  // ④ 관심과 생각
  observation: { borderLeftWidth: 4, borderLeftColor: TAG_TEXT, paddingLeft: 16, paddingVertical: 2, gap: 10 },
  observationText: { color: storybookTheme.color.onCardTitle, fontSize: 17, lineHeight: 26, fontWeight: storybookTheme.type.weight.bold },
  evidence: { gap: 4 },
  evidenceLabel: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.semibold },
  evidenceQuote: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.md, lineHeight: 25 },
  reasonToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: CHARACTER_RULE,
    paddingHorizontal: 14,
  },
  reasonToggleText: { color: ACCENT, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  reasonBox: { borderRadius: 12, backgroundColor: CHARACTER_TINT, padding: 14 },

  failed: { gap: 8, alignItems: 'flex-start' },
  retry: { borderRadius: 999, borderWidth: 1, borderColor: TAG_TEXT, paddingHorizontal: 16, paddingVertical: 8 },
  retryText: { color: TAG_TEXT, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.semibold },

  // ⑤ 함께 이야기할 카드
  cards: { gap: 14 },
  cardsWide: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.background,
    padding: 18,
    gap: 12,
  },
  cardWide: { flexBasis: '48%', flexGrow: 1 },
  cardNarrow: { padding: 14 },
  commonCard: { backgroundColor: storybookTheme.color.surfaceCard },
  cardEyebrow: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.sm, lineHeight: 20 },
  cardHeadline: { color: storybookTheme.color.onCardTitle, fontSize: 17, lineHeight: 26, fontWeight: storybookTheme.type.weight.bold },
  say: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  sayLead: { backgroundColor: LEAD_BACKGROUND, borderWidth: 1, borderColor: LEAD_BORDER },
  saySoft: { backgroundColor: CHARACTER_TINT },
  sayLabel: { color: TAG_TEXT, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold },
  sayLabelLead: { color: storybookTheme.color.goldText },
  sayText: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.md, lineHeight: 26 },
  sayTextLead: { color: storybookTheme.color.onCardTitle, fontWeight: storybookTheme.type.weight.semibold },
  followUps: { gap: 14, marginTop: 2 },
  followUpsLabel: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.semibold },
  followUp: { gap: 6 },
  followUpText: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.md, lineHeight: 26 },

  // 선생님 표
  tableRow: { gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: storybookTheme.color.surfaceCardBorder },
  tableRowWide: { flexDirection: 'row', gap: 12 },
  tableScene: { color: storybookTheme.color.onCardTitle, fontSize: storybookTheme.type.md, lineHeight: 24, fontWeight: storybookTheme.type.weight.bold },
  tableCell: { gap: 2 },
  tableCellWide: { flex: 1 },
});
