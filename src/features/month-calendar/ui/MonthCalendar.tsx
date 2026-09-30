import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, storybookTheme } from '@/shared/ui';

/**
 * 월 그리드 + 선택된 일자 아래 목록. items를 날짜별로 그루핑해 dot으로 표시하고, 탭한 날짜의
 * 항목을 renderItem으로 그린다.
 *  - 주 시작은 일요일. 6주 고정 42셀 그리드, 앞뒤 달 날짜는 dim 처리.
 *  - dot은 항목 유무만 표시(개수 무관).
 *  - "오늘"은 gold 외곽선, "선택된 날"은 gold 채워진 원(둘 다면 채워진 원).
 */

export type MonthCalendarItem = {
  /** 그루핑/dot 판단용 - 로컬 타임존 기준 날짜로 묶는다(시각은 무시). */
  date: Date;
  /** React key */
  id: string;
};

type MonthCalendarProps<T extends MonthCalendarItem> = {
  items: T[];
  renderItem: (item: T) => ReactNode;
  /** 선택된 날에 항목이 없을 때 아래에 보여줄 문구. */
  emptyDayMessage?: string;
};

const WEEKDAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const MONTH_LABELS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
];

export function MonthCalendar<T extends MonthCalendarItem>({
  items,
  renderItem,
  emptyDayMessage = '이 날에는 예정된 항목이 없어요.',
}: MonthCalendarProps<T>) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => startOfDay(new Date()));
  const [viewMonth, setViewMonth] = useState<Date>(() => startOfMonth(new Date()));

  // 날짜별 그루핑 - dot 표시와 선택된 날의 목록에 둘 다 쓴다. key는 로컬 YYYY-MM-DD.
  const itemsByDay = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of items) {
      const key = localDayKey(item.date);
      const bucket = map.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(key, [item]);
      }
    }
    return map;
  }, [items]);

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);
  const selectedKey = localDayKey(selectedDate);
  const selectedItems = itemsByDay.get(selectedKey) ?? [];

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const todayKey = localDayKey(new Date());

  return (
    <View style={styles.root}>
      {/* 월 헤더 */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={8}
          onPress={() => changeMonth(-1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <View style={styles.flipHorizontal}>
            <Icon name="chevronRight" size={16} color={storybookTheme.color.onContent} />
          </View>
        </Pressable>
        <Text style={styles.headerLabel} accessibilityRole="header">
          {viewMonth.getFullYear()}년 {MONTH_LABELS[viewMonth.getMonth()]}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={8}
          onPress={() => changeMonth(1)}
          style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
        >
          <Icon name="chevronRight" size={16} color={storybookTheme.color.onContent} />
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((label, index) => (
          <Text
            key={label}
            style={[
              styles.weekdayLabel,
              index === 0 && styles.weekdayLabelSunday,
              index === 6 && styles.weekdayLabelSaturday,
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* 6주 × 7일 = 42셀. flex로 균등 분배해 태블릿/모바일 양쪽에서 자연스럽게 늘어난다. */}
      <View style={styles.grid}>
        {cells.map((cell, index) => {
          const key = localDayKey(cell.date);
          const inMonth = cell.date.getMonth() === viewMonth.getMonth();
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;
          const hasItems = itemsByDay.has(key);
          const dayOfWeek = index % 7;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={`${cell.date.getMonth() + 1}월 ${cell.date.getDate()}일${hasItems ? ', 항목 있음' : ''}`}
              onPress={() => setSelectedDate(cell.date)}
              style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
            >
              <View
                style={[
                  styles.dayBadge,
                  isToday && !isSelected && styles.dayBadgeToday,
                  isSelected && styles.dayBadgeSelected,
                ]}
              >
                <Text
                  style={[
                    styles.dayNumber,
                    !inMonth && styles.dayNumberOutOfMonth,
                    dayOfWeek === 0 && !isSelected && styles.dayNumberSunday,
                    dayOfWeek === 6 && !isSelected && styles.dayNumberSaturday,
                    isSelected && styles.dayNumberSelected,
                  ]}
                >
                  {cell.date.getDate()}
                </Text>
              </View>
              <View style={styles.dotSlot}>
                {hasItems ? (
                  <View
                    style={[styles.dot, isSelected && styles.dotSelected]}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 선택된 날의 목록 */}
      <View style={styles.list}>
        <Text style={styles.listHeader} accessibilityRole="header">
          {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({WEEKDAY_HEADERS[selectedDate.getDay()]})
        </Text>
        {selectedItems.length === 0 ? (
          <Text style={styles.emptyLabel}>{emptyDayMessage}</Text>
        ) : (
          <View style={styles.listItems}>{selectedItems.map((item) => renderItem(item))}</View>
        )}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ date helpers */

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function localDayKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** 6주 × 7일 = 42셀. 첫 셀은 이달 1일이 속한 주의 일요일. */
function buildMonthCells(viewMonth: Date): { date: Date }[] {
  const firstOfMonth = startOfMonth(viewMonth);
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=일
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - firstDayOfWeek);
  const cells: { date: Date }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + i);
    cells.push({ date: day });
  }
  return cells;
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  root: {
    gap: storybookTheme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
  },
  headerLabel: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  navButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  flipHorizontal: { transform: [{ scaleX: -1 }] },
  pressed: { opacity: 0.7 },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 2,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onContentMuted,
    paddingBottom: storybookTheme.spacing.xs,
  },
  weekdayLabelSunday: { color: storybookTheme.color.calendarSunday },
  weekdayLabelSaturday: { color: storybookTheme.color.calendarSaturday },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  // aspectRatio 대신 고정 height - 넓은 화면에서 그리드가 세로로 불필요하게 길어지지 않게.
  // 36px 뱃지 + 4px dot을 담고 터치 영역을 확보하는 높이.
  cell: {
    width: `${100 / 7}%`,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellPressed: { opacity: 0.7 },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeToday: {
    borderWidth: 1,
    borderColor: storybookTheme.color.gold,
  },
  dayBadgeSelected: {
    backgroundColor: storybookTheme.color.gold,
  },
  dayNumber: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onContent,
    // 자릿수 폭을 같게 해 원 안의 숫자 중심이 밀리지 않게 한다.
    fontVariant: ['tabular-nums'],
  },
  dayNumberOutOfMonth: { color: storybookTheme.color.onContentMuted, opacity: 0.5 },
  dayNumberSunday: { color: storybookTheme.color.calendarSunday },
  dayNumberSaturday: { color: storybookTheme.color.calendarSaturday },
  dayNumberSelected: {
    color: storybookTheme.color.primary,
    fontWeight: storybookTheme.type.weight.black,
  },
  dotSlot: {
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: storybookTheme.color.gold,
  },
  dotSelected: {
    backgroundColor: storybookTheme.color.primary,
  },
  list: {
    gap: storybookTheme.spacing.sm,
  },
  listHeader: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  listItems: {
    gap: storybookTheme.spacing.sm,
  },
  emptyLabel: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onContentMuted,
  },
});
