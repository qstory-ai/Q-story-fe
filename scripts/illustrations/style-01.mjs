// 삽화 스타일 01 "Crisp Characters × Soft Painterly Backgrounds" - 팀 공통 복붙 프롬프트와 장면 칸(STORY·COMPOSITION·
// BACKGROUND·LIGHTING / MOOD)을 한곳에 둔다. build-jobs.mjs가 장면마다 칸을 채우고, generate-higgsfield.mjs가 그대로 보낸다.
// 문구를 바꾸면 promptHash가 바뀌어 같은 장면도 새로 만든다(결과 폴더에서 비교할 수 있게).

export const STYLE_ID = 'style-01';
export const STYLE_LABEL = 'Crisp Characters × Soft Painterly Backgrounds';

/** 팀 공통 복붙 프롬프트(스타일 01 문서의 "복붙용 프롬프트 템플릿"). */
export const COMMON_TEMPLATE = [
  "Create ONE 16:9 landscape illustration for the children's fairy tale Hansel and Gretel, following a consistent classic 1950s–60s hand-drawn 2D animation aesthetic.",
  'Use the uploaded Hansel and Gretel character reference sheets as the PRIMARY and STRICT visual references for character design. Preserve their exact facial features, eye shapes, hairstyles, body proportions, clothing, and original illustration style without redesign.',
  'If additional background or art-direction reference images are provided, use them only as supplementary guidance for the environment, painterly atmosphere, lighting, and cinematic composition. Do NOT copy their characters, people, poses, or exact scenery.',
  'Whether or not additional background references are provided, ALWAYS follow this background style:',
  'Traditional hand-painted 2D animation backgrounds with soft atmospheric depth, diffused edges, simplified painterly shapes, broad gouache and watercolor brushwork, and subtle tonal layering. Background objects should have soft, indistinct contours rather than sharply defined outlines.',
  'The scenery should resemble a genuine hand-painted background from a classic animated fairy-tale film. Use expressive color harmonies, gentle atmospheric perspective, and diffused cinematic lighting to create emotional depth.',
  'Characters must remain crisp, clearly defined, and visually prominent, with delicate ink/cel-style contours and smooth 2D shading. The background must remain softer and more painterly, establishing a strong visual hierarchy.',
  'CHARACTERS CRISP, LANDSCAPE SOFT.',
  'Avoid hyper-detailed foliage, razor-sharp background textures, photographic blur, digital bokeh, photorealism, CGI, 3D rendering, and modern flat vector aesthetics.',
].join('\n');

/**
 * 등장인물 외형. 헨젤·그레텔은 스타일 01 캐릭터 시트 문서 그대로, 어른과 동물은 시트가 아직 없어 글로 고정한다
 * (refs 폴더에 father-sheet 같은 시트를 넣으면 그 장면에 함께 붙는다 - generate-higgsfield.mjs의 REF_FILES).
 */
export const CHARACTER_SPECS = {
  GRETEL:
    'Gretel: blonde braided pigtails tied with red ribbons, bright blue eyes, white long-sleeved puff blouse and white round collar, BLACK fitted sleeveless bodice, red long skirt below the knees, white apron, white socks and black Mary Jane shoes. About 8 years old.',
  HANSEL:
    'Hansel: short fluffy wavy blond hair, bright blue eyes, white collared puff-sleeved shirt, DARK BROWN four-button vest, brown knickerbocker pants to below the knees, white socks and black Mary Jane shoes. About 8 years old, similar height to Gretel (Gretel perhaps slightly taller).',
  FATHER:
    'Father: a tired, gentle middle-aged woodcutter, tall and thin, light brown hair and a short beard, faded blue work shirt, brown leather vest, dark trousers and boots. Worried and regretful, never villainous.',
  STEPMOTHER:
    'Stepmother: a stern adult woman with dark brown hair pinned in a tight bun, sharp eyebrows, a plain dark plum dress with a grey shawl. Cold and stubborn but human - clearly NOT the witch.',
  OLD_WOMAN:
    'Old woman: a small elderly woman with grey hair in a bun, a kindly-looking wrinkled face, a long dark purple dress with a lavender apron and a shawl. The SAME person as the witch, only her expression changes.',
  WITCH:
    'Witch: the SAME small elderly woman with grey hair in a bun and a long dark purple dress with a lavender apron; only her expression turns cold and watchful. Not a monster, no green skin, no pointed hat, no magic effects.',
  WHITE_BIRD: 'White bird: a small snow-white songbird with natural proportions, not a magical creature.',
  WHITE_DUCK: 'White duck: a large white duck with an orange beak, big enough to carry one child at a time.',
  BIRDS: 'Small forest birds (brown and grey), clearly different from the white bird.',
};

/** 장소별 배경(장면이 바뀌어도 같은 공간으로 보이게). build-jobs.mjs의 locationKey가 고른다. */
export const BACKGROUNDS = {
  HOME:
    "A poor but cozy woodcutter's cottage at the edge of a great forest: rough plank walls, one small window, a round wooden table, an oil lamp, simple shelves. Keep the same table, window, wall and door layout in every home scene.",
  FOREST:
    'A deep European fairy-tale forest of tall ancient trees with thick trunks, dirt paths, mossy roots, ferns and rocks; distant trees fade into soft mist. Keep the same tree shapes and world across all forest scenes.',
  CANDY_EXTERIOR:
    'A charming gingerbread-and-candy cottage in a sunny forest clearing: biscuit walls, icing trim, candy windows, a lollipop garden, inviting rather than scary. Keep the same door and window positions. Before the children enter, the door is closed and there are no scratches, sugar swirls or magic glows.',
  CANDY_INTERIOR:
    "The inside of the candy cottage: walls studded with candies, shelves of candy jars. Kitchen layout stays fixed - a tall black iron cage on the LEFT, a wooden worktable FRONT RIGHT, shelves along the back wall, a CLOSED brick oven at the back right, and a heavy wooden kitchen door to the corridor.",
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
  'Place the characters and the key action in the UPPER and MIDDLE part of the frame (faces between 20% and 55% of the picture height). The bottom 40% of the frame is covered by subtitles and a dialogue panel in the app, so keep it calm (ground, foliage, floor) with no faces, hands or important props there. Characters clearly visible from head to at least the knees.';

export const NEGATIVE =
  'The style must be ONE coherent 2D hand-painted fairy-tale animation aesthetic. NOT 3D, NOT photorealistic, NOT glossy, NOT CGI, NOT Pixar style, NOT modern vector cartoon, no heavy comic outlines in the background, no photographic blur, no lens bokeh. No lettering, captions, borders, collage, multiple panels, speech bubbles, UI or watermark. Gentle for children ages 6-9: tense moments are never gory or horrifying.';

/** 한 장면의 최종 프롬프트(Flare 상한 5000자). */
export function buildPrompt({ characters, story, composition, background, lighting, continuity }) {
  const cast = characters.map((key) => CHARACTER_SPECS[key]).filter(Boolean);
  return [
    COMMON_TEMPLATE,
    '',
    cast.length ? `CHARACTERS IN THIS SCENE (no one else): ${cast.join(' ')}` : 'No people in this scene.',
    `STORY: ${story}`,
    `COMPOSITION: ${composition} ${COMPOSITION_RULE}`,
    `BACKGROUND: ${background}`,
    `LIGHTING / MOOD: ${lighting}`,
    continuity ? `CONTINUITY: ${continuity}` : '',
    NEGATIVE,
  ]
    .filter((line) => line !== '')
    .join('\n');
}
