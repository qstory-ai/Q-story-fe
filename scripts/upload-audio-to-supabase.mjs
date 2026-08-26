// 일회성/재사용 가능 마이그레이션: 등록된 모든 내레이션 클립(content/stories/<slug>/assets.json의
// audioAssets)을 Supabase Storage에 업로드하여, 앱 번들 대신 그곳에서 재생을 서빙할 수 있게 한다.
// 사용법: node scripts/upload-audio-to-supabase.mjs --story hansel-gretel [--env <path-to-.env>]
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = dirname(scriptDirectory);
const repoRoot = dirname(dirname(appDirectory));

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1]?.trim();
}

const args = process.argv.slice(2);
const slug = flagValue(args, '--story');
const envPathArg = flagValue(args, '--env');
if (!slug) throw new Error('Use --story <slug>, e.g. --story hansel-gretel');

const envPath = envPathArg ?? join(repoRoot, 'be', 'q-story-backend', '.env');
const envText = await readFile(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    }),
);
const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = env.SUPABASE_STORY_AUDIO_BUCKET || 'qstory-story-audio';
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(`SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing in ${envPath}`);
}

const assetsPath = join(appDirectory, 'content', 'stories', slug, 'assets.json');
const assets = JSON.parse(await readFile(assetsPath, 'utf8'));
const entries = Object.entries(assets.audioAssets ?? {});
if (entries.length === 0) throw new Error(`No audioAssets in ${assetsPath}`);

async function uploadOne([assetId, relativePath]) {
  // assets.json은 assets/ 소스 트리를 기준으로 경로를 선언하지만, 이 프로젝트는 실제로
  // public/에서 서빙한다 (generate-story-package.mjs 자체의 publicAssetUrl 리매핑 참고).
  const onDiskPath = join(appDirectory, relativePath.replace(/^assets\//, 'public/'));
  const filename = relativePath.split('/').pop();
  const objectName = `${slug}/audio/${filename}`;
  const bytes = await readFile(onDiskPath);
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectName}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'audio/mpeg',
      'x-upsert': 'true', // 안전하게 재실행 가능 - 재업로드 시 409 대신 덮어쓰기(replace)된다
      // 이것들은 앱의 약 200개 고정 내레이션 클립으로, 아이의 세션이 바뀌어도
      // 내용이 달라지지 않는다 - 이 설정이 없으면 Supabase가 "no-cache"로 서빙해서,
      // 재생할 때마다 동일한 바이트를 매번 다시 가져오게 된다.
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: bytes,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { assetId, objectName, ok: false, status: response.status, body: body.slice(0, 200) };
  }
  return { assetId, objectName, ok: true, bytes: bytes.length };
}

const CONCURRENCY = 8;
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < entries.length) {
    const entry = entries[cursor++];
    results.push(await uploadOne(entry));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const failed = results.filter((r) => !r.ok);
const totalBytes = results.filter((r) => r.ok).reduce((sum, r) => sum + r.bytes, 0);
console.log(`uploaded ${results.length - failed.length}/${results.length} clips (${(totalBytes / 1024 / 1024).toFixed(1)} MB) to bucket "${bucket}"`);
if (failed.length > 0) {
  console.log('failures:');
  for (const failure of failed) {
    console.log(`  ${failure.assetId} -> ${failure.objectName}: HTTP ${failure.status} ${failure.body}`);
  }
  process.exitCode = 1;
}
