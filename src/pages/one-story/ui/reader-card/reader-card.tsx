import { Text, View } from 'react-native';

import type { OneStoryRuntime } from '../../model';
import { statusCopy } from '../../lib/runtime-view';
import { styles } from '../styles';
import { AwaitingChoicePanel } from './awaiting-choice-panel';
import { CompletePanel } from './complete-panel';
import { ConfirmTranscriptPanel } from './confirm-transcript-panel';
import { FailedRecoverablePanel } from './failed-recoverable-panel';
import { GeneratingBranchPanel } from './generating-branch-panel';
import { IdlePanel } from './idle-panel';
import { ParentMessageBanner } from './parent-message-banner';
import { PlaybackCaption } from './playback-caption';
import { ProcessingPanel } from './processing-panel';
import { QuestionInvitePanel } from './question-invite-panel';
import { RecordingTextPanel } from './recording-text-panel';
import { RecordingVoicePanel } from './recording-voice-panel';
import { ResponsePanel } from './response-panel';

export function ReaderCard({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    isWide,
    isPlaybackDockState,
    captionVisible,
    isParentReport,
    isQuestionInvitePlayback,
    speaker,
  } = runtime;

  return (
    <View
      style={[
        styles.readerCard,
        isWide && styles.readerCardWide,
        runtimeState.status === 'idle' && styles.onboardingCard,
        runtimeState.status !== 'idle' &&
          !isPlaybackDockState &&
          styles.interactionCard,
        isPlaybackDockState && styles.playbackCard,
        isPlaybackDockState && !captionVisible && styles.playbackCardCollapsed,
        isParentReport && styles.reportReaderCard,
      ]}
    >
      {!isPlaybackDockState && !isParentReport && (
        <View style={styles.cardMetaRow}>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {isQuestionInvitePlayback
                ? `${speaker?.displayName ?? '이야기 친구'}이 묻고 있어요`
                : statusCopy(runtimeState)}
            </Text>
          </View>
        </View>
      )}

      <IdlePanel runtime={runtime} />
      <PlaybackCaption runtime={runtime} />
      <QuestionInvitePanel runtime={runtime} />
      <RecordingVoicePanel runtime={runtime} />
      <RecordingTextPanel runtime={runtime} />
      <ConfirmTranscriptPanel runtime={runtime} />
      <ProcessingPanel runtime={runtime} />
      <GeneratingBranchPanel runtime={runtime} />
      <FailedRecoverablePanel runtime={runtime} />
      <AwaitingChoicePanel runtime={runtime} />
      <ResponsePanel runtime={runtime} />
      <CompletePanel runtime={runtime} />
      <ParentMessageBanner runtime={runtime} />
    </View>
  );
}
