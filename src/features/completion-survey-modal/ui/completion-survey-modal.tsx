import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Modal, ModalBody, TextField } from '@/shared/ui';

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
import { MultiChoiceQuestion, ScaleQuestion, SingleChoiceQuestion } from './question-controls';

function toggle(values: string[], option: string) {
  return values.includes(option) ? values.filter((v) => v !== option) : [...values, option];
}

/**
 * 완주 후 부모 리포트 화면의 "1분 체험 후기 남기기"가 여는 인앱 설문 - 기존에는 같은 문항을
 * 외부 Google Form으로 리다이렉트해서 받았다(entities/analytics/model/beta-events.ts의
 * getCompletionSurveyUrl 참고). 문항 구성은 그 Form과 동일하게 유지한다 - 이미 쌓인 응답과
 * 비교할 수 있어야 하기 때문이다. LaunchNotificationGate와 달리 선택 사항이라 linkAction으로
 * 건너뛸 수 있다.
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
  // 필수 항목이 비어있어도 "후기 보내기"는 그냥 눌리지 않기만 할 뿐 설명이 없으면 안 되므로,
  // 한 번이라도 눌러보면(canSubmit이 false인 채로) 그때부터 각 필드 아래 무엇이 비었는지 보여준다.
  const [showValidation, setShowValidation] = useState(false);

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
          부모님의 의견은 다음 동화와 부모 리포트를 고치는 데 반영할게요. 체험단 안내를
          신청하셨다면 다음 이야기가 준비되는 대로 연락드릴게요.
        </ModalBody>
      </Modal>
    );
  }

  const handleSkip = () => {
    form.reset();
    onClose();
  };

  const attemptSubmit = () => {
    if (!form.canSubmit) {
      setShowValidation(true);
      return;
    }
    void form.submit();
  };

  const fieldError = (valid: boolean, message: string) =>
    showValidation && !valid ? message : undefined;

  return (
    <Modal
      visible
      eyebrow="Q-Story 체험 후 1분 설문"
      title="방금 체험, 어떠셨나요?"
      positiveAction={{
        label: '후기 보내기',
        onPress: attemptSubmit,
        disabled: form.submitting,
        loading: form.submitting,
      }}
      linkAction={{ label: '나중에 할게요', onPress: handleSkip }}
      accessibilityLabel="체험 후기 설문"
    >
      <ModalBody>
        좋았던 순간만큼, 아이가 망설였던 순간도 궁금합니다. 정답은 없으니 옆에서 보신 아이의
        실제 반응만 알려주세요.
      </ModalBody>

      <SingleChoiceQuestion
        label="함께 체험한 아이는 몇 살인가요?"
        options={CHILD_AGE_BAND_OPTIONS}
        value={form.childAgeBand}
        onChange={form.setChildAgeBand}
        errorText={fieldError(form.childAgeBand.length > 0, '아이 나이를 선택해 주세요.')}
      />
      <ScaleQuestion
        label="아이의 몰입도는 어땠나요?"
        minLabel="금방 다른 곳으로 관심이 갔어요"
        maxLabel="끝까지 집중했어요"
        value={form.childEngagement}
        onChange={form.setChildEngagement}
        errorText={fieldError(form.childEngagement !== null, '몰입도를 선택해 주세요.')}
      />
      <SingleChoiceQuestion
        label="아이는 자신의 말이 이야기에 반영됐다는 것을 어떻게 받아들였나요?"
        options={INPUT_UNDERSTANDING_OPTIONS}
        value={form.inputUnderstanding}
        onChange={form.setInputUnderstanding}
        errorText={fieldError(form.inputUnderstanding.length > 0, '아이의 반응을 선택해 주세요.')}
      />
      <SingleChoiceQuestion
        label="아이가 답할 때 어느 정도 도움이 필요했나요?"
        options={HELP_NEEDED_OPTIONS}
        value={form.helpNeeded}
        onChange={form.setHelpNeeded}
        errorText={fieldError(form.helpNeeded.length > 0, '도움 정도를 선택해 주세요.')}
      />
      <MultiChoiceQuestion
        label="체험 중 아이가 보인 반응을 모두 골라주세요."
        options={CHILD_REACTION_OPTIONS}
        values={form.childReactions}
        onToggle={(option) => form.setChildReactions(toggle(form.childReactions, option))}
        allowOther
        otherValue={form.childReactionsOtherText}
        onOtherChange={form.setChildReactionsOtherText}
        errorText={fieldError(
          form.childReactions.length > 0 &&
            (!form.childReactionsOtherOn || form.childReactionsOtherText.trim().length > 0),
          '아이가 보인 반응을 선택해 주세요.',
        )}
      />
      <MultiChoiceQuestion
        label="체험 중 불편하거나 흐름이 끊긴 순간이 있었나요? 모두 골라주세요."
        options={DISRUPTION_OPTIONS}
        values={form.disruptions}
        onToggle={(option) => form.setDisruptions(toggle(form.disruptions, option))}
        errorText={fieldError(form.disruptions.length > 0, '불편했던 점을 선택해 주세요.')}
      />
      <ScaleQuestion
        label="부모 리포트가 아이와 대화를 이어가는 데 얼마나 도움이 되었나요?"
        minLabel="전혀 도움이 되지 않았어요"
        maxLabel="매우 도움이 되었어요"
        value={form.reportHelpfulness}
        onChange={form.setReportHelpfulness}
        errorText={fieldError(form.reportHelpfulness !== null, '도움 정도를 선택해 주세요.')}
      />
      <SingleChoiceQuestion
        label="부모님께서 같이 플레이하면서 가장 좋았던 점은 무엇인가요?"
        options={BEST_ASPECT_OPTIONS}
        value={form.bestAspect}
        onChange={form.setBestAspect}
        allowOther
        otherValue={form.bestAspectOtherText}
        onOtherChange={form.setBestAspectOtherText}
        errorText={fieldError(
          form.bestAspectOtherOn
            ? form.bestAspectOtherText.trim().length > 0
            : form.bestAspect.length > 0,
          '가장 좋았던 점을 선택해 주세요.',
        )}
      />
      <TextField
        label="가장 먼저 고쳤으면 하는 점이 있다면 한 가지만 적어주세요. (선택)"
        value={form.topPriority}
        onChangeText={form.setTopPriority}
        placeholder="예: 질문 응답 대기 시간이 길었어요"
      />
      <SingleChoiceQuestion
        label="다음 동화가 나오면 아이와 다시 체험하고 싶으신가요?"
        options={RETRY_INTEREST_OPTIONS}
        value={form.retryInterest}
        onChange={form.setRetryInterest}
        errorText={fieldError(form.retryInterest.length > 0, '다시 체험할 의향을 선택해 주세요.')}
      />

      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>다른 부모님께 들려주고 싶은 한마디</Text>
        <Text style={styles.sectionBody}>
          좋았던 점과 아쉬웠던 점 모두 괜찮아요. 다른 부모님에게 설명하듯 한 문장으로 남겨주세요.
          작성과 공개는 모두 선택입니다.
        </Text>
      </View>
      <TextField
        label="다른 부모님께 Q-Story를 한 문장으로 소개한다면 어떻게 말하고 싶으세요? (선택)"
        value={form.oneLineReview}
        onChangeText={form.setOneLineReview}
        placeholder="예: 아이가 직접 질문하며 참여하는 동화예요"
      />
      <SingleChoiceQuestion
        label="작성한 한 줄 후기를 어떻게 사용해도 될까요?"
        options={REVIEW_USAGE_CONSENT_OPTIONS}
        value={form.reviewUsageConsent}
        onChange={form.setReviewUsageConsent}
        errorText={fieldError(
          form.reviewUsageConsent.length > 0,
          '후기 사용 동의 여부를 선택해 주세요.',
        )}
      />

      <View style={styles.sectionDivider}>
        <Text style={styles.sectionTitle}>다음 두 이야기를 먼저 만나보세요</Text>
        <Text style={styles.sectionBody}>
          Q-Story 가족 체험단은 다음 두 동화를 정식 공개 전에 아이와 무료로 체험하고, 짧은
          의견을 남기는 프로그램입니다. 신청하시면 다음 두 동화를 먼저 체험하고, 다음 작품 후보
          투표와 부모님 의견을 반영해 달라진 내용도 받아보실 수 있어요.
        </Text>
      </View>
      <SingleChoiceQuestion
        label="다음 두 동화를 먼저 체험해보고 싶으신가요?"
        options={WANTS_NEXT_STORIES_OPTIONS}
        value={form.wantsNextStories}
        onChange={form.setWantsNextStories}
        errorText={fieldError(
          form.wantsNextStories.length > 0,
          '다음 이야기 체험 의향을 선택해 주세요.',
        )}
      />
      <TextField
        label="체험단 안내를 받을 이메일 또는 휴대전화 번호를 남겨주세요. (선택)"
        value={form.contact}
        onChangeText={form.setContact}
        placeholder="parent@example.com 또는 010-0000-0000"
      />
      <SingleChoiceQuestion
        label="연락처를 남긴 경우, 다음 이야기 체험 안내를 위해 연락처를 수집·이용하는 데 동의하시나요? (안내 종료 후 파기)"
        options={CONTACT_CONSENT_OPTIONS}
        value={form.contactConsent}
        onChange={form.setContactConsent}
        errorText={fieldError(
          form.contactConsent.length > 0,
          '연락처 수집 동의 여부를 선택해 주세요.',
        )}
      />
      {form.error ? <Text style={styles.submitError}>{form.error}</Text> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  sectionDivider: {
    gap: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEE3F5',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#28153F',
  },
  sectionBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#706476',
  },
  submitError: {
    fontSize: 12,
    color: '#E46647',
    textAlign: 'center',
  },
});
