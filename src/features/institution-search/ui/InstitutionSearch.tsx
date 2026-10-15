import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { FILTER_CHIP_ROW_GAP, FilterChip, Icon, Pill, SearchField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import {
  INSTITUTION_KIND_LABEL,
  isSearchableInstitutionQuery,
  searchPublicInstitutions,
  type InstitutionKind,
  type PublicInstitution,
} from '@/entities/public-institution';

/** key는 이 결과를 부른 검색(종류|검색어) - 지금 검색과 다르면 아직 불러오는 중이다. */
type Load =
  | { key: string; status: 'ready'; items: PublicInstitution[]; hasMore: boolean; attribution: string }
  | { key: string; status: 'error'; message: string };

const KIND_FILTERS: Array<{ key: InstitutionKind | null; label: string }> = [
  { key: null, label: '전체' },
  { key: 'KINDERGARTEN', label: '유치원' },
  { key: 'DAYCARE', label: '어린이집' },
];

/** 글자를 칠 때마다 부르지 않고 잠깐 쉬었다 부른다(서버 상한: 1분 60번). */
const DEBOUNCE_MS = 350;

const DEFAULT_ATTRIBUTION =
  '기관 정보 출처: 교육부 유치원알리미 공시자료, 한국사회보장정보원 어린이집정보공개포털(공공누리 제1유형)';

type Props = {
  /** 로그인 전(원장 가입 화면)이면 null - 그때는 "이미 등록됨" 표시가 오지 않는다. */
  token: string | null;
  selectedId?: string | null;
  onSelect: (institution: PublicInstitution) => void;
  /** 결과 줄 오른쪽 상태 표시(예: 이미 등록됨/신청 중). 없으면 아무것도 안 붙인다. */
  badgeFor?: (institution: PublicInstitution) => string | null;
};

/**
 * 공공데이터 유치원·어린이집 검색. 원장 기관 등록(가입 화면·기관 등록)과 선생님 소속 신청이 함께 쓴다.
 * 고르면 onSelect만 부르고, 그다음 일(등록·신청)은 부르는 화면이 정한다.
 */
export function InstitutionSearch({ token, selectedId, onSelect, badgeFor }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<InstitutionKind | null>(null);
  const [load, setLoad] = useState<Load | null>(null);
  const searchKey = isSearchableInstitutionQuery(query) ? `${kind ?? ''}|${query.trim()}` : null;

  useEffect(() => {
    if (!searchKey) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPublicInstitutions(token, query, kind)
        .then((result) => {
          if (!cancelled) {
            setLoad({ key: searchKey, status: 'ready', items: result.items, hasMore: result.hasMore, attribution: result.attribution });
          }
        })
        .catch((failure: unknown) => {
          if (!cancelled) {
            setLoad({ key: searchKey, status: 'error', message: messageForError(failure, '기관을 찾지 못했어요. 잠시 후 다시 시도해 주세요.') });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // query·kind는 searchKey에 들어 있다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey, token]);

  const current = searchKey && load?.key === searchKey ? load : null;

  return (
    <View style={styles.container}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="기관 이름 (예: 강릉 가온유치원)"
        accessibilityLabel="유치원·어린이집 이름으로 찾기"
      />
      <View style={styles.chips} accessibilityRole="radiogroup">
        {KIND_FILTERS.map((filter) => (
          <FilterChip
            key={filter.label}
            label={filter.label}
            selected={kind === filter.key}
            onPress={() => setKind(filter.key)}
          />
        ))}
      </View>

      {!searchKey ? (
        <Text style={styles.hint}>이름을 두 글자 이상 입력해 주세요. 시·군·구를 함께 쓰면 더 빨리 찾아요.</Text>
      ) : !current ? (
        <View style={styles.center}>
          <ActivityIndicator color={storybookTheme.color.primary} />
        </View>
      ) : current.status === 'error' ? (
        <Text style={[styles.hint, styles.error]}>{current.message}</Text>
      ) : current.items.length === 0 ? (
        <Text style={styles.hint}>찾는 기관이 없어요. 이름을 다시 확인하거나 직접 입력해 주세요.</Text>
      ) : (
        <View style={styles.list} accessibilityRole="list">
          {current.items.map((item) => {
            const badge = badgeFor?.(item) ?? null;
            const selected = item.id === selectedId;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${item.name}, ${item.address ?? ''}${badge ? `, ${badge}` : ''}`}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                  {item.address ? <Text style={styles.address} numberOfLines={2}>{item.address}</Text> : null}
                  <View style={styles.pills}>
                    <Pill label={INSTITUTION_KIND_LABEL[item.kind]} />
                    {item.establishmentType ? <Pill label={item.establishmentType} tone="onLight" /> : null}
                    {badge ? <Pill label={badge} tone="accent" /> : null}
                  </View>
                </View>
                {selected ? <Icon name="check" size={18} color={storybookTheme.color.primary} /> : null}
              </Pressable>
            );
          })}
          {current.hasMore ? (
            <Text style={styles.hint}>결과가 더 있어요. 시·군·구나 이름을 더 적어 보세요.</Text>
          ) : null}
        </View>
      )}
      <Text style={styles.attribution}>
        {current?.status === 'ready' ? current.attribution : DEFAULT_ATTRIBUTION}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: storybookTheme.spacing.sm, alignSelf: 'stretch' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.xs, rowGap: FILTER_CHIP_ROW_GAP }, // 칩이 여러 줄로 감길 때 터치 영역(44)이 겹치지 않게
  hint: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardMuted,
  },
  error: { color: storybookTheme.color.error },
  center: { alignItems: 'center', paddingVertical: storybookTheme.spacing.ms },
  list: { gap: storybookTheme.spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    padding: storybookTheme.spacing.ms,
    borderRadius: storybookTheme.radius.input,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.surfaceCard,
  },
  rowSelected: { borderColor: storybookTheme.color.primary, borderWidth: 2, padding: storybookTheme.spacing.ms - 1 },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  address: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  attribution: {
    fontSize: storybookTheme.type.xxs,
    lineHeight: storybookTheme.type.xxs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardMuted,
  },
});
