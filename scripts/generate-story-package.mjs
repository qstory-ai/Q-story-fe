import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  generatedStoryContent,
  loadPrompts,
  loadRegistry,
  loadStoryPackage,
} from './lib/story-package.mjs';
// Only Hansel & Gretel has a visual-generation-contract.ts today (see references/packs.yaml's
// sourceModule) - this import must stay story-scoped (see visualReferencePacksFor below) so
// other stories in the registry don't fail trying to load a module that doesn't exist for them.
import { hanselGretelVisualReferencePacks } from '../src/entities/story/hansel-gretel/visual-generation-contract.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = dirname(scriptDirectory);
const args = process.argv.slice(2);
const requestedStoryId = args[args.indexOf('--story') + 1]?.trim();
const all = args.includes('--all');
const check = args.includes('--check');
const validateOnly = args.includes('--validate');
// Recomputes every assets.json integrity hash from the files on disk instead of asserting them.
const fix = args.includes('--fix');

if (!requestedStoryId && !all) {
  throw new Error('Use --story <id> or --all.');
}

const registry = await loadRegistry(appDirectory);
const entries = all
  ? registry.stories
  : registry.stories.filter((entry) => entry.storyId === requestedStoryId);
if (entries.length === 0) {
  throw new Error(`Unknown story: ${requestedStoryId}`);
}
const sources = [];
for (const entry of entries) {
  sources.push(await loadStoryPackage(appDirectory, entry, { rewriteIntegrity: fix }));
}
const prompts = await loadPrompts(appDirectory);
// A story naming a policy nobody ships is the drift this move exists to stop, so it fails here.
const promptVersions = new Set(prompts.map((prompt) => prompt.version));
for (const source of sources) {
  const named = source.routeContext.routePromptVersion;
  if (!promptVersions.has(named)) {
    throw new Error(`${source.story.storyId} names unknown routePromptVersion ${named}`);
  }
}

if (validateOnly || fix) {
  for (const source of sources) {
    console.log(
      `${fix ? 'Rehashed' : 'Valid'} ${source.story.storyId}: ${source.scenes.length} scenes, ${source.scenes.flatMap((scene) => scene.visuals).length} visuals, ${source.fallbacks.length} fallbacks`,
    );
  }
  process.exit(0);
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function quote(value) {
  return JSON.stringify(value);
}

// Flattens { style, characters, locations, props } into the backend's StoryVisualReferencePack
// shape. `label` is deliberately the Record's object key (e.g. HANSEL, HOME), not pack.label
// (a Korean display string) - the backend matches CHARACTER label against StoryCast.speakerId
// with its "<STORY>-SPK-" prefix stripped (see StoryVisualReferencePack.java).
function visualReferencePacksFor(source) {
  if (source.story.storyId !== 'HG') return [];
  const { style, characters, locations, props } = hanselGretelVisualReferencePacks;
  const entries = [
    ['STYLE', style],
    ...Object.entries(characters),
    ...Object.entries(locations),
    ...Object.entries(props),
  ];
  return entries.map(([label, pack]) => ({
    id: pack.id,
    kind: pack.kind.toUpperCase(),
    label,
    immutableFacts: pack.immutableFacts,
  }));
}

function packageData(source, prompts) {
  return {
    schemaVersion: 1,
    story: source.story,
    routeContext: source.routeContext,
    cast: source.cast,
    reportCopy: source.reportCopy,
    release: source.release,
    evaluation: source.evaluation,
    // Authoring metadata that used to live only as files: the QA contract was never even read, and
    // the reference packs never reached the backend, so the DB could not describe how a story is
    // meant to be checked or generated.
    qaContract: source.qaContract,
    references: source.references,
    // Character/location/prop/style appearance-consistency facts for image generation, reused
    // from the TS module that already holds them (see visualReferencePacksFor) rather than
    // re-authored here - HG-only today since no other story has a visual-generation-contract.ts.
    visualReferencePacks: visualReferencePacksFor(source),
    // One flat array, the same shape the backend serves back at /v1/stories/{id}/content. `file` is
    // storage-relative and is what the DB row keeps; `url` is what a client fetches. Both are
    // carried so the import and the app read the same list rather than two divergent ones.
    assetRoot: source.assets.root,
    assets: source.assets.assets.map((asset) => ({
      ...asset,
      url: publicAssetUrl(`${source.assets.root}${asset.file}`),
    })),
    // The route policy this story names, carried so the import writes policy and version together.
    prompt: prompts.find((entry) => entry.version === source.routeContext.routePromptVersion),
    sourceDigest: source.digest,
  };
}

// Assets ship from `public/`, which Vite serves at the site root — so an
// asset registered at `assets/story/...` is fetched from `/story/...`.
function publicAssetUrl(relativePath) {
  return `/${relativePath.replace(/^assets\//, '')}`;
}

function renderAppAssets(allSources) {
  const lines = [
    '// Generated by scripts/generate-story-package.mjs. Do not edit manually.',
    "import type { AudioSource, ImageSource } from './media-source';",
    '',
    'export const STORY_IMAGE_ASSETS_BY_ID: Readonly<Record<string, Readonly<Record<string, ImageSource>>>> = {',
  ];
  for (const source of allSources) {
    lines.push(`  ${quote(source.story.storyId)}: {`);
    for (const asset of source.assets.assets) {
      if (asset.category !== 'SCENE_ART' && asset.category !== 'BRANCH_ART') continue;
      const path = `${source.assets.root}${asset.file}`;
      lines.push(`    ${quote(asset.slug)}: { uri: ${quote(publicAssetUrl(path))} },`);
    }
    lines.push('  },');
  }
  lines.push(
    '};',
    '',
    'export const STORY_AUDIO_ASSETS_BY_ID: Readonly<Record<string, Readonly<Record<string, AudioSource>>>> = {',
  );
  for (const source of allSources) {
    lines.push(`  ${quote(source.story.storyId)}: {`);
    for (const asset of source.assets.assets) {
      if (asset.category !== 'NARRATION' && asset.category !== 'BRIDGE') continue;
      const path = `${source.assets.root}${asset.file}`;
      lines.push(`    ${quote(asset.slug)}: { uri: ${quote(publicAssetUrl(path))} },`);
    }
    lines.push('  },');
  }
  lines.push('};');
  return `${lines.join('\n')}\n`;
}

const allSources = [];
for (const entry of registry.stories) {
  allSources.push(await loadStoryPackage(appDirectory, entry));
}

const outputs = [];
for (const source of sources) {
  const directory = join(
    appDirectory,
    'src',
    'entities',
    'story',
    source.story.slug,
  );
  outputs.push(
    [join(directory, 'generated-story-content.json'), stableJson(generatedStoryContent(source))],
    [join(directory, 'story-package.generated.json'), stableJson(packageData(source, prompts))],
  );
}
outputs.push([
  join(appDirectory, 'src', 'entities', 'story', 'model', 'story-assets.generated.ts'),
  renderAppAssets(allSources),
]);

let stale = false;
for (const [path, content] of outputs) {
  if (check) {
    let existing = '';
    try {
      existing = await readFile(path, 'utf8');
    } catch {
      existing = '';
    }
    if (existing !== content) {
      stale = true;
      console.error(`Stale generated content: ${path}`);
    }
    continue;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
  console.log(`Generated ${path}`);
}
if (stale) process.exitCode = 1;
