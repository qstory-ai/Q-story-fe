// 콘텐츠 파이프라인(scripts/generate-story-package.mjs)이 읽는 HG 삽화 생성 계약 - 운영 앱 코드는 import하지 않는다.
import type { GeneratedStoryContent, GeneratedVisual } from '../../../src/entities/story';

import generatedContentJson from './generated/generated-story-content.json';

const generatedHanselGretelContent = generatedContentJson as unknown as GeneratedStoryContent;

type AssetId = string;

export type VisualReferencePack = {
  id: string;
  version: string;
  kind: 'style' | 'character' | 'location' | 'prop';
  label: string;
  canonicalAssetIds: readonly AssetId[];
  immutableFacts: readonly string[];
};

export type VisualGenerationBrief = {
  schemaVersion: 1;
  storyId: 'HG';
  contentVersion: string;
  visualId: string;
  targetAssetId: AssetId;
  generationMode: 'reference-guided-edit';
  stylePackId: string;
  characterPackIds: readonly string[];
  locationPackId: string;
  propPackIds: readonly string[];
  referenceAssetIds: readonly AssetId[];
  previousVisualId: string | null;
  previousAssetId: AssetId | null;
  nextVisualId: string | null;
  nextAssetId: AssetId | null;
  requiredFacts: {
    time: string;
    location: string;
    characters: readonly string[];
    entryState: string;
    action: string;
    exitState: string;
  };
  prompt: string;
  negativePrompt: string;
  reviewChecklist: readonly string[];
};

const STYLE_PACK: VisualReferencePack = {
  id: 'HG-STYLE-STORYBOOK-V1',
  version: '1.0.0',
  kind: 'style',
  label: '헨젤과 그레텔 공통 그림책 화풍',
  canonicalAssetIds: [
    'home-table',
    'white-bird',
    'witch-cooking-keys',
  ],
  immutableFacts: [
    '가로 16:9 아동 그림책 삽화(스타일 01 - 선명한 인물, 부드러운 회화적 배경)',
    '섬세한 선묘와 매끄러운 명암, 과한 종이 질감·붓 자국 없음',
    '따뜻한 색과 차가운 색이 균형 잡힌 팔레트와 장면 시간에 맞는 조명',
    '6~9세가 볼 수 있는 긴장감이며 잔혹하거나 공포스럽지 않음',
    '하단 자막 안전 영역에 핵심 얼굴·손·행동을 배치하지 않음',
    '삽화 안에는 글자·UI·말풍선·워터마크를 넣지 않음',
  ],
};

