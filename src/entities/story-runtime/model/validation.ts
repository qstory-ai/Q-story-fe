import type {
  AudioGroupId,
  QuestionAnchorId,
  SceneId,
} from './ids';
import type {
  StoryCheckpoint,
  StoryManifest,
} from './content';

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly ValidationIssue[] };

const addDuplicateIssues = <T>(
  values: readonly T[],
  getId: (value: T) => string,
  path: string,
  issues: ValidationIssue[],
) => {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const id = getId(value);
    if (seen.has(id)) {
      issues.push({
        code: 'DUPLICATE_ID',
        path: `${path}[${index}].id`,
        message: `Duplicate id: ${id}`,
      });
    }
    seen.add(id);
  });
};

const addMissingReference = (
  exists: boolean,
  path: string,
  value: string,
  issues: ValidationIssue[],
) => {
  if (!exists) {
    issues.push({
      code: 'MISSING_REFERENCE',
      path,
      message: `Referenced id does not exist: ${value}`,
    });
  }
};

export function validateStoryManifest(
  manifest: StoryManifest,
): ValidationResult<StoryManifest> {
  const issues: ValidationIssue[] = [];

  if (manifest.schemaVersion !== 1) {
    issues.push({
      code: 'UNSUPPORTED_SCHEMA',
      path: 'schemaVersion',
      message: 'Only schemaVersion 1 is supported.',
    });
  }
  if (!manifest.contentVersion.trim()) {
    issues.push({
      code: 'EMPTY_VALUE',
      path: 'contentVersion',
      message: 'contentVersion is required.',
    });
  }
  if (!manifest.title.trim()) {
    issues.push({
      code: 'EMPTY_VALUE',
      path: 'title',
      message: 'title is required.',
    });
  }
  if (manifest.scenes.length === 0) {
    issues.push({
      code: 'EMPTY_COLLECTION',
      path: 'scenes',
      message: 'At least one scene is required.',
    });
  }

  addDuplicateIssues(manifest.scenes, (item) => item.id, 'scenes', issues);
  addDuplicateIssues(
    manifest.visualStates,
    (item) => item.id,
    'visualStates',
    issues,
  );
  addDuplicateIssues(
    manifest.audioGroups,
    (item) => item.id,
    'audioGroups',
    issues,
  );
  addDuplicateIssues(manifest.assets, (item) => item.id, 'assets', issues);
  addDuplicateIssues(manifest.speakers, (item) => item.id, 'speakers', issues);
  addDuplicateIssues(
    manifest.questionAnchors,
    (item) => item.id,
    'questionAnchors',
    issues,
  );
  addDuplicateIssues(
    manifest.rejoinAnchors,
    (item) => item.id,
    'rejoinAnchors',
    issues,
  );
  addDuplicateIssues(
    manifest.fallbackFamilies,
    (item) => item.id,
    'fallbackFamilies',
    issues,
  );

  const sceneIds = new Set(manifest.scenes.map((item) => item.id));
  const visualIds = new Set(manifest.visualStates.map((item) => item.id));
  const audioGroupIds = new Set(manifest.audioGroups.map((item) => item.id));
  const assetMap = new Map(manifest.assets.map((item) => [item.id, item]));
  const speakerIds = new Set(manifest.speakers.map((item) => item.id));
  const questionIds = new Set(manifest.questionAnchors.map((item) => item.id));
  const rejoinIds = new Set(manifest.rejoinAnchors.map((item) => item.id));
  const fallbackIds = new Set(
    manifest.fallbackFamilies.map((item) => item.id),
  );
  addDuplicateIssues(
    manifest.audioGroups.flatMap((group) => group.clips),
    (item) => item.id,
    'audioClips',
    issues,
  );

  addMissingReference(
    sceneIds.has(manifest.entrySceneId),
    'entrySceneId',
    manifest.entrySceneId,
    issues,
  );
  addMissingReference(
    sceneIds.has(manifest.endingSceneId),
    'endingSceneId',
    manifest.endingSceneId,
    issues,
  );

  const sequences = new Set<number>();
  manifest.scenes.forEach((scene, sceneIndex) => {
    if (sequences.has(scene.sequence)) {
      issues.push({
        code: 'DUPLICATE_SEQUENCE',
        path: `scenes[${sceneIndex}].sequence`,
        message: `Duplicate scene sequence: ${scene.sequence}`,
      });
    }
    sequences.add(scene.sequence);

    scene.visualStateIds.forEach((id, index) =>
      {
        addMissingReference(
          visualIds.has(id),
          `scenes[${sceneIndex}].visualStateIds[${index}]`,
          id,
          issues,
        );
        const visual = manifest.visualStates.find((item) => item.id === id);
        if (visual && visual.sceneId !== scene.id) {
          issues.push({
            code: 'CROSS_SCENE_REFERENCE',
            path: `scenes[${sceneIndex}].visualStateIds[${index}]`,
            message: `Visual state ${id} belongs to another scene.`,
          });
        }
      },
    );
    scene.audioGroupIds.forEach((id, index) =>
      {
        addMissingReference(
          audioGroupIds.has(id),
          `scenes[${sceneIndex}].audioGroupIds[${index}]`,
          id,
          issues,
        );
        const group = manifest.audioGroups.find((item) => item.id === id);
        if (group && group.sceneId !== scene.id) {
          issues.push({
            code: 'CROSS_SCENE_REFERENCE',
            path: `scenes[${sceneIndex}].audioGroupIds[${index}]`,
            message: `Audio group ${id} belongs to another scene.`,
          });
        }
      },
    );
    scene.questionAnchorIds.forEach((id, index) =>
      {
        addMissingReference(
          questionIds.has(id),
          `scenes[${sceneIndex}].questionAnchorIds[${index}]`,
          id,
          issues,
        );
        const anchor = manifest.questionAnchors.find((item) => item.id === id);
        if (anchor && anchor.sceneId !== scene.id) {
          issues.push({
            code: 'CROSS_SCENE_REFERENCE',
            path: `scenes[${sceneIndex}].questionAnchorIds[${index}]`,
            message: `Question anchor ${id} belongs to another scene.`,
          });
        }
      },
    );

    if (scene.nextSceneId) {
      addMissingReference(
        sceneIds.has(scene.nextSceneId),
        `scenes[${sceneIndex}].nextSceneId`,
        scene.nextSceneId,
        issues,
      );
    }
  });

  const orderedScenes = [...manifest.scenes].sort(
    (left, right) => left.sequence - right.sequence,
  );
  const lastScene = orderedScenes.at(-1);
  if (lastScene && lastScene.id !== manifest.endingSceneId) {
    issues.push({
      code: 'ENDING_SCENE_MISMATCH',
      path: 'endingSceneId',
      message: 'endingSceneId must be the last scene by sequence.',
    });
  }
  if (lastScene?.nextSceneId !== null) {
    issues.push({
      code: 'ENDING_SCENE_HAS_NEXT',
      path: 'scenes',
      message: 'The ending scene must have nextSceneId = null.',
    });
  }

  const visitState = new Map<SceneId, 'visiting' | 'visited'>();
  const visit = (id: SceneId) => {
    if (visitState.get(id) === 'visiting') {
      issues.push({
        code: 'SCENE_CYCLE',
        path: 'scenes',
        message: `Scene next chain contains a cycle at ${id}.`,
      });
      return;
    }
    if (visitState.get(id) === 'visited') {
      return;
    }
    visitState.set(id, 'visiting');
    const next = manifest.scenes.find((scene) => scene.id === id)?.nextSceneId;
    if (next && sceneIds.has(next)) {
      visit(next);
    }
    visitState.set(id, 'visited');
  };
  if (sceneIds.has(manifest.entrySceneId)) {
    visit(manifest.entrySceneId);
  }
  manifest.scenes.forEach((scene, sceneIndex) => {
    if (visitState.get(scene.id) !== 'visited') {
      issues.push({
        code: 'UNREACHABLE_SCENE',
        path: `scenes[${sceneIndex}].id`,
        message: `Scene is not reachable from entrySceneId: ${scene.id}`,
      });
    }
  });

  manifest.visualStates.forEach((visual, visualIndex) => {
    addMissingReference(
      sceneIds.has(visual.sceneId),
      `visualStates[${visualIndex}].sceneId`,
      visual.sceneId,
      issues,
    );
    const master = assetMap.get(visual.masterAssetId);
    addMissingReference(
      master?.kind === 'image',
      `visualStates[${visualIndex}].masterAssetId`,
      visual.masterAssetId,
      issues,
    );
    visual.layerAssetIds.forEach((id, index) =>
      addMissingReference(
        assetMap.get(id)?.kind === 'image',
        `visualStates[${visualIndex}].layerAssetIds[${index}]`,
        id,
        issues,
      ),
    );
  });

  manifest.audioGroups.forEach((group, groupIndex) => {
    addMissingReference(
      sceneIds.has(group.sceneId),
      `audioGroups[${groupIndex}].sceneId`,
      group.sceneId,
      issues,
    );
    addMissingReference(
      visualIds.has(group.visualStateId),
      `audioGroups[${groupIndex}].visualStateId`,
      group.visualStateId,
      issues,
    );
    const groupVisual = manifest.visualStates.find(
      (visual) => visual.id === group.visualStateId,
    );
    if (groupVisual && groupVisual.sceneId !== group.sceneId) {
      issues.push({
        code: 'CROSS_SCENE_REFERENCE',
        path: `audioGroups[${groupIndex}].visualStateId`,
        message: 'Audio group visual state belongs to another scene.',
      });
    }
    if (group.clips.length === 0) {
      issues.push({
        code: 'EMPTY_AUDIO_GROUP',
        path: `audioGroups[${groupIndex}].clips`,
        message: 'Audio group must contain at least one clip.',
      });
    }
    addDuplicateIssues(
      group.clips,
      (item) => item.id,
      `audioGroups[${groupIndex}].clips`,
      issues,
    );
    group.clips.forEach((clip, clipIndex) => {
      addMissingReference(
        assetMap.get(clip.assetId)?.kind === 'audio',
        `audioGroups[${groupIndex}].clips[${clipIndex}].assetId`,
        clip.assetId,
        issues,
      );
      addMissingReference(
        speakerIds.has(clip.speakerId),
        `audioGroups[${groupIndex}].clips[${clipIndex}].speakerId`,
        clip.speakerId,
        issues,
      );
      if (clip.order !== clipIndex) {
        issues.push({
          code: 'CLIP_ORDER_MISMATCH',
          path: `audioGroups[${groupIndex}].clips[${clipIndex}].order`,
          message: 'Clip order must match its array position.',
        });
      }
    });
  });

  manifest.questionAnchors.forEach((anchor, anchorIndex) => {
    if (!anchor.prompt.trim()) {
      issues.push({
        code: 'EMPTY_QUESTION_PROMPT',
        path: `questionAnchors[${anchorIndex}].prompt`,
        message: 'Question anchor prompt is required.',
      });
    }
    addMissingReference(
      speakerIds.has(anchor.promptSpeakerId),
      `questionAnchors[${anchorIndex}].promptSpeakerId`,
      anchor.promptSpeakerId,
      issues,
    );
    if (anchor.interactionMode !== 'curiosity') {
      issues.push({
        code: 'INVALID_QUESTION_MODE',
        path: `questionAnchors[${anchorIndex}].interactionMode`,
        message: 'Question anchor must use curiosity mode.',
      });
    }
    const requiredInputKinds = [
      'question',
      'guess',
      'warning',
      'plan',
    ] as const;
    if (
      requiredInputKinds.some(
        (kind) => !anchor.acceptedInputKinds.includes(kind),
      )
    ) {
      issues.push({
        code: 'INCOMPLETE_QUESTION_INPUT_KINDS',
        path: `questionAnchors[${anchorIndex}].acceptedInputKinds`,
        message:
          'Question anchor must accept question, guess, warning, and plan.',
      });
    }
    addMissingReference(
      sceneIds.has(anchor.sceneId),
      `questionAnchors[${anchorIndex}].sceneId`,
      anchor.sceneId,
      issues,
    );
    addMissingReference(
      audioGroupIds.has(anchor.afterAudioGroupId),
      `questionAnchors[${anchorIndex}].afterAudioGroupId`,
      anchor.afterAudioGroupId,
      issues,
    );
    const afterGroup = manifest.audioGroups.find(
      (group) => group.id === anchor.afterAudioGroupId,
    );
    if (afterGroup && afterGroup.sceneId !== anchor.sceneId) {
      issues.push({
        code: 'CROSS_SCENE_REFERENCE',
        path: `questionAnchors[${anchorIndex}].afterAudioGroupId`,
        message: 'Question anchor audio group belongs to another scene.',
      });
    }
    if (anchor.resumeAudioGroupId) {
      addMissingReference(
        audioGroupIds.has(anchor.resumeAudioGroupId),
        `questionAnchors[${anchorIndex}].resumeAudioGroupId`,
        anchor.resumeAudioGroupId,
        issues,
      );
      const resumeGroup = manifest.audioGroups.find(
        (group) => group.id === anchor.resumeAudioGroupId,
      );
      if (resumeGroup && resumeGroup.sceneId !== anchor.sceneId) {
        issues.push({
          code: 'CROSS_SCENE_REFERENCE',
          path: `questionAnchors[${anchorIndex}].resumeAudioGroupId`,
          message: 'Question resume audio group belongs to another scene.',
        });
      }
    }
    anchor.allowedRejoinAnchorIds.forEach((id, index) =>
      addMissingReference(
        rejoinIds.has(id),
        `questionAnchors[${anchorIndex}].allowedRejoinAnchorIds[${index}]`,
        id,
        issues,
      ),
    );
    anchor.fallbackFamilyIds.forEach((id, index) =>
      addMissingReference(
        fallbackIds.has(id),
        `questionAnchors[${anchorIndex}].fallbackFamilyIds[${index}]`,
        id,
        issues,
      ),
    );
  });

  manifest.rejoinAnchors.forEach((anchor, anchorIndex) => {
    addMissingReference(
      sceneIds.has(anchor.sceneId),
      `rejoinAnchors[${anchorIndex}].sceneId`,
      anchor.sceneId,
      issues,
    );
    addMissingReference(
      sceneIds.has(anchor.nextSceneId),
      `rejoinAnchors[${anchorIndex}].nextSceneId`,
      anchor.nextSceneId,
      issues,
    );
    if (anchor.resumeAudioGroupId) {
      addMissingReference(
        audioGroupIds.has(anchor.resumeAudioGroupId),
        `rejoinAnchors[${anchorIndex}].resumeAudioGroupId`,
        anchor.resumeAudioGroupId,
        issues,
      );
      const resumeGroup = manifest.audioGroups.find(
        (group) => group.id === anchor.resumeAudioGroupId,
      );
      if (resumeGroup && resumeGroup.sceneId !== anchor.nextSceneId) {
        issues.push({
          code: 'CROSS_SCENE_REFERENCE',
          path: `rejoinAnchors[${anchorIndex}].resumeAudioGroupId`,
          message: `Rejoin audio group ${anchor.resumeAudioGroupId} does not belong to destination scene ${anchor.nextSceneId}.`,
        });
      }
    }
  });

  manifest.fallbackFamilies.forEach((fallback, fallbackIndex) => {
    addMissingReference(
      audioGroupIds.has(fallback.audioGroupId),
      `fallbackFamilies[${fallbackIndex}].audioGroupId`,
      fallback.audioGroupId,
      issues,
    );
    if (fallback.rejoinAnchorId) {
      addMissingReference(
        rejoinIds.has(fallback.rejoinAnchorId),
        `fallbackFamilies[${fallbackIndex}].rejoinAnchorId`,
        fallback.rejoinAnchorId,
        issues,
      );
    }
  });

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: manifest };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateCheckpoint(
  input: unknown,
  manifest: StoryManifest,
): ValidationResult<StoryCheckpoint> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_CHECKPOINT',
          path: '',
          message: 'Checkpoint must be an object.',
        },
      ],
    };
  }

  const sceneIds = new Set(manifest.scenes.map((scene) => scene.id));
  if (input.schemaVersion !== 1) {
    issues.push({
      code: 'UNSUPPORTED_SCHEMA',
      path: 'schemaVersion',
      message: 'Checkpoint schemaVersion must be 1.',
    });
  }
  if (input.storyId !== manifest.storyId) {
    issues.push({
      code: 'STORY_MISMATCH',
      path: 'storyId',
      message: 'Checkpoint belongs to another story.',
    });
  }
  if (input.contentVersion !== manifest.contentVersion) {
    issues.push({
      code: 'CONTENT_VERSION_MISMATCH',
      path: 'contentVersion',
      message: 'Checkpoint content version does not match.',
    });
  }
  if (
    typeof input.nextSceneId !== 'string' ||
    !sceneIds.has(input.nextSceneId as SceneId)
  ) {
    issues.push({
      code: 'MISSING_REFERENCE',
      path: 'nextSceneId',
      message: 'Checkpoint next scene does not exist.',
    });
  }
  if (
    input.completedSceneId !== null &&
    (typeof input.completedSceneId !== 'string' ||
      !sceneIds.has(input.completedSceneId as SceneId))
  ) {
    issues.push({
      code: 'MISSING_REFERENCE',
      path: 'completedSceneId',
      message: 'Checkpoint completed scene does not exist.',
    });
  }
  if (
    typeof input.questionRound !== 'number' ||
    !Number.isInteger(input.questionRound) ||
    input.questionRound < 0
  ) {
    issues.push({
      code: 'INVALID_QUESTION_ROUND',
      path: 'questionRound',
      message: 'questionRound must be a non-negative integer.',
    });
  }
  if (
    typeof input.savedAt !== 'string' ||
    Number.isNaN(Date.parse(input.savedAt))
  ) {
    issues.push({
      code: 'INVALID_DATE',
      path: 'savedAt',
      message: 'savedAt must be an ISO-compatible date string.',
    });
  }
  if (Array.isArray(input.priorTrace)) {
    issues.push({
      code: 'MULTIPLE_PRIOR_TRACES',
      path: 'priorTrace',
      message: 'priorTrace must be null or one object, never an array.',
    });
  } else if (input.priorTrace !== null) {
    if (!isRecord(input.priorTrace)) {
      issues.push({
        code: 'INVALID_PRIOR_TRACE',
        path: 'priorTrace',
        message: 'priorTrace must be null or an object.',
      });
    } else {
      const allowedKinds = new Set([
        'ALLY',
        'SIGNAL',
        'KNOWLEDGE',
        'ROUTE_MARK',
      ]);
      if (!allowedKinds.has(String(input.priorTrace.kind))) {
        issues.push({
          code: 'INVALID_PRIOR_TRACE_KIND',
          path: 'priorTrace.kind',
          message: 'priorTrace kind is not supported.',
        });
      }
      if (
        typeof input.priorTrace.sourceSceneId !== 'string' ||
        !sceneIds.has(input.priorTrace.sourceSceneId as SceneId)
      ) {
        issues.push({
          code: 'MISSING_REFERENCE',
          path: 'priorTrace.sourceSceneId',
          message: 'priorTrace source scene does not exist.',
        });
      }
      if (
        typeof input.priorTrace.id !== 'string' ||
        typeof input.priorTrace.summary !== 'string'
      ) {
        issues.push({
          code: 'INVALID_PRIOR_TRACE',
          path: 'priorTrace',
          message: 'priorTrace id and summary are required.',
        });
      }
    }
  }

  return issues.length > 0
    ? { ok: false, issues }
    : { ok: true, value: input as StoryCheckpoint };
}

export function questionAnchorForGroup(
  manifest: StoryManifest,
  sceneId: SceneId,
  audioGroupId: AudioGroupId,
): QuestionAnchorId | null {
  return (
    manifest.questionAnchors.find(
      (anchor) =>
        anchor.sceneId === sceneId &&
        anchor.afterAudioGroupId === audioGroupId,
    )?.id ?? null
  );
}
