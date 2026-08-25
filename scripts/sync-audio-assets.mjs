// 오디오 폴더를 스캔해서 assets.json의 audioAssets(및 그 integrity 해시)를 재생성한다.
// 사람이 매 클립마다 assetId/path/hash 트리플을 직접 타이핑하지 않도록 하기 위함이다. 경로는 항상
// id의 순수 함수였다(ID.toLowerCase() + ".mp3"를 스토리의 오디오 폴더 아래에 붙인 형태이며,
// 현재 200개 항목 전체에서 확인됨) - 이 스크립트는 그 함수의 결과값을
// 사람이 직접 타이핑하지 않아도 되게 해줄 뿐이다. 사용법: node scripts/sync-audio-assets.mjs --story hansel-gretel [--write]
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadRegistry } from './lib/story-package.mjs';

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1]?.trim();
}

async function syncStory(appDirectory, slug, write) {
  const assetsPath = join(appDirectory, 'content', 'stories', slug, 'assets.json');
  const audioDirectory = join(appDirectory, 'public', 'story', slug, 'audio');
  const assets = JSON.parse(await readFile(assetsPath, 'utf8'));

  const files = (await readdir(audioDirectory)).filter((name) => name.endsWith('.mp3')).sort();

  const nextAudioAssets = {};
  const nextIntegrityForAudio = {};
  for (const filename of files) {
    const assetId = filename.slice(0, -'.mp3'.length).toUpperCase();
    const relativePath = `assets/story/${slug}/audio/${filename}`;
    const bytes = await readFile(join(audioDirectory, filename));
    nextAudioAssets[assetId] = relativePath;
    nextIntegrityForAudio[assetId] = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
  }

  const previousIds = new Set(Object.keys(assets.audioAssets ?? {}));
  const nextIds = new Set(Object.keys(nextAudioAssets));
  const added = [...nextIds].filter((id) => !previousIds.has(id));
  const removed = [...previousIds].filter((id) => !nextIds.has(id));
  const changed = [...nextIds]
    .filter((id) => previousIds.has(id))
    .filter((id) => assets.integrity?.[id] !== nextIntegrityForAudio[id]);

  console.log(`${slug}: ${files.length} clips on disk, ${previousIds.size} previously registered`);
  if (added.length) console.log(`  + added: ${added.join(', ')}`);
  if (removed.length) console.log(`  - removed (no file on disk anymore): ${removed.join(', ')}`);
  if (changed.length) console.log(`  ~ re-recorded (integrity changed): ${changed.join(', ')}`);
  if (!added.length && !removed.length && !changed.length) console.log('  up to date, nothing to do');

  if (write) {
    const nextIntegrity = { ...assets.integrity };
    for (const id of previousIds) delete nextIntegrity[id]; // 오래된 오디오 항목을 먼저 제거
    Object.assign(nextIntegrity, nextIntegrityForAudio);
    const next = { ...assets, audioAssets: nextAudioAssets, integrity: nextIntegrity };
    await writeFile(assetsPath, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`  wrote ${assetsPath}`);
  } else if (added.length || removed.length || changed.length) {
    console.log('  (dry run - pass --write to apply)');
  }
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = dirname(scriptDirectory);
const args = process.argv.slice(2);
const requestedSlug = flagValue(args, '--story');
const all = args.includes('--all');
const write = args.includes('--write');
if (!requestedSlug && !all) throw new Error('Use --story <slug> or --all.');

const slugs = all
  ? (await loadRegistry(appDirectory)).stories.map((entry) => entry.slug)
  : [requestedSlug];

for (const slug of slugs) {
  await syncStory(appDirectory, slug, write);
}
