import type { AudioSource, ImageSource } from './media-source';

import {
  assetId,
  audioClipId,
  audioGroupId,
  fallbackFamilyId,
  questionAnchorId,
  rejoinAnchorId,
  sceneId,
  speakerId,
  storyId,
  visualStateId,
  type AudioGroup,
  type ContentAsset,
  type FallbackFamily,
  type QuestionAnchor,
  type RoutePlan,
  type RejoinAnchor,
  type Speaker,
  type StoryManifest,
  type StoryScene,
  type VisualState,
} from '@/entities/story-runtime';

import type {
  AttemptBackdrop,
  GeneratedFallback,
  GeneratedStoryContent,
  GeneratedStoryScene,
  GeneratedStorySegment,
  StoryPackageData,
  StoryReportCopy,
  InviteHelp,
} from './story-package-types';

type UtterancePresentation = Extract<
  GeneratedStorySegment,
  { kind: 'utterance' }
> & {
  sceneId: string;
  groupId: string;
  clipId: string;
};

export type StoryPresentation = {
  scenes: readonly GeneratedStoryScene[];
  fallbacks: readonly GeneratedFallback[];
  utteranceByClipId: Readonly<Record<string, UtterancePresentation>>;
  fallbackByFamilyId: Readonly<Record<string, GeneratedFallback>>;
};

export type StoryRuntimePackage = {
  storyId: string;
  slug: string;
  availability: 'INTERNAL' | 'BETA' | 'PUBLISHED' | 'DISABLED';
  manifest: StoryManifest;
  presentation: StoryPresentation;
  reportCopy: StoryReportCopy;
  imageAssets: Readonly<Record<string, ImageSource>>;
  audioAssets: Readonly<Record<string, AudioSource>>;
  illustrationForAssetId: (assetId: string) => ImageSource;
  branchIllustrationAssetId: (familyId: string | null) => string | null;
  branchReportSummary: (familyId: string | null) => string | null;
  branchInteractionCopy: (familyId: string) => {
    text: string;
    audioId: string | null;
  };
  repairRoutePlanForHistory: (
    anchorId: string,
    plan: RoutePlan,
    priorActionFamilyIds: readonly string[],
  ) => RoutePlan;
  speakerIdForTag: (tag: string) => string;
  narratorSpeakerId: string;
  /** Q-31 그레텔 대화용 콘텐츠 - story.yaml의 sceneSynopses·inviteHelp·thinkingFillers. 없으면 빈 값. */
  dialogue: {
    sceneSynopses: Readonly<Record<string, string>>;
    inviteHelp: Readonly<Record<string, InviteHelp>>;
    /** 질문 초대 시도 장면 배경 그림 후보(앵커 id별) - 그림이 실제로 있는 것만 남긴다. */
    attemptBackdrops: Readonly<Record<string, readonly AttemptBackdrop[]>>;
    /** "생각 중" 채움말 문장 - i번째(0부터)의 녹음 id는 dialogue-thinking-<i+1>. */
    thinkingFillers: readonly string[];
  };
};

function nextUtteranceIndex(
  segments: readonly GeneratedStorySegment[],
  fromIndex: number,
) {
  return segments.findIndex(
    (segment, index) => index > fromIndex && segment.kind === 'utterance',
  );
}

function previousUtteranceIndex(
  segments: readonly GeneratedStorySegment[],
  fromIndex: number,
) {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (segments[index]?.kind === 'utterance') return index;
  }
  return -1;
}

/**
 * Deterministic narration-asset slug for one utterance segment - `stem` is a scene id with the
 * story prefix already stripped ("F01") or a fallback family id ("A_OBSERVE_BIRD"), `segmentIndex`
 * is that segment's index within its scene's/fallback's full `segments` array (not an
 * utterance-only counter). This is also the fixed-audio clip id (assets.json, and therefore
 * STORY_AUDIO_ASSETS_BY_ID) for that segment, so anything that needs to ask for a segment's
 * pre-recorded audio - inside this module or a caller playing a fallback/story-change branch's own
 * narrative - must derive the id through this function rather than re-deriving the shape, or the
 * lookup silently misses and falls back to on-demand TTS for audio that already exists.
 */
