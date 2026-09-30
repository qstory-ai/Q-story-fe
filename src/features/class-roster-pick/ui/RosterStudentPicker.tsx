import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RadioGroup, storybookTheme } from '@/shared/ui';
import { listClassRosterByCode, type ClassRosterEntry } from '@/entities/auth';

/**
 * not-needed: 명단에 같은 이름이 있거나(서버가 이름으로 잇는다) 명단이 비어 있다.
 * loading: 명단을 아직 불러오는 중. pending: 같은 이름이 없어 학부모가 골라야 한다.
 * student: 명단의 이 학생과 잇는다. new: 명단에 없는 아이로 새로 올린다.
 */
export type RosterSelection =
  | { kind: 'not-needed' }
  | { kind: 'loading' }
  | { kind: 'pending' }
  | { kind: 'student'; id: string }
  | { kind: 'new' };

/** 명단을 확인하는 중이거나 골라야 하는데 아직 안 골랐으면 가입·연결 버튼을 막는다. */
export function rosterSelectionBlocksSubmit(selection: RosterSelection): boolean {
  return selection.kind === 'loading' || selection.kind === 'pending';
}

const NEW_STUDENT = 'new';
const CLASS_CODE_PATTERN = /^[A-Z0-9]{4,16}$/;
/** 반 코드를 치는 동안 글자마다 조회하지 않는다. */
const ROSTER_FETCH_DELAY_MS = 300;

type RosterLoad = { code: string; entries: ClassRosterEntry[] };
/** 고른 값은 그때의 아이 이름에 묶는다 - 이름(형제 등)이 바뀌면 이전 선택을 이어 쓰지 않는다. */
type Choice = { name: string; value: string };

/** 서버의 findPendingClassmate와 같은 비교 - 공백과 대소문자는 무시한다. */
function normalizeName(name: string) {
  return name.replace(/\s+/g, '').toLowerCase();
}

/**
 * 아이 이름이 선생님 명단과 다를 때(별명, 오타 등) 명단에서 우리 아이를 고르게 한다. 고르지 않고 가입하면 명단에
 * 같은 아이가 한 명 더 생기므로, 같은 이름이 없으면 "명단의 학생" 또는 "명단에 없어요" 중 하나를 꼭 고르게 한다.
 */
export function RosterStudentPicker({
  classCode,
  childName,
  onChange,
}: {
  classCode: string;
  childName: string;
  onChange: (selection: RosterSelection) => void;
}) {
  const code = classCode.trim().toUpperCase();
  const [roster, setRoster] = useState<RosterLoad | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const validCode = CLASS_CODE_PATTERN.test(code);

  useEffect(() => {
    if (!validCode) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      listClassRosterByCode(code)
        .then((entries) => {
          if (!cancelled) setRoster({ code, entries });
        })
        // 명단을 못 불러오면 예전처럼 이름으로만 잇는다 - 가입 자체를 막지는 않는다.
        .catch(() => {
          if (!cancelled) setRoster({ code, entries: [] });
        });
    }, ROSTER_FETCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, validCode]);

  const loaded = roster?.code === code;
  const entries = loaded ? roster.entries : [];
  const wanted = normalizeName(childName);
  const loading = wanted.length > 0 && validCode && !loaded;
  const needsPick = wanted.length > 0 && entries.length > 0 && !entries.some((entry) => normalizeName(entry.name) === wanted);
  // 다른 아이 이름으로 바뀌었거나 고른 학생이 명단에서 사라졌으면 선택도 없던 것으로 본다.
  const chosen = choice && choice.name === wanted ? choice.value : null;
  const effectiveChoice = chosen === NEW_STUDENT || entries.some((entry) => entry.id === chosen) ? chosen : null;

  const selection = useMemo<RosterSelection>(() => {
    if (loading) return { kind: 'loading' };
    if (!needsPick) return { kind: 'not-needed' };
    if (effectiveChoice === NEW_STUDENT) return { kind: 'new' };
    if (effectiveChoice) return { kind: 'student', id: effectiveChoice };
    return { kind: 'pending' };
  }, [loading, needsPick, effectiveChoice]);
  const selectionKey = selection.kind === 'student' ? `student:${selection.id}` : selection.kind;

  useEffect(() => {
    onChange(selection);
    // selectionKey가 바뀔 때만 알린다 - 객체 identity로 의존하면 매 렌더마다 부모 상태를 건드린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  if (!needsPick) return null;
  return (
    <View style={styles.box}>
      <Text style={styles.title}>선생님 명단에서 우리 아이를 골라 주세요</Text>
      <Text style={styles.body}>
        적어 주신 이름이 명단에 없어요. 명단에 다른 이름(별명 등)으로 올라가 있다면 그 이름을 골라 주세요.
      </Text>
      <RadioGroup
        accessibilityLabel="선생님 명단에서 우리 아이 고르기"
        value={effectiveChoice}
        onChange={(value) => setChoice({ name: wanted, value })}
        options={[
          ...entries.map((entry) => ({ value: entry.id, label: entry.name })),
          { value: NEW_STUDENT, label: '명단에 없어요 · 새로 올리기', description: '선생님 명단에 우리 아이가 새로 추가돼요.' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: storybookTheme.spacing.sm,
    padding: storybookTheme.spacing.md,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.surfaceCard,
  },
  title: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
});