const CHARACTER_PACKS: Record<string, VisualReferencePack> = {
  HANSEL: {
    id: 'HG-CHAR-HANSEL-V1',
    version: '1.0.0',
    kind: 'character',
    label: '헨젤',
    canonicalAssetIds: [
      'first-walk-pebbles',
      'witch-reveal',
      'cage-unlock-oven-secured',
    ],
    immutableFacts: [
      '그레텔과 키가 비슷한 8세쯤의 남자아이, 푸른 눈',
      '헝클어진 갈색 머리, 흰 퍼프소매 셔츠, 짙은 갈색 단추 조끼, 무릎 길이 갈색 반바지, 흰 양말, 짙은 갈색 로퍼',
      '영리하지만 어린아이의 취약함이 남아 있는 얼굴과 체격',
    ],
  },
  GRETEL: {
    id: 'HG-CHAR-GRETEL-V1',
    version: '1.0.0',
    kind: 'character',
    label: '그레텔',
    canonicalAssetIds: [
      'white-bird',
      'gretel-watches-keys',
      'cage-unlock-oven-secured',
    ],
    immutableFacts: [
      '헨젤과 키가 비슷한 8세쯤의 여자아이, 푸른 눈',
      '금발 양갈래 땋은 머리 위에 흰 머릿수건, 흰 퍼프소매 블라우스, 짙은 갈색 조끼, 빨간 치마, 흰 앞치마, 흰 양말, 짙은 갈색 메리제인',
      '따뜻하고 관찰력이 좋으며 탈출 장면에서는 결단력 있는 표정',
    ],
  },
  FATHER: {
    id: 'HG-CHAR-FATHER-V1',
    version: '1.0.0',
    kind: 'character',
    label: '아버지',
    canonicalAssetIds: [
      'home-table',
      'home-promise',
    ],
    immutableFacts: [
      '헝클어진 갈색 머리와 짧은 수염이 있는 지친 나무꾼',
      '소매를 걷은 흰 셔츠, 올리브색 조끼, 갈색 허리띠와 바지, 갈색 부츠 - 가난해 보이는 차림',
      '걱정·회피·후회가 보이되 괴물이나 악당처럼 표현하지 않음',
    ],
  },
  STEPMOTHER: {
    id: 'HG-CHAR-STEPMOTHER-V1',
    version: '1.0.0',
    kind: 'character',
    label: '새어머니',
    canonicalAssetIds: [
      'night-plan',
      'second-night-plan',
    ],
    immutableFacts: [
      '짙은 갈색 머리를 낮게 쪽진 성인 여성',
      '흰 하이칼라 블라우스, 갈색 조끼 원피스, 베이지 앞치마, 갈색 부츠, 차갑고 완고한 표정',
      '마녀와는 다른 인물이며 친절하거나 온화하게 미화하지 않음',
    ],
  },
  OLD_WOMAN: {
    id: 'HG-CHAR-OLD-WOMAN-V1',
    version: '1.0.0',
    kind: 'character',
    label: '노파·마녀',
    canonicalAssetIds: [
      'old-woman-door',
      'witch-reveal',
      'witch-cooking-keys',
    ],
    immutableFacts: [
      '크림색 머릿수건 아래 회색 머리의 작은 노년 여성 - 할머니와 마녀는 같은 사람',
      '자주색 술 달린 숄, 올리브색 조끼, 기운 자국이 있는 크림색 앞치마, 붉은 갈색 치마, 끈 부츠 - 얼굴 골격·키·체격 유지',
      '노파일 때의 다정한 표정과 마녀일 때의 차가운 표정만 달라짐',
    ],
  },
  WITCH: {
    id: 'HG-CHAR-WITCH-V1',
    version: '1.0.0',
    kind: 'character',
    label: '노파·마녀',
    canonicalAssetIds: [
      'old-woman-door',
      'witch-reveal',
      'witch-cooking-keys',
    ],
    immutableFacts: [
      '크림색 머릿수건 아래 회색 머리의 작은 노년 여성 - 할머니와 마녀는 같은 사람',
      '자주색 술 달린 숄, 올리브색 조끼, 기운 자국이 있는 크림색 앞치마, 붉은 갈색 치마, 끈 부츠 - 얼굴 골격·키·체격 유지',
      '위험성은 표정·열쇠·감금 행동으로 표현하고 신체를 괴물화하지 않음',
    ],
  },
  WHITE_BIRD: {
    id: 'HG-CHAR-WHITE-BIRD-V1',
    version: '1.0.0',
    kind: 'character',
    label: '하얀 새',
    canonicalAssetIds: [
      'white-bird',
      'white-bird-leads',
    ],
    immutableFacts: [
      '작고 눈처럼 흰 새',
      '과장된 마법 생물보다 숲에서 볼 수 있는 자연스러운 비율',
    ],
  },
  WHITE_DUCK: {
    id: 'HG-CHAR-WHITE-DUCK-V1',
    version: '1.0.0',
    kind: 'character',
    label: '흰 오리',
    canonicalAssetIds: [
      'waterway-obstacle',
      'water-return',
    ],
    immutableFacts: [
      '아이 한 명씩만 태울 수 있는 현실적인 크기의 흰 오리',
      '같은 깃털 무늬와 부리 색을 유지',
    ],
  },
  BIRDS: {
    id: 'HG-CHAR-FOREST-BIRDS-V1',
    version: '1.0.0',
    kind: 'character',
    label: '빵 부스러기를 먹는 작은 새들',
    canonicalAssetIds: ['birds-eat-breadcrumbs'],
    immutableFacts: ['숲의 작은 새들이며 하얀 새와 혼동되지 않음'],
  },
};

