import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Link } from 'react-router-dom';

import { useAuth } from '@/entities/auth';
import { isDevBuild } from '@/shared/config';
import {
  ActionButton,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  FilterChip,
  Modal,
  Pill,
  PillTabs,
  SafeAreaView,
  SearchField,
  SectionHeader,
  ThemeModeProvider,
  TextField,
  elevation,
  radius,
  responsive,
  responsiveMode,
  semanticColors,
  shadow,
  space,
  textStylesFor,
  actionButtonStyle,
  type ActionButtonState,
  type ActionButtonVariant,
} from '@/shared/ui';

const L = semanticColors.light;
/** DOM <a> 스타일(CSS) - 터치 높이 44. */
const LOGIN_LINK = { color: L.text.link, fontSize: 16, fontWeight: 700, textDecoration: 'underline', display: 'inline-block', padding: '12px 0' } as const;
const D = semanticColors.dark;

/**
 * 내부 UI 키트(/internal/ui-kit) - 공통 컴포넌트를 상태별로 한 화면에 늘어놓아 캡처·리뷰한다. 메뉴에 걸지 않는다.
 * 개발 빌드에서는 누구나, 운영에서는 STAFF만 본다(데이터 요청 없음).
 */
export function InternalUiKitPage() {
  const { state } = useAuth();
  const allowed = isDevBuild() || (state.status === 'authenticated' && state.user.role === 'STAFF');
  if (!allowed && state.status === 'loading') {
    // 로그인 상태를 확인하는 동안 거부 문구가 깜빡이지 않게.
    return (
      <SafeAreaView style={styles.page}>
        <LoadingState />
      </SafeAreaView>
    );
  }
  if (!allowed) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.inner}>
          <Text style={styles.h1}>팀 계정으로 로그인해 주세요</Text>
          <Link to="/login?next=%2Finternal%2Fui-kit" style={LOGIN_LINK}>로그인하러 가기</Link>
        </View>
      </SafeAreaView>
    );
  }
  return <Kit />;
}

const BUTTON_VARIANTS: ActionButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
const STATES = [
  { key: 'default', label: '기본' },
  { key: 'hover', label: 'hover' },
  { key: 'pressed', label: 'pressed' },
  { key: 'disabled', label: 'disabled' },
] as const;

