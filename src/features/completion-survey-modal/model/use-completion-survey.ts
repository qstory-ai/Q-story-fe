import { useCallback, useState } from 'react';

import { submitCompletionSurvey } from '@/entities/completion-survey';
import { messageForError } from '@/shared/api';

export const CHILD_AGE_BAND_OPTIONS = ['5세 이하', '6세', '7세', '8세', '9세', '10세 이상'];

export const INPUT_UNDERSTANDING_OPTIONS = [
  '아이가 먼저 “내가 말해서 바뀌었어”라고 표현했어요',
  '말로 표현하지는 않았지만 달라진 장면에 반응했어요',
  '부모가 설명해 주자 이해했어요',
  '알아차리지 못한 것 같아요',
  '잘 모르겠어요',
];

export const HELP_NEEDED_OPTIONS = [
  '거의 혼자 듣고 답했어요',
  '가끔 질문을 다시 설명해 줬어요',
  '여러 번 부모가 답변을 도와줬어요',
  '아이가 직접 답하기 어려워했어요',
];

export const CHILD_REACTION_OPTIONS = [
  '질문하거나 자기 생각을 말했어요',
  '다음 장면을 예상했어요',
  '선택한 이유를 설명했어요',
  '부모에게 다시 물어봤어요',
  '다시 해보고 싶다고 했어요',
  '특별한 반응은 없었어요',
];

export const DISRUPTION_OPTIONS = [
  '질문에 언제, 어떻게 답해야 할지 헷갈렸어요',
  '아이의 말을 잘 알아듣지 못했어요',
  '다음 장면을 기다리는 시간이 길었어요',
  '이야기의 길이나 전개가 아이와 맞지 않았어요',
  '버튼이나 화면 조작이 어려웠어요',
  '소리 또는 음성 재생에 문제가 있었어요',
  '기술 오류로 체험이 중단됐어요',
  '특별히 불편한 점은 없었어요',
];

export const BEST_ASPECT_OPTIONS = [
  '캐릭터가 아이에게 질문한 순간',
  '아이의 말이 장면에 반영된 점',
  '달라진 장면이 원 이야기로 자연스럽게 이어진 점',
  '부모 리포트로 아이의 질문과 선택을 본 점',
  '부모와 아이가 자연스럽게 대화한 시간',
  '특별히 좋다고 느낀 점은 없었어요',
];

export const RETRY_INTEREST_OPTIONS = [
  '나오면 꼭 다시 체험하고 싶어요',
  '아마 다시 체험할 것 같아요',
  '아직 잘 모르겠어요',
  '아마 다시 체험하지 않을 것 같아요',
  '다시 체험할 생각이 없어요',
];

export const REVIEW_USAGE_CONSENT_OPTIONS = [
  '아이 나이대와 함께 익명으로 공개해도 괜찮아요',
  'Q-Story 내부 개선에만 사용해 주세요',
  '한 줄 후기를 작성하지 않았어요',
];

export const WANTS_NEXT_STORIES_OPTIONS = ['네, 안내받을 연락처를 남길게요', '이번에는 괜찮아요'];

export const CONTACT_CONSENT_OPTIONS = ['동의합니다', '연락처를 남기지 않았습니다'];

/** "기타" 칩을 고르면 직접 입력한 텍스트가 최종 값이 된다 - Google Form의 "기타" 응답과 동일한 동작. */
const OTHER_CHOICE = '기타';

/**
 * 완주 후 부모 리포트에서 남기는 "1분 체험 후기" - 기존 외부 Google Form과 동일한 문항을 인앱
 * 모달로 받는다(use-one-story-runtime.ts의 openCompletionSurvey 참고). 열고 닫을 때마다 답을
 * 새로 받는다 - 한 세션에서 여러 이야기를 완주할 수 있어 이전 답을 남겨두면 다음 후기에 섞여
 * 들어갈 수 있기 때문이다.
 */
