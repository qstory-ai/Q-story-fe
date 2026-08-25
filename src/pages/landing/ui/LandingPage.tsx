import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { BrandLockup, Icon, Pill, SafeAreaView, SectionHeader, storybookTheme, type IconName } from '@/shared/ui';

/**
 * 마케팅 목업이 참조하던 히어로 사진(q-story-hero-question-book.webp 등)은 이 레포에 없어서,
 * 같은 장면을 가리키는 기존 「헨젤과 그레텔」 리더 일러스트로 대체했다 - public/story/에 이미
 * 있는 실제 리더 아트라서, 탭 한 번 거리로 이어지는 /demo 미리보기와 시각적으로도 어긋나지 않는다.
 */
const HERO_ILLUSTRATION = {
  uri: '/story/hansel-gretel/illustrations/hg-art-08-candy-house-reveal.jpg',
  label: '숲속에서 과자집을 발견한 헨젤과 그레텔',
};
const BETA_SHOWCASE_ILLUSTRATION = {
  uri: '/story/hansel-gretel/illustrations/hg-art-01-home-table.jpg',
  label: '헨젤과 그레텔이 아버지와 식탁에서 이야기를 나누는 장면',
};
const FINAL_CTA_ILLUSTRATION = '/story/hansel-gretel/illustrations/hg-art-29-white-bird-leads.jpg';

const PREVIEW_ILLUSTRATIONS = [
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

const EXPERIENCE_STEPS = [
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

const EXPERIENCE_SUPPORT: Array<{ icon: IconName; label: string }> = [
  { icon: 'user', label: '아이 이름으로 초대' },
  { icon: 'play', label: '자막·다시 듣기·이어 듣기' },
  { icon: 'pencil', label: '글로 질문하거나 건너뛰기' },
  { icon: 'report', label: '완주 뒤 부모 리포트' },
];

const PROOF_POINTS = [
  { title: '자유롭게 말해요', body: '완벽한 문장이나 정답은 필요 없어요.' },
  { title: '말뜻을 확인해요', body: '다시 말하거나 글로 고칠 수 있어요.' },
  { title: '장면으로 확인해요', body: '변화 뒤에는 원 이야기로 자연스럽게 돌아와요.' },
];

const TRUST_PILLARS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'shield', title: '검수된 안전한 변화', body: '위험한 방향은 부드럽게 전환하고, 가능한 행동만 장면으로 보여 줘요.' },
  { icon: 'replay', title: '실패해도 끝까지', body: '음성 인식이나 연결이 불안하면 다시 시도하거나 그대로 계속 들을 수 있어요.' },
  {
    icon: 'consent',
    title: '원음 연구 저장은 선택',
    body: '보호자가 체크한 경우에만 질문 원음과 확인된 문장을 90일간 보관해요. 동의하지 않아도 체험할 수 있어요.',
  },
];

const BETA_QUICK_FACTS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'users', title: '6–9세 아이와 보호자', body: '함께 보고 들어요' },
  { icon: 'clock', title: '질문 방식에 따라 시간이 달라져요', body: '함께 한 편을 완주해요' },
  { icon: 'report', title: '완주 뒤 부모 리포트', body: '질문과 변화를 확인해요' },
];