export function narrationUtteranceSlug(stem: string, segmentIndex: number): string {
  const serial = String(segmentIndex + 1).padStart(3, '0');
  return `${stem.toLowerCase().replaceAll('_', '-')}-${serial}`;
}

/**
 * 시도 장면 배경 후보 중 그림이 실제로 내려온 것만 남긴다 - 그림을 아직 올리지 않았거나(서버 자산 목록에 없음) 형식이 어긋난
 * 후보를 그레텔 대화에 보내면 AI가 보여 줄 수 없는 그림을 고르게 된다.
 */
export function availableAttemptBackdrops(
  declared: Record<string, AttemptBackdrop[]> | undefined,
  imageAssets: Readonly<Record<string, ImageSource>>,
): Record<string, readonly AttemptBackdrop[]> {
  const result: Record<string, readonly AttemptBackdrop[]> = {};
  for (const [anchorId, backdrops] of Object.entries(declared ?? {})) {
    if (!Array.isArray(backdrops)) continue;
    const usable = backdrops.filter(
      (backdrop) =>
        typeof backdrop?.id === 'string' &&
        typeof backdrop.description === 'string' &&
        backdrop.description.trim().length > 0 &&
        Boolean(imageAssets[backdrop.id]),
    );
    if (usable.length > 0) result[anchorId] = usable;
  }
  return result;
}