const LOCATION_PACKS: Record<string, VisualReferencePack> = {
  HOME: {
    id: 'HG-LOC-HOME-V1',
    version: '1.0.0',
    kind: 'location',
    label: '남매의 집',
    canonicalAssetIds: [
      'home-table',
      'night-plan',
      'first-homecoming',
    ],
    immutableFacts: [
      '가난하지만 현실적인 숲 가장자리 나무집',
      '같은 식탁·창문·벽·문 구조를 유지',
    ],
  },
  FOREST: {
    id: 'HG-LOC-FOREST-V1',
    version: '1.0.0',
    kind: 'location',
    label: '큰 숲',
    canonicalAssetIds: [
      'first-walk-pebbles',
      'lost-forest',
      'white-bird',
    ],
    immutableFacts: [
      '높은 침엽수와 굵은 줄기, 흙길과 바위가 반복되는 유럽풍 숲',
      '시간대가 바뀌어도 나무 형태와 공간의 세계관을 유지',
    ],
  },
  CANDY_EXTERIOR: {
    id: 'HG-LOC-CANDY-EXTERIOR-V1',
    version: '1.0.0',
    kind: 'location',
    label: '과자집 외부',
    canonicalAssetIds: [
      'candy-house-reveal',
      'candy-house-close',
      'old-woman-door',
    ],
    immutableFacts: [
      '보라·갈색 사탕과 빵으로 지어진 동일한 집 외관',
      '문·창문의 위치 관계를 유지',
      '남매가 들어가기 전에는 문이 닫혀 있고, 문 주변에 긁힌 자국·설탕 소용돌이·마법 빛을 넣지 않음',
    ],
  },
  CANDY_INTERIOR: {
    id: 'HG-LOC-CANDY-INTERIOR-V1',
    version: '1.0.0',
    kind: 'location',
    label: '과자집 내부',
    canonicalAssetIds: [
      'candy-house-interior',
      'candy-house-sleep',
      'kitchen-door-locked',
      'witch-cooking-keys',
    ],
    immutableFacts: [
      '보라·갈색 사탕 질감의 동일한 내부 공간',
      '부엌 배치를 유지: 왼쪽 높은 쇠창살, 오른쪽 앞 작업대, 뒤쪽 벽 선반, 뒤쪽 오른편의 닫힌 오븐, 복도로 나가는 부엌 문',
      '부엌 문은 같은 큰 검은 열쇠로 안팎에서 여닫고, 바깥문은 복도 끝의 다른 문',
    ],
  },
  WATERWAY: {
    id: 'HG-LOC-WATERWAY-V1',
    version: '1.0.0',
    kind: 'location',
    label: '넓은 물길',
    canonicalAssetIds: [
      'waterway-obstacle',
      'water-return',
    ],
    immutableFacts: ['다리와 배가 없는 같은 폭의 물길과 양쪽 숲 둑'],
  },
};

