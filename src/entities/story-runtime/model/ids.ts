export type Brand<T, Name extends string> = T & {
  readonly __brand: Name;
};

export type StoryId = Brand<string, 'StoryId'>;
export type SceneId = Brand<string, 'SceneId'>;
export type VisualStateId = Brand<string, 'VisualStateId'>;
export type AudioGroupId = Brand<string, 'AudioGroupId'>;
export type AudioClipId = Brand<string, 'AudioClipId'>;
export type AssetId = Brand<string, 'AssetId'>;
export type SpeakerId = Brand<string, 'SpeakerId'>;
export type QuestionAnchorId = Brand<string, 'QuestionAnchorId'>;
export type RejoinAnchorId = Brand<string, 'RejoinAnchorId'>;
export type FallbackFamilyId = Brand<string, 'FallbackFamilyId'>;
export type TraceId = Brand<string, 'TraceId'>;
export type RecordingAssetId = Brand<string, 'RecordingAssetId'>;

function createId<T extends string>(value: string, label: string): T {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }

  if (/\s/.test(normalized)) {
    throw new Error(`${label} cannot contain whitespace.`);
  }

  return normalized as T;
}

export const storyId = (value: string) => createId<StoryId>(value, 'StoryId');
export const sceneId = (value: string) => createId<SceneId>(value, 'SceneId');
export const visualStateId = (value: string) =>
  createId<VisualStateId>(value, 'VisualStateId');
export const audioGroupId = (value: string) =>
  createId<AudioGroupId>(value, 'AudioGroupId');
export const audioClipId = (value: string) =>
  createId<AudioClipId>(value, 'AudioClipId');
export const assetId = (value: string) => createId<AssetId>(value, 'AssetId');
export const speakerId = (value: string) =>
  createId<SpeakerId>(value, 'SpeakerId');
export const questionAnchorId = (value: string) =>
  createId<QuestionAnchorId>(value, 'QuestionAnchorId');
export const rejoinAnchorId = (value: string) =>
  createId<RejoinAnchorId>(value, 'RejoinAnchorId');
export const fallbackFamilyId = (value: string) =>
  createId<FallbackFamilyId>(value, 'FallbackFamilyId');
export const traceId = (value: string) => createId<TraceId>(value, 'TraceId');
export const recordingAssetId = (value: string) =>
  createId<RecordingAssetId>(value, 'RecordingAssetId');
