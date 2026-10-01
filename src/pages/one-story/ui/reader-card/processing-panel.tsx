import { View } from 'react-native';

import { ActionButton } from '@/shared/ui';

import { withParticle } from '@/shared/lib';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';
import { LoadingPanel } from './loading-panel';

export function ProcessingPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    runtimeState,
    storyPackage,
    pendingTranscription,
    isPreparingResponseAudio,
    questionMode,
    beginQuestion,
    beginTypedQuestion,
    continueStory,
  } = runtime;

  const storyTitle = storyPackage.manifest.title;

  if (
    !(runtimeState.status === 'processing-question' && !pendingTranscription)
  ) {
    return null;
  }

  return (
    <LoadingPanel
      title={
        isPreparingResponseAudio ? (
          <>
            {withParticle(storyTitle, '이/가')}{'\n'}
            대답을 준비하고 있어요
          </>
        ) : (
          <>
            {withParticle(storyTitle, '이/가')}{'\n'}
            아이의 생각을 살펴보고 있어요
          </>
        )
      }
      body={
        isPreparingResponseAudio
          ? '목소리로 들려줄 준비가 되면 바로 이어갈게요.'
          : '이야기와 어울리는 안전한 길을 찾으면 바로 이어갈게요.'
      }
      actions={
        <View style={styles.recoveryActions}>
          <ActionButton
            variant="secondaryFull"
            label={questionMode === 'text' ? '말로 질문하기' : '글로 질문하기'}
            onPress={questionMode === 'text' ? beginQuestion : beginTypedQuestion}
          />
          <ActionButton
            variant="secondaryFull"
            label="이번 질문 건너뛰기"
            onPress={continueStory}
          />
        </View>
      }
    />
  );
}
