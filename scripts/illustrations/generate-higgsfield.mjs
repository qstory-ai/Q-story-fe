// 삽화 다시 만들기 2단계 - jobs.json의 장면마다 Higgsfield GPT Image 2.5 Flare(marketing-studio/image/flare)로 후보를
// 만들어 내려받는다. 요청은 비동기라 status_url을 지켜보고, 끝난 그림은 images/<id>/<n>.png로 저장한다. 이미 받은 후보는
// 건너뛰므로 중간에 끊겨도 다시 돌리면 이어서 만든다(같은 요청은 Idempotency-Key로 중복 과금되지 않게).
//
// 준비: refs 폴더에 캐릭터 시트를 넣는다(파일 이름으로 찾는다).
//   gretel-sheet.(png|jpg|webp)  hansel-sheet.*   ← 필수
//   background-1.*  background-2.*                ← 선택(배경·분위기 참고)
//   father-sheet.* stepmother-sheet.* witch-sheet.* ← 선택(있으면 그 인물이 나오는 장면에 붙는다)
// 인증: HF_API_KEY_ID / HF_API_KEY_SECRET (또는 HF_CREDENTIALS="id:secret") 환경변수. 키는 저장소에 넣지 않는다.
//
// 사용법: node scripts/illustrations/generate-higgsfield.mjs --refs <dir> [--only id1,id2] [--variants 2]
//          [--resolution 4k] [--quality high] [--concurrency 3] [--limit N] [--dry-run]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const story = flag('--story', 'hansel-gretel');
const workDir = flag('--out', join(appDirectory, 'build-output', 'illustrations', story));
const refsDir = flag('--refs', null);
const only = (flag('--only', '') || '').split(',').filter(Boolean);
const variants = Number(flag('--variants', '2'));
const resolution = flag('--resolution', '4k');
const quality = flag('--quality', 'high');
const concurrency = Number(flag('--concurrency', '3'));
const limit = Number(flag('--limit', '0'));
const dryRun = args.includes('--dry-run');

// HF_API_BASE는 시험용(가짜 서버)으로만 바꾼다.
const API = process.env.HF_API_BASE ?? 'https://api.higgsfield.ai';
const ENDPOINT = 'marketing-studio/image/flare';
const MODEL_LABEL = 'higgsfield:marketing-studio/image/flare (GPT Image 2.5 Flare)';
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

const { jobs } = JSON.parse(readFileSync(join(workDir, 'jobs.json'), 'utf8'));
let selected = only.length ? jobs.filter((job) => only.includes(job.id)) : jobs;
if (limit > 0) selected = selected.slice(0, limit);
if (selected.length === 0) throw new Error('No jobs selected');

/** 인물 → refs 파일 이름 앞부분. 시트가 있는 인물만 그 장면에 붙는다. */
const REF_FILES = {
  GRETEL: 'gretel-sheet',
  HANSEL: 'hansel-sheet',
  FATHER: 'father-sheet',
  STEPMOTHER: 'stepmother-sheet',
  OLD_WOMAN: 'witch-sheet',
  WITCH: 'witch-sheet',
};
const CONTENT_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function findRefs() {
  if (!refsDir) throw new Error('--refs <dir> is required (character sheets)');
  const files = readdirSync(refsDir).filter((name) => CONTENT_TYPES[extname(name).toLowerCase()]);
  const byStem = new Map(files.map((name) => [name.slice(0, -extname(name).length).toLowerCase(), join(refsDir, name)]));
  for (const required of ['gretel-sheet', 'hansel-sheet']) {
    if (!byStem.has(required)) throw new Error(`${refsDir}에 ${required}.(png|jpg|webp)가 없어요`);
  }
  return byStem;
}

function credentials() {
  const combined = process.env.HF_CREDENTIALS;
  const id = process.env.HF_API_KEY_ID ?? combined?.split(':')[0];
  const secret = process.env.HF_API_KEY_SECRET ?? combined?.split(':').slice(1).join(':');
  if (!id || !secret) throw new Error('HF_API_KEY_ID / HF_API_KEY_SECRET (또는 HF_CREDENTIALS) 환경변수가 필요해요');
  return `Key ${id}:${secret}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(path, { method = 'GET', body, idempotencyKey } = {}, auth) {
  const headers = { authorization: auth, 'content-type': 'application/json' };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(path.startsWith('http') ? path : `${API}/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 429 || response.status >= 500) {
      if (attempt >= 5) throw new Error(`${method} ${path}: HTTP ${response.status}`);
      const retryAfter = Number(response.headers.get('retry-after')) || 2 ** attempt * 2;
      await sleep(retryAfter * 1000);
      continue;
    }
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  }
}

