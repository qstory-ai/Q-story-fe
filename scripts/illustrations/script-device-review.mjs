// 대본 + 기기별 삽화 검토 파일 - 장면 순서대로 그 그림에서 읽히는 대본 문장과, 휴대폰 가로·노트북·아이패드 가로로 잘린
// 그림(상단 버튼 줄·자막·질문 카드·대화창 자리를 겹침)을 나란히 둔 HTML 한 장을 만든다. 그림은 파일 안에 넣어(data URI)
// 이 파일 하나만 보내면 된다. 덮는 자리 수치는 device-preview.mjs와 같다.
//
// 사용법: node scripts/illustrations/script-device-review.mjs [--story hansel-gretel] [--candidates] [--out <file.html>]
//   기본 출력: build-output/illustrations/<story>/대본-기기별-삽화.html (먼저 npm run art:jobs)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEVICES, deviceFrame } from './device-frames.mjs';

const appDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const story = flag('--story', 'hansel-gretel');
const workDir = join(appDirectory, 'build-output', 'illustrations', story);
const outFile = flag('--out', join(workDir, '대본-기기별-삽화.html'));
const useCandidates = args.includes('--candidates');

const FRAME_H = 240;
const KIND_LABEL = { scene: '장면', branch: '행동 전개', attempt: '시도 장면 막힘' };

const { jobs } = JSON.parse(readFileSync(join(workDir, 'jobs.json'), 'utf8'));
const assets = JSON.parse(readFileSync(join(appDirectory, 'content', 'stories', story, 'assets.json'), 'utf8')).assets;
const fileFor = (job) => {
  const candidate = join(workDir, 'images', job.id, '1.png');
  if (useCandidates && existsSync(candidate)) return candidate;
  const asset = assets.find((entry) => entry.slug === job.id);
  return asset ? join(appDirectory, 'assets', 'story', story, asset.file) : null;
};


async function frame(file, device) {
  const jpeg = await deviceFrame(file, device, FRAME_H, 'jpeg');
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
}

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const speakerLabel = { NARRATOR: '', HANSEL: '헨젤', GRETEL: '그레텔', FATHER: '아버지', STEPMOTHER: '새어머니', OLD_WOMAN: '할머니', WITCH: '마녀' };
function lineHtml(line) {
  const match = /^([A-Z_]+): (.*)$/.exec(line);
  if (!match) return `<li>${escape(line)}</li>`;
  return `<li><b>${escape(speakerLabel[match[1]] ?? match[1])}</b> ${escape(match[2])}</li>`;
}

const sections = [];
let lastScene = null;
for (const [index, job] of jobs.entries()) {
  const file = fileFor(job);
  if (!file) continue;
  const frames = await Promise.all(DEVICES.map((device) => frame(file, device)));
  const heading =
    job.kind === 'scene' && job.sceneTitle !== lastScene ? `<h2>${escape(job.sceneTitle)}</h2>` : '';
  if (job.kind === 'scene') lastScene = job.sceneTitle;
  if (job.kind !== 'scene' && index > 0 && jobs[index - 1].kind === 'scene') sections.push('<h2>행동 전개·시도 장면</h2>');
  sections.push(`${heading}
<section>
  <div class="meta"><span class="kind">${KIND_LABEL[job.kind] ?? job.kind}</span> <code>${escape(job.id)}</code></div>
  <ul class="lines">${job.lines.map(lineHtml).join('')}</ul>
  <div class="row">${frames
    .map((src, i) => `<figure><img src="${src}" alt=""><figcaption>${DEVICES[i].name}</figcaption></figure>`)
    .join('')}</div>
</section>`);
}

writeFileSync(
  outFile,
  `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>대본·기기별 삽화 검토 - ${escape(story)}</title>
<style>
body{font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;margin:0;padding:24px 16px;background:#f7f5fa;color:#231936}
main{max-width:1400px;margin:0 auto}
h1{font-size:24px;margin:0 0 8px} h2{font-size:19px;margin:36px 0 10px;padding-top:12px;border-top:2px solid #d9d2e6}
.legend{font-size:14px;line-height:1.6;background:#fff;border-radius:8px;padding:12px 14px}
.legend span{display:inline-block;width:14px;height:10px;vertical-align:middle;margin-right:4px}
section{background:#fff;border-radius:10px;padding:14px;margin:0 0 14px}
.meta{font-size:13px;color:#6b5f80} .kind{font-weight:700;color:#5b3fb5} code{font-size:12px}
.lines{margin:8px 0 12px;padding-left:18px;font-size:15px;line-height:1.6} .lines b{color:#5b3fb5;margin-right:4px}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start}
figure{margin:0;min-width:0} img{display:block;height:200px;width:auto;max-width:100%;border-radius:6px}
figcaption{font-size:12px;color:#6b5f80;margin-top:4px}
</style>
<main>
<h1>대본·기기별 삽화 검토 (${jobs.length}장${useCandidates ? ', 새 후보' : ''})</h1>
<div class="legend">
그림마다 그 그림이 보이는 동안 읽히는 대본과, 플레이어처럼 잘린 세 화면을 나란히 뒀어요.<br>
<span style="background:rgba(220,30,30,.5)"></span>상단 버튼 줄·내레이션 자막이 늘 덮는 자리
<span style="border:2px dashed orange;background:none"></span>질문 카드(질문 때)
<span style="border-top:2px dashed #2a7fff;background:none"></span>파란 선 아래 = 대화창(그레텔과 말하기)<br>
얼굴·동물·중요한 행동이 빨강 안에 있거나 화면 밖으로 잘리면, 또는 그림이 대본과 안 맞으면 장면 이름(영문)과 함께 적어 주세요.
</div>
${sections.join('\n')}
</main></html>`,
);
console.log(`${jobs.length}장 → ${outFile}`);
