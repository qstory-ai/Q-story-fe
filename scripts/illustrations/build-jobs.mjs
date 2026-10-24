// 삽화 다시 만들기 1단계 - 스토리 콘텐츠에서 바꿀 그림 목록(장면 40 + 행동 전개 4 + 시도 장면 막힘 6)을 뽑아
// 스타일 01 프롬프트(STORY·COMPOSITION·BACKGROUND·LIGHTING)를 채운 jobs.json을 만든다. API는 부르지 않는다.
//
// 사용법: node scripts/illustrations/build-jobs.mjs [--story hansel-gretel] [--out <dir>]
//   기본 출력: build-output/illustrations/<story>/jobs.json (gitignore된 폴더)
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { BAG_SCENES, CONTINUITY_RULES, STAGING } from './staging-hansel-gretel.mjs';
import { BACKGROUNDS, buildPrompt, LIGHTING, STYLE_ID } from './style-01.mjs';

const appDirectory = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const story = flag('--story', 'hansel-gretel');
const outDir = flag('--out', join(appDirectory, 'build-output', 'illustrations', story));
const storyDir = join(appDirectory, 'content', 'stories', story);

const generated = JSON.parse(readFileSync(join(storyDir, 'generated', 'generated-story-content.json'), 'utf8'));
const assets = JSON.parse(readFileSync(join(storyDir, 'assets.json'), 'utf8'));
const storyYaml = parseYaml(readFileSync(join(storyDir, 'story.yaml'), 'utf8'));
const assetBySlug = new Map(assets.assets.map((asset) => [asset.slug, asset]));

/** "siblings-hold-hands-and-follow-bird" → "siblings hold hands and follow bird" */
const words = (slug) => (slug ? String(slug).replace(/-/g, ' ') : '');

function locationKey(location = '') {
  if (location.startsWith('home') || location === 'outside-home') return 'HOME';
  if (location.startsWith('candy-house-')) {
    if (/exterior|threshold|clearing/.test(location)) return 'CANDY_EXTERIOR';
    // 10/21: 복도 장면이 부엌 배경(창살 LEFT)으로 그려져 복도에 창살이 나왔다 - 복도는 따로.
    if (/corridor|hallway/.test(location)) return 'CANDY_CORRIDOR';
    if (/dining|bedroom/.test(location)) return 'CANDY_DINING';
    if (/storehouse|storeroom/.test(location)) return 'CANDY_STOREROOM';
    return 'CANDY_INTERIOR';
  }
  if (location.startsWith('wide-waterway')) return 'WATERWAY';
  return 'FOREST';
}

/** 그 그림에 나오는 대사(아이가 이 그림을 보며 듣는 문장) - 장면 묘사의 근거로 프롬프트에 함께 넣는다. */
function linesFor(segments, visualId) {
  return segments
    .filter((segment) => segment.kind === 'utterance' && segment.visualId === visualId)
    .map((segment) => `${segment.speaker === 'NARRATOR' ? '' : `${segment.speaker}: `}${segment.text.replace(/\n/g, ' ')}`);
}

function shotFor(visual) {
  const mode = visual.mode ?? '';
  if (/wide|reveal|path|walk|forest/.test(mode)) return 'Cinematic medium-wide shot that shows the place and the characters together.';
  if (/close|whisper|watch|keys|key/.test(mode)) return 'Medium shot focused on the characters and their hands and faces.';
  return 'Medium-wide two-shot, the characters clearly readable.';
}

const jobs = [];

// 10/21 재생성에서 모델이 그레텔·마녀를 창살 안에 넣거나 헨젤을 두 번 그렸다. 부엌 장면마다 "누가 창살 안에 있는지"를
// 장면 흐름(마녀가 헨젤을 가둠 → 그레텔이 창살을 엶)에 따라 추적해 한 문장으로 못 박는다.
const CAGE_LOCK = /locks-hansel-in-cage|hansel-inside-cage|hansel-in-cage/;
const CAGE_OPEN = /opens-cage|unlocks-cage|hansel-steps-out|hansel-free/;
function cageRule(visual, hanselCaged) {
  if (locationKey(visual.location) !== 'CANDY_INTERIOR') return '';
  const action = `${visual.mode ?? ''} ${words(visual.requiredAction)}`;
  if (CAGE_OPEN.test(action)) {
    return 'CAGE: Gretel turns the small silver key in the cage lock and Hansel steps OUT of the open cage; the witch is at the back shelf, not in the cage; each character appears once.';
  }
  if (hanselCaged) {
    // 10/21 3차: 속삭이는 장면에서 그레텔 옆에 헨젤을 한 명 더 그렸다 - 창살 너머로 속삭인다고 못 박는다.
    const whisper = /whisper/.test(action) ? ' Gretel whispers to Hansel THROUGH the bars; NO other boy.' : '';
    return 'CAGE: Hansel is INSIDE the iron cage behind the bars (nowhere else); Gretel is the only child outside; the witch is never in the cage; each character appears once.' + whisper;
  }
  return 'CAGE: the cage is EMPTY; both children stand outside it; each character appears once.';
}