const FAQ_ITEMS = [
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

const NAV_SECTIONS = [
  { key: 'experience', label: 'Q-Story란' },
  { key: 'difference', label: '장면 변화' },
  { key: 'trust', label: '안심 설계' },
  { key: 'beta', label: '베타 안내' },
  { key: 'faq', label: 'FAQ' },
] as const;

type SectionKey = (typeof NAV_SECTIONS)[number]['key'];

/**
 * 공개 대문 화면. 이전에는 화면을 가득 채우는 일러스트 위 카드 하나짜리 히어로였지만,
 * 이제는 체험 흐름(듣기->말하기->장면 변화), 안심 설계, 베타 안내, FAQ까지 아우르는
 * 풀 페이지 마케팅 레이아웃이다. 상단 내비게이션 칩은 섹션 DOM 노드의 scrollIntoView로
 * 스크롤한다 (registerSection 참고) - RN 쪽에는 DOM #anchor가 없어서다.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;

  const goToDemo = () => navigate('/demo');

  /**
   * 이 앱은 RN ScrollView 자체의 내부 overflow가 아니라 브라우저 문서(window) 스크롤에
   * 기대고 있다 (global.css의 html/body/#root가 height: 100%가 아니라 min-height: 100%라서,
   * 콘텐츠가 흘러넘치면 각 화면의 최상위 flex:1 View가 아니라 window가 스크롤됨) - 그래서
   * ScrollView ref의 scrollTo({y})가 아니라, 각 섹션 DOM 노드의 scrollIntoView를 쓴다.
   * View의 웹 ref는 실제 DOM 엘리먼트를 그대로 가리킨다.
   *
   * 섹션마다 고정된 useRef를 직접 ref에 붙인다 (렌더 중 클로저를 새로 만들어 반환하는
   * 팩토리 함수를 ref로 넘기면 eslint-plugin-react-hooks의 refs 규칙이 "렌더 중 ref를
   * 읽을 수 있다"고 경고한다 - NAV_SECTIONS가 고정된 5개뿐이라 각각 이름 붙은 useRef로 둔다).
   */
  const experienceRef = useRef<HTMLElement | null>(null);
  const differenceRef = useRef<HTMLElement | null>(null);
  const trustRef = useRef<HTMLElement | null>(null);
  const betaRef = useRef<HTMLElement | null>(null);
  const faqRef = useRef<HTMLElement | null>(null);
  const sectionRefs: Record<SectionKey, React.RefObject<HTMLElement | null>> = {
    experience: experienceRef,
    difference: differenceRef,
    trust: trustRef,
    beta: betaRef,
    faq: faqRef,
  };
  const scrollToSection = (key: SectionKey) => {
    sectionRefs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <View style={styles.app}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <BrandLockup size="compact" />
          <Pressable
            accessibilityRole="button"
            onPress={goToDemo}
            style={({ pressed }) => [styles.headerCta, pressed && styles.pressed]}
          >
            <Text style={styles.headerCtaText}>무료 체험</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.navRow}
            contentContainerStyle={styles.navRowContent}
          >
            {NAV_SECTIONS.map((item) => (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                onPress={() => scrollToSection(item.key)}
                style={({ pressed }) => [styles.navChip, pressed && styles.pressed]}
              >
                <Text style={styles.navChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* 히어로 */}
          <View style={[styles.section, isWide && styles.heroSectionWide]}>
            <View style={[styles.heroCopy, isWide && styles.heroCopyWide]}>
              <Pill label="6–9세 아이와 부모가 함께하는 AI 동화" tone="onDark" />
              <Text style={styles.heroTitle}>
                아이의 질문과 선택으로,{'\n'}중간 장면이 달라져요.
              </Text>
              <Text style={styles.heroLead}>
                아이의 질문·추측·제안이 동화 속 행동으로 이어집니다. 중요한 사건과 결말은 안전하게 이어져요.
              </Text>
              <View style={styles.heroActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={goToDemo}
                  style={({ pressed }) => [styles.buttonGoldLarge, pressed && styles.pressed]}
                >
                  <Text style={styles.buttonGoldLargeText}>무료로 한 편 체험하기</Text>
                  <Icon name="next" size={18} color={storybookTheme.color.primary} />
                </Pressable>
                <Pressable accessibilityRole="link" onPress={() => scrollToSection('experience')}>
                  <Text style={styles.textLink}>Q-Story 체험 방식 보기</Text>
                </Pressable>
              </View>
              <View style={styles.heroFacts}>
                {['무료 · 회원가입 없음', '질문 방식에 따라 체험 시간 달라짐', '말·글 모두 가능'].map((fact) => (
                  <View key={fact} style={styles.heroFactRow}>
                    <Icon name="check" size={15} color={storybookTheme.color.gold} />
                    <Text style={styles.heroFactText}>{fact}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.heroVisual, isWide && styles.heroVisualWide]}>
              <View style={styles.storybook}>
                <Image
                  source={{ uri: HERO_ILLUSTRATION.uri }}
                  resizeMode="cover"
                  style={styles.storybookImage}
                  accessibilityLabel={HERO_ILLUSTRATION.label}
                />
                <View style={styles.storybookCaption}>
                  <Text style={styles.speaker}>그레텔</Text>
                  <Text style={styles.storybookCaptionText}>이 집, 바로 들어가도 괜찮을까? 네 생각을 들려줄래?</Text>
                </View>
              </View>
              <View style={styles.questionBubble}>
                <Icon name="mic" size={14} color={storybookTheme.color.gold} />
                <Text style={styles.questionBubbleText}>“창문부터 살펴보자!”</Text>
              </View>
              <View style={styles.changeNote}>
                <Icon name="sparkles" size={14} color={storybookTheme.color.primary} />
                <Text style={styles.changeNoteText}>질문과 선택으로 중간 장면이 달라져요</Text>
              </View>
            </View>
          </View>

          {/* Q-Story란 */}
          <View style={styles.section} ref={(node) => { experienceRef.current = node as HTMLElement | null; }}>
            <View style={styles.sectionHeadingCenter}>
              <Text style={styles.eyebrow}>Q-Story란</Text>
              <Text style={styles.sectionTitle}>보기만 하던 동화에서,{'\n'}아이가 참여하는 이야기로</Text>
              <Text style={styles.sectionSubLead}>함께 듣다가 아이의 생각을 들려주면, 그 말이 장면 속 행동으로 이어집니다.</Text>
            </View>

            <View style={[styles.stepsRow, !isWide && styles.stepsRowStacked]}>
              {EXPERIENCE_STEPS.map((step, index) => (
                <View key={step.key} style={[styles.stepCard, step.featured && styles.stepCardFeatured]}>
                  <Text style={styles.stepNumber}>
                    {String(index + 1).padStart(2, '0')} · {step.key}
                  </Text>
                  <Icon name={step.icon} size={22} color={storybookTheme.color.primary} />
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              ))}
            </View>

            <View style={[styles.supportRow, !isWide && styles.supportRowStacked]}>
              {EXPERIENCE_SUPPORT.map((item) => (
                <View key={item.label} style={styles.supportChip}>
                  <Icon name={item.icon} size={16} color={storybookTheme.color.gold} />
                  <Text style={styles.supportChipText}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 장면 변화 */}
          <View
            style={[styles.section, isWide && styles.differenceSectionWide]}
            ref={(node) => { differenceRef.current = node as HTMLElement | null; }}
          >
            <View style={[styles.differenceCopy, isWide && styles.differenceCopyWide]}>
              <Text style={styles.eyebrow}>아이의 말이 닿는 순간</Text>
              <Text style={styles.sectionTitle}>
                아이의 “왜?”와{'\n'}“이렇게 해 보자”가{'\n'}장면 속 행동이 돼요.
              </Text>
              <Text style={styles.sectionSubLead}>
                질문뿐 아니라 추측, 경고, 거절, 해 보고 싶은 방법도 받아들입니다. 아이가 말한 뜻을 먼저 확인하고 가능한 변화로 보여
                줍니다.
              </Text>
              <View style={styles.proofList}>
                {PROOF_POINTS.map((point, index) => (
                  <View key={point.title} style={styles.proofRow}>
                    <Text style={styles.proofIndex}>{String(index + 1).padStart(2, '0')}</Text>
                    <View style={styles.proofTextGroup}>
                      <Text style={styles.proofTitle}>{point.title}</Text>
                      <Text style={styles.proofBody}>{point.body}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={[styles.differenceVisual, isWide && styles.differenceVisualWide]}>
              <View style={styles.sceneCard}>
                <View style={styles.sceneLabelRow}>
                  <Icon name="mic" size={15} color={storybookTheme.color.primary} />
                  <Text style={styles.sceneLabel}>아이의 생각</Text>
                </View>
                <Text style={styles.sceneQuote}>“저 할머니, 조금 수상해.{'\n'}창문부터 살펴보자.”</Text>
              </View>
              <View style={styles.sceneCard}>
                <View style={styles.sceneLabelRow}>
                  <Icon name="searchCheck" size={15} color={storybookTheme.color.primary} />
                  <Text style={styles.sceneLabel}>이렇게 들었어요</Text>
                </View>
                <Text style={styles.sceneBody}>“들어가기 전에 창문을 먼저 살펴보자.”</Text>
              </View>
              <View style={[styles.sceneCard, styles.sceneCardResult]}>
                <View style={styles.sceneLabelRow}>
                  <Icon name="sparkles" size={15} color={storybookTheme.color.gold} />
                  <Text style={[styles.sceneLabel, styles.sceneLabelOnResult]}>달라진 장면</Text>
                </View>
                <Text style={styles.sceneBodyOnResult}>
                  그레텔이 고개를 끄덕이고, 남매는 집에 들어가기 전 창문을 살펴봐요.
                </Text>
                <View style={styles.resultTag}>
                  <Text style={styles.resultTagText}>아이의 제안을 바로 반영</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 안심 설계 */}
          <View
            style={[styles.section, isWide && styles.trustSectionWide]}
            ref={(node) => { trustRef.current = node as HTMLElement | null; }}
          >
            <View style={[styles.trustCopy, isWide && styles.trustCopyWide]}>
              <Text style={styles.eyebrow}>부모가 안심할 수 있도록</Text>
              <Text style={styles.sectionTitle}>자유롭게 말해도,{'\n'}이야기는 안전하게 이어져요.</Text>
              <Text style={styles.sectionSubLead}>
                Q-Story는 자유 대화 챗봇이 아닙니다. 현재 장면과 미리 검수한 범위 안에서만 아이의 말을 반영하고, 중요한 사건과
                결말은 지킵니다.
              </Text>
              <View style={styles.parentNote}>
                <Text style={styles.parentNoteKicker}>보호자에게</Text>
                <Text style={styles.parentNoteTitle}>완벽한 문장이 아니어도 괜찮아요.</Text>
                <Text style={styles.parentNoteBody}>조금 기다려 주고 “어떤 점이 궁금했어?”라고 한 번 더 물어봐 주세요.</Text>
              </View>
            </View>

            <View style={[styles.trustPillars, isWide && styles.trustPillarsWide]}>
              {TRUST_PILLARS.map((pillar) => (
                <View key={pillar.title} style={styles.pillarRow}>
                  <View style={styles.pillarIcon}>
                    <Icon name={pillar.icon} size={18} color={storybookTheme.color.primary} />
                  </View>
                  <View style={styles.pillarTextGroup}>
                    <Text style={styles.pillarTitle}>{pillar.title}</Text>
                    <Text style={styles.pillarBody}>{pillar.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 베타 안내 */}
          <View
            style={[styles.section, isWide && styles.betaSectionWide]}
            ref={(node) => { betaRef.current = node as HTMLElement | null; }}
          >
            <View style={[styles.betaCopy, isWide && styles.betaCopyWide]}>
              <Text style={styles.eyebrow}>Q-Story 1차 공개 베타</Text>
              <Text style={styles.sectionTitle}>아이와 한 편을 완주하고,{'\n'}느낀 점을 들려주세요.</Text>
              <Text style={styles.sectionSubLead}>
                「헨젤과 그레텔」을 무료로 체험하고, 완주 뒤 1분 후기로 솔직한 경험을 나눠 주세요.
              </Text>

              <View style={styles.quickFactList}>
                {BETA_QUICK_FACTS.map((fact) => (
                  <View key={fact.title} style={styles.quickFactRow}>
                    <Icon name={fact.icon} size={16} color={storybookTheme.color.gold} />
                    <Text style={styles.quickFactText}>
                      <Text style={styles.quickFactStrong}>{fact.title}</Text> {fact.body}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.betaFeedbackRow}>
                <Icon name="sparkles" size={15} color={storybookTheme.color.gold} />
                <Text style={styles.betaFeedbackText}>여러분의 1분 후기가 다음 동화와 체험 방식을 결정하는 데 쓰여요.</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={goToDemo}
                style={({ pressed }) => [styles.buttonVioletFull, pressed && styles.pressed]}
              >
                <Text style={styles.buttonVioletFullText}>무료로 한 편 체험하기</Text>
                <Icon name="next" size={18} color={storybookTheme.color.onDark} />
              </Pressable>
              <Text style={styles.betaNote}>무료 · 회원가입 없음 · 질문하지 않아도 결말까지 감상 가능</Text>
            </View>

            <View style={[styles.betaShowcase, isWide && styles.betaShowcaseWide]}>
              <View style={styles.betaStoryFrame}>
                <Image
                  source={{ uri: BETA_SHOWCASE_ILLUSTRATION.uri }}
                  resizeMode="cover"
                  style={styles.betaStoryFrameImage}
                  accessibilityLabel={BETA_SHOWCASE_ILLUSTRATION.label}
                />
                <View style={styles.betaStoryFrameCaption}>
                  <Text style={styles.betaStoryFrameCaptionKicker}>체험 화면</Text>
                  <Text style={styles.betaStoryFrameCaptionText}>아이의 질문으로 이어진 밤의 대화</Text>
                </View>
              </View>
              <View style={styles.reportPreview}>
                <View style={styles.reportPreviewHeader}>
                  <View style={styles.reportPreviewIcon}>
                    <Icon name="report" size={16} color={storybookTheme.color.primary} />
                  </View>
                  <Text style={styles.reportPreviewHeaderLabel}>부모 리포트 미리보기</Text>
                  <View style={styles.reportBadge}>
                    <Text style={styles.reportBadgeText}>완주 후</Text>
                  </View>
                </View>
                <Text style={styles.reportPreviewTitle}>오늘 아이는{'\n'}먼저 살펴보는 방법을 제안했어요.</Text>
                <Text style={styles.reportPreviewQuote}>“창문부터 살펴보자!”</Text>
                <Text style={styles.reportPreviewBody}>
                  아이의 질문과 실제로 달라진 장면을 한눈에 확인하고, 대화를 이어갈 질문도 받아보세요.
                </Text>
              </View>
            </View>
          </View>

          {/* FAQ */}
          <View style={styles.section} ref={(node) => { faqRef.current = node as HTMLElement | null; }}>
            <View style={styles.sectionHeading}>
              <Text style={styles.eyebrow}>자주 묻는 질문</Text>
              <Text style={styles.sectionTitle}>체험 전,{'\n'}네 가지만 확인하세요.</Text>
            </View>
            <View style={styles.accordion}>
              {FAQ_ITEMS.map((item, index) => (
                <FaqItem key={item.q} question={item.q} answer={item.a} defaultOpen={index === 0} />
              ))}
            </View>
          </View>

          {/* 최종 CTA */}
          <View style={styles.finalCta}>
            <Image
              source={{ uri: FINAL_CTA_ILLUSTRATION }}
              resizeMode="cover"
              style={styles.finalCtaArt}
              accessibilityLabel=""
            />
            <View style={styles.finalCtaScrim} />
            <View style={styles.finalCtaInner}>
              <Text style={styles.finalCtaEyebrow}>AI 시대, 스스로 묻는 아이로 자라게</Text>
              <Text style={styles.finalCtaTitle}>오늘 밤, 아이와 함께{'\n'}질문이 움직이는 동화를 시작해 보세요.</Text>
              <Text style={styles.finalCtaLead}>「헨젤과 그레텔」 한 편을 무료로 체험할 수 있어요.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={goToDemo}
                style={({ pressed }) => [styles.buttonGoldLarge, pressed && styles.pressed]}
              >
                <Text style={styles.buttonGoldLargeText}>무료로 한 편 체험하기</Text>
                <Icon name="next" size={18} color={storybookTheme.color.primary} />
              </Pressable>
            </View>
          </View>

          {/* 프리뷰 스트립 */}
          <View style={styles.section}>
            <SectionHeader title="이런 장면을 만나요" subtitle="체험판 「헨젤과 그레텔」 속 한 장면들" />
            <View style={styles.previewRow}>
              {PREVIEW_ILLUSTRATIONS.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={goToDemo}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} - 무료로 체험 시작하기`}
                  style={({ pressed }) => [styles.previewThumb, pressed && styles.previewThumbPressed]}
                >
                  <Image source={{ uri: item.uri }} resizeMode="cover" style={styles.previewImage} accessibilityLabel={item.label} />
                </Pressable>
              ))}
            </View>
          </View>

          {/* 푸터 */}
          <View style={styles.footer}>
            <BrandLockup size="compact" />
            <Text style={styles.footerLead}>아이의 질문을 달라지는 중간 장면으로 이어 주는 AI 인터랙티브 동화</Text>
            <View style={styles.footerNav}>
              {NAV_SECTIONS.map((item) => (
                <Pressable key={item.key} onPress={() => scrollToSection(item.key)}>
                  <Text style={styles.footerNavText}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.footerBottom}>
              <Text style={styles.footerBottomText}>© 2026 Q-Story. All rights reserved.</Text>
              <Text style={styles.footerBottomText}>1차 공개 베타 · 보호자와 함께 이용해 주세요.</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function FaqItem({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((prev) => !prev)}
      style={styles.faqItem}
    >
      <View style={styles.faqQuestionRow}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Text style={styles.faqToggle}>{open ? '–' : '+'}</Text>
      </View>
      {open ? <Text style={styles.faqAnswer}>{answer}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerCta: {
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.gold,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerCtaText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  navRow: {
    marginTop: 12,
  },
  navRowContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  navChip: {
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navChipText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '500',
  },
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    gap: 24,
  },
  eyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  sectionTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xxl,
    lineHeight: 36,
    fontWeight: '700',
  },
  sectionSubLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: 24,
    fontWeight: '300',
  },
  sectionHeading: {
    gap: 10,
  },
  sectionHeadingCenter: {
    gap: 10,
    alignItems: 'center',
  },

  // 히어로
  heroSectionWide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  heroCopy: {
    gap: 16,
  },
  heroCopyWide: {
    flex: 1,
  },
  heroTitle: {
    color: storybookTheme.color.onDark,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700',
  },
  heroLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    lineHeight: 25,
    fontWeight: '300',
  },
  heroActions: {
    gap: 12,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  textLink: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  heroFacts: {
    gap: 8,
    marginTop: 4,
  },
  heroFactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroFactText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
  },
  heroVisual: {
    marginTop: 32,
    gap: -12,
  },
  heroVisualWide: {
    flex: 1,
    marginTop: 0,
  },
  storybook: {
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: storybookTheme.color.coverFallback,
    ...storybookTheme.elevation.high,
  },
  storybookImage: {
    width: '100%',
    aspectRatio: 5 / 3,
  },
  storybookCaption: {
    backgroundColor: storybookTheme.color.surfaceCard,
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 4,
  },
  speaker: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  storybookCaptionText: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '400',
  },
  questionBubble: {
    alignSelf: 'flex-end',
    marginRight: 16,
    marginTop: -18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2B1748',
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(246, 198, 77, 0.4)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...storybookTheme.elevation.low,
  },
  questionBubbleText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xs,
    fontWeight: '500',
  },
  changeNote: {
    alignSelf: 'center',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: storybookTheme.color.gold,
    borderRadius: storybookTheme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    ...storybookTheme.elevation.low,
  },
  changeNoteText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
  },

  // 버튼
  buttonGoldLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: storybookTheme.color.gold,
    paddingHorizontal: 24,
  },
  buttonGoldLargeText: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.md,
    fontWeight: '700',
  },
  buttonVioletFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 56,
    width: '100%',
    borderRadius: 17,
    backgroundColor: storybookTheme.color.primary,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  buttonVioletFullText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.md,
    fontWeight: '700',
  },

  // Q-Story란
  stepsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stepsRowStacked: {
    flexDirection: 'column',
  },
  stepCard: {
    flex: 1,
    gap: 8,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 20,
  },
  stepCardFeatured: {
    borderColor: storybookTheme.color.gold,
    borderWidth: 2,
  },
  stepNumber: {
    color: storybookTheme.color.onCardMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  stepTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
  },
  stepBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
  supportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  supportRowStacked: {
    flexDirection: 'column',
  },
  supportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  supportChipText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
  },

  // 장면 변화
  differenceSectionWide: {
    flexDirection: 'row',
    gap: 40,
  },
  differenceCopy: {
    gap: 16,
  },
  differenceCopyWide: {
    flex: 1,
  },
  proofList: {
    gap: 14,
    marginTop: 4,
  },
  proofRow: {
    flexDirection: 'row',
    gap: 14,
  },
  proofIndex: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.md,
    fontWeight: '700',
    width: 28,
  },
  proofTextGroup: {
    flex: 1,
    gap: 2,
  },
  proofTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
  },
  proofBody: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
  differenceVisual: {
    gap: 12,
    marginTop: 8,
  },
  differenceVisualWide: {
    flex: 1,
    marginTop: 0,
    justifyContent: 'center',
  },
  sceneCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 18,
    gap: 8,
    ...storybookTheme.elevation.low,
  },
  sceneCardResult: {
    backgroundColor: storybookTheme.color.primary,
  },
  sceneLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sceneLabel: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
  },
  sceneLabelOnResult: {
    color: storybookTheme.color.gold,
  },
  sceneQuote: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  sceneBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '400',
  },
  sceneBodyOnResult: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '400',
  },
  resultTag: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: 'rgba(246, 198, 77, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(246, 198, 77, 0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  resultTagText: {
    color: storybookTheme.color.gold,
    fontSize: 11,
    fontWeight: '600',
  },

  // 안심 설계
  trustSectionWide: {
    flexDirection: 'row',
    gap: 40,
  },
  trustCopy: {
    gap: 16,
  },
  trustCopyWide: {
    flex: 1,
  },
  parentNote: {
    marginTop: 8,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 18,
    gap: 4,
  },
  parentNoteKicker: {
    color: storybookTheme.color.primary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  parentNoteTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
  },
  parentNoteBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
  trustPillars: {
    gap: 16,
    marginTop: 8,
  },
  trustPillarsWide: {
    flex: 1,
    marginTop: 0,
    justifyContent: 'center',
  },
  pillarRow: {
    flexDirection: 'row',
    gap: 14,
  },
  pillarIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(246, 198, 77, 0.16)',
  },
  pillarTextGroup: {
    flex: 1,
    gap: 2,
  },
  pillarTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
  },
  pillarBody: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },

  // 베타 안내
  betaSectionWide: {
    flexDirection: 'row',
    gap: 40,
  },
  betaCopy: {
    gap: 14,
  },
  betaCopyWide: {
    flex: 1,
  },
  quickFactList: {
    gap: 10,
    marginTop: 4,
  },
  quickFactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  quickFactText: {
    flex: 1,
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
  quickFactStrong: {
    color: storybookTheme.color.onDark,
    fontWeight: '600',
  },
  betaFeedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  betaFeedbackText: {
    flex: 1,
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '500',
  },
  betaNote: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '400',
  },
  betaShowcase: {
    gap: 16,
    marginTop: 8,
  },
  betaShowcaseWide: {
    flex: 1,
    marginTop: 0,
  },
  betaStoryFrame: {
    borderRadius: storybookTheme.radius.card,
    overflow: 'hidden',
    backgroundColor: storybookTheme.color.coverFallback,
    ...storybookTheme.elevation.low,
  },
  betaStoryFrameImage: {
    width: '100%',
    aspectRatio: 5 / 3,
  },
  betaStoryFrameCaption: {
    backgroundColor: 'rgba(18, 10, 30, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  betaStoryFrameCaptionKicker: {
    color: storybookTheme.color.gold,
    fontSize: 11,
    fontWeight: '600',
  },
  betaStoryFrameCaptionText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
  },
  reportPreview: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    padding: 20,
    gap: 10,
  },
  reportPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportPreviewIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.pillBackground,
  },
  reportPreviewHeaderLabel: {
    flex: 1,
    color: storybookTheme.color.onCardMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '500',
  },
  reportBadge: {
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.pillBackground,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reportBadgeText: {
    color: storybookTheme.color.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  reportPreviewTitle: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.lg,
    lineHeight: 26,
    fontWeight: '600',
  },
  reportPreviewQuote: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.md,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  reportPreviewBody: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },

  // FAQ
  accordion: {
    gap: 10,
  },
  faqItem: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
  },
  faqToggle: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.lg,
    fontWeight: '700',
  },
  faqAnswer: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    fontWeight: '300',
  },

  // 최종 CTA
  finalCta: {
    width: '100%',
    overflow: 'hidden',
  },
  finalCtaArt: {
    ...StyleSheet.absoluteFill,
    opacity: 0.28,
  },
  finalCtaScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 10, 30, 0.72)',
  },
  finalCtaInner: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 56,
    gap: 14,
    alignItems: 'flex-start',
  },
  finalCtaEyebrow: {
    color: storybookTheme.color.gold,
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  finalCtaTitle: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.xl,
    lineHeight: 34,
    fontWeight: '700',
  },
  finalCtaLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.md,
    fontWeight: '300',
  },

  // 프리뷰 스트립
  previewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewThumb: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  previewThumbPressed: {
    opacity: 0.85,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },

  // 푸터
  footer: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerLead: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 20,
    fontWeight: '300',
  },
  footerNav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  footerNavText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
  },
  footerBottom: {
    gap: 4,
  },
  footerBottomText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: 11,
    fontWeight: '300',
  },
});
