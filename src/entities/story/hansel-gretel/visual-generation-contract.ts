import {
  generatedHanselGretelContent,
  type GeneratedVisual,
} from './generated-content';

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
    'oven-command',
  ],
  immutableFacts: [
    '가로 16:10 아동 그림책 삽화',
    '손으로 칠한 듯한 질감과 세밀한 선묘',
    '따뜻한 갈색·보라색 중심 팔레트와 장면 시간에 맞는 조명',
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
      'short-twig-check',
      'cage-unlock-oven-secured',
    ],
    immutableFacts: [
      '그레텔보다 약간 큰 어린 남자아이',
      '짧은 갈색 머리, 초록색 조끼, 크림색 셔츠, 붉은 목수건',
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
      '헨젤보다 약간 작은 어린 여자아이',
      '갈색 양갈래 땋은 머리와 보라색 리본, 겨자색 원피스',
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
      '갈색 머리와 수염이 있는 지친 중년 나무꾼',
      '푸른 작업복과 현실적인 성인 체격',
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
      '검은 갈색 머리를 단정히 올린 성인 여성',
      '어두운 자주색 옷, 날카롭고 완고한 눈썹과 표정',
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
      'oven-command',
    ],
    immutableFacts: [
      '회색 머리를 뒤로 올린 동일한 노년 여성',
      '어두운 보라색 옷과 같은 얼굴 골격·키·체격을 유지',
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
      'oven-command',
    ],
    immutableFacts: [
      '회색 머리를 뒤로 올린 동일한 노년 여성',
      '어두운 보라색 옷과 같은 얼굴 골격·키·체격을 유지',
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
  VILLAGERS: {
    id: 'HG-CHAR-VILLAGERS-V1',
    version: '1.0.0',
    kind: 'character',
    label: '마을 사람들',
    canonicalAssetIds: ['village-restitution'],
    immutableFacts: ['현대 복장이 아닌 이야기 시대의 평범한 마을 사람들'],
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
      '문·창문·설탕 무늬의 위치 관계를 유지',
    ],
  },
  CANDY_INTERIOR: {
    id: 'HG-LOC-CANDY-INTERIOR-V1',
    version: '1.0.0',
    kind: 'location',
    label: '과자집 내부',
    canonicalAssetIds: [
      'candy-house-interior',
      'short-twig-check',
      'oven-command',
    ],
    immutableFacts: [
      '보라·갈색 사탕 질감의 동일한 내부 공간',
      '오븐·높은 검은 쇠창살 감옥·열쇠 구조의 크기와 위치 관계를 유지',
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
  VILLAGE: {
    id: 'HG-LOC-VILLAGE-V1',
    version: '1.0.0',
    kind: 'location',
    label: '마을',
    canonicalAssetIds: ['village-restitution'],
    immutableFacts: ['남매의 집과 같은 시대·재료의 작은 숲 마을'],
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
      'black-key-glow',
      'gretel-watches-keys',
      'oven-secured-keys',
    ],
    immutableFacts: [
      '검은 열쇠와 은색 열쇠를 색·크기·용도로 구분',
      '은색 열쇠는 쇠창살 문, 검은 열쇠는 큰 철문에 사용',
    ],
  },
  IRON_CAGE: {
    id: 'HG-PROP-IRON-CAGE-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '높은 검은 쇠창살 감옥',
    canonicalAssetIds: [
      'short-twig-check',
      'oven-command',
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
      'oven-command',
      'witch-demonstrates-oven',
      'oven-secured-keys',
    ],
    immutableFacts: [
      '성인 한 명이 몸을 숙여 들어갈 수 있는 같은 크기의 벽난로형 오븐',
      '불이 사람에게 닿거나 상해가 보이지 않음',
    ],
  },
  RETURN_MARKS: {
    id: 'HG-PROP-RETURN-MARKS-V1',
    version: '1.0.0',
    kind: 'prop',
    label: '귀환 표시',
    canonicalAssetIds: ['marked-return-path'],
    immutableFacts: ['나무의 도끼 자국과 하얀 천 표시를 동일하게 유지'],
  },
};

function locationPackFor(location: string) {
  if (location === 'village-and-candy-house') {
    return LOCATION_PACKS.VILLAGE;
  }
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