const PROP_PACKS: Record<string, VisualReferencePack> = {
  WHITE_PEBBLES: {
    id: 'HG-PROP-WHITE-PEBBLES-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '하얀 조약돌',
    canonicalAssetIds: [
      'pebble-collection',
      'first-walk-pebbles',
      'moonlit-return',
    ],
    immutableFacts: ['작고 둥근 하얀 돌이며 달빛에서만 은은히 반짝임'],
  },
  BREADCRUMBS: {
    id: 'HG-PROP-BREADCRUMBS-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '빵과 빵 부스러기',
    canonicalAssetIds: [
      'morning-bread-plan',
      'second-walk-breadcrumbs',
      'birds-eat-breadcrumbs',
    ],
    immutableFacts: ['같은 갈색 빵에서 떼어낸 작은 부스러기'],
  },
  KEY_SET: {
    id: 'HG-PROP-KEY-SET-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '검은 열쇠·은색 열쇠',
    canonicalAssetIds: [
      'kitchen-door-locked',
      'gretel-watches-keys',
      'witch-cooking-keys',
    ],
    immutableFacts: [
      '작은 은색 열쇠와 큰 검은 열쇠가 한 고리에 달려 있고 색·크기로 구분됨',
      '은색 열쇠는 헨젤의 쇠창살 문, 검은 열쇠는 복도로 나가는 부엌 문에만 사용',
      '열쇠가 빛나거나 문·무늬를 마법으로 움직이지 않음',
    ],
  },
  IRON_CAGE: {
    id: 'HG-PROP-IRON-CAGE-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '높은 검은 쇠창살 감옥',
    canonicalAssetIds: [
      'witch-reveal',
      'gretel-whispers-keys',
      'cage-unlock-oven-secured',
    ],
    immutableFacts: [
      '헨젤의 머리보다 훨씬 높은 검은 철제 창살과 분명한 잠금장치',
      '낮은 사탕 울타리·나무문·아이 혼자 넘을 수 있는 구조로 바꾸지 않음',
    ],
  },
  OVEN: {
    id: 'HG-PROP-OVEN-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '과자집 오븐',
    canonicalAssetIds: [
      'witch-cooking-keys',
      'cage-unlock-oven-secured',
    ],
    immutableFacts: [
      '부엌 뒤쪽의 닫힌 벽난로형 오븐 - 배경 소품일 뿐 감금·위협 장소가 아님',
      '누군가 오븐을 가리키거나 오븐 안으로 들어가지 않음',
    ],
  },
  RETURN_MARKS: {
    id: 'HG-PROP-RETURN-MARKS-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '귀환 표시',
    canonicalAssetIds: ['marked-return-path'],
    immutableFacts: ['아버지가 나뭇가지에 묶은 하얀 천 표시를 동일하게 유지'],
  },
};

function locationPackFor(location: string) {
  if (
    location.startsWith('home-') ||
    location === 'outside-home'
  ) {
    return LOCATION_PACKS.HOME;
  }
  if (location.startsWith('candy-house-')) {
    return location.includes('exterior') ||
      location.includes('threshold') ||
      location.includes('clearing')
      ? LOCATION_PACKS.CANDY_EXTERIOR
      : LOCATION_PACKS.CANDY_INTERIOR;
  }
  if (location.startsWith('wide-waterway')) {
    return LOCATION_PACKS.WATERWAY;
  }
  return LOCATION_PACKS.FOREST;
}

function propPacksFor(visual: GeneratedVisual) {
  const searchable = [
    visual.mode,
    visual.entryState,
    visual.requiredAction,
    visual.exitState,
    visual.location,
  ].join(' ');
  const packs: VisualReferencePack[] = [];
  if (/pebble|stone|moonlit-return/.test(searchable)) {
    packs.push(PROP_PACKS.WHITE_PEBBLES);
  }
  if (/bread|crumb/.test(searchable)) {
    packs.push(PROP_PACKS.BREADCRUMBS);
  }
  if (/key|lock|gate/.test(searchable)) {
    packs.push(PROP_PACKS.KEY_SET);
  }
  if (/cage|iron|barred/.test(searchable)) {
    packs.push(PROP_PACKS.IRON_CAGE);
  }
  if (/oven/.test(searchable)) {
    packs.push(PROP_PACKS.OVEN);
  }
  if (/marked|route-mark|white-cloth/.test(searchable)) {
    packs.push(PROP_PACKS.RETURN_MARKS);
  }
  return packs;
}

const orderedVisuals = generatedHanselGretelContent.scenes.flatMap(
  (scene) => scene.visuals,
);

function unique<T>(values: readonly T[]) {
  return [...new Set(values)];
}