// 글 규칙만으로는 모델이 "누가 창살 안인지"를 자주 틀렸다(10/21 2차: 8/11 실패). 정답 상태가 담긴 승인 그림을
// 마지막 참고 이미지로 붙이고 "마지막 참고 그림의 창살 상황을 그대로"라고 못 박는다. 앱에 들어간 그림 중 상태가 맞는 것.
const illustration = (slug) => join(appDirectory, 'assets', 'story', story, assetBySlug.get(slug)?.file ?? '');
const STATE_REFS = {
  'state-hansel-caged': illustration('c-wait-for-witch-turn-01'),
  'state-corridor': illustration('escape-corridor'),
  // 10/24 3차 QA: 문을 나가는 장면만 오븐·솥 위치와 마녀 옷이 달랐다 - 바로 앞 장면 그림(같은 부엌·같은 마녀)을 붙인다.
  'state-kitchen-layout': illustration('wait-and-take-keys'),
};
function sceneRefsFor(visual, hanselCaged) {
  if (visual.assetId === 'black-key-side-door') return ['state-kitchen-layout'];
  const key = locationKey(visual.location);
  if (key === 'CANDY_CORRIDOR') return ['state-corridor'];
  if (key === 'CANDY_INTERIOR' && hanselCaged) return ['state-hansel-caged'];
  return [];
}
const KITCHEN_LAYOUT_RULE =
  "Match the LAST reference picture's kitchen layout (oven and pot position, shelves, door) and the witch's face, clothes and colors exactly; only the cage is now open and empty.";
const STATE_REF_RULE = " Match the LAST reference picture's cage situation exactly (who is inside/outside).";

// 1) 장면 삽화 - 장면 순서대로. 앞 그림을 이어 그리도록 continuity에 앞 그림의 끝 상태를 적는다.
let previous = null;
let hanselCaged = false;
for (const scene of generated.scenes) {
  for (const visual of scene.visuals) {
    const lines = linesFor(scene.segments, visual.id);
    const action = `${visual.mode ?? ''} ${words(visual.requiredAction)}`;
    if (CAGE_LOCK.test(action)) hanselCaged = true;
    const cage = cageRule(visual, hanselCaged);
    // 창살을 여는 그림도 "헨젤이 안에 있던" 참고 그림이 있어야 밖으로 나오는 장면을 맞게 그린다.
    const refs = sceneRefsFor(visual, hanselCaged);
    if (CAGE_OPEN.test(action)) hanselCaged = false;
    jobs.push({
      id: visual.assetId,
      kind: 'scene',
      sceneId: scene.id,
      sceneTitle: scene.title,
      visualId: visual.id,
      characters: visual.characters,
      location: visual.location,
      time: visual.time,
      lines,
      story: [
        `Episode "${scene.title}". ${words(visual.requiredAction)}.`,
        `It starts from: ${words(visual.entryState)}; it ends with: ${words(visual.exitState)}.`,
        lines.length ? `The story text read with this picture (Korean): ${lines.join(' / ')}` : '',
      ].filter(Boolean).join(' '),
      sceneRefs: refs,
      rules: cage + (refs.length ? STATE_REF_RULE : ''),
      composition: shotFor(visual),
      background: BACKGROUNDS[locationKey(visual.location)],
      lighting: LIGHTING[visual.time] ?? LIGHTING.day,
      continuity: previous ? `This picture follows the previous one, which ended with: ${words(previous.exitState)}.` : '',
    });
    previous = visual;
  }
}

