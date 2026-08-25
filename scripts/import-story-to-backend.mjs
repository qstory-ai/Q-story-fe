import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegistry } from './lib/story-package.mjs';

// `npm run content:generate`가 이미 생성해 둔 결과물(generated-story-content.json
// + story-package.generated.json)을 백엔드의 admin import 엔드포인트로 전송한다. 이렇게 하면
// 이 파일들이 앱 빌드에 번들되는 대신, 백엔드 DB가 런타임 소스 오브 트루스가 된다.
// content:generate를 먼저 실행할 것 - 이 스크립트는 디스크에 이미 있는 것만 읽는다.

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = dirname(scriptDirectory);
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
