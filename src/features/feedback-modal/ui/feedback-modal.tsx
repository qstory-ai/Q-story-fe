import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { Modal, StatusBanner, TextareaField } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { submitFeedback } from '@/entities/feedback';

/**
 * 마이페이지에서 여는 개선사항 요청 오버레이 - 예전엔 /mypage/feedback 전체 화면 라우트였는데,
 * 한두 줄 남기고 바로 돌아갈 짧은 액션이라 화면 전환 없이 카드 위에 바로 띄운다(사용자 요청).
 */
export function FeedbackModal({
  visible,
  token,
  onClose,
}: {
  visible: boolean;
  token: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
      await submitFeedback(token, { message });
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
      eyebrow="개선사항 요청"
      title="어떤 점이 개선되면 좋을까요?"
      positiveAction={{ label: '제출', onPress: handleSubmit, disabled: !message.trim(), loading: submitting }}
      linkAction={{ label: '닫기', onPress: handleClose }}
      accessibilityLabel="개선사항 요청"
    >
      <TextareaField
        label="자유롭게 의견을 남겨 주세요"
        value={message}
        onChangeText={setMessage}
        placeholder="예: 질문 응답 대기 시간이 길었어요"
        numberOfLines={6}
        style={styles.multiline}
      />
      {submitted ? <StatusBanner label="소중한 의견 감사해요!" /> : null}
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
