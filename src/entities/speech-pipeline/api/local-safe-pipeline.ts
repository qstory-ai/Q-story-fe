import {
  type FallbackPlan,
} from '@/entities/story-runtime';
import type { StoryRuntimePackage } from '@/entities/story';

import type {
  SpeechPipeline,
  SpeechPipelineInput,
  SpeechPipelineOutput,
  TextQuestionPipelineInput,
  TranscriptionOutput,
} from './types';

function defaultForInput(
  input: Pick<SpeechPipelineInput, 'storyId' | 'sceneId' | 'anchorId'>,
  storyPackage: StoryRuntimePackage,
): FallbackPlan {
  const anchor = storyPackage.manifest.questionAnchors.find(
    (candidate) =>
      candidate.id === input.anchorId && candidate.sceneId === input.sceneId,
  );
  const fallback = anchor
    ? storyPackage.manifest.fallbackFamilies.find(
        (candidate) => candidate.id === anchor.defaultFallbackFamilyId,
      )
    : null;
  if (!fallback) {
    throw new Error(
      `No package fallback for ${input.storyId}/${input.sceneId}/${input.anchorId}`,
    );
  }
  return {
    kind: 'fallback',
    familyId: fallback.id,
    text:
      fallback.acknowledgementText ??
      '목소리를 잘 담았어. 지금은 준비된 장면으로 계속할게.',
    rejoinAt: fallback.rejoinAnchorId,
  };
}

export class LocalSafeSpeechPipeline implements SpeechPipeline {
  constructor(private readonly storyPackage: StoryRuntimePackage) {}

  async transcribe(
    input: SpeechPipelineInput,
    signal: AbortSignal,
  ): Promise<TranscriptionOutput> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, 450);
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          reject(new DOMException('Speech processing aborted', 'AbortError'));
        },
        { once: true },
      );
    });

    return {
      ok: false,
      failure: {
        code: 'SPEECH_PROVIDER_NOT_CONFIGURED',
        stage: 'stt',
        retryable: false,
        safeDetail:
          'Provider-neutral boundary is active; server adapter is not configured.',
      },
      fallback: defaultForInput(input, this.storyPackage),
    };
  }

  async route(
    input: TextQuestionPipelineInput,
    _signal: AbortSignal,
  ): Promise<SpeechPipelineOutput> {
    return {
      ok: false,
      failure: {
        code: 'RESPONSE_PROVIDER_NOT_CONFIGURED',
        stage: 'response',
        retryable: false,
        safeDetail:
          'Provider-neutral boundary is active; server adapter is not configured.',
      },
      fallback: defaultForInput(input, this.storyPackage),
    };
  }
}
