// 스토리의 정적 자산(삽화 + 내레이션/브릿지 오디오)을 Supabase Storage 공개 버킷에 올린다.
// 백엔드의 GET /v1/stories/{id}/content 가 내려주는 asset.url 은 이 버킷의 공개 URL 이라
// (be StoryContentAssemblyService.assetUrl 참고), 임포트한 스토리의 파일은 반드시 여기 올라가 있어야
// 플레이어가 그림과 소리를 받는다. 오브젝트 이름은 백엔드와 같은 규칙
// `<slug>/<assets.json의 file>` (예: hansel-gretel/illustrations/x.jpg, hansel-gretel/audio/y.mp3)이다.
//
// 사용법: node scripts/upload-story-assets-to-supabase.mjs (--story <slug> | --all)
//         [--kind images|audio|all] [--env <path-to-be/.env>] [--dry-run]
import { readFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assetBucketFor, loadRegistry } from './lib/story-package.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const appDirectory = dirname(scriptDirectory);
const repoRoot = dirname(dirname(appDirectory));

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1]?.trim();
}

const args = process.argv.slice(2);
const requestedSlug = flagValue(args, '--story');
const all = args.includes('--all');
const kind = flagValue(args, '--kind') ?? 'all';
const dryRun = args.includes('--dry-run');
const envPathArg = flagValue(args, '--env');
if (!requestedSlug && !all) throw new Error('Use --story <slug> or --all');
if (!['images', 'audio', 'all'].includes(kind)) throw new Error('--kind must be images, audio or all');

// 프로젝트 URL 과 service role key 는 백엔드 .env 에서 읽는다(브라우저에는 절대 싣지 않는다).
const envPath = envPathArg ?? join(repoRoot, 'be', 'q-story-backend', '.env');
const envText = await readFile(envPath, 'utf8');
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim().replace(/^"|"$/g, '')];
    }),
);
const supabaseUrl = env.SUPABASE_URL?.replace(/\/+$/, '');
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(`SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing in ${envPath}`);
}

const IMAGE_CATEGORIES = new Set(['SCENE_ART', 'BRANCH_ART']);
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
};

function wanted(category) {
  if (kind === 'all') return true;
  return kind === 'images' ? IMAGE_CATEGORIES.has(category) : !IMAGE_CATEGORIES.has(category);
}

const registry = await loadRegistry(appDirectory);
// 업로드 대상 프로젝트와 앱이 URL 을 만들 때 쓰는 프로젝트가 다르면 조용히 404 가 나므로 여기서 막는다.
if (!registry.assetStorage.publicBaseUrl.startsWith(`${supabaseUrl}/`)) {
  throw new Error(
    `content/registry.yaml assetStorage.publicBaseUrl (${registry.assetStorage.publicBaseUrl}) is not under SUPABASE_URL (${supabaseUrl}) from ${envPath}`,
  );
}
const entries = all
  ? registry.stories
  : registry.stories.filter((entry) => entry.slug === requestedSlug);
if (entries.length === 0) throw new Error(`Unknown story slug: ${requestedSlug}`);

const jobs = [];
for (const entry of entries) {
  const assetsPath = join(appDirectory, 'content', 'stories', entry.slug, 'assets.json');
  const assets = JSON.parse(await readFile(assetsPath, 'utf8'));
  for (const asset of assets.assets) {
    if (!wanted(asset.category)) continue;
    const contentType = CONTENT_TYPES[extname(asset.file).toLowerCase()];
    if (!contentType) throw new Error(`No content type for ${asset.file}`);
    jobs.push({
      slug: entry.slug,
      assetId: asset.slug,
      bucket: assetBucketFor(registry, asset.category),
      onDiskPath: join(appDirectory, `${assets.root}${asset.file}`),
      objectName: `${entry.slug}/${asset.file}`,
      contentType,
    });
  }
}
if (jobs.length === 0) throw new Error('Nothing to upload');

async function uploadOne(job) {
  const bytes = await readFile(job.onDiskPath);
  if (dryRun) return { ...job, ok: true, bytes: bytes.length };
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${job.bucket}/${job.objectName}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      'content-type': job.contentType,
      'x-upsert': 'true', // 재실행 안전 - 같은 이름이면 409 대신 덮어쓴다
      // 릴리스된 정적 자산은 내용이 바뀌지 않으므로 브라우저/CDN 이 오래 캐시해도 된다.
      // 바뀌면 파일명(-v2 등)이 바뀌는 규칙이라 immutable 로 둔다.
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: bytes,
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    return { ...job, ok: false, status: response.status, body: body.slice(0, 200) };
  }
  return { ...job, ok: true, bytes: bytes.length };
}

const CONCURRENCY = 8;
const results = [];
let cursor = 0;
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    results.push(await uploadOne(job));
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const failed = results.filter((r) => !r.ok);
const totalBytes = results.filter((r) => r.ok).reduce((sum, r) => sum + r.bytes, 0);
const byBucket = new Map();
for (const r of results.filter((r) => r.ok)) byBucket.set(r.bucket, (byBucket.get(r.bucket) ?? 0) + 1);
console.log(
  `${dryRun ? 'would upload' : 'uploaded'} ${results.length - failed.length}/${results.length} files (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`,
);
for (const [bucket, count] of byBucket) console.log(`  ${bucket}: ${count}`);
if (failed.length > 0) {
  console.log('failures:');
  for (const failure of failed) {
    console.log(`  ${failure.assetId} -> ${failure.bucket}/${failure.objectName}: HTTP ${failure.status} ${failure.body}`);
  }
  process.exitCode = 1;
}
