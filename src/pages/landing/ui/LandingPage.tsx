import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';

import { NAV_SECTIONS, type SectionKey } from '../model/content';
import { sectionStyles } from './section-styles';
import { BetaSection } from './sections/beta';
import { DifferenceSection } from './sections/difference';
import { ExperienceSection } from './sections/experience';
import { FaqSection } from './sections/faq';
import { FinalCtaSection } from './sections/final-cta';
import { FooterSection } from './sections/footer';
import { HeroSection } from './sections/hero';
import { PreviewStripSection } from './sections/preview-strip';
import { TrustSection } from './sections/trust';

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
            style={({ pressed }) => [styles.headerCta, pressed && sectionStyles.pressed]}
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
                style={({ pressed }) => [styles.navChip, pressed && sectionStyles.pressed]}
              >
                <Text style={styles.navChipText}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <HeroSection isWide={isWide} onGoToDemo={goToDemo} onExploreExperience={() => scrollToSection('experience')} />
          <ExperienceSection isWide={isWide} sectionRef={experienceRef} />
          <DifferenceSection isWide={isWide} sectionRef={differenceRef} />
          <TrustSection isWide={isWide} sectionRef={trustRef} />
          <BetaSection isWide={isWide} sectionRef={betaRef} onGoToDemo={goToDemo} />
          <FaqSection sectionRef={faqRef} />
          <FinalCtaSection onGoToDemo={goToDemo} />
          <PreviewStripSection onGoToDemo={goToDemo} />
          <FooterSection onNavigateToSection={scrollToSection} />
        </ScrollView>
      </SafeAreaView>
    </View>
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
});
