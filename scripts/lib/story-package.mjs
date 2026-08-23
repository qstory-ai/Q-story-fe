import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

function fail(storyId, message) {
  throw new Error(`Story package ${storyId}: ${message}`);
}

function parseTag(line) {
  const match = line.match(/^\[([^\]]+)\]$/);
  if (!match) return null;
  const parts = match[1].split('|').map((part) => part.trim());
  const attributes = {};
  for (const part of parts.slice(1)) {
    const index = part.indexOf('=');
    if (index > 0) {
      attributes[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
  }
  return { raw: match[1], kind: parts[0], parts, attributes };
}

function parseSceneBlock(storyId, block) {
  const lines = block.trim().split('\n');
  const sceneTag = lines.map((line) => parseTag(line.trim())).find((tag) => tag?.kind === 'SCENE');
  const sceneId = sceneTag?.parts[1];
  const title = sceneTag?.attributes.title;
  if (!sceneId || !sceneId.startsWith(`${storyId}-`) || !title) {
    fail(storyId, `invalid SCENE tag ${sceneTag?.raw ?? 'missing'}`);
  }
  const scene = {
    id: sceneId,
    title,
    visuals: [],
    segments: [],
    questionSlots: [],
    anchors: [],
    rejoins: [],
    checkpointId: null,
  };
  let currentVisualId = null;
  let pendingUtterance = null;
  let pendingText = [];
  const flushUtterance = () => {
    if (!pendingUtterance) return;
    const texts = pendingText.map((line) => line.trim()).filter(Boolean);
    if (texts.length === 0) fail(storyId, `${sceneId} has an empty utterance`);
    for (const text of texts) {
      scene.segments.push({
        kind: 'utterance',
        visualId: currentVisualId,
        speaker: pendingUtterance.kind,
        role: pendingUtterance.parts[1] ?? 'FIXED',
        text,
      });
    }
    pendingUtterance = null;
    pendingText = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const tag = parseTag(line.trim());
    if (!tag) {
      if (pendingUtterance) pendingText.push(line);
      continue;
    }
    flushUtterance();
    if (tag.kind === 'SCENE') continue;
    if (tag.kind === 'VISUAL') {
      const visual = {
        id: tag.parts[1],
        assetId: tag.attributes.asset,
        mode: tag.attributes.mode,
        time: tag.attributes.time,
        location: tag.attributes.location,
        characters: tag.attributes.characters?.split(',').filter(Boolean),
        entryState: tag.attributes.entry,
        requiredAction: tag.attributes.action,
        exitState: tag.attributes.exit,
        exception: tag.attributes.exception ?? null,
      };
      if (
        !visual.id?.startsWith(`${storyId}-`) ||
        !visual.assetId ||
        !visual.mode ||
        !visual.time ||
        !visual.location ||
        !visual.characters?.length ||
        !visual.entryState ||
        !visual.requiredAction ||
        !visual.exitState
      ) {
        fail(storyId, `${sceneId} has an incomplete VISUAL contract`);
      }
      currentVisualId = visual.id;
      scene.visuals.push(visual);
      scene.segments.push({ kind: 'visual', ...visual });
      continue;
    }
    if (tag.kind === 'SYSTEM') {
      const action = tag.parts[1] ?? '';
      if (action.startsWith('INTERACTION:')) {
        const slot = action.split(':')[1];
        scene.questionSlots.push(slot);
        scene.segments.push({ kind: 'interaction', visualId: currentVisualId, slot });
      } else if (action === 'ANCHOR') {
        const id = tag.attributes.id;
        if (!id) fail(storyId, `${sceneId} has an ANCHOR without id`);
        scene.anchors.push(id);
        scene.segments.push({ kind: 'anchor', id });
      } else if (action.startsWith('REJOIN:')) {
        const slot = action.split(':')[1];
        const target = tag.attributes.target;
        if (!target) fail(storyId, `${sceneId} has a REJOIN without target`);
        scene.rejoins.push({ slot, target });
        scene.segments.push({ kind: 'rejoin', slot, target });
      } else if (action === 'CHECKPOINT') {
        const id = tag.parts[2];
        if (!id) fail(storyId, `${sceneId} has a CHECKPOINT without id`);
        scene.checkpointId = id;
        scene.segments.push({ kind: 'checkpoint', id });
      }
      continue;
    }
    if (tag.kind === 'TRACE') {
      scene.segments.push({ kind: 'trace', instruction: tag.parts.slice(1).join('|') });
      continue;
    }
    if (tag.kind === 'SFX') {
      scene.segments.push({ kind: 'sfx', visualId: currentVisualId, id: tag.parts[1] ?? 'unknown' });
      continue;
    }
    pendingUtterance = tag;
  }
  flushUtterance();
  if (!scene.visuals.length || !scene.checkpointId) {
    fail(storyId, `${sceneId} is missing visuals or checkpoint`);
  }
  return scene;
}

function parseFallbackBlock(storyId, block) {
  const lines = block.trim().split('\n');
  const fallbackTag = lines.map((line) => parseTag(line.trim())).find((tag) => tag?.kind === 'FALLBACK');
  const id = fallbackTag?.parts[1];
  if (!id) fail(storyId, 'fallback has no id');
  const fallback = {
    id,
    requires: fallbackTag.attributes.requires ?? null,
    segments: [],
    rejoin: null,
  };
  let currentVisualId = null;
  let pendingUtterance = null;
  let pendingText = [];
  const flushUtterance = () => {
    if (!pendingUtterance) return;
    const text = pendingText.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text) fail(storyId, `${id} has an empty utterance`);
    fallback.segments.push({
      kind: 'utterance',
      visualId: currentVisualId,
      speaker: pendingUtterance.kind,
      role: pendingUtterance.parts[1] ?? 'FALLBACK',
      text,
    });
    pendingUtterance = null;
    pendingText = [];
  };
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const tag = parseTag(line.trim());
    if (!tag) {
      if (pendingUtterance) pendingText.push(line);
      continue;
    }
    flushUtterance();
    if (tag.kind === 'FALLBACK') continue;
    if (tag.kind === 'VISUAL') {
      const visual = {
        kind: 'visual',
        id: tag.parts[1],
        assetId: tag.attributes.asset,
        mode: tag.attributes.mode,
      };
      if (!visual.id || !visual.assetId || !visual.mode) {
        fail(storyId, `${id} has an incomplete VISUAL tag`);
      }
      currentVisualId = visual.id;
      fallback.segments.push(visual);
      continue;
    }
    if (tag.kind === 'SYSTEM' && tag.parts[1]?.startsWith('REJOIN:')) {
      const slot = tag.parts[1].split(':')[1];
      const target = tag.attributes.target;
      if (!target) fail(storyId, `${id} has a REJOIN without target`);
      fallback.rejoin = { slot, target };
      fallback.segments.push({ kind: 'rejoin', slot, target });
      continue;
    }
    if (tag.kind === 'TRACE') {
      fallback.segments.push({ kind: 'trace', instruction: tag.parts.slice(1).join('|') });
      continue;
    }
    if (tag.kind === 'SFX') {
      fallback.segments.push({ kind: 'sfx', visualId: currentVisualId, id: tag.parts[1] ?? 'unknown' });
      continue;
    }
    pendingUtterance = tag;
  }
  flushUtterance();
  if (!fallback.rejoin) fail(storyId, `${id} has no REJOIN`);
  return fallback;
}

