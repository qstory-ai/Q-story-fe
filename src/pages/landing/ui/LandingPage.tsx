import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { homePathFor, useAuth } from '@/entities/auth';
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
 * 공개 대문 화면. 체험 흐름(듣기->말하기->장면 변화), 안심 설계, 베타 안내, FAQ까지 아우르는
 * 풀 페이지 마케팅 레이아웃이다. 상단 내비게이션 칩은 섹션 DOM 노드의 scrollIntoView로
 * 스크롤한다 (registerSection 참고) - RN 쪽에는 DOM #anchor가 없어서다.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 860;
  const [activeSection, setActiveSection] = useState<SectionKey>('experience');

  // 로그인된 사용자는 데모가 아니라 자신의 역할 홈으로 보낸다.
  const goToDemo = () => {
    if (authState.status === 'authenticated') {
      navigate(homePathFor(authState.user));
      return;
    }
    navigate('/demo');
  };

  /**
   * 이 앱은 RN ScrollView 자체의 내부 overflow가 아니라 브라우저 문서(window) 스크롤에
   * 기대고 있다 (global.css의 html/body/#root가 height: 100%가 아니라 min-height: 100%라서,
   * 콘텐츠가 흘러넘치면 각 화면의 최상위 flex:1 View가 아니라 window가 스크롤됨) - 그래서
   * ScrollView ref의 scrollTo({y})가 아니라, 각 섹션 DOM 노드의 scrollIntoView를 쓴다.
   * View의 웹 ref는 실제 DOM 엘리먼트를 그대로 가리킨다.
   *
   * 섹션마다 고정된 useRef를 둔다 (ref 팩토리 함수는 react-hooks refs 규칙에 걸린다).
   */
  const experienceRef = useRef<HTMLElement | null>(null);
  const differenceRef = useRef<HTMLElement | null>(null);
  const trustRef = useRef<HTMLElement | null>(null);
  const betaRef = useRef<HTMLElement | null>(null);
  const faqRef = useRef<HTMLElement | null>(null);
  const sectionRefs = useMemo<Record<SectionKey, React.RefObject<HTMLElement | null>>>(
    () => ({
      experience: experienceRef,
      difference: differenceRef,
      trust: trustRef,
      beta: betaRef,
      faq: faqRef,
    }),
    [experienceRef, differenceRef, trustRef, betaRef, faqRef],
  );
  // 클릭 후 smooth-scroll 중에 지나치는 섹션들이 observer로 칩 하이라이트를 깜빡이게 하므로, 클릭
  // 직후엔 observer 쓰기를 잠깐 무시한다. 스크롤 거리가 0이면 scrollend가 안 터질 수 있어 고정 지연을 쓴다.
  const suppressObserverRef = useRef(false);
  const suppressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollToSection = (key: SectionKey) => {
    setActiveSection(key);
    suppressObserverRef.current = true;
    if (suppressTimeoutRef.current !== null) clearTimeout(suppressTimeoutRef.current);
    suppressTimeoutRef.current = setTimeout(() => {
      suppressObserverRef.current = false;
      suppressTimeoutRef.current = null;
    }, 600);
    sectionRefs[key].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressObserverRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const section = NAV_SECTIONS.find((item) => sectionRefs[item.key].current === visible?.target);
        if (section) setActiveSection(section.key);
      },
      { rootMargin: '-24% 0px -60% 0px', threshold: [0.1, 0.35, 0.6] },
    );

    Object.values(sectionRefs).forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });
    return () => observer.disconnect();
  }, [sectionRefs]);

  useEffect(
    () => () => {
      if (suppressTimeoutRef.current !== null) clearTimeout(suppressTimeoutRef.current);
    },
    [],
  );

  const navigationItems = NAV_SECTIONS.map((item) => {
    const active = activeSection === item.key;
    return (
      <Pressable
        key={item.key}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={() => scrollToSection(item.key)}
        style={({ pressed }) => [
          styles.navChip,
          active && styles.navChipActive,
          pressed && sectionStyles.pressed,
        ]}
      >
        <Text style={[styles.navChipText, active && styles.navChipTextActive]}>{item.label}</Text>
      </Pressable>
    );
  });

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
          {isWide ? (
            <View style={[styles.navRow, styles.navRowWide]}>{navigationItems}</View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.navRow}
              contentContainerStyle={styles.navRowContent}
            >
              {navigationItems}
            </ScrollView>
          )}

          <HeroSection isWide={isWide} onGoToDemo={goToDemo} onExploreExperience={() => scrollToSection('experience')} />
          <ExperienceSection isWide={isWide} sectionRef={experienceRef} />
          <DifferenceSection isWide={isWide} sectionRef={differenceRef} />
          <TrustSection isWide={isWide} sectionRef={trustRef} />
          <BetaSection isWide={isWide} sectionRef={betaRef} onGoToDemo={goToDemo} />
          <FaqSection sectionRef={faqRef} />
          <PreviewStripSection onGoToDemo={goToDemo} />
          <FinalCtaSection onGoToDemo={goToDemo} />
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
    minHeight: 44,
    justifyContent: 'center',
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
  navRowWide: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  navChip: {
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  navChipActive: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  navChipText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.xs,
    fontWeight: '500',
  },
  navChipTextActive: { color: storybookTheme.color.onDark },
});
