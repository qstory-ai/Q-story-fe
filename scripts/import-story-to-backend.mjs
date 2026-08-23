import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegistry } from './lib/story-package.mjs';

// Pushes the already-generated output of `npm run content:generate` (generated-story-content.json
// + story-package.generated.json) to the backend's admin import endpoint, so the backend's DB
// becomes the runtime source of truth instead of these files being bundled into the app build.
// Run content:generate first - this script only reads what's already on disk.

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = dirname(scriptDirectory);

// The two variables below are declared in fe/.env, but nothing here used to read that file, so
// every run needed them exported by hand first. Real environment variables still win - loadEnvFile
// does not overwrite what is already set, which keeps CI and deploy targets in charge.
try {
  process.loadEnvFile(join(appDirectory, '.env'));
} catch {
  // No .env (CI, a deploy job): the explicit checks below report anything actually missing.
}
const args = process.argv.slice(2);
const requestedStoryId = args[args.indexOf('--story') + 1]?.trim();
const all = args.includes('--all');

if (!requestedStoryId && !all) {
  throw new Error('Use --story <id> or --all.');
}

const backendUrl = process.env.QSTORY_BACKEND_URL?.trim().replace(/\/+$/, '');
const adminToken = process.env.QSTORY_STORY_IMPORT_TOKEN?.trim();
if (!backendUrl) {
  throw new Error('Set QSTORY_BACKEND_URL (e.g. https://your-backend.example) before running this script.');
}
if (!adminToken) {
  throw new Error('Set QSTORY_STORY_IMPORT_TOKEN to the backend\'s configured admin token.');
}

const registry = await loadRegistry(appDirectory);
const entries = all
  ? registry.stories
  : registry.stories.filter((entry) => entry.storyId === requestedStoryId);
if (entries.length === 0) {
  throw new Error(`Unknown story: ${requestedStoryId}`);
}

for (const entry of entries) {
  const directory = join(appDirectory, 'src', 'entities', 'story', entry.slug);
  const generatedContent = JSON.parse(
    await readFile(join(directory, 'generated-story-content.json'), 'utf8'),
  );
  const packageData = JSON.parse(
    await readFile(join(directory, 'story-package.generated.json'), 'utf8'),
  );

  const response = await fetch(`${backendUrl}/v1/admin/stories/import`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Admin-Token': adminToken,
    },
    body: JSON.stringify({ generatedContent, packageData }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      `Import failed for ${entry.storyId}: HTTP ${response.status} ${JSON.stringify(body)}`,
    );
  }
  console.log(`Imported ${entry.storyId}:`, body);
}
