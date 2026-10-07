import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';
import type { QuestionOutcome } from '@/entities/analytics';
import type { PlayTurn } from '@/entities/play-session';
import type { StoryRuntimePackage } from '@/entities/story';
import type { ReportAnalysis, ReportFollowUp, StoryEndStatus, TeacherNote } from '@/entities/story-completion';

import {
  classSceneRows,
  evidenceTurns,
  groupExchanges,
  hasChildLines,
  inputTags,
  readRangeLabel,
  sceneNumberOf,
  sceneTitleOf,
  skippedInviteScenes,
  storyChanges,
} from '../../lib/session-report';
import { styles } from '../styles';

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
}) {
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
            {' '}부모에게는 공유용 한마디와 집에서 나눌 대화 거리가 함께 가요.
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
          <AnalysisState analysis={data.analysis} onRetry={onRetryAnalysis} personal={false} />
          <TalkCards analysis={data.analysis} storyPackage={storyPackage} isWide={isWide} />
        </Section>
        {readAgainSlot}
      </View>
    );
  }

  const exchanges = groupExchanges(storyPackage, data.turns);
  const spoke = hasChildLines(data.turns);
  return (
    <View style={sr.stack}>
      <Section title="① 오늘 읽은 이야기">
        <Text style={sr.body}>
          {[data.childName, title, formatDate(data.completedAt), range].filter(Boolean).join(' · ')}
        </Text>
      </Section>

      <Section title="② 아이가 남긴 말" description="아이가 한 말과 그레텔의 답을 그대로 담았어요. 말로 한 것은 앱이 받아 적은 문장이에요.">
        {exchanges.length === 0 ? (
          <Text style={sr.empty}>이번 회차에는 아이가 남긴 말이 없어요.</Text>
        ) : (
          exchanges.map((exchange) => (
            <ExchangeBlock key={exchange.sceneId} storyPackage={storyPackage} exchange={exchange} isWide={isWide} />
          ))
        )}
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
            <AnalysisState analysis={data.analysis} onRetry={onRetryAnalysis} personal />
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
                />
              ))}
          </>
        )}
      </Section>

      <Section title="⑤ 함께 이야기할 카드" description="질문을 순서대로 다 묻기보다, 아이 반응에 맞춰 골라 써 보세요.">
        {!data.analysis || data.analysis.status === 'PENDING' ? (
          <AnalysisState analysis={data.analysis} onRetry={onRetryAnalysis} personal={false} />
        ) : null}
        <TalkCards analysis={data.analysis} storyPackage={storyPackage} isWide={isWide} />
      </Section>
      {readAgainSlot}
    </View>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <View style={styles.reportPanel}>
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

