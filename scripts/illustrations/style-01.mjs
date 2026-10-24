// 삽화 스타일 01 "Crisp Characters × Soft Painterly Backgrounds" - 팀 공통 복붙 프롬프트와 장면 칸(STORY·COMPOSITION·
// BACKGROUND·LIGHTING / MOOD)을 한곳에 둔다. build-jobs.mjs가 장면마다 칸을 채우고, generate-higgsfield.mjs가 그대로 보낸다.
// 문구를 바꾸면 promptHash가 바뀌어 같은 장면도 새로 만든다(결과 폴더에서 비교할 수 있게).

export const STYLE_ID = 'style-01';
export const STYLE_LABEL = 'Crisp Characters × Soft Painterly Backgrounds';

/**
 * 팀 공통 프롬프트 - 디자이너(이민재) 삽화 제작 문서의 "공통 프롬프트 = 고정" 그대로(10/21). 손으로 만들 때도 같은 글을
 * 먼저 붙이므로 여기와 노션 문서가 같아야 한다. 캐릭터 참고는 API에서는 Character Element 대신 시트 그림을 image_urls로
 * 같이 보낸다(generate-higgsfield.mjs). Flare 프롬프트 상한(5000자) 때문에 아래 장면 칸은 짧게 유지한다.
 */
export const COMMON_TEMPLATE = [
  // 디자이너 공통 프롬프트(노션 "삽화 제작 방법") 다섯 절을 규칙은 하나도 빼지 않고 줄인 판 - 원문 3,900자를 그대로 넣으면
  // 장면 칸까지 합쳐 Flare 상한 5,000자를 넘는다. 손으로 만들 때는 노션 원문을 쓴다.
  'Create one final illustration for a cohesive Hansel and Gretel storybook for children aged 5-9.',
  'ART STYLE AND COLORING: a hand-drawn 2D fairy-tale storybook illustration with delicate organic linework, clean contours, natural proportions, soft dimensional shading and smooth controlled color transitions - warm, expressive, traditional-storybook charm with a polished finish. ONE consistent visual identity across the book: a harmonious palette balancing warm and cool colors, soft believable shadows; lighting reinforces mood and time of day without breaking continuity. Avoid oversaturated colors, excessive contrast, glossy digital finishes, photorealism and 3D-rendered looks.',
  "CHARACTER CONSISTENCY: the attached character sheets are the authoritative references. Preserve each character's identity, facial proportions, eye shape, nose, mouth, hairstyle, hair color, body proportions, outfit and clothing colors, and the sheets' distinctive linework, shapes and coloring. Do not redesign, beautify, modernize or reinterpret them; only pose, expression, viewing angle and scene lighting change. Never let the designs drift toward another illustration style. Characters stay clearly readable and distinct from their surroundings: faces, hair and clothing in clean linework, smooth color and subtle shading, not heavy surface texture.",
  'BACKGROUND TEXTURE (same overall style): character-focused scenes keep backgrounds smooth, softly shaded and quieter than the characters (no paper grain, canvas, rough brush marks or watercolor blooms); environment scenes may show richer layered detail, atmospheric depth and subtle painterly brushwork on trees, foliage and cottages, never noisy or in a different style.',
  "COMPOSITION AND PHYSICAL ACCURACY: follow the scene instructions for content, composition, camera, placement, actions, emotions and lighting. Believable anatomy, hands, expressions, perspective, spatial relationships and object scale; characters interact naturally with plausible surroundings. Keep established locations, recurring props and layouts consistent across pictures; no extra objects, clutter or details that change the scene's meaning. Prioritize clear storytelling, readable silhouettes, natural poses and balanced composition.",
  'FINAL REQUIREMENTS: one complete landscape 16:9 storybook illustration. No text, subtitles, speech bubbles, borders, watermarks, extra characters, duplicate limbs, distorted hands, malformed anatomy or inconsistent costume details. No collage, character sheet, storyboard or multiple panels. The picture must read as part of the same cohesive book.',
].join('\n');

