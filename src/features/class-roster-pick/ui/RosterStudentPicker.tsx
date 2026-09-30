import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RadioGroup, storybookTheme } from '@/shared/ui';
import { listClassRosterByCode, type ClassRosterEntry } from '@/entities/auth';

/**
 * not-needed: 명단에 같은 이름이 있거나(서버가 이름으로 잇는다) 명단이 비어 있다.
 * pending: 같은 이름이 없어 학부모가 골라야 한다. student: 명단의 이 학생과 잇는다. new: 명단에 없는 아이로 새로 올린다.
 */
export type RosterSelection =
  | { kind: 'not-needed' }
  | { kind: 'pending' }
  | { kind: 'student'; id: string }
  | { kind: 'new' };

const NEW_STUDENT = 'new';

type RosterLoad = { code: string; entries: ClassRosterEntry[] };

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
  const [choice, setChoice] = useState<string | null>(null);

  useEffect(() => {
    if (code.length < 4) return;
    let cancelled = false;
    listClassRosterByCode(code)
      .then((entries) => {
        if (!cancelled) setRoster({ code, entries });
      })
      // 명단을 못 불러오면 예전처럼 이름으로만 잇는다 - 가입 자체를 막지는 않는다.
      .catch(() => {
        if (!cancelled) setRoster({ code, entries: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const entries = roster?.code === code ? roster.entries : [];
  const wanted = normalizeName(childName);
  const needsPick = wanted.length > 0 && entries.length > 0 && !entries.some((entry) => normalizeName(entry.name) === wanted);
  // 이름을 고치거나 명단이 바뀌어 고른 학생이 목록에서 사라지면 선택도 없던 것으로 본다.
  const effectiveChoice = choice === NEW_STUDENT || entries.some((entry) => entry.id === choice) ? choice : null;

  const selection = useMemo<RosterSelection>(() => {
    if (!needsPick) return { kind: 'not-needed' };
    if (effectiveChoice === NEW_STUDENT) return { kind: 'new' };
    if (effectiveChoice) return { kind: 'student', id: effectiveChoice };
    return { kind: 'pending' };
  }, [needsPick, effectiveChoice]);
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
        onChange={setChoice}
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
