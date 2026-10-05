import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, SelectField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { listTutorClasses, type TutorClass } from '@/entities/tutor';
import { listMyOrganizations, type TutorOrganizationLink } from '@/entities/organization-tutor';

type Props = {
  token: string;
  /** 고른 반 id. 아직 안 골랐으면 null. */
  value: string | null;
  /** 반 이름도 함께 준다 - 수업 이름을 비워 두면 "{반 이름} 수업"으로 쓴다. */
  onChange: (classGroupId: string, className: string) => void;
  /** 반이 하나도 없을 때 "새 반 만들기" - 반 만들기 화면으로 보낸다(반 만들기 진입점은 반·학생 화면 하나로 모았다). */
  onCreateClass: () => void;
};

type ClassesLoad =
  | { status: 'loading' }
  | { status: 'ready'; classes: TutorClass[]; organizations: TutorOrganizationLink[] }
  | { status: 'error'; message: string };

/**
 * 선생님이 수업을 반에 넣을 때 쓰는 반 선택기. 수업은 언제나 반 수업이라(1:1 과외도 아이 한 명짜리 반) 개인
 * 레슨/반 수업을 고르는 단계 없이 반만 고른다. 보이는 반 = 내가 담임인 반(GET /v1/tutor-classes).
 *
 * <p>예전에는 이 자리에서 반 이름만 받아 바로 만들 수 있었지만, 반 만들기 진입점을 반·학생 화면 하나로 모으면서(Q-35)
 * 반이 없을 때는 반 만들기 화면으로 보낸다 - 그 화면이 초대 링크까지 바로 보여 준다.
 */
export function TutorClassPicker({ token, value, onChange, onCreateClass }: Props) {
  const [load, setLoad] = useState<ClassesLoad>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listTutorClasses(token), listMyOrganizations(token).catch(() => [] as TutorOrganizationLink[])])
      .then(([classes, organizations]) => {
        if (!cancelled) setLoad({ status: 'ready', classes, organizations });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: messageForError(failure, '반 목록을 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  const classOptions = useMemo(() => {
    if (load.status !== 'ready') return [];
    const orgNameById = new Map(load.organizations.map((org) => [org.organizationId, org.organizationName]));
    return load.classes.map((cls) => {
      const orgName = cls.organizationId ? orgNameById.get(cls.organizationId) : null;
      return { value: cls.id, label: orgName ? `${cls.name} · ${orgName}` : cls.name };
    });
  }, [load]);

  // 반이 하나뿐이면 고를 것이 없다 - 바로 그 반으로 정해 한 단계를 줄인다.
  const onlyClass = load.status === 'ready' && load.classes.length === 1 ? load.classes[0] : null;
  useEffect(() => {
    if (onlyClass && value == null) onChange(onlyClass.id, onlyClass.name);
  }, [onlyClass, value, onChange]);

  return (
    <View style={styles.container}>
      {load.status === 'loading' ? (
        <Text style={styles.helper}>반 목록을 불러오는 중이에요…</Text>
      ) : load.status === 'error' ? (
        <>
          <Text style={styles.error}>{load.message}</Text>
          <ActionButton variant="secondaryFull" label="다시 시도" onPress={() => setReloadKey((n) => n + 1)} />
        </>
      ) : classOptions.length === 0 ? (
        <>
          <Text style={styles.helper}>수업은 반과 함께 만들어요. 먼저 반을 만들어 주세요 - 1:1 과외도 아이 한 명짜리 반이면 돼요.</Text>
          <ActionButton variant="secondaryFull" label="새 반 만들기" onPress={onCreateClass} />
        </>
      ) : (
        <SelectField
          label="반 선택"
          placeholder="반을 골라 주세요"
          options={classOptions}
          value={value}
          onChange={(next) => {
            const picked = load.classes.find((cls) => cls.id === next);
            onChange(next, picked?.name ?? '');
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: storybookTheme.spacing.sm },
  helper: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onLightMuted,
  },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
});