function Kit() {
  const { width } = useWindowDimensions();
  const mode = responsiveMode(width);
  const text = textStylesFor(width);
  const [tab, setTab] = useState<'all' | 'reading' | 'done'>('all');
  const [chip, setChip] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={[styles.inner, { paddingHorizontal: responsive.paddingX[mode] }]}>
        <Text style={[styles.h1, text.heading2]}>UI 키트</Text>
        <Text style={styles.caption}>
          {`화면 ${Math.round(width)}px · ${mode} 모드 · 좌우 여백 ${responsive.paddingX[mode]}px`}
        </Text>

        <Section title="Button" note="variant × 기본/hover/pressed/disabled · 크기 sm 40 / md 48 / lg 56">
          {BUTTON_VARIANTS.map((variant) => (
            <View key={variant} style={styles.row}>
              <Text style={styles.rowLabel}>{variant}</Text>
              {STATES.map((s) => (
                <View key={s.key} style={styles.cell}>
                  <ButtonPreview variant={variant} state={s.key} label={s.label} />
                </View>
              ))}
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>크기</Text>
            <View style={styles.cell}><ActionButton label="sm" size="sm" onPress={() => {}} /></View>
            <View style={styles.cell}><ActionButton label="md" size="md" onPress={() => {}} /></View>
            <View style={styles.cell}><ActionButton label="lg" size="lg" onPress={() => {}} /></View>
            <View style={styles.cell}><ActionButton label="loading" size="md" loading onPress={() => {}} /></View>
          </View>
          <View style={[styles.darkStrip]}>
            <ActionButton label="outline (어두운 바탕)" variant="outline" onPress={() => {}} />
          </View>
        </Section>

        <Section title="Input" note="기본 / focused / error / disabled">
          <View style={styles.grid}>
            <View style={styles.gridItem}><TextField label="기본" placeholder="이름을 입력해 주세요" /></View>
            <View style={styles.gridItem}><TextField label="focused" placeholder="입력 중" autoFocus /></View>
            <View style={styles.gridItem}><TextField label="error" value="잘못된 값" errorText="다시 확인해 주세요." onChangeText={() => {}} /></View>
            <View style={styles.gridItem}><TextField label="disabled" value="바꿀 수 없어요" editable={false} /></View>
            <View style={styles.gridItem}><SearchField value="" onChangeText={() => {}} placeholder="이야기 제목을 검색해요" accessibilityLabel="검색" /></View>
          </View>
        </Section>

        <Section title="Card" note="surface(elevation 2) / panel / tinted · radius 16">
          <View style={styles.grid}>
            <View style={styles.gridItem}><Card title="surface"><Text style={styles.body}>흰 카드 + hairline + 옅은 그림자</Text></Card></View>
            <View style={styles.gridItem}><Card title="panel" variant="panel"><Text style={styles.body}>카드 안 서브 패널</Text></Card></View>
            <View style={styles.gridItem}><Card title="tinted" variant="tinted"><Text style={styles.body}>랜딩식 옅은 보라 카드</Text></Card></View>
          </View>
        </Section>

        <Section title="Pill / Badge">
          <View style={styles.wrap}>
            <Pill label="고전동화" />
            <Pill label="보호자 연결 대기" tone="onLight" />
            <Pill label="지금 반" tone="accent" />
            <Badge label="안내" tone="info" />
            <Badge label="완료" tone="success" />
            <Badge label="확인 필요" tone="error" />
          </View>
        </Section>

        <Section title="Tabs (알약형)" note="선택된 탭만 흰 알약 + elevation 1 · 높이 44">
          <PillTabs
            accessibilityLabel="예시 탭"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: '전체', count: 12 },
              { value: 'reading', label: '읽는 중', count: 3 },
              { value: 'done', label: '읽은 작품' },
            ]}
          />
          <View style={styles.wrap}>
            <FilterChip label="필터 칩" selected={chip} onPress={() => setChip((v) => !v)} />
            <FilterChip label="채움 칩" tone="filled" selected={chip} onPress={() => setChip((v) => !v)} count={2} />
          </View>
        </Section>

        <Section title="Section header">
          <SectionHeader title="최근 리포트" subtitle="아이와 읽은 이야기" action={{ label: '더 보기', onPress: () => {} }} />
        </Section>

        <Section title="Empty / Error state" note="빈 상태는 큐돌이">
          <View style={styles.grid}>
            <View style={styles.gridItem}>
              <EmptyState title="아직 읽은 이야기가 없어요" body="첫 이야기를 골라 볼까요?" cta={{ label: '이야기 고르기', onPress: () => {} }} />
            </View>
            <View style={styles.gridItem}>
              <ErrorState message="불러오지 못했어요." onRetry={() => {}} />
            </View>
          </View>
        </Section>

        <Section title="Modal">
          <ActionButton label="모달 열기" variant="secondary" onPress={() => setModalOpen(true)} />
          <Modal
            visible={modalOpen}
            accessibilityLabel="예시 모달"
            eyebrow="안내"
            title="모달 제목"
            positiveAction={{ label: '확인', onPress: () => setModalOpen(false) }}
            negativeAction={{ label: '닫기', onPress: () => setModalOpen(false) }}
          >
            <Text style={styles.body}>radius 32 · elevation 5 · 버튼은 최대 2개.</Text>
          </Modal>
        </Section>

        <Section title="Elevation 0~5 · Radius">
          <View style={styles.wrap}>
            {elevation.light.map((_, level) => (
              <View key={level} style={[styles.swatchBox, shadow(level as 0 | 1 | 2 | 3 | 4 | 5)]}>
                <Text style={styles.caption}>{`level ${level}`}</Text>
              </View>
            ))}
          </View>
          <View style={styles.wrap}>
            {([0, 4, 8, 12, 16, 32, 'rounded'] as const).map((r) => (
              <View key={r} style={[styles.radiusBox, { borderRadius: radius[r] }]}>
                <Text style={styles.caption}>{String(r)}</Text>
              </View>
            ))}
          </View>
        </Section>

        <Section title="테마 범위(ThemeModeProvider)" note="요소 범위 data-theme - 가장 가까운 조상이 이긴다. 바깥 dark 안에 light 중첩.">
          <ThemeModeProvider mode="dark" style={styles.darkStrip}>
            <View nativeID="theme-scope-dark">
              <Text style={{ color: D.text.primary }}>dark 범위</Text>
            </View>
            <ThemeModeProvider mode="light" style={styles.lightInset}>
              <View nativeID="theme-scope-light-in-dark">
                <Text style={styles.body}>dark 안의 light 범위</Text>
              </View>
            </ThemeModeProvider>
          </ThemeModeProvider>
        </Section>

        <Section title="Semantic 색 (Light / Dark)">
          <Swatches colors={L} />
          <View style={styles.darkStrip}>
            <Swatches colors={D} dark />
          </View>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

/** 상태를 고정한 버튼 그림 - ActionButton과 같은 actionButtonStyle을 쓴다(누를 수 없는 견본). */
function ButtonPreview({ variant, state, label }: { variant: ActionButtonVariant; state: ActionButtonState; label: string }) {
  const look = actionButtonStyle(variant, state, 'md');
  return (
    <View style={look.container} aria-hidden>
      <Text style={look.labelStyle}>{label}</Text>
    </View>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} subtitle={note} />
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Swatches({ colors, dark = false }: { colors: typeof L; dark?: boolean }) {
  const items: Array<[string, string, string]> = [
    ['bg/primary', colors.bg.primary, colors.text.primary],
    ['bg/secondary', colors.bg.secondary, colors.text.primary],
    ['bg/tertiary', colors.bg.tertiary, colors.text.primary],
    ['bg/brandSubtle', colors.bg.brandSubtle, colors.text.interactive.selected],
    ['bg/interactive/primary', colors.bg.interactive.primary.default, colors.text.interactive.inverse],
    ['-hover/-pressed', colors.bg.interactive.primary.hover, colors.text.interactive.inverse],
    ['bg/infoSubtle', colors.bg.infoSubtle, colors.text.secondary],
    ['bg/successSubtle', colors.bg.successSubtle, colors.text.success],
    ['bg/errorSubtle', colors.bg.errorSubtle, colors.text.error],
    ['bg/inverse', colors.bg.inverse, colors.text.inverse],
  ];
  return (
    <View style={styles.wrap}>
      {items.map(([name, bg, fg]) => (
        <View key={name} style={[styles.swatch, { backgroundColor: bg, borderColor: colors.border.secondary }]}>
          <Text style={[styles.swatchText, { color: fg }]}>{name}</Text>
        </View>
      ))}
      <Text style={[styles.caption, dark && { color: D.text.secondary }]}>{dark ? 'Dark(리더)' : 'Light(콘솔)'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: L.bg.secondary },
  inner: { paddingVertical: space[32], gap: space[8], maxWidth: 1280, width: '100%', alignSelf: 'center' },
  h1: { color: L.text.primary },
  caption: { color: L.text.tertiary, fontSize: 12 },
  body: { color: L.text.secondary, fontSize: 14, lineHeight: 20 },
  section: { marginTop: space[40], gap: space[16] },
  sectionBody: { gap: space[16] },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[12] },
  rowLabel: { width: 72, color: L.text.secondary, fontSize: 14, fontWeight: '700' },
  cell: { minWidth: 110 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[16] },
  gridItem: { flexGrow: 1, flexBasis: 280 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[12], rowGap: space[16] },
  lightInset: { backgroundColor: L.bg.primary, borderRadius: radius[12], padding: space[12] },
  darkStrip: { backgroundColor: D.bg.primary, borderRadius: radius[16], padding: space[16], gap: space[12] },
  swatchBox: { width: 96, height: 64, borderRadius: radius[12], backgroundColor: L.bg.primary, alignItems: 'center', justifyContent: 'center' },
  radiusBox: { width: 72, height: 48, backgroundColor: L.bg.brandSubtle, borderWidth: 1, borderColor: L.border.brandSubtle, alignItems: 'center', justifyContent: 'center' },
  swatch: { minWidth: 120, paddingHorizontal: space[12], paddingVertical: space[12], borderRadius: radius[12], borderWidth: 1 },
  swatchText: { fontSize: 12, fontWeight: '700' },
});
