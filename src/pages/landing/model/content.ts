import type { IconName } from '@/shared/ui';

/**
 * 마케팅 목업이 참조하던 히어로 사진(q-story-hero-question-book.webp 등)은 이 레포에 없어서,
 * 같은 장면을 가리키는 기존 「헨젤과 그레텔」 리더 일러스트로 대체했다 - public/story/에 이미
 * 있는 실제 리더 아트라서, 탭 한 번 거리로 이어지는 /demo 미리보기와 시각적으로도 어긋나지 않는다.
 */
export const HERO_ILLUSTRATION = {
  uri: '/story/hansel-gretel/illustrations/hg-art-08-candy-house-reveal.jpg',
  label: '숲속에서 과자집을 발견한 헨젤과 그레텔',
};

export const BETA_SHOWCASE_ILLUSTRATION = {
  uri: '/story/hansel-gretel/illustrations/hg-art-01-home-table.jpg',
  label: '헨젤과 그레텔이 아버지와 식탁에서 이야기를 나누는 장면',
};

export const FINAL_CTA_ILLUSTRATION = '/story/hansel-gretel/illustrations/hg-art-29-white-bird-leads.jpg';

export const PREVIEW_ILLUSTRATIONS = [
  { id: 'HG-ART-01', uri: '/story/hansel-gretel/illustrations/hg-art-01-home-table.jpg', label: '저녁을 먹는 남매' },
  {
    id: 'HG-ART-08',
    uri: '/story/hansel-gretel/illustrations/hg-art-08-candy-house-reveal.jpg',
    label: '숲 속 과자로 만든 집',
  },
  {
    id: 'HG-ART-11',
    uri: '/story/hansel-gretel/illustrations/hg-art-11-witch-reveal-v3.jpg',
    label: '집 안에서 나타난 마녀',
  },
] as const;

export const EXPERIENCE_STEPS = [
  {
    key: 'LISTEN',
    icon: 'voice' as IconName,
    title: '동화를 함께 들어요',
    body: '삽화·캐릭터 낭독·자막과 함께 헨젤과 그레텔의 이야기를 따라가요.',
  },
  {
    key: 'SPEAK',
    icon: 'mic' as IconName,
    title: '생각을 자유롭게 말해요',
    body: '질문하거나, 걱정되는 점과 해 보고 싶은 일을 말이나 글로 들려줘요.',
    featured: true,
  },
  {
    key: 'CHANGE',
    icon: 'sparkles' as IconName,
    title: '달라진 장면을 확인해요',
    body: '아이의 생각이 검수된 행동과 장면으로 이어지고, 원 이야기의 결말까지 완주해요.',
  },
];

export const EXPERIENCE_SUPPORT: Array<{ icon: IconName; label: string }> = [
  { icon: 'user', label: '아이 이름으로 초대' },
  { icon: 'play', label: '자막·다시 듣기·이어 듣기' },
  { icon: 'pencil', label: '글로 질문하거나 건너뛰기' },
  { icon: 'report', label: '완주 뒤 부모 리포트' },
];

export const PROOF_POINTS = [
  { title: '자유롭게 말해요', body: '완벽한 문장이나 정답은 필요 없어요.' },
  { title: '말뜻을 확인해요', body: '다시 말하거나 글로 고칠 수 있어요.' },
  { title: '장면으로 확인해요', body: '변화 뒤에는 원 이야기로 자연스럽게 돌아와요.' },
];

export const TRUST_PILLARS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'shield', title: '검수된 안전한 변화', body: '위험한 방향은 부드럽게 전환하고, 가능한 행동만 장면으로 보여 줘요.' },
  { icon: 'replay', title: '실패해도 끝까지', body: '음성 인식이나 연결이 불안하면 다시 시도하거나 그대로 계속 들을 수 있어요.' },
  {
    icon: 'consent',
    title: '원음 연구 저장은 선택',
    body: '보호자가 체크한 경우에만 질문 원음과 확인된 문장을 90일간 보관해요. 동의하지 않아도 체험할 수 있어요.',
  },
];

export const BETA_QUICK_FACTS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'users', title: '6–9세 아이와 보호자', body: '함께 보고 들어요' },
  { icon: 'clock', title: '질문 방식에 따라 시간이 달라져요', body: '함께 한 편을 완주해요' },
  { icon: 'report', title: '완주 뒤 부모 리포트', body: '질문과 변화를 확인해요' },
];

export const FAQ_ITEMS = [
  { q: '비용이 들거나 회원가입이 필요한가요?', a: '아니요. 1차 베타는 무료이며 회원가입과 결제 정보 없이 바로 체험할 수 있습니다.' },
  {
    q: '몇 살 아이에게 맞나요? 얼마나 걸리나요?',
    a: '6–9세 아이와 보호자가 함께 체험하는 것을 기준으로 만들었고, 체험 시간은 질문 방식과 건너뛰기 여부에 따라 달라집니다.',
  },
  {
    q: '질문이 어렵거나 음성 인식이 잘 안 되면요?',
    a: '질문은 건너뛸 수 있습니다. 인식된 문장을 확인해 다시 말하거나 글로 고칠 수도 있어요.',
  },
  {
    q: '아이의 목소리를 저장하나요?',
    a: '플레이어 시작 화면에서 보호자가 선택 동의한 경우에만 아이의 질문 원음과 확인된 문장을 음성 인식 개선을 위해 90일간 보관합니다. 체크하지 않으면 Q-Story 저장소에 보관하지 않으며, 동의하지 않아도 체험할 수 있습니다.',
  },
];

export const NAV_SECTIONS = [
  { key: 'experience', label: 'Q-Story란' },
  { key: 'difference', label: '장면 변화' },
  { key: 'trust', label: '안심 설계' },
  { key: 'beta', label: '베타 안내' },
  { key: 'faq', label: 'FAQ' },
] as const;

export type SectionKey = (typeof NAV_SECTIONS)[number]['key'];
