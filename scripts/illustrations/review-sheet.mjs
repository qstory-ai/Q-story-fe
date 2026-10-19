// 삽화 다시 만들기 3단계 - 지금 그림과 새 후보를 장면 순서대로 나란히 놓은 review.html과, 고를 후보를 적는 picks.json
// 초안을 만든다. 브라우저로 review.html을 열어 보고 picks.json의 숫자(후보 번호, 안 바꿀 장면은 null)를 고친다.
//
// 사용법: node scripts/illustrations/review-sheet.mjs [--story hansel-gretel] [--out <dir>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const story = flag('--story', 'hansel-gretel');
const workDir = flag('--out', join(appDirectory, 'build-output', 'illustrations', story));
const assetsRoot = join(appDirectory, 'assets', 'story', story);
const { jobs } = JSON.parse(readFileSync(join(workDir, 'jobs.json'), 'utf8'));

const escape = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const picksPath = join(workDir, 'picks.json');
const picks = existsSync(picksPath) ? JSON.parse(readFileSync(picksPath, 'utf8')) : {};

const sections = jobs.map((job) => {
  const dir = join(workDir, 'images', job.id);
  const candidates = existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.png')).sort() : [];
  if (!(job.id in picks)) picks[job.id] = candidates.length ? 1 : null;
  const current = job.currentFile ? pathToFileURL(join(assetsRoot, job.currentFile)).href : '';
  const cells = [
    `<figure><img src="${current}" alt=""><figcaption>지금 그림</figcaption></figure>`,
    ...candidates.map(
      (name) => `<figure><img src="${escape(relative(workDir, join(dir, name)).replace(/\\/g, '/'))}" alt=""><figcaption>후보 ${escape(name.replace('.png', ''))}</figcaption></figure>`,
    ),
  ];
  return `<section id="${escape(job.id)}">
  <h2>${escape(job.id)} <small>${escape(job.kind)}${job.sceneTitle ? ` · ${escape(job.sceneTitle)}` : ''}</small></h2>
  <p class="lines">${job.lines.map(escape).join('<br>')}</p>
  <div class="row">${cells.join('')}</div>
  <details><summary>프롬프트 (${job.prompt.length}자)</summary><pre>${escape(job.prompt)}</pre></details>
</section>`;
});

writeFileSync(
  join(workDir, 'review.html'),
  `<!doctype html><meta charset="utf-8"><title>삽화 후보 비교 - ${escape(story)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;background:#faf8fc;color:#28153f}
section{margin:0 0 36px;padding-bottom:24px;border-bottom:1px solid #ddd}
h2{font-size:18px;margin:0 0 6px} small{color:#888;font-weight:400}
.lines{color:#555;font-size:14px;margin:0 0 10px}
.row{display:flex;gap:12px;flex-wrap:wrap}
figure{margin:0;width:min(32vw,520px)} img{width:100%;border-radius:8px;display:block;background:#eee}
figcaption{font-size:13px;color:#666;margin-top:4px}
pre{white-space:pre-wrap;font-size:12px;background:#fff;padding:10px;border-radius:6px}
</style>
<h1>삽화 후보 비교 (${jobs.length}장면)</h1>
<p>고른 후보 번호는 같은 폴더의 picks.json에 적어요. 바꾸지 않을 장면은 null.</p>
${sections.join('\n')}`,
);
writeFileSync(picksPath, `${JSON.stringify(picks, null, 2)}\n`);
console.log(`review.html, picks.json → ${workDir}`);