function buildPrompt({
  visual,
  characterPacks,
  locationPack,
  propPacks,
  previousVisual,
}: {
  visual: GeneratedVisual;
  characterPacks: readonly VisualReferencePack[];
  locationPack: VisualReferencePack;
  propPacks: readonly VisualReferencePack[];
  previousVisual: GeneratedVisual | null;
}) {
  const identityRules = characterPacks.flatMap(
    (pack) => pack.immutableFacts,
  );
  const propRules = propPacks.flatMap((pack) => pack.immutableFacts);
  return [
    `Use case: reference-guided story illustration edit for ${visual.id}.`,
    `Preserve style pack ${STYLE_PACK.id}: ${STYLE_PACK.immutableFacts.join('; ')}.`,
    `Time: ${visual.time}. Location: ${visual.location}.`,
    `Characters: ${visual.characters.join(', ')}.`,
    `Entry state: ${visual.entryState}.`,
    `Show this exact action: ${visual.requiredAction}.`,
    `The image must leave this exit state: ${visual.exitState}.`,
    `Character identity rules: ${identityRules.join('; ')}.`,
    `Location continuity rules: ${locationPack.immutableFacts.join('; ')}.`,
    propRules.length > 0
      ? `Prop continuity rules: ${propRules.join('; ')}.`
      : '',
    previousVisual
      ? `Continue visibly from ${previousVisual.id}, whose exit state is ${previousVisual.exitState}.`
      : '',
    'Keep the lower subtitle-safe area calm. No text, UI, captions, speech bubbles, or watermark.',
  ]
    .filter(Boolean)
    .join('\n');
}

export const hanselGretelVisualReferencePacks = Object.freeze({
  style: STYLE_PACK,
  characters: CHARACTER_PACKS,
  locations: LOCATION_PACKS,
  props: PROP_PACKS,
});

export const hanselGretelVisualGenerationBriefs: readonly VisualGenerationBrief[] =
  orderedVisuals.map((visual, index) => {
    const previousVisual = orderedVisuals[index - 1] ?? null;
    const nextVisual = orderedVisuals[index + 1] ?? null;
    const characterPacks = unique(
      visual.characters
        .map((character) => CHARACTER_PACKS[character])
        .filter((pack): pack is VisualReferencePack => Boolean(pack)),
    );
    const locationPack = locationPackFor(visual.location);
    const propPacks = unique(propPacksFor(visual));
    const referenceAssetIds = unique([
      visual.assetId,
      ...(previousVisual ? [previousVisual.assetId] : []),
      ...STYLE_PACK.canonicalAssetIds,
      ...characterPacks.flatMap((pack) => pack.canonicalAssetIds),
      ...locationPack.canonicalAssetIds,
      ...propPacks.flatMap((pack) => pack.canonicalAssetIds),
    ]);

    return {
      schemaVersion: 1,
      storyId: 'HG',
      contentVersion: generatedHanselGretelContent.story.contentVersion,
      visualId: visual.id,
      targetAssetId: visual.assetId,
      generationMode: 'reference-guided-edit',
      stylePackId: STYLE_PACK.id,
      characterPackIds: characterPacks.map((pack) => pack.id),
      locationPackId: locationPack.id,
      propPackIds: propPacks.map((pack) => pack.id),
      referenceAssetIds,
      previousVisualId: previousVisual?.id ?? null,
      previousAssetId: previousVisual?.assetId ?? null,
      nextVisualId: nextVisual?.id ?? null,
      nextAssetId: nextVisual?.assetId ?? null,
      requiredFacts: {
        time: visual.time,
        location: visual.location,
        characters: visual.characters,
        entryState: visual.entryState,
        action: visual.requiredAction,
        exitState: visual.exitState,
      },
      prompt: buildPrompt({
        visual,
        characterPacks,
        locationPack,
        propPacks,
        previousVisual,
      }),
      negativePrompt: [
        'different face or age',
        'different costume colors',
        'duplicate character',
        'contradictory time or location',
        'missing required action',
        'modern object',
        'text',
        'UI',
        'watermark',
        'graphic injury',
      ].join(', '),
      reviewChecklist: [
        '등장인물 얼굴·나이·체격·의상이 캐릭터 참조팩과 같은가',
        '시간·장소·핵심 행동이 requiredFacts와 정확히 일치하는가',
        '직전 장면의 exitState가 이번 그림의 entryState로 자연스럽게 이어지는가',
        '열쇠·쇠창살·오븐 등 연속 소품의 크기·색·위치가 유지되는가',
        '다음 자막에서 아직 일어나지 않은 사건을 미리 보여주지 않는가',
        '하단 자막 안전 영역이 핵심 얼굴·손·행동을 가리지 않는가',
      ],
    };
  });

export function visualGenerationBriefForId(visualId: string) {
  return (
    hanselGretelVisualGenerationBriefs.find(
      (brief) => brief.visualId === visualId,
    ) ?? null
  );
}