function Bubble({ turn }: { turn: PlayTurn }) {
  if (turn.role === 'SYSTEM') {
    const text =
      turn.event === 'ACTION_CONFIRMED'
        ? `행동 실행${turn.viaSuggestion ? ' · 예시 보고 고름' : ''}`
        : turn.event === 'ACTION_DECLINED'
          ? '제안한 행동은 하지 않고 이야기를 이어 감'
          : turn.event === 'INVITE_SKIPPED'
            ? '질문 초대를 건너뜀'
            : turn.event === 'INVITE_CLOSED'
              ? '대화를 마치고 이야기로 돌아감'
              : '';
    return text ? <Text style={sr.system}>{text}</Text> : null;
  }
  const isChild = turn.role === 'CHILD';
  const who = isChild
    ? '아이'
    : turn.helpStep && turn.fixed
      ? `그레텔 · 도움 ${turn.helpStep}단계`
      : turn.fixed
        ? '그레텔 · 준비된 말'
        : '그레텔';
  return (
    <View style={[sr.bubble, isChild ? sr.childBubble : sr.characterBubble]}>
      <View style={sr.tagRow}>
        <Text style={sr.who}>{who}</Text>
        {inputTags(turn).map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
      </View>
      <Text style={sr.bubbleText}>{turn.text ?? ''}</Text>
    </View>
  );
}

function ExchangeBlock({
  storyPackage,
  exchange,
  isWide,
}: {
  storyPackage: StoryRuntimePackage;
  exchange: ReturnType<typeof groupExchanges>[number];
  isWide: boolean;
}) {
  const [open, setOpen] = useState(false);
  const sceneNo = sceneNumberOf(storyPackage, exchange.sceneId);
  return (
    <View style={[sr.exchange, isWide && sr.exchangeWide]}>
      <View style={[sr.figure, isWide && sr.figureWide]}>
        {exchange.visualId ? (
          <Image
            source={storyPackage.illustrationForAssetId(exchange.visualId)}
            style={sr.thumb}
            resizeMode="cover"
            accessibilityLabel={`${exchange.sceneTitle} 삽화`}
          />
        ) : null}
        <Text style={sr.muted}>
          {sceneNo ? `${sceneNo}화 · ` : ''}
          {exchange.sceneTitle}
        </Text>
      </View>
      <View style={sr.talk}>
        {exchange.lead.map((turn) => (
          <Bubble key={turn.seq} turn={turn} />
        ))}
        {exchange.rest.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} hitSlop={6}>
            <Text style={sr.link}>{open ? '앞뒤 대화 접기' : `앞뒤 대화 ${exchange.rest.length}개 펼치기`}</Text>
          </Pressable>
        )}
        {open && exchange.rest.map((turn) => <Bubble key={turn.seq} turn={turn} />)}
      </View>
    </View>
  );
}