function splitBlocks(text, kind) {
  return text
    .split(new RegExp(`(?=^\\[${kind}\\s*\\|)`, 'm'))
    .map((block) => block.trim())
    .filter((block) => block.startsWith(`[${kind}`));
}

async function readText(path) {
  return readFile(path, 'utf8');
}

export async function loadRegistry(appDirectory) {
  const path = join(appDirectory, 'content', 'registry.yaml');
  const registry = parseYaml(await readText(path));
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.stories)) {
    throw new Error('Invalid content/registry.yaml');
  }
  const storyIds = new Set(registry.stories.map((entry) => entry.storyId));
  const slugs = new Set(registry.stories.map((entry) => entry.slug));
  if (
    storyIds.size !== registry.stories.length ||
    slugs.size !== registry.stories.length ||
    !storyIds.has(registry.defaultBetaStoryId)
  ) {
    throw new Error('Content registry has duplicate ids/slugs or an invalid default story.');
  }
  return registry;
}

export async function loadStoryPackage(appDirectory, entry) {
  const directory = join(appDirectory, 'content', 'stories', entry.slug);
  return loadStoryPackageFromDirectory(directory, entry, { assetRoot: appDirectory });
}

export async function loadStoryPackageFromDirectory(
  directory,
  entry,
  { assetRoot = null } = {},
) {
  const names = [
    'story.yaml',
    'script.qstory',
    'route-context.yaml',
    'fallbacks.qstory',
    'cast.yaml',
    'assets.json',
    'evaluation.jsonl',
    'report-copy.yaml',
    'release.yaml',
    'references/packs.yaml',
  ];
  const values = await Promise.all(names.map((name) => readText(join(directory, name))));
  const byName = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const story = parseYaml(byName['story.yaml']);
  const routeContext = parseYaml(byName['route-context.yaml']);
  const cast = parseYaml(byName['cast.yaml']);
  const assets = JSON.parse(byName['assets.json']);
  const reportCopy = parseYaml(byName['report-copy.yaml']);
  const release = parseYaml(byName['release.yaml']);
  const references = parseYaml(byName['references/packs.yaml']);
  if (story?.storyId !== entry.storyId || story?.slug !== entry.slug) {
    fail(entry.storyId, 'registry and story.yaml do not match');
  }
  for (const [label, value] of Object.entries({ routeContext, cast, assets, reportCopy, release, references })) {
    if (value?.storyId !== story.storyId) fail(story.storyId, `${label} storyId does not match`);
  }
  if (assetRoot) {
    for (const [assetId, relativePath] of Object.entries({
      ...assets.imageAssets,
      ...assets.audioAssets,
    })) {
      // This project serves static story assets from `public/` (Vite's
      // static root) instead of the `assets/` source tree assets.json
      // still declares paths against, so remap the prefix on disk lookup.
      const onDiskPath = relativePath.replace(/^assets\//, 'public/');
      const actual = `sha256-${createHash('sha256')
        .update(await readFile(join(assetRoot, onDiskPath)))
        .digest('base64')}`;
      if (assets.integrity?.[assetId] !== actual) {
        fail(story.storyId, `integrity mismatch for ${assetId}`);
      }
    }
  }
  const scenes = splitBlocks(byName['script.qstory'], 'SCENE').map((block) =>
    parseSceneBlock(story.storyId, block),
  );
  const fallbacks = splitBlocks(byName['fallbacks.qstory'], 'FALLBACK').map((block) =>
    parseFallbackBlock(story.storyId, block),
  );
  const digest = createHash('sha256')
    .update(values.join('\n---\n'))
    .digest('hex');
  const source = {
    entry,
    directory,
    story,
    routeContext,
    cast,
    assets,
    reportCopy,
    release,
    references,
    evaluation: JSON.parse(byName['evaluation.jsonl'].trim()),
    scenes,
    fallbacks,
    digest,
  };
  validateStoryPackage(source);
  return source;
}

export function validateStoryPackage(source) {
  const { story, scenes, fallbacks, routeContext, cast, assets, reportCopy, release, references } = source;
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  if (sceneIds.size !== scenes.length || !sceneIds.has(story.entrySceneId) || !sceneIds.has(story.endingSceneId)) {
    fail(story.storyId, 'scene ids are duplicated or entry/ending scene is missing');
  }
  const visuals = scenes.flatMap((scene) => scene.visuals);
  for (const scene of scenes) {
    if (
      !scene.checkpointId?.startsWith(`${story.storyId}-`) ||
      !scene.anchors.every((id) => id.startsWith(`${story.storyId}-`)) ||
      !scene.rejoins.every((rejoin) =>
        rejoin.target.startsWith(`${story.storyId}-`),
      )
    ) {
      fail(story.storyId, `${scene.id} contains an invalid prefixed id`);
    }
  }
  const visualIds = new Set(visuals.map((visual) => visual.id));
  const visualAssetIds = new Set(visuals.map((visual) => visual.assetId));
  if (visualIds.size !== visuals.length || visualAssetIds.size !== visuals.length) {
    fail(story.storyId, 'fixed visual ids and assets must be one-to-one');
  }
  for (const visual of visuals) {
    if (!assets.imageAssets[visual.assetId]) fail(story.storyId, `unregistered image ${visual.assetId}`);
  }
  const declaredAssets = { ...assets.imageAssets, ...assets.audioAssets };
  if (Object.keys(assets.integrity ?? {}).length !== Object.keys(declaredAssets).length) {
    fail(story.storyId, 'asset integrity records contain missing or orphan ids');
  }
  for (const assetId of Object.keys(declaredAssets)) {
    if (!/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(assets.integrity?.[assetId] ?? '')) {
      fail(story.storyId, `missing integrity for ${assetId}`);
    }
  }
  const declaredRejoins = new Set(
    scenes.flatMap((scene) => [
      ...scene.anchors,
      ...scene.rejoins.map((rejoin) => rejoin.target),
    ]),
  );
  const anchorEntries = Object.entries(routeContext.anchors ?? {});
  const slotMap = new Map(anchorEntries.map(([id, anchor]) => [anchor.slot, { id, ...anchor }]));
  const usedSlots = new Set(scenes.flatMap((scene) => scene.questionSlots));
  if (usedSlots.size !== anchorEntries.length) {
    fail(story.storyId, 'route anchors and interaction slots are not one-to-one');
  }
  for (const scene of scenes) {
    for (const slot of scene.questionSlots) {
      const anchor = slotMap.get(slot);
      if (!anchor || anchor.sceneId !== scene.id) fail(story.storyId, `interaction ${slot} has no matching route context`);
    }
  }
  const fallbackIds = new Set(fallbacks.map((fallback) => fallback.id));
  if (fallbackIds.size !== fallbacks.length) fail(story.storyId, 'fallback ids are duplicated');
  const castEntries = Object.entries(cast.speakers ?? {});
  const speakerIds = new Set(castEntries.map(([, speaker]) => speaker.speakerId));
  if (![...speakerIds].every((id) => id.startsWith(`${story.storyId}-`))) {
    fail(story.storyId, 'cast contains an invalid story prefix');
  }
  const speakerTags = new Set(castEntries.map(([tag]) => tag));
  for (const segment of [...scenes, ...fallbacks].flatMap((item) => item.segments)) {
    if (segment.kind === 'utterance' && !speakerTags.has(segment.speaker)) {
      fail(story.storyId, `unknown speaker tag ${segment.speaker}`);
    }
    if (segment.kind === 'visual' && !assets.imageAssets[segment.assetId]) {
      fail(story.storyId, `unregistered image ${segment.assetId}`);
    }
  }
  for (const fallback of fallbacks) {
    if (!declaredRejoins.has(fallback.rejoin.target)) {
      fail(story.storyId, `${fallback.id} references unknown rejoin ${fallback.rejoin.target}`);
    }
  }
  for (const [anchorId, anchor] of anchorEntries) {
    if (!anchorId.startsWith(`${story.storyId}-`) || !sceneIds.has(anchor.sceneId)) {
      fail(story.storyId, `invalid anchor ${anchorId}`);
    }
    if (!speakerIds.has(anchor.primarySpeakerId) || !anchor.allowedSpeakerIds?.every((id) => speakerIds.has(id))) {
      fail(story.storyId, `${anchorId} references an unknown speaker`);
    }
    const familyIds = new Set(anchor.actionFamilies?.map((family) => family.id));
    if (!familyIds.has(anchor.defaultFallbackFamilyId)) fail(story.storyId, `${anchorId} default fallback is not allowed`);
    if (!declaredRejoins.has(anchor.defaultRejoinAt)) {
      fail(story.storyId, `${anchorId} default rejoin is not declared`);
    }
    for (const familyId of familyIds) {
      if (!fallbackIds.has(familyId)) fail(story.storyId, `${anchorId} family ${familyId} has no fallback`);
      const fallback = fallbacks.find((candidate) => candidate.id === familyId);
      if (fallback?.rejoin.slot !== anchor.slot) {
        fail(story.storyId, `${familyId} rejoins through the wrong slot`);
      }
      const family = anchor.actionFamilies.find((candidate) => candidate.id === familyId);
      if (family.branchAssetId && assets.familyAssets?.[familyId] !== family.branchAssetId) {
        fail(story.storyId, `${familyId} family asset is not registered`);
      }
    }
  }
  const declaredFamilyIds = new Set(
    anchorEntries.flatMap(([, anchor]) =>
      anchor.actionFamilies.map((family) => family.id),
    ),
  );
  for (const [anchorId, anchor] of anchorEntries) {
    for (const family of anchor.actionFamilies) {
      const prerequisites = family.requiresPriorFamilyIds ?? [];
      if (
        !Array.isArray(prerequisites) ||
        prerequisites.some(
          (familyId) =>
            familyId === family.id || !declaredFamilyIds.has(familyId),
        )
      ) {
        fail(
          story.storyId,
          `${anchorId} family ${family.id} has an invalid prior-family requirement`,
        );
      }
    }
  }
  if (
    declaredFamilyIds.size !== fallbackIds.size ||
    ![...fallbackIds].every((id) => declaredFamilyIds.has(id))
  ) {
    fail(story.storyId, 'fallback families contain missing or orphan ids');
  }
  if (
    !reportCopy.anchors ||
    !anchorEntries.every(([anchorId]) => reportCopy.anchors[anchorId]) ||
    Object.keys(reportCopy.anchors ?? {}).length !== anchorEntries.length ||
    release.availability !== source.entry.availability
  ) {
    fail(story.storyId, 'report copy or release availability is invalid');
  }
  const packs = references.packs ?? {};
  if (!Object.values(packs).every((ids) => Array.isArray(ids) && ids.length > 0)) {
    fail(story.storyId, 'reference packs must be non-empty');
  }
  if (!release.approvals?.automated || !release.approvals?.editorial || !release.approvals?.safety) {
    fail(story.storyId, 'required automated/editorial/safety approvals are missing');
  }
  return source;
}

export function generatedStoryContent(source) {
  return {
    schemaVersion: 1,
    source: {
      package: `content/stories/${source.story.slug}`,
      digest: source.digest,
    },
    story: {
      id: source.story.storyId,
      title: source.story.title,
      contentVersion: source.story.contentVersion,
    },
    scenes: source.scenes,
    fallbacks: source.fallbacks,
  };
}