export function buildStoryRuntimePackage({
  generatedContent,
  packageData,
  imageAssets,
  audioAssets,
}: {
  generatedContent: GeneratedStoryContent;
  packageData: StoryPackageData;
  imageAssets: Readonly<Record<string, ImageSource>>;
  audioAssets: Readonly<Record<string, AudioSource>>;
}): StoryRuntimePackage {
  const contentAssets: ContentAsset[] = [];
  const visualStates: VisualState[] = [];
  const audioGroups: AudioGroup[] = [];
  const speakers: Speaker[] = [];
  const scenes: StoryScene[] = [];
  const questionAnchors: QuestionAnchor[] = [];
  const rejoinAnchors: RejoinAnchor[] = [];
  const fallbackFamilies: FallbackFamily[] = [];
  const utteranceByClipId: Record<string, UtterancePresentation> = {};
  const fallbackByFamilyId: Record<string, GeneratedFallback> = {};
  const knownAssetIds = new Set<string>();
  const knownSpeakerIds = new Set<string>();
  const groupByPosition = new Map<string, string>();
  const targetGroupByAnchor = new Map<
    string,
    { sceneId: string; groupId: string }
  >();
  const anchorBySlot = new Map(
    Object.entries(packageData.routeContext.anchors).map(
      ([id, anchor]) => [anchor.slot, { id, ...anchor }] as const,
    ),
  );
  const castByTag = packageData.cast.speakers;
  // 실시간 분기 생성 파이프라인이 가끔 태그 대신 speakerId 자체를 `speaker` 필드에 써서 보낸다
  // (예: "GRETEL" 대신 "HG-SPK-GRETEL") - 그 값도 캐스트를 찾을 수 있도록 speakerId로도 조회한다.
  const castBySpeakerId = new Map(
    Object.values(castByTag).map((cast) => [cast.speakerId, cast] as const),
  );
  const resolveCastByTag = (tag: string) => castByTag[tag] ?? castBySpeakerId.get(tag);
  const familyConfigById = new Map(
    Object.values(packageData.routeContext.anchors).flatMap((anchor) =>
      anchor.actionFamilies.map((family) => [family.id, family] as const),
    ),
  );

  function addAsset(id: string, kind: 'image' | 'audio', uri: string) {
    if (knownAssetIds.has(id)) return;
    knownAssetIds.add(id);
    contentAssets.push({ id: assetId(id), kind, uri });
  }

  function addSpeaker(tag: string) {
    const cast = resolveCastByTag(tag);
    if (!cast) throw new Error(`Unknown speaker tag ${tag}`);
    if (!knownSpeakerIds.has(cast.speakerId)) {
      knownSpeakerIds.add(cast.speakerId);
      speakers.push({
        id: speakerId(cast.speakerId),
        role: cast.role,
        displayName: cast.displayName,
      });
    }
    return speakerId(cast.speakerId);
  }

  // Scene ids are already story-qualified ("HG-F01"); family ids are not ("A_OBSERVE_BIRD").
  // Strip the prefix so the derived id carries exactly one copy of it.
  const localId = (value: string) =>
    value.startsWith(`${packageData.story.storyId}-`)
      ? value.slice(packageData.story.storyId.length + 1)
      : value;

  function addUtteranceGroup({
    scene,
    segment,
    segmentIndex,
    stem,
    positionKey,
  }: {
    scene: GeneratedStoryScene;
    segment: Extract<GeneratedStorySegment, { kind: 'utterance' }>;
    segmentIndex: number;
    stem: string;
    // Distinct from `stem`: fallback utterances are attached to the scene they rejoin into, so
    // keying their position by that scene's id would collide with the scene's own utterances.
    positionKey: string;
  }) {
    const visualId = segment.visualId ?? scene.visuals[0]?.id;
    if (!visualId) throw new Error(`${scene.id} utterance has no visual.`);
    // These ids are derived, never authored - assets.json has to spell them the same way, so the
    // shape lives in narrationUtteranceSlug() alone (see its doc comment for why callers outside
    // this module must go through it too rather than re-deriving the format).
    const slug = narrationUtteranceSlug(stem, segmentIndex);
    const group = `ag-${slug}`;
    const clip = slug;
    const audioAsset = `src-${slug}`;
    addAsset(audioAsset, 'audio', `tts://${clip}`);
    audioGroups.push({
      id: audioGroupId(group),
      sceneId: sceneId(scene.id),
      visualStateId: visualStateId(visualId),
      clips: [
        {
          id: audioClipId(clip),
          assetId: assetId(audioAsset),
          speakerId: addSpeaker(segment.speaker),
          transcript: segment.text,
          order: 0,
        },
      ],
    });
    groupByPosition.set(`${positionKey}:${segmentIndex}`, group);
    utteranceByClipId[clip] = {
      ...segment,
      sceneId: scene.id,
      groupId: group,
      clipId: clip,
    };
    return group;
  }

  for (const [sceneIndex, scene] of generatedContent.scenes.entries()) {
    for (const [visualIndex, visual] of scene.visuals.entries()) {
      addAsset(visual.assetId, 'image', `package://${visual.assetId}`);
      visualStates.push({
        id: visualStateId(visual.id),
        sceneId: sceneId(scene.id),
        masterAssetId: assetId(visual.assetId),
        layerAssetIds: [],
        order: visualIndex,
      });
    }
    const fixedGroupIds: string[] = [];
    scene.segments.forEach((segment, segmentIndex) => {
      if (segment.kind === 'utterance') {
        fixedGroupIds.push(
          addUtteranceGroup({ scene, segment, segmentIndex, stem: localId(scene.id), positionKey: scene.id }),
        );
      }
    });
    scenes.push({
      id: sceneId(scene.id),
      sequence: sceneIndex + 1,
      kind: 'fixed',
      entryState: { [`entered_${scene.id}`]: true },
      requiredExitState: { [`completed_${scene.id}`]: true },
      visualStateIds: scene.visuals.map((visual) => visualStateId(visual.id)),
      audioGroupIds: fixedGroupIds.map(audioGroupId),
      questionAnchorIds: scene.questionSlots.map((slot) => {
        const anchor = anchorBySlot.get(slot);
        if (!anchor) throw new Error(`No anchor registered for slot ${slot}`);
        return questionAnchorId(anchor.id);
      }),
      nextSceneId:
        sceneIndex < generatedContent.scenes.length - 1
          ? sceneId(generatedContent.scenes[sceneIndex + 1].id)
          : null,
      checkpoint: true,
    });
  }

  // 앵커는 자기 뒤의 첫 발화 그룹을 가리키므로, 모든 씬의 발화 그룹이 등록된 뒤에 매핑한다.
  for (const scene of generatedContent.scenes) {
    scene.segments.forEach((segment, segmentIndex) => {
      if (segment.kind !== 'anchor') return;
      const targetIndex = nextUtteranceIndex(scene.segments, segmentIndex);
      const group = groupByPosition.get(`${scene.id}:${targetIndex}`);
      if (group) targetGroupByAnchor.set(segment.id, { sceneId: scene.id, groupId: group });
    });
  }

  // 실시간 생성 분기(LIVE_*)는 재임포트에도 남는데, 그 사이 콘텐츠가 바뀌어 예전 앵커 이름
  // (예: HG-F07-DEMONSTRATION)으로 돌아가려는 것이 섞여 올 수 있다. 그 분기 하나 때문에 이야기
  // 전체를 못 여는 대신, 갈 곳이 없는 분기만 빼고 경고로 남긴다 - 서버 쪽 정리는 임포트가 맡는다.
  const fallbacks = generatedContent.fallbacks.filter((fallback) => {
    if (targetGroupByAnchor.has(fallback.rejoin.target)) return true;
    console.warn(
      `[story-package] ${fallback.id}: rejoin target ${fallback.rejoin.target} is not an anchor in this story - skipped`,
    );
    return false;
  });

  for (const fallback of fallbacks) {
    const anchor = anchorBySlot.get(fallback.rejoin.slot);
    if (!anchor) throw new Error(`No question anchor for ${fallback.rejoin.slot}`);
    const sourceScene = generatedContent.scenes.find(
      (scene) => scene.id === anchor.sceneId,
    );
    if (!sourceScene) throw new Error(`No source scene for ${anchor.id}`);
    fallbackByFamilyId[fallback.id] = fallback;
    fallback.segments.forEach((segment, segmentIndex) => {
      if (segment.kind !== 'visual') return;
      addAsset(segment.assetId, 'image', `package://${segment.assetId}`);
      if (!visualStates.some((visual) => visual.id === segment.id)) {
        visualStates.push({
          id: visualStateId(segment.id),
          sceneId: sceneId(sourceScene.id),
          masterAssetId: assetId(segment.assetId),
          layerAssetIds: [],
          order: segmentIndex,
        });
      }
    });
    const groups = fallback.segments.flatMap((segment, segmentIndex) =>
      segment.kind === 'utterance'
        ? [addUtteranceGroup({ scene: sourceScene, segment, segmentIndex, stem: fallback.id, positionKey: `FB-${fallback.id}` })]
        : [],
    );
    if (!groups[0]) throw new Error(`${fallback.id} has no utterance`);
    const family = familyConfigById.get(fallback.id);
    if (!family) throw new Error(`${fallback.id} has no family configuration`);
    fallbackFamilies.push({
      id: fallbackFamilyId(fallback.id),
      meaning: family.meaning,
      acknowledgementText: family.acknowledgementText,
      bridgeAudioId: family.bridgeAudioId,
      branchAssetId: assetId(family.branchAssetId),
      audioGroupId: audioGroupId(groups[0]),
      rejoinAnchorId: rejoinAnchorId(fallback.rejoin.target),
    });
  }

  const rejoinTargets = new Map<string, Set<string>>();
  for (const fallback of fallbacks) {
    const targets = rejoinTargets.get(fallback.rejoin.slot) ?? new Set<string>();
    targets.add(fallback.rejoin.target);
    rejoinTargets.set(fallback.rejoin.slot, targets);
  }
  for (const [slot, targets] of rejoinTargets.entries()) {
    const anchor = anchorBySlot.get(slot);
    if (!anchor) throw new Error(`No anchor for slot ${slot}`);
    for (const target of targets) {
      const destination = targetGroupByAnchor.get(target);
      if (!destination) throw new Error(`No destination for ${target}`);
      rejoinAnchors.push({
        id: rejoinAnchorId(target),
        sceneId: sceneId(anchor.sceneId),
        nextSceneId: sceneId(destination.sceneId),
        resumeAudioGroupId: audioGroupId(destination.groupId),
        requiredState: { [`question_${slot}_resolved`]: true },
      });
    }
  }

  for (const scene of generatedContent.scenes) {
    scene.segments.forEach((segment, segmentIndex) => {
      if (segment.kind !== 'interaction') return;
      const anchor = anchorBySlot.get(segment.slot);
      if (!anchor) throw new Error(`No anchor for ${segment.slot}`);
      const previousIndex = previousUtteranceIndex(scene.segments, segmentIndex);
      const resumeIndex = nextUtteranceIndex(scene.segments, segmentIndex);
      const afterGroup = groupByPosition.get(`${scene.id}:${previousIndex}`);
      const resumeGroup = groupByPosition.get(`${scene.id}:${resumeIndex}`);
      const invite = scene.segments[previousIndex];
      if (
        !afterGroup ||
        !resumeGroup ||
        invite?.kind !== 'utterance' ||
        invite.role !== `QUESTION_INVITE:${segment.slot}`
      ) {
        throw new Error(`${scene.id} interaction ${segment.slot} is incomplete`);
      }
      const slotFallbacks = fallbacks.filter(
        (fallback) => fallback.rejoin.slot === segment.slot,
      );
      questionAnchors.push({
        id: questionAnchorId(anchor.id),
        sceneId: sceneId(scene.id),
        afterAudioGroupId: audioGroupId(afterGroup),
        prompt: invite.text,
        promptSpeakerId: addSpeaker(invite.speaker),
        interactionMode: 'curiosity',
        acceptedInputKinds: ['question', 'guess', 'warning', 'plan'],
        allowedActions: ['ask', 'type', 'continue-story'],
        resumeAudioGroupId: audioGroupId(resumeGroup),
        allowedRejoinAnchorIds: Array.from(
          rejoinTargets.get(segment.slot) ?? [],
        ).map(rejoinAnchorId),
        fallbackFamilyIds: slotFallbacks.map((fallback) =>
          fallbackFamilyId(fallback.id),
        ),
        defaultFallbackFamilyId: anchor.defaultFallbackFamilyId
          ? fallbackFamilyId(anchor.defaultFallbackFamilyId)
          : null,
      });
    });
  }

  const manifest: StoryManifest = {
    schemaVersion: 1,
    storyId: storyId(packageData.story.storyId),
    contentVersion: packageData.story.contentVersion,
    title: packageData.story.title,
    entrySceneId: sceneId(packageData.story.entrySceneId),
    endingSceneId: sceneId(packageData.story.endingSceneId),
    scenes,
    visualStates,
    audioGroups,
    assets: contentAssets,
    speakers,
    questionAnchors,
    rejoinAnchors,
    fallbackFamilies,
  };
  const presentation: StoryPresentation = {
    scenes: generatedContent.scenes,
    fallbacks,
    utteranceByClipId,
    fallbackByFamilyId,
  };
  const fallbackImage = imageAssets[Object.keys(imageAssets)[0]];
  if (!fallbackImage) throw new Error(`${packageData.story.storyId} has no image assets`);
  const familyById = new Map(fallbackFamilies.map((family) => [family.id, family]));
  const narratorSpeakerId =
    Object.values(castByTag).find((speaker) => speaker.role === 'narrator')
      ?.speakerId ?? Object.values(castByTag)[0]?.speakerId;
  if (!narratorSpeakerId) {
    throw new Error(`${packageData.story.storyId} has no narrator speaker`);
  }
  return {
    storyId: packageData.story.storyId,
    slug: packageData.story.slug,
    availability: packageData.release.availability,
    manifest,
    presentation,
    reportCopy: packageData.reportCopy,
    imageAssets,
    audioAssets,
    illustrationForAssetId: (id) => imageAssets[id] ?? fallbackImage,
    branchIllustrationAssetId: (familyIdValue) =>
      familyIdValue
        ? ((familyById.get(fallbackFamilyId(familyIdValue))?.branchAssetId as string | undefined) ?? null)
        : null,
    branchReportSummary: (familyIdValue) =>
      familyIdValue
        ? (familyConfigById.get(familyIdValue)?.reportSummary ?? null)
        : null,
    branchInteractionCopy: (familyIdValue) => {
      const family = familyById.get(fallbackFamilyId(familyIdValue));
      return {
        text: family?.acknowledgementText ?? '좋아, 우리가 고른 방법으로 조심스럽게 해보자.',
        audioId: family?.bridgeAudioId ?? null,
      };
    },
    repairRoutePlanForHistory: (
      anchorIdValue,
      plan,
      priorActionFamilyIds,
    ) => {
      const anchorConfig = packageData.routeContext.anchors[anchorIdValue];
      if (!anchorConfig) return plan;
      const priorFamilyIds = new Set(priorActionFamilyIds);
      const eligibleFamilies = anchorConfig.actionFamilies.filter((family) =>
        (family.requiresPriorFamilyIds ?? []).every((requiredFamilyId) =>
          priorFamilyIds.has(requiredFamilyId),
        ),
      );
      const eligibleFamilyIds = new Set(
        eligibleFamilies.map((family) => family.id),
      );
      const defaultFamily =
        eligibleFamilies.find(
          (family) => family.id === anchorConfig.defaultFallbackFamilyId,
        ) ?? eligibleFamilies[0];
      if (!defaultFamily) return plan;
      const defaultRuntimeFamily = familyById.get(
        fallbackFamilyId(defaultFamily.id),
      );
      if (!defaultRuntimeFamily) return plan;

      if (plan.route === 'THREE_PATHS') {
        const repairedFamilies = plan.options
          .filter((option) => eligibleFamilyIds.has(option.actionFamilyId))
          .map((option) => ({
            familyId: option.actionFamilyId,
            label: option.label,
            meaning: option.meaning,
          }));
        for (const family of eligibleFamilies) {
          if (
            repairedFamilies.length >= 3 ||
            repairedFamilies.some((candidate) => candidate.familyId === family.id)
          ) {
            continue;
          }
          repairedFamilies.push({
            familyId: fallbackFamilyId(family.id),
            label: family.meaning.replace(/[.!?。]$/u, ''),
            meaning: family.meaning,
          });
        }
        if (repairedFamilies.length < 3) return plan;
        const optionIds = ['OPTION_1', 'OPTION_2', 'OPTION_3'] as const;
        const options: RoutePlan['options'] = repairedFamilies
          .slice(0, 3)
          .map((family, index) => ({
            id: optionIds[index],
            label: family.label,
            meaning: family.meaning,
            actionFamilyId: fallbackFamilyId(family.familyId),
            // 서버 plan이 부족해 여기서 즉석으로 채워 넣는 옵션이라 LLM이 쓴 실제 대사가 없다 -
            // runtime.ts의 selectRouteOption이 이미 빈 문자열을 family.acknowledgementText로
            // 대체하도록 되어 있다.
            branchLine: '',
          }));
        const fallbackIsEligible =
          plan.fallbackFamilyId !== null &&
          eligibleFamilyIds.has(plan.fallbackFamilyId);
        const changed = options.some(
          (option, index) =>
            option.actionFamilyId !== plan.options[index]?.actionFamilyId,
        );
        if (!changed && fallbackIsEligible) return plan;
        return {
          ...plan,
          options,
          fallbackFamilyId: fallbackIsEligible
            ? plan.fallbackFamilyId
            : defaultRuntimeFamily.id,
        };
      }

      if (
        plan.actionFamilyId &&
        !eligibleFamilyIds.has(plan.actionFamilyId)
      ) {
        return {
          ...plan,
          text: defaultFamily.acknowledgementText,
          actionFamilyId: defaultRuntimeFamily.id,
          fallbackFamilyId: defaultRuntimeFamily.id,
          rejoinAt: defaultRuntimeFamily.rejoinAnchorId,
        };
      }
      return plan;
    },
    speakerIdForTag: (tag) => resolveCastByTag(tag)?.speakerId ?? narratorSpeakerId,
    narratorSpeakerId,
    dialogue: {
      sceneSynopses: packageData.story.sceneSynopses ?? {},
      inviteHelp: packageData.story.inviteHelp ?? {},
      attemptBackdrops: availableAttemptBackdrops(packageData.story.attemptBackdrops, imageAssets),
      thinkingFillers: packageData.story.thinkingFillers ?? [],
    },
  };
}