export function useCompletionSurvey(storyId: string) {
  const [childAgeBand, setChildAgeBand] = useState('');
  const [childEngagement, setChildEngagement] = useState<number | null>(null);
  const [inputUnderstanding, setInputUnderstanding] = useState('');
  const [helpNeeded, setHelpNeeded] = useState('');
  const [childReactions, setChildReactions] = useState<string[]>([]);
  const [childReactionsOtherText, setChildReactionsOtherText] = useState('');
  const [disruptions, setDisruptions] = useState<string[]>([]);
  const [reportHelpfulness, setReportHelpfulness] = useState<number | null>(null);
  const [bestAspect, setBestAspect] = useState('');
  const [bestAspectOtherText, setBestAspectOtherText] = useState('');
  const [topPriority, setTopPriority] = useState('');
  const [retryInterest, setRetryInterest] = useState('');
  const [oneLineReview, setOneLineReview] = useState('');
  const [reviewUsageConsent, setReviewUsageConsent] = useState('');
  const [wantsNextStories, setWantsNextStories] = useState('');
  const [contact, setContact] = useState('');
  const [contactConsent, setContactConsent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const childReactionsOtherOn = childReactions.includes(OTHER_CHOICE);
  const childReactionsValid =
    childReactions.length > 0 &&
    (!childReactionsOtherOn || childReactionsOtherText.trim().length > 0);
  const bestAspectOtherOn = bestAspect === OTHER_CHOICE;
  const bestAspectValid = bestAspectOtherOn
    ? bestAspectOtherText.trim().length > 0
    : bestAspect.length > 0;

  const canSubmit =
    childAgeBand.length > 0 &&
    childEngagement !== null &&
    inputUnderstanding.length > 0 &&
    helpNeeded.length > 0 &&
    childReactionsValid &&
    disruptions.length > 0 &&
    reportHelpfulness !== null &&
    bestAspectValid &&
    retryInterest.length > 0 &&
    reviewUsageConsent.length > 0 &&
    wantsNextStories.length > 0 &&
    contactConsent.length > 0;

  const reset = useCallback(() => {
    setChildAgeBand('');
    setChildEngagement(null);
    setInputUnderstanding('');
    setHelpNeeded('');
    setChildReactions([]);
    setChildReactionsOtherText('');
    setDisruptions([]);
    setReportHelpfulness(null);
    setBestAspect('');
    setBestAspectOtherText('');
    setTopPriority('');
    setRetryInterest('');
    setOneLineReview('');
    setReviewUsageConsent('');
    setWantsNextStories('');
    setContact('');
    setContactConsent('');
    setError(null);
    setSubmitting(false);
    setSubmitted(false);
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit || childEngagement === null || reportHelpfulness === null) return;
    setError(null);
    setSubmitting(true);
    try {
      const resolvedChildReactions = childReactions
        .filter((value) => value !== OTHER_CHOICE)
        .concat(childReactionsOtherOn && childReactionsOtherText.trim() ? [childReactionsOtherText.trim()] : []);
      const resolvedBestAspect = bestAspectOtherOn ? bestAspectOtherText.trim() : bestAspect;

      await submitCompletionSurvey({
        storyId,
        childAgeBand,
        childEngagement,
        inputUnderstanding,
        helpNeeded,
        childReactions: resolvedChildReactions,
        disruptions,
        reportHelpfulness,
        bestAspect: resolvedBestAspect,
        topPriority: topPriority.trim() || undefined,
        retryInterest,
        oneLineReview: oneLineReview.trim() || undefined,
        reviewUsageConsent,
        wantsNextStories,
        contact: contact.trim() || undefined,
        contactConsent,
      });
      setSubmitted(true);
    } catch (failure) {
      setError(messageForError(failure, '후기를 저장하지 못했어요. 네트워크를 확인 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    storyId,
    childAgeBand,
    childEngagement,
    inputUnderstanding,
    helpNeeded,
    childReactions,
    childReactionsOtherOn,
    childReactionsOtherText,
    disruptions,
    reportHelpfulness,
    bestAspect,
    bestAspectOtherOn,
    bestAspectOtherText,
    topPriority,
    retryInterest,
    oneLineReview,
    reviewUsageConsent,
    wantsNextStories,
    contact,
    contactConsent,
  ]);

  return {
    childAgeBand,
    setChildAgeBand,
    childEngagement,
    setChildEngagement,
    inputUnderstanding,
    setInputUnderstanding,
    helpNeeded,
    setHelpNeeded,
    childReactions,
    setChildReactions,
    childReactionsOtherOn,
    childReactionsOtherText,
    setChildReactionsOtherText,
    disruptions,
    setDisruptions,
    reportHelpfulness,
    setReportHelpfulness,
    bestAspect,
    setBestAspect,
    bestAspectOtherOn,
    bestAspectOtherText,
    setBestAspectOtherText,
    topPriority,
    setTopPriority,
    retryInterest,
    setRetryInterest,
    oneLineReview,
    setOneLineReview,
    reviewUsageConsent,
    setReviewUsageConsent,
    wantsNextStories,
    setWantsNextStories,
    contact,
    setContact,
    contactConsent,
    setContactConsent,
    error,
    submitting,
    submitted,
    canSubmit,
    submit,
    reset,
  };
}

export type UseCompletionSurvey = ReturnType<typeof useCompletionSurvey>;
export { OTHER_CHOICE };