/**
 * 등장인물 외형 - 피그마 「삽화」 파일의 캐릭터 시트(등장인물 83:7, 10/21)와 같게. 시트 5장(그레텔·헨젤·아버지·새어머니·
 * 할머니/마녀)은 refs 폴더에서 그 인물이 나오는 장면에 image_urls로 붙으므로(generate-higgsfield.mjs의 REF_FILES) 여기는
 * 시트에서 헷갈리기 쉬운 색·소품만 짧게 짚는다. 동물은 시트가 없어 글로 고정한다.
 */
export const CHARACTER_SPECS = {
  GRETEL:
    'Gretel: about 8, blonde braids under a white kerchief, blue eyes, white puff blouse, dark brown bodice, red skirt, white apron, white socks, dark Mary Janes.',
  HANSEL:
    'Hansel: about 8, tousled brown hair, blue eyes, white puff shirt, dark brown vest, brown knee breeches, white socks, dark loafers; same height as Gretel.',
  FATHER:
    'Father: worn, gentle woodcutter, untidy brown hair, short beard, white rolled-sleeve shirt, olive vest, brown trousers and boots; tired and regretful, never villainous.',
  STEPMOTHER:
    'Stepmother: stern woman, dark brown low bun, white high-collar blouse, brown bodice-dress, beige apron, brown boots; hard-faced but human, NOT the witch.',
  OLD_WOMAN:
    'Old woman: small elderly woman, grey hair under a cream kerchief, plum fringed shawl, olive bodice, patched cream apron, reddish-brown skirt, lace-up boots; kindly here. The SAME person as the witch.',
  WITCH:
    'Witch: the SAME small elderly woman (grey hair, cream kerchief, plum shawl, olive bodice, patched apron, reddish-brown skirt); only her expression turns cold and watchful. No monster look, green skin, pointed hat or magic effects.',
  WHITE_BIRD: 'White bird: a small snow-white songbird with natural proportions, not a magical creature.',
  WHITE_DUCK: 'White duck: a large white duck with an orange beak, big enough to carry one child at a time.',
  BIRDS: 'Small forest birds (brown and grey), clearly different from the white bird.',
};

/** 장소별 배경(장면이 바뀌어도 같은 공간으로 보이게). build-jobs.mjs의 locationKey가 고른다. */
export const BACKGROUNDS = {
  HOME:
    "A poor but cozy woodcutter's cottage by a great forest: rough plank walls, one small window, round wooden table, oil lamp, simple shelves; same table, window, wall and door layout in every home scene.",
  FOREST:
    'A deep European fairy-tale forest of tall ancient trees with thick trunks, dirt paths, mossy roots, ferns and rocks; distant trees fade into soft mist. Keep the same tree shapes and world across all forest scenes.',
  CANDY_EXTERIOR:
    'A charming gingerbread-and-candy cottage in a sunny forest clearing: biscuit walls, icing trim, candy windows, a lollipop garden, inviting rather than scary. Keep the same door and window positions. Before the children enter, the door is closed and there are no scratches, sugar swirls or magic glows.',
  CANDY_INTERIOR:
    'Inside the candy cottage kitchen: candy-studded walls, shelves of candy jars; a TALL RECTANGULAR floor-standing black iron cage LEFT (taller than an adult, straight vertical bars, never a round birdcage), wooden worktable FRONT RIGHT, CLOSED brick oven back right, heavy wooden door to the corridor. Key ring: EXACTLY TWO keys (small silver = cage, big black = door), never three.',
  // 10/24: 식당 겸 침실·창고 장면에 부엌 배경(창살·오븐)이 들어가 창살이 나왔다 - 방마다 따로.
  CANDY_DINING:
    'A cozy dining-and-sleeping room inside the candy cottage: candy-studded walls, a small wooden table, two small beds side by side against the wall, a lamp. NO cage, NO oven, NO kitchen worktable in this room.',
  CANDY_STOREROOM:
    'A small storeroom off the candy cottage corridor: plain wooden shelves with a few loaves of bread and water bottles, sacks, the corridor door. NO cage, NO oven, NO kitchen worktable here.',
  CANDY_CORRIDOR:
    'A hallway inside the candy cottage: candy-studded walls, the heavy wooden kitchen door (closed), a storeroom door and the outside door at the far end. NO cage and NO oven here - those are in the kitchen.',
  WATERWAY:
    'A wide, calm forest waterway with grassy banks on both sides and no bridge or boat; soft reflections, trees fading into mist on the far bank.',
};