/** 참고 그림을 Higgsfield 임시 저장소에 올리고 public_url을 받는다(업로드 주소는 1시간 유효). */
async function uploadRefs(byStem, auth) {
  const cachePath = join(workDir, 'refs.json');
  const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const urls = {};
  for (const [stem, file] of byStem) {
    const bytes = readFileSync(file);
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (cache[stem]?.hash === hash) {
      urls[stem] = cache[stem].url;
      continue;
    }
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()];
    const upload = await api('files/generate-upload-url', { method: 'POST', body: { content_type: contentType } }, auth);
    const put = await fetch(upload.upload_url, { method: 'PUT', headers: upload.upload_headers, body: bytes });
    if (!put.ok) throw new Error(`upload ${stem}: HTTP ${put.status}`);
    urls[stem] = upload.public_url;
    cache[stem] = { hash, url: upload.public_url, uploadedAt: new Date().toISOString() };
    console.log(`[ref] ${stem} 올림`);
  }
  writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`);
  return urls;
}

/** 장면에 붙일 참고 그림 - 등장인물 시트 먼저, 그다음 배경 참고(최대 16장). */
function refsFor(job, urls) {
  const stems = [
    ...new Set(job.characters.map((character) => REF_FILES[character]).filter((stem) => stem && urls[stem])),
  ];
  const backgrounds = Object.keys(urls).filter((stem) => stem.startsWith('background-')).sort();
  return [...stems, ...backgrounds].slice(0, 16).map((stem) => ({ stem, url: urls[stem] }));
}

async function runVariant(job, variant, refs, auth, results) {
  const dir = join(workDir, 'images', job.id);
  const file = join(dir, `${variant}.png`);
  if (existsSync(file)) return 'skipped';
  const refNote = refs.map((ref) => ref.stem).join(', ');
  // 같은 장면·같은 프롬프트·같은 참고 그림·같은 후보 번호면 같은 키 - 끊겼다가 다시 보내도 새로 과금되지 않는다.
  const idempotencyKey = createHash('sha256').update(`${job.id}|${variant}|${job.promptHash}|${refNote}`).digest('hex');
  const body = {
    prompt: job.prompt,
    image_urls: refs.map((ref) => ref.url),
    resolution,
    aspect_ratio: '16:9',
    quality,
    enhance_prompt: false,
  };
  const submitted = await api(ENDPOINT, { method: 'POST', body, idempotencyKey }, auth);
  const started = Date.now();
  let status = submitted;
  let wait = 4000;
  while (!['completed', 'failed', 'nsfw', 'canceled'].includes(status.status)) {
    if (Date.now() - started > POLL_TIMEOUT_MS) throw new Error(`${job.id}#${variant}: timed out (${submitted.request_id})`);
    await sleep(wait);
    wait = Math.min(wait * 1.5, 20000);
    status = await api(submitted.status_url ?? `requests/${submitted.request_id}/status`, {}, auth);
  }
  const record = {
    id: job.id,
    variant,
    requestId: submitted.request_id,
    status: status.status,
    promptHash: job.promptHash,
    refs: refNote,
    model: MODEL_LABEL,
    resolution,
    quality,
    seconds: Math.round((Date.now() - started) / 1000),
    finishedAt: new Date().toISOString(),
  };
  if (status.status !== 'completed' || !status.images?.[0]?.url) {
    results.push({ ...record, error: status.error ?? null });
    throw new Error(`${job.id}#${variant}: ${status.status} ${JSON.stringify(status.error ?? '')}`);
  }
  // 결과는 최소 7일만 보관되니 바로 내려받는다.
  const image = await fetch(status.images[0].url);
  if (!image.ok) throw new Error(`${job.id}#${variant}: download HTTP ${image.status}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, Buffer.from(await image.arrayBuffer()));
  results.push({ ...record, file: `images/${job.id}/${variant}.png`, sourceUrl: status.images[0].url });
  return 'done';
}

const byStem = findRefs();
console.log(`장면 ${selected.length}개 × 후보 ${variants}장 = 요청 ${selected.length * variants}건 (${resolution}, ${quality})`);
if (dryRun) {
  for (const job of selected) {
    const refs = [...new Set(job.characters.map((c) => REF_FILES[c]).filter((s) => s && byStem.has(s)))];
    console.log(`- ${job.id} [${job.kind}] 참고: ${[...refs, ...[...byStem.keys()].filter((s) => s.startsWith('background-'))].join(', ')} · ${job.prompt.length}자`);
  }
  console.log('dry-run - API를 부르지 않았어요');
  process.exit(0);
}

const auth = credentials();
const urls = await uploadRefs(byStem, auth);
const resultsPath = join(workDir, 'results.json');
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
const tasks = selected.flatMap((job) => Array.from({ length: variants }, (_, index) => ({ job, variant: index + 1 })));
let cursor = 0;
let done = 0;
let failed = 0;
async function worker() {
  while (cursor < tasks.length) {
    const { job, variant } = tasks[cursor++];
    try {
      const outcome = await runVariant(job, variant, refsFor(job, urls), auth, results);
      if (outcome === 'done') {
        done += 1;
        console.log(`[ok] ${job.id}#${variant}`);
      }
    } catch (error) {
      failed += 1;
      console.log(`[fail] ${error.message}`);
    }
    writeFileSync(resultsPath, `${JSON.stringify(results, null, 2)}\n`);
  }
}
await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
console.log(`끝: 새로 만든 ${done}장, 실패 ${failed}건 → ${join(workDir, 'images')}`);
console.log('다음: node scripts/illustrations/review-sheet.mjs 로 비교 화면을 만들고 picks.json에 고를 후보를 적어요');
if (failed) process.exitCode = 1;
