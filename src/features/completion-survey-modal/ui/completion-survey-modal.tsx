import { useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ActionButton, Modal, ModalBody, storybookTheme } from '@/shared/ui';

import {
  BEST_ASPECT_OPTIONS,
  CHILD_AGE_BAND_OPTIONS,
  CHILD_REACTION_OPTIONS,
  CONTACT_CONSENT_OPTIONS,
  DISRUPTION_OPTIONS,
  HELP_NEEDED_OPTIONS,
  INPUT_UNDERSTANDING_OPTIONS,
  RETRY_INTEREST_OPTIONS,
  REVIEW_USAGE_CONSENT_OPTIONS,
  WANTS_NEXT_STORIES_OPTIONS,
  useCompletionSurvey,
} from '../model/use-completion-survey';
import { MultiChoiceQuestion, ScaleQuestion, SingleChoiceQuestion, TextQuestion } from './question-controls';

function toggle(values: string[], option: string) {
  return values.includes(option) ? values.filter((v) => v !== option) : [...values, option];
}

type Form = ReturnType<typeof useCompletionSurvey>;
type FieldError = (valid: boolean, message: string) => string | undefined;

/** 한 단계 - 제목, 이 단계 답이 다 찼는지, 문항들. */
type Step = {
  title: string;
  intro?: string;
  valid: (form: Form) => boolean;
  render: (form: Form, error: FieldError) => ReactNode;
};

/**
 * 15문항을 4단계로 - 한 화면에 3~5문항만 보이게 한다(10/24 QA: 한 장에 15문항이라 스크롤이 너무 길고 문항 구분이 안 됨).
 * 문항 번호는 단계를 넘어 1~15로 이어진다(대표 QA에서 정한 Q1~Q15와 같은 번호).
 */