/** 시간대 → 조명·분위기. */
export const LIGHTING = {
  day: 'soft diffused daylight, warm and calm',
  morning: 'pale, hopeful morning light filtering through the trees',
  evening: 'warm evening glow, lamplight inside, deepening shadows outside',
  'later-evening': 'quiet warm lamplight at night, gentle and safe',
  'late-day': 'golden late-afternoon light, long soft shadows',
  dusk: 'blue twilight with a last warm glow on the horizon',
  night: 'blue moonlit night, muted sapphire and teal shadows, pale moonlight on hair and sleeves for legibility',
};

/** 플레이어 화면에 맞춘 구도 - 아래 약 40%는 자막·대화 패널이 덮는다(10/19 UI 리뷰). */
export const COMPOSITION_RULE =
  'Keep characters and the key action in the UPPER and MIDDLE of the frame (faces at 20-55% of the height); the app covers the bottom 40% with subtitles, so leave it calm (ground, floor, foliage) with no faces, hands or key props.';
// 숨거나 엿듣는 장면(hidden)에는 넣지 않는다 - "모두 무릎까지 보이게"가 아이들을 부모 옆에 세웠다(10/24 QA).
export const FULL_BODY_RULE = 'Characters visible from head to at least the knees.';

/** 공통 프롬프트의 FINAL REQUIREMENTS가 금지 항목을 이미 담으므로 여기는 아이 대상 수위만. */
export const NEGATIVE =
  'Gentle for children ages 5-9: tense moments are never gory or horrifying. No UI, lettering or watermark.';

/** 사람 수를 못 박는다 - 동물은 세지 않는다(10/24: 헨젤 두 명). */
const PEOPLE = { GRETEL: 'Gretel', HANSEL: 'Hansel', FATHER: 'Father', STEPMOTHER: 'Stepmother', OLD_WOMAN: 'the old woman', WITCH: 'the witch' };
function castCount(characters) {
  const people = [...new Set(characters.map((key) => PEOPLE[key]).filter(Boolean))];
  if (!people.length) return '';
  return `EXACTLY ${people.length} ${people.length === 1 ? 'person' : 'people'} in the picture (${people.join(', ')}); each appears ONCE - no duplicates, no extra people.`;
}

/**
 * 한 장면의 최종 프롬프트(Flare 상한 5000자). staging(장면 연출 메모, staging-<story>.mjs)이 장면 내용을 정한다 -
 * 동화 문장은 넣지 않는다(10/24: 문장이 잘리고, 모델이 해석 없이 인물을 한 줄로 세웠다).
 */
export function buildPrompt({ characters, staging, background, lighting, continuityRule, rules = '' }) {
  const cast = characters.map((key) => CHARACTER_SPECS[key]).filter(Boolean);
  return [
    COMMON_TEMPLATE,
    '',
    cast.length ? `CHARACTERS IN THIS SCENE (match the attached sheets; no one else): ${cast.join(' ')}` : 'No people in this scene.',
    castCount(characters),
    `SCENE - follow exactly, it overrides any default staging: ${staging.stage}`,
    `PROPS AND STATE: ${staging.props} ${continuityRule}`,
    rules,
    `COMPOSITION: ${staging.shot} ${COMPOSITION_RULE}${staging.hidden ? '' : ` ${FULL_BODY_RULE}`}`,
    `BACKGROUND: ${background}`,
    `LIGHTING / MOOD: ${lighting}`,
    NEGATIVE,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