function ObservationItem({
  observation,
  evidence,
  explanation,
}: {
  observation: string;
  evidence: PlayTurn[];
  explanation: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={sr.observation}>
      <Text style={sr.strong}>{observation}</Text>
      {evidence.length > 0 && (
        <Text style={sr.muted}>근거: {evidence.map((turn) => `“${turn.text}”`).join(' ')}</Text>
      )}
      {explanation ? (
        <>
          <Pressable accessibilityRole="button" onPress={() => setOpen((value) => !value)} hitSlop={6}>
            <Text style={sr.link}>{open ? '설명 접기' : '이렇게 본 이유'}</Text>
          </Pressable>
          {open && <Text style={sr.body}>{explanation}</Text>}
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
        <View key={card.key} style={[sr.card, isWide && sr.cardWide]}>
          <Text style={sr.muted}>아이가 남긴 말에서</Text>
          <Text style={sr.strong}>{card.headline}</Text>
          {card.acknowledge ? <Text style={sr.body}>먼저 받아주기: “{card.acknowledge}”</Text> : null}
          <Text style={sr.body}>처음 꺼낼 말: “{card.openingLine}”</Text>
          {card.followUps.map((followUp) => (
            <FollowUpLine key={followUp.text} followUp={followUp} />
          ))}
        </View>
      ))}
      {analysis.commonScenes.map((scene) => {
        const sceneNo = sceneNumberOf(storyPackage, scene.sceneId);
        return (
          <View key={scene.sceneId} style={[sr.card, sr.commonCard, isWide && sr.cardWide]}>
            <Text style={sr.muted}>
              이 장면으로 나눌 수 있는 이야기{sceneNo ? ` · ${sceneNo}화 ${sceneTitleOf(storyPackage, scene.sceneId)}` : ''}
            </Text>
            <Text style={sr.body}>처음 꺼낼 말: “{scene.openingLine}”</Text>
            {scene.followUps.map((followUp) => (
              <FollowUpLine key={followUp.text} followUp={followUp} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

function FollowUpLine({ followUp }: { followUp: ReportFollowUp }) {
  return (
    <View style={sr.followUp}>
      <Tag label={FOLLOW_UP_LABEL[followUp.type] ?? followUp.type} />
      <Text style={[sr.body, sr.followUpText]}>{followUp.text}</Text>
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
          <Tag label="부모에게 공유" />
          <Text style={sr.body}>{note.forParents}</Text>
        </View>
      ) : null}
    </View>
  );
}

const CHILD_BUBBLE = '#F4EAD6';
const CHARACTER_BUBBLE = '#EEF2F7';
const TAG_BACKGROUND = '#E6EDF5';
const TAG_TEXT = '#3F5F7A';

const sr = StyleSheet.create({
  stack: { gap: 16 },
  sectionBody: { gap: 14, marginTop: 4 },
  body: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.sm, lineHeight: 22 },
  strong: { color: storybookTheme.color.onCardTitle, fontSize: storybookTheme.type.sm, lineHeight: 22, fontWeight: storybookTheme.type.weight.bold },
  muted: { color: storybookTheme.color.onCardMuted, fontSize: 13, lineHeight: 19 },
  empty: { color: storybookTheme.color.onCardMuted, fontSize: storybookTheme.type.sm, lineHeight: 22 },
  link: { color: TAG_TEXT, fontSize: 13, fontWeight: storybookTheme.type.weight.semibold },
  memo: { color: storybookTheme.color.onCardBody, fontSize: storybookTheme.type.sm, lineHeight: 22 },
  memoBox: { gap: 8 },
  tag: { borderRadius: 999, backgroundColor: TAG_BACKGROUND, paddingHorizontal: 8, paddingVertical: 1 },
  tagText: { color: TAG_TEXT, fontSize: 11.5, fontWeight: storybookTheme.type.weight.semibold },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  exchange: { gap: 10 },
  exchangeWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  figure: { gap: 4 },
  figureWide: { width: 200 },
  thumb: { width: '100%', aspectRatio: 16 / 10, borderRadius: 10, backgroundColor: '#E8E4DA' },
  thumbWide: { width: 180 },
  talk: { flex: 1, gap: 8, minWidth: 0 },
  bubble: { maxWidth: '92%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, gap: 4 },
  childBubble: { alignSelf: 'flex-end', backgroundColor: CHILD_BUBBLE, borderBottomRightRadius: 4 },
  characterBubble: { alignSelf: 'flex-start', backgroundColor: CHARACTER_BUBBLE, borderBottomLeftRadius: 4 },
  who: { color: storybookTheme.color.onCardMuted, fontSize: 12, fontWeight: storybookTheme.type.weight.semibold },
  bubbleText: { color: storybookTheme.color.onCardTitle, fontSize: 15, lineHeight: 22 },
  system: { color: storybookTheme.color.onCardMuted, fontSize: 12.5, textAlign: 'center' },
  change: { gap: 10 },
  changeWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  changeText: { flex: 1, gap: 4, minWidth: 0 },
  observation: { borderLeftWidth: 3, borderLeftColor: TAG_TEXT, paddingLeft: 12, gap: 4 },
  failed: { gap: 8, alignItems: 'flex-start' },
  retry: { borderRadius: 999, borderWidth: 1, borderColor: TAG_TEXT, paddingHorizontal: 14, paddingVertical: 6 },
  retryText: { color: TAG_TEXT, fontSize: 13, fontWeight: storybookTheme.type.weight.semibold },
  cards: { gap: 12 },
  cardsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderRadius: 12, borderWidth: 1, borderColor: storybookTheme.color.surfaceCardBorder, backgroundColor: storybookTheme.color.background, padding: 14, gap: 6 },
  cardWide: { flexBasis: '48%', flexGrow: 1 },
  commonCard: { backgroundColor: storybookTheme.color.surfaceCard },
  followUp: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  followUpText: { flex: 1 },
  tableRow: { gap: 6, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: storybookTheme.color.surfaceCardBorder },
  tableRowWide: { flexDirection: 'row', gap: 12 },
  tableScene: { color: storybookTheme.color.onCardTitle, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold },
  tableCell: { gap: 2 },
  tableCellWide: { flex: 1 },
});
