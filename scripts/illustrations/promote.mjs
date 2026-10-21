// 삽화 다시 만들기 4단계 - picks.json에서 고른 후보를 앱 그림으로 바꾼다.
//   1) 1920×1080 WebP로 맞춰 assets/story/<story>/illustrations/<기존 이름>-s1.webp로 저장(이름이 바뀌어야 CDN 캐시가 새로 받는다)
//   2) assets.json의 file·integrity를 새 파일로 바꾼다
//   3) visual-provenance.yaml에 프롬프트·모델·inputHash를 RECOVERED로 남긴다(approvedBy는 비워 둔다 - 사람이 승인 후 적는다)
// 예전 파일은 지우지 않는다(되돌릴 때 assets.json만 되돌리면 된다). 끝나면 아래 순서로 반영한다.
//   npm run content:generate && npm run content:check → node scripts/upload-story-assets-to-supabase.mjs --story <story> --kind images
//   → npm run content:import
//
// 사용법: node scripts/illustrations/promote.mjs [--story hansel-gretel] [--out <dir>] [--dry-run]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { parseDocument } from 'yaml';

import { STYLE_ID } from './style-01.mjs';

const appDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const story = flag('--story', 'hansel-gretel');
const workDir = flag('--out', join(appDirectory, 'build-output', 'illustrations', story));
const dryRun = args.includes('--dry-run');
const storyDir = join(appDirectory, 'content', 'stories', story);
const assetsRoot = join(appDirectory, 'assets', 'story', story);

const { jobs } = JSON.parse(readFileSync(join(workDir, 'jobs.json'), 'utf8'));
const picks = JSON.parse(readFileSync(join(workDir, 'picks.json'), 'utf8'));
const results = existsSync(join(workDir, 'results.json')) ? JSON.parse(readFileSync(join(workDir, 'results.json'), 'utf8')) : [];
const assetsPath = join(storyDir, 'assets.json');
const assets = JSON.parse(readFileSync(assetsPath, 'utf8'));
const provenancePath = join(storyDir, 'visual-provenance.yaml');
const provenance = parseDocument(readFileSync(provenancePath, 'utf8'));

const changed = [];
for (const job of jobs) {
  const pick = picks[job.id];
  if (pick == null) continue;
  const source = join(workDir, 'images', job.id, `${pick}.png`);
  if (!existsSync(source)) throw new Error(`${job.id}: 후보 ${pick}이 없어요 (${source})`);
  const asset = assets.assets.find((entry) => entry.slug === job.id);
  if (!asset) throw new Error(`${job.id}: assets.json에 없어요`);
  // 예전 이름에서 버전 꼬리(-v2 등)와 스타일 꼬리를 떼고 스타일 꼬리를 붙인다. 이미 같은 스타일 꼬리(-s1)가 붙어 있는데
  // 그림이 바뀌었으면 번호를 올린다(-s2) - 이름이 같으면 CDN·브라우저가 예전 그림을 1시간 넘게 보여 준다(10/21 부엌 장면).
  // 그림이 그대로면(같은 후보를 다시 골라도) 건드리지 않는다.
  const webp = await sharp(source).resize(1920, 1080, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
  const integrity = `sha256-${createHash('sha256').update(webp).digest('base64')}`;
  if (integrity === asset.integrity) continue;
  const current = /-s(\d+)$/.exec(basename(asset.file, '.webp'));
  const stem = basename(asset.file, '.webp').replace(/-(v\d+|s\d+)$/, '');
  const file = `illustrations/${stem}-s${current ? Number(current[1]) + 1 : 1}.webp`;
  const record = results.find((entry) => entry.id === job.id && entry.variant === pick && entry.file);
  changed.push({ id: job.id, from: asset.file, to: file, kb: Math.round(webp.length / 1024) });
  if (dryRun) continue;
  writeFileSync(join(assetsRoot, file), webp);
  asset.file = file;
  asset.integrity = integrity;
  const sourceBytes = readFileSync(source);
  const entry = {
    assetSlug: job.id,
    status: 'RECOVERED',
    prompt: job.prompt,
    model: record?.model ?? 'higgsfield:marketing-studio/image/flare',
    inputHash: `sha256:${createHash('sha256').update(job.prompt).update(record?.refs ?? '').digest('hex')}`,
    generatedAt: record?.finishedAt ?? new Date().toISOString(),
    approvedBy: null,
    note: `${STYLE_ID} 다시 그리기(후보 ${pick}). 참고 그림: ${record?.refs ?? '?'}. 요청 ${record?.requestId ?? '?'}, ${record?.resolution ?? '?'}/${record?.quality ?? '?'}. 원본 PNG sha256:${createHash('sha256').update(sourceBytes).digest('hex').slice(0, 16)}… 를 1920x1080 WebP로 맞춤. inputHash는 프롬프트 + 참고 그림 이름의 sha256.`,
  };
  const records = provenance.get('records');
  const index = records.items.findIndex((item) => item.get('assetSlug') === job.id);
  if (index >= 0) records.set(index, provenance.createNode(entry));
  else records.add(provenance.createNode(entry));
}

for (const item of changed) console.log(`${item.id}: ${item.from} → ${item.to} (${item.kb}KB)`);
if (dryRun) {
  console.log(`dry-run - ${changed.length}장을 바꿀 예정, 파일은 쓰지 않았어요`);
} else {
  writeFileSync(assetsPath, `${JSON.stringify(assets, null, 2)}\n`);
  writeFileSync(provenancePath, provenance.toString({ lineWidth: 0 }));
  console.log(`${changed.length}장 바꿈. 다음: npm run content:generate && npm run content:check`);
}