// 2) 행동 전개 그림(BRANCH_ART) - 아이가 고른 행동이 이야기에서 펼쳐지는 장면.
for (const fallback of generated.fallbacks) {
  for (const segment of fallback.segments) {
    if (segment.kind !== 'visual' || assetBySlug.get(segment.assetId)?.category !== 'BRANCH_ART') continue;
    const lines = linesFor(fallback.segments, segment.id);
    const kitchen = fallback.id.startsWith('C_');
    jobs.push({
      id: segment.assetId,
      kind: 'branch',
      familyId: fallback.id,
      visualId: segment.id,
      characters: kitchen ? ['HANSEL', 'GRETEL', 'WITCH'] : ['HANSEL', 'GRETEL', 'WHITE_BIRD'],
      location: kitchen ? 'candy-house-kitchen' : 'forest',
      time: kitchen ? 'day' : 'morning',
      lines,
      story: [
        `The child chose this action for the siblings: ${words(segment.mode)}.`,
        lines.length ? `The story text read with this picture (Korean): ${lines.join(' / ')}` : '',
      ].filter(Boolean).join(' '),
      sceneRefs: kitchen ? ['state-hansel-caged'] : [],
      rules: kitchen ? cageRule({ location: 'candy-house-kitchen', mode: '' }, true) + STATE_REF_RULE : '',
      composition: 'Medium shot focused on the chosen action, faces and hands clearly readable.',
      background: BACKGROUNDS[kitchen ? 'CANDY_INTERIOR' : 'FOREST'],
      lighting: kitchen ? LIGHTING.day : LIGHTING.morning,
      continuity: '',
    });
  }
}

// 3) 시도 장면 막힘 그림 - 준비되지 않은 방법을 해 보다가 막힌 모습(story.yaml attemptBackdrops).
for (const [anchorId, backdrops] of Object.entries(storyYaml.attemptBackdrops ?? {})) {
  for (const backdrop of backdrops) {
    const kitchen = anchorId.endsWith('-C');
    jobs.push({
      id: backdrop.id,
      kind: 'attempt',
      anchorId,
      characters: kitchen ? ['HANSEL', 'GRETEL', 'WITCH'] : ['HANSEL', 'GRETEL', 'WHITE_BIRD'],
      location: kitchen ? 'candy-house-kitchen' : 'forest',
      time: kitchen ? 'day' : 'morning',
      lines: [backdrop.description],
      story: [
        `A gentle "oh no, this way does not work" moment (Korean description: ${backdrop.description}).`,
        'Show the attempt and clearly why it is blocked. Nobody is hurt; the mood stays gentle.',
        kitchen
          ? 'The witch has her back turned, stirring a pot, not noticing. The key ring (two keys) still lies on the worktable.'
          : 'This happens on the glowing forest path where the white bird keeps looking back.',
      ].join(' '),
      sceneRefs: kitchen ? ['state-hansel-caged'] : [],
      rules: kitchen ? cageRule({ location: 'candy-house-kitchen', mode: '' }, true) + STATE_REF_RULE : '',
      composition: 'Medium shot; the blocked attempt is the main subject, large in the frame.',
      background: BACKGROUNDS[kitchen ? 'CANDY_INTERIOR' : 'FOREST'],
      lighting: kitchen ? LIGHTING.day : LIGHTING.morning,
      continuity: '',
    });
  }
}

const unstaged = jobs.filter((job) => !STAGING[job.id]).map((job) => job.id);
if (unstaged.length) throw new Error(`장면 연출 메모(staging-${story}.mjs)가 없는 그림: ${unstaged.join(', ')}`);
for (const job of jobs) {
  job.currentFile = assetBySlug.get(job.id)?.file ?? null;
  job.staging = STAGING[job.id];
  job.continuityRule = BAG_SCENES.has(job.id) ? CONTINUITY_RULES.bag : CONTINUITY_RULES.noBag;
  // 창살 규칙은 연출 메모가 대신한다(누가 창살 안인지 메모에 적음) - 상태 참고 그림 문장만 남겨 5,000자 안에 맞춘다.
  if (job.sceneRefs?.includes('state-kitchen-layout')) job.rules = KITCHEN_LAYOUT_RULE;
  else if (job.sceneRefs?.length) job.rules = STATE_REF_RULE.trim();
  else job.rules = '';
  job.prompt = buildPrompt(job);
  job.promptHash = createHash('sha256').update(job.prompt).digest('hex').slice(0, 16);
}

const tooLong = jobs.filter((job) => job.prompt.length > 5000);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'jobs.json'), `${JSON.stringify({ style: STYLE_ID, story, createdAt: new Date().toISOString(), stateRefs: STATE_REFS, jobs }, null, 2)}\n`);
const count = (kind) => jobs.filter((job) => job.kind === kind).length;
console.log(`jobs ${jobs.length} (scene ${count('scene')}, branch ${count('branch')}, attempt ${count('attempt')}) → ${join(outDir, 'jobs.json')}`);
console.log(`prompt length max ${Math.max(...jobs.map((job) => job.prompt.length))} chars`);
const missing = jobs.filter((job) => !job.currentFile).map((job) => job.id);
if (missing.length) console.log(`[warn] assets.json에 없는 그림: ${missing.join(', ')}`);
if (tooLong.length) {
  console.log(`[error] 5000자 넘는 프롬프트: ${tooLong.map((job) => job.id).join(', ')}`);
  process.exitCode = 1;
}