const STEPS: Step[] = [
  {
    title: '아이는 어떻게 참여했나요?',
    intro: '정답은 없어요. 옆에서 보신 아이의 실제 반응만 알려 주세요.',
    valid: (f) =>
      f.childAgeBand.length > 0 && f.childEngagement !== null && f.inputUnderstanding.length > 0 && f.helpNeeded.length > 0,
    render: (f, error) => (
      <>
        <SingleChoiceQuestion
          number={1}
          label="함께 체험한 아이는 몇 살인가요?"
          options={CHILD_AGE_BAND_OPTIONS}
          value={f.childAgeBand}
          onChange={f.setChildAgeBand}
          errorText={error(f.childAgeBand.length > 0, '아이 나이를 골라 주세요.')}
        />
        <ScaleQuestion
          number={2}
          label="아이의 몰입도는 어땠나요?"
          minLabel="금방 다른 곳으로 관심이 갔어요"
          maxLabel="끝까지 집중했어요"
          value={f.childEngagement}
          onChange={f.setChildEngagement}
          errorText={error(f.childEngagement !== null, '몰입도를 골라 주세요.')}
        />
        <SingleChoiceQuestion
          number={3}
          label="아이는 자기 말이 이야기에 반영된 것을 어떻게 받아들였나요?"
          options={INPUT_UNDERSTANDING_OPTIONS}
          value={f.inputUnderstanding}
          onChange={f.setInputUnderstanding}
          errorText={error(f.inputUnderstanding.length > 0, '아이의 반응을 골라 주세요.')}
        />
        <SingleChoiceQuestion
          number={4}
          label="아이가 답할 때 어느 정도 도움이 필요했나요?"
          options={HELP_NEEDED_OPTIONS}
          value={f.helpNeeded}
          onChange={f.setHelpNeeded}
          errorText={error(f.helpNeeded.length > 0, '도움 정도를 골라 주세요.')}
        />
      </>
    ),
  },
  {
    title: '체험하는 동안은 어땠나요?',
    valid: (f) => f.childReactionsValid && f.disruptions.length > 0 && f.reportHelpfulness !== null,
    render: (f, error) => (
      <>
        <MultiChoiceQuestion
          number={5}
          label="체험 중 아이가 보인 반응"
          options={CHILD_REACTION_OPTIONS}
          values={f.childReactions}
          onToggle={(option) => f.setChildReactions(toggle(f.childReactions, option))}
          allowOther
          otherValue={f.childReactionsOtherText}
          onOtherChange={f.setChildReactionsOtherText}
          errorText={error(f.childReactionsValid, '아이가 보인 반응을 골라 주세요.')}
        />
        <MultiChoiceQuestion
          number={6}
          label="불편하거나 흐름이 끊긴 순간이 있었나요?"
          options={DISRUPTION_OPTIONS}
          values={f.disruptions}
          onToggle={(option) => f.setDisruptions(toggle(f.disruptions, option))}
          errorText={error(f.disruptions.length > 0, '불편했던 점을 골라 주세요.')}
        />
        <ScaleQuestion
          number={7}
          label="보호자 리포트가 아이와 대화를 이어가는 데 얼마나 도움이 되었나요?"
          minLabel="전혀 도움이 되지 않았어요"
          maxLabel="매우 도움이 되었어요"
          value={f.reportHelpfulness}
          onChange={f.setReportHelpfulness}
          errorText={error(f.reportHelpfulness !== null, '도움 정도를 골라 주세요.')}
        />
      </>
    ),
  },
  {
    title: '좋았던 점과 아쉬운 점',
    valid: (f) => f.bestAspectValid && f.retryInterest.length > 0,
    render: (f, error) => (
      <>
        <SingleChoiceQuestion
          number={8}
          label="같이 체험하면서 가장 좋았던 점은 무엇인가요?"
          options={BEST_ASPECT_OPTIONS}
          value={f.bestAspect}
          onChange={f.setBestAspect}
          allowOther
          otherValue={f.bestAspectOtherText}
          onOtherChange={f.setBestAspectOtherText}
          errorText={error(f.bestAspectValid, '가장 좋았던 점을 골라 주세요.')}
        />
        <TextQuestion
          number={9}
          label="가장 먼저 고쳤으면 하는 점 한 가지"
          value={f.topPriority}
          onChange={f.setTopPriority}
          placeholder="예: 질문에 답을 기다리는 시간이 길었어요"
        />
        <SingleChoiceQuestion
          number={10}
          label="다음 동화가 나오면 아이와 다시 체험하고 싶으신가요?"
          options={RETRY_INTEREST_OPTIONS}
          value={f.retryInterest}
          onChange={f.setRetryInterest}
          errorText={error(f.retryInterest.length > 0, '다시 체험할 생각이 있는지 골라 주세요.')}
        />
      </>
    ),
  },
  {
    title: '한 줄 후기와 체험단',
    intro:
      '한 줄 후기와 연락처는 남기지 않아도 돼요. 가족 체험단을 신청하면 다음 두 동화를 정식 공개 전에 아이와 무료로 먼저 체험할 수 있어요.',
    valid: (f) => f.reviewUsageConsent.length > 0 && f.wantsNextStories.length > 0 && f.contactConsent.length > 0,
    render: (f, error) => (
      <>
        <TextQuestion
          number={11}
          label="다른 부모님께 Q-Story를 한 문장으로 소개한다면?"
          value={f.oneLineReview}
          onChange={f.setOneLineReview}
          placeholder="예: 아이가 직접 질문하며 참여하는 동화예요"
        />
        <SingleChoiceQuestion
          number={12}
          label="한 줄 후기를 어떻게 써도 될까요?"
          options={REVIEW_USAGE_CONSENT_OPTIONS}
          value={f.reviewUsageConsent}
          onChange={f.setReviewUsageConsent}
          errorText={error(f.reviewUsageConsent.length > 0, '후기를 써도 되는지 골라 주세요.')}
        />
        <SingleChoiceQuestion
          number={13}
          label="다음 두 동화를 먼저 체험해 보고 싶으신가요?"
          options={WANTS_NEXT_STORIES_OPTIONS}
          value={f.wantsNextStories}
          onChange={f.setWantsNextStories}
          errorText={error(f.wantsNextStories.length > 0, '체험단 신청 여부를 골라 주세요.')}
        />
        <TextQuestion
          number={14}
          label="체험단 안내를 받을 이메일 또는 휴대전화 번호"
          value={f.contact}
          onChange={f.setContact}
          placeholder="parent@example.com 또는 010-0000-0000"
        />
        <SingleChoiceQuestion
          number={15}
          label="연락처를 남겼다면, 체험 안내를 위해 연락처를 수집·이용하는 데 동의하시나요? (안내가 끝나면 파기해요)"
          options={CONTACT_CONSENT_OPTIONS}
          value={f.contactConsent}
          onChange={f.setContactConsent}
          errorText={error(f.contactConsent.length > 0, '동의 여부를 골라 주세요.')}
        />
      </>
    ),
  },
];

/**
 * 완주 후 부모 리포트 화면의 "1분 체험 후기 남기기"가 여는 인앱 설문. 문항은 기존 Google Form과
 * 동일하게 유지한다 - 이미 쌓인 응답과 비교할 수 있어야 하기 때문이다. 선택 사항이라 건너뛸 수 있다.
 * 크기는 Modal size="form"(640 너비, 화면에 맞춘 고정 높이)이라 단계가 바뀌어도 카드 크기가 그대로다.
 */
