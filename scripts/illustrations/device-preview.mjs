// 삽화 기기별 미리보기 - 앱에 들어간 그림(또는 --candidates로 새 후보)을 휴대폰 가로·노트북·아이패드 가로 화면 비율로
// 잘라(플레이어와 같게 - device-frames.mjs) 나란히 놓고, 그림 위를 덮는 화면 요소 자리를 겹쳐 그린다. 그림을 고르기 전에
// "잘리거나 가리는지"를 한 번에 본다(10/24: 하얀 새가 상단 버튼에 가리고 2:1 태블릿에서 잘림).
//
// 덮는 자리(10/24 demo에서 잰 값, 화면 높이 대비 %):
//   상단 버튼 줄  휴대폰 0-22 / 노트북·아이패드 0-11      (빨강)
//   내레이션 자막  휴대폰 74-95 / 노트북·아이패드 87-98    (빨강)
//   질문 카드     가로 28-72 · 세로 36-74 (질문 초대 때)  (주황 점선)
//   대화창       아래 40% (그레텔과 말하기를 열었을 때)     (파랑 점선)
//
// 사용법: node scripts/illustrations/device-preview.mjs [--story hansel-gretel] [--candidates] [--only id1,id2]
//   결과: build-output/illustrations/<story>/device-preview/sheet-NN.jpg + index.html
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import { DEVICES, deviceFrame } from './device-frames.mjs';

const appDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const story = flag('--story', 'hansel-gretel');
const workDir = join(appDirectory, 'build-output', 'illustrations', story);
const outDir = join(workDir, 'device-preview');
const only = (flag('--only', '') || '').split(',').filter(Boolean);
const useCandidates = args.includes('--candidates');

const FRAME_H = 220;
const LABEL_H = 28;
const GAP = 12;
const ROWS_PER_SHEET = 6;

const assets = JSON.parse(readFileSync(join(appDirectory, 'content', 'stories', story, 'assets.json'), 'utf8')).assets;
let items = assets.filter((asset) => ['SCENE_ART', 'BRANCH_ART', 'ATTEMPT_ART'].includes(asset.category));
if (only.length) items = items.filter((asset) => only.includes(asset.slug));
const sourceFor = (asset) => {
  const candidate = join(workDir, 'images', asset.slug, '1.png');
  if (useCandidates && existsSync(candidate)) return candidate;
  return join(appDirectory, 'assets', 'story', story, asset.file);
};


const frame = (file, device) => deviceFrame(file, device, FRAME_H);

const label = (text, width) =>
  Buffer.from(`<svg width="${width}" height="${LABEL_H}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#222"/>
  <text x="8" y="19" font-size="15" fill="#fff" font-family="sans-serif">${text}</text></svg>`);

mkdirSync(outDir, { recursive: true });
const rowWidth = DEVICES.reduce((sum, device) => sum + Math.round(FRAME_H * device.aspect) + GAP, 0);
const sheets = [];
for (let start = 0; start < items.length; start += ROWS_PER_SHEET) {
  const rows = items.slice(start, start + ROWS_PER_SHEET);
  const layers = [];
  for (const [index, asset] of rows.entries()) {
    const top = index * (FRAME_H + LABEL_H + GAP);
    layers.push({ input: label(`${asset.slug}  ·  ${DEVICES.map((d) => d.name).join(' / ')}`, rowWidth), left: 0, top });
    let left = 0;
    for (const device of DEVICES) {
      layers.push({ input: await frame(sourceFor(asset), device), left, top: top + LABEL_H });
      left += Math.round(FRAME_H * device.aspect) + GAP;
    }
  }
  const name = `sheet-${String(sheets.length + 1).padStart(2, '0')}.jpg`;
  await sharp({ create: { width: rowWidth, height: rows.length * (FRAME_H + LABEL_H + GAP), channels: 3, background: '#fff' } })
    .composite(layers)
    .jpeg({ quality: 82 })
    .toFile(join(outDir, name));
  sheets.push(name);
}
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html><meta charset="utf-8"><title>기기별 삽화 미리보기 - ${story}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px}img{max-width:100%;display:block;margin:0 0 24px}</style>
<h1>기기별 삽화 미리보기 (${items.length}장${useCandidates ? ', 새 후보' : ''})</h1>
<p>빨강 = 상단 버튼 줄·내레이션 자막이 늘 덮는 자리. 주황 점선 = 질문 카드(질문 초대 때). 파랑 점선 아래 = 대화창(그레텔과 말하기).
얼굴·동물·중요한 행동이 빨강 안에 있거나 틀 밖으로 잘리면 고친다.</p>
${sheets.map((name) => `<img src="${name}" alt="">`).join('\n')}`,
);
console.log(`${items.length}장 → ${outDir} (${sheets.length}장짜리 시트, index.html)`);
