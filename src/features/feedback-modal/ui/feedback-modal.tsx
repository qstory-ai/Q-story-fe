import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Modal, StatusBanner, TextareaField } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { submitFeedback } from '@/entities/feedback';

export type FeedbackKind = 'suggestion' | 'bug';

/**
 * 마이페이지에서 여는 개선사항 요청 오버레이. kind에 따라 제목/힌트/prefix가 갈라진다:
 *  - `suggestion` (default): "어떤 점이 개선되면 좋을까요?" - 기능 제안
 *  - `bug`: "어디에서 오류가 났나요?" - 오류 제보 (실행 단계·기대 결과 힌트)
 *
 * BE의 submitFeedback API는 아직 kind 필드를 받지 않는다. 대신 message 앞에 `[기능 제안]`/
 * `[오류 제보]` 프리픽스를 붙여 운영 팀 인박스에서 종류를 즉시 구분할 수 있게 한다 - 추후
 * BE에 kind 컬럼이 생기면 이 프리픽스는 서버가 자동 채우도록 옮긴다.
 */
export function FeedbackModal({
  visible,
  token,
  onClose,
  kind = 'suggestion',
}: {
  visible: boolean;
  token: string;
  onClose: () => void;
  kind?: FeedbackKind;
}) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const copy = kind === 'bug'
    ? {
        eyebrow: '오류 제보',
        title: '어디에서 오류가 났나요?',
        placeholder: '예: /parent에서 이야기를 열려고 하면 화면이 회색으로만 남아요. 오후 2시쯤 발생.',
        fieldLabel: '언제·어디에서·어떻게 재현되는지 알려 주세요',
        prefix: '[오류 제보]',
        thankYou: '제보 감사해요! 곧 확인할게요.',
      }
    : {
        eyebrow: '개선사항 요청',
        title: '어떤 점이 개선되면 좋을까요?',
        placeholder: '예: 질문 응답 대기 시간이 길었어요',
        fieldLabel: '자유롭게 의견을 남겨 주세요',
        prefix: '[기능 제안]',
        thankYou: '소중한 의견 감사해요!',
      };

  function handleClose() {
    setMessage('');
    setError(null);
    setSubmitted(false);
    onClose();
  }

  async function handleSubmit() {
    setError(null);
    setSubmitted(false);
    setSubmitting(true);
    try {
      await submitFeedback(token, { message: `${copy.prefix} ${message.trim()}` });
      setMessage('');
      setSubmitted(true);
    } catch (err) {
      setError(messageForError(err, '의견을 보내지 못했어요. 네트워크를 확인 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      eyebrow={copy.eyebrow}
      title={copy.title}
      positiveAction={{ label: '제출', onPress: handleSubmit, disabled: !message.trim(), loading: submitting }}
      linkAction={{ label: '닫기', onPress: handleClose }}
      accessibilityLabel={copy.eyebrow}
    >
      <TextareaField
        label={copy.fieldLabel}
        value={message}
        onChangeText={setMessage}
        placeholder={copy.placeholder}
        numberOfLines={6}
        style={styles.multiline}
      />
      {submitted ? <StatusBanner label={copy.thankYou} /> : null}
      {error ? <StatusBanner variant="warning" label={error} /> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  multiline: {
    minHeight: 140,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});
