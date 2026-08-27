import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parse as parseYaml } from 'yaml';

function fail(storyId, message) {
  throw new Error(`Story package ${storyId}: ${message}`);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * assets.json is one list of records - {slug, category, file, integrity} - so a hash can never be
 * orphaned from the asset it covers and the shared directory prefix is written once. Callers still
 * need to look assets up by slug and by family, so those indexes are derived here rather than
 * being a second thing to keep in sync in the file.
 */
export function indexAssets(storyId, assets) {
  const bySlug = new Map(assets.assets.map((asset) => [asset.slug, asset]));
  if (bySlug.size !== assets.assets.length) fail(storyId, 'duplicate asset slug');
  return {
    bySlug,
    artSlugs: assets.assets
      .filter((asset) => asset.category === 'SCENE_ART' || asset.category === 'BRANCH_ART')
      .map((asset) => asset.slug),
    branchArtByFamily: Object.fromEntries(
      assets.assets
        .filter((asset) => asset.category === 'BRANCH_ART' && asset.panel === 1)
        .map((asset) => [asset.familyId, asset.slug]),
    ),
  };
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

/**
 * The Phase 2 three-stage pipeline's prompts (safety_scope_gate/route_classifier/content_generator),
 * optional on a prompt file so stories naming a single-call-era policy without stages don't break.
 * When present it must name exactly the three stages, each with a non-empty `system` string list
 * and an `examples` list of {input, output} objects - mirroring the shape
 * StoryImportService.importRoutePromptStages/upsertStage expects byte-for-byte.
 */
function validateStages(version, stages) {
  if (stages === undefined) return undefined;
  if (!isPlainObject(stages)) {
    throw new Error(`Prompt ${version}: stages must be an object`);
  }
  const keys = Object.keys(stages);
  if (keys.length !== 3 || !['safety', 'classifier', 'generator'].every((key) => keys.includes(key))) {
    throw new Error(`Prompt ${version}: stages must have exactly safety, classifier, generator`);
  }
  for (const [stageName, stage] of Object.entries(stages)) {
    if (!isPlainObject(stage)) {
      throw new Error(`Prompt ${version}: stages.${stageName} must be an object`);
    }
    if (!Array.isArray(stage.system) || stage.system.length === 0) {
      throw new Error(`Prompt ${version}: stages.${stageName}.system must be a non-empty list`);
    }
    if (stage.system.some((line) => typeof line !== 'string' || !line.trim())) {
      throw new Error(`Prompt ${version}: stages.${stageName}.system has an empty line`);
    }
    if (!Array.isArray(stage.examples)) {
      throw new Error(`Prompt ${version}: stages.${stageName}.examples must be a list`);
    }
    for (const example of stage.examples) {
      if (!isPlainObject(example) || !isPlainObject(example.input) || !isPlainObject(example.output)) {
        throw new Error(`Prompt ${version}: stages.${stageName}.examples entries need input and output objects`);
      }
    }
  }
  return stages;
}

/**
 * Route policies, keyed by the version a story's route-context.yaml names. Loaded separately from
 * stories because one policy can serve several stories - and because it is the text the backend
 * used to hardcode, which is what let the policy and its version label drift apart.
 */
export async function loadPrompts(appDirectory) {
  const registry = await loadRegistry(appDirectory);
  const prompts = [];
  for (const entry of registry.prompts ?? []) {
    const parsed = parseYaml(
      await readText(join(appDirectory, 'content', 'prompts', entry.file)),
    );
    if (parsed?.schemaVersion !== 1 || parsed.version !== entry.version) {
      throw new Error(`Prompt ${entry.version}: registry and file disagree`);
    }
    for (const field of ['system', 'instruction']) {
      if (!Array.isArray(parsed[field]) || parsed[field].length === 0) {
        throw new Error(`Prompt ${entry.version}: ${field} must be a non-empty list`);
      }
      if (parsed[field].some((line) => typeof line !== 'string' || !line.trim())) {
        throw new Error(`Prompt ${entry.version}: ${field} has an empty line`);
      }
    }
    const stages = validateStages(entry.version, parsed.stages);
    prompts.push({
      version: parsed.version,
      system: parsed.system,
      instruction: parsed.instruction,
      ...(stages ? { stages } : {}),
    });
  }
  const versions = new Set(prompts.map((prompt) => prompt.version));
  if (versions.size !== prompts.length) throw new Error('Duplicate prompt version in registry');
  return prompts;
}

export async function loadStoryPackage(appDirectory, entry, { rewriteIntegrity = false } = {}) {
  const directory = join(appDirectory, 'content', 'stories', entry.slug);
  return loadStoryPackageFromDirectory(directory, entry, {
    assetRoot: appDirectory,
    rewriteIntegrity,
  });
}

export async function loadStoryPackageFromDirectory(
  directory,
  entry,
  { assetRoot = null, rewriteIntegrity = false } = {},
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
    'qa-contract.yaml',
    'references/packs.yaml',
  ];
  const values = await Promise.all(names.map((name) => readText(join(directory, name))));
  const byName = Object.fromEntries(names.map((name, index) => [name, values[index]]));
  const story = parseYaml(byName['story.yaml']);
  const routeContext = parseYaml(byName['route-context.yaml']);
  const cast = parseYaml(byName['cast.yaml']);
  const assets = JSON.parse(byName['assets.json']);
  if (assets?.schemaVersion !== 2) fail(entry.storyId, 'assets.json must be schemaVersion 2');
  const reportCopy = parseYaml(byName['report-copy.yaml']);
  const release = parseYaml(byName['release.yaml']);
  const qaContract = parseYaml(byName['qa-contract.yaml']);
  const references = parseYaml(byName['references/packs.yaml']);
  if (story?.storyId !== entry.storyId || story?.slug !== entry.slug) {
    fail(entry.storyId, 'registry and story.yaml do not match');
  }
  for (const [label, value] of Object.entries({ routeContext, cast, assets, reportCopy, release, qaContract, references })) {
    if (value?.storyId !== story.storyId) fail(story.storyId, `${label} storyId does not match`);
  }
  if (assetRoot) {
    // rewriteIntegrity: recompute rather than compare. Every hash in assets.json used to be
    // maintained by hand - swapping one illustration meant computing a base64 sha256 yourself and
    // pasting it in, with a failed build as the only feedback. `--fix` writes them instead.
    for (const asset of assets.assets) {
      // This project serves static story assets from `public/` (Vite's
      // static root) instead of the `assets/` source tree assets.json
      // still declares paths against, so remap the prefix on disk lookup.
      const onDiskPath = `${assets.root}${asset.file}`.replace(/^assets\//, 'public/');
      const actual = `sha256-${createHash('sha256')
        .update(await readFile(join(assetRoot, onDiskPath)))
        .digest('base64')}`;
      if (rewriteIntegrity) {
        asset.integrity = actual;
      } else if (asset.integrity !== actual) {
        fail(story.storyId, `integrity mismatch for ${asset.slug}`);
      }
    }
    if (rewriteIntegrity) {
      await writeFile(
        join(directory, 'assets.json'),
        `${JSON.stringify(assets, null, 2)}\n`,
      );
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
    qaContract,
    references,
    evaluation: JSON.parse(byName['evaluation.jsonl'].trim()),
    scenes,
    fallbacks,
    digest,
  };
  validateStoryPackage(source);
  return source;
}

/**
 * qa-contract.yaml states, per action family, where it rejoins and how many pictures it shows.
 * Nothing read the file until now - it was authored, committed, and never compared against the
 * fallbacks it describes, so it could disagree with them indefinitely.
 */
function validateQaContract(source) {
  const { storyId } = source.story;
  const families = source.qaContract?.families ?? {};
  const byId = new Map(source.fallbacks.map((family) => [family.id, family]));
  for (const [familyId, expected] of Object.entries(families)) {
    const family = byId.get(familyId);
    if (!family) fail(storyId, `qa-contract names unknown family ${familyId}`);
    if (expected.expectedRejoin !== family.rejoin?.target) {
      fail(
        storyId,
        `qa-contract expects ${familyId} to rejoin at ${expected.expectedRejoin}, fallbacks say ${family.rejoin?.target}`,
      );
    }
    if (expected.slot !== family.rejoin?.slot) {
      fail(storyId, `qa-contract puts ${familyId} in slot ${expected.slot}, fallbacks say ${family.rejoin?.slot}`);
    }
    const visualCount = family.segments.filter((segment) => segment.kind === 'visual').length;
    if (expected.expectedVisualCount !== visualCount) {
      fail(
        storyId,
        `qa-contract expects ${familyId} to show ${expected.expectedVisualCount} visuals, fallbacks show ${visualCount}`,
      );
    }
  }
  const missing = [...byId.keys()].filter((familyId) => !(familyId in families));
  if (missing.length > 0) fail(storyId, `qa-contract is missing families: ${missing.join(', ')}`);
}

export function validateStoryPackage(source) {
  const { bySlug: assetBySlug, artSlugs, branchArtByFamily } = indexAssets(
    source.story.storyId,
    source.assets,
  );
  validateQaContract(source);
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
    if (!assetBySlug.has(visual.assetId)) fail(story.storyId, `unregistered image ${visual.assetId}`);
  }
  // The reverse of the check above: art that is declared, hashed, and shipped in public/ but that
  // no scene or fallback ever draws. Seven such files (5.4MB) had accumulated unnoticed, because
  // only the "referenced but undeclared" direction was ever checked.
  const referencedImages = new Set([
    ...visuals.map((visual) => visual.assetId),
    ...Object.values(branchArtByFamily),
    ...fallbacks.flatMap((family) =>
      family.segments.filter((segment) => segment.kind === 'visual').map((segment) => segment.assetId),
    ),
  ]);
  const unusedImages = artSlugs.filter((slug) => !referencedImages.has(slug));
  if (unusedImages.length > 0) {
    fail(story.storyId, `image assets declared but never shown: ${unusedImages.join(', ')}`);
  }
  // No count reconciliation any more: integrity lives on the asset record, so a hash cannot be
  // missing for a declared asset or left behind for a deleted one.
  for (const asset of assets.assets) {
    if (!/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(asset.integrity ?? '')) {
      fail(story.storyId, `missing integrity for ${asset.slug}`);
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
    if (segment.kind === 'visual' && !assetBySlug.has(segment.assetId)) {
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
      if (family.branchAssetId && branchArtByFamily[familyId] !== family.branchAssetId) {
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