export function CompletionSurveyModal({
  visible,
  storyId,
  onClose,
}: {
  visible: boolean;
  storyId: string;
  onClose: () => void;
}) {
  const form = useCompletionSurvey(storyId);
  const [step, setStep] = useState(0);
  // 이 단계에서 "다음"을 한 번 눌렀으면 빈 문항을 표시한다.
  const [checkedStep, setCheckedStep] = useState<number | null>(null);
  // 휴대폰 세로 - 버튼을 한 줄에 꽉 채우고 "나중에 할게요"는 그 아래로(한 줄에 셋이면 넘쳤다).
  const narrow = useWindowDimensions().width < NARROW_WIDTH;

  if (!visible) return null;

  if (form.submitted) {
    return (
      <Modal
        visible
        eyebrow="후기 감사해요"
        title="응답해 주셔서 감사합니다"
        positiveAction={{ label: '닫기', onPress: onClose }}
        accessibilityLabel="체험 후기 제출 완료"
      >
        <ModalBody>
          보호자의 의견은 다음 동화와 보호자 리포트를 고치는 데 반영할게요. 체험단 안내를
          신청하셨다면 다음 이야기가 준비되는 대로 연락드릴게요.
        </ModalBody>
      </Modal>
    );
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const showErrors = checkedStep === step && !current.valid(form);
  const error: FieldError = (valid, message) => (checkedStep === step && !valid ? message : undefined);

  const handleSkip = () => {
    form.reset();
    setStep(0);
    setCheckedStep(null);
    onClose();
  };
  const goNext = () => {
    if (!current.valid(form)) {
      setCheckedStep(step);
      return;
    }
    if (isLast) {
      void form.submit();
      return;
    }
    setStep(step + 1);
    setCheckedStep(null);
  };
  const goBack = () => {
    setStep(step - 1);
    setCheckedStep(null);
  };

  const skip = (
    <Pressable accessibilityRole="button" onPress={handleSkip} hitSlop={8}>
      <Text style={styles.skip}>나중에 할게요</Text>
    </Pressable>
  );
  const footer = (
    <View style={[styles.footer, narrow && styles.footerNarrow]}>
      {narrow ? null : skip}
      <View style={[styles.footerButtons, narrow && styles.footerButtonsNarrow]}>
        {step > 0 ? (
          <View style={[styles.footerButton, narrow && styles.footerButtonNarrow]}>
            <ActionButton
              variant="secondaryFull"
              size="lg"
              label="이전"
              onPress={goBack}
              disabled={form.submitting}
            />
          </View>
        ) : null}
        <View style={[styles.footerButton, styles.footerPrimary, narrow && styles.footerButtonNarrow]}>
          <ActionButton
            variant="primary"
            label={isLast ? '후기 보내기' : '다음'}
            onPress={goNext}
            disabled={form.submitting}
            loading={form.submitting}
          />
        </View>
      </View>
      {narrow ? skip : null}
    </View>
  );

  return (
    <Modal
      visible
      size="form"
      pinActions
      eyebrow="1분 체험 후기"
      title={current.title}
      footer={footer}
      bodyKey={step}
      actionsNote={
        showErrors ? (
          <Text style={styles.stepError}>빨간 테두리 문항을 채워 주세요.</Text>
        ) : form.error ? (
          <Text style={styles.stepError}>{form.error}</Text>
        ) : null
      }
      accessibilityLabel="체험 후기 설문"
    >
      <View style={styles.body}>
        <View style={styles.progressRow} accessibilityLabel={`${STEPS.length}단계 중 ${step + 1}단계`}>
          <View style={styles.progress}>
            {STEPS.map((item, index) => (
              <View key={item.title} style={[styles.progressSegment, index <= step && styles.progressSegmentDone]} />
            ))}
          </View>
          <Text style={styles.progressText}>
            {step + 1} / {STEPS.length}
          </Text>
        </View>
        {current.intro ? <Text style={styles.intro}>{current.intro}</Text> : null}
        <View style={styles.questions}>{current.render(form, error)}</View>
      </View>
    </Modal>
  );
}

const c = storybookTheme.color;
const NARROW_WIDTH = 480;

const styles = StyleSheet.create({
  body: { gap: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.disabledBackground },
  progressSegmentDone: { backgroundColor: c.primary },
  progressText: { fontSize: storybookTheme.type.xs, color: c.onLightMuted, fontVariant: ['tabular-nums'] },
  intro: { fontSize: storybookTheme.type.sm, lineHeight: 21, color: c.onLightBody },
  questions: { gap: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  skip: { fontSize: storybookTheme.type.sm, color: c.onLightMuted, textDecorationLine: 'underline', textAlign: 'center' },
  footerNarrow: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  footerButtons: { flexDirection: 'row', gap: 8, flexShrink: 1 },
  footerButtonsNarrow: { alignSelf: 'stretch' },
  footerButtonNarrow: { flex: 1, minWidth: 0 },
  footerButton: { minWidth: 96 },
  footerPrimary: { minWidth: 132 },
  stepError: { fontSize: storybookTheme.type.xs, color: c.error, textAlign: 'right' },
});
