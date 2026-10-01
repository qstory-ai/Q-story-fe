import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, SelectField, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { createTutorClass, listTutorClasses, type TutorClass } from '@/entities/tutor';
import { listMyOrganizations, type TutorOrganizationLink } from '@/entities/organization-tutor';

type Props = {
  token: string;
  /** 고른 반 id. 아직 안 골랐으면 null. */
  value: string | null;
  onChange: (classGroupId: string) => void;
};

type ClassesLoad =
  | { status: 'loading' }
  | { status: 'ready'; classes: TutorClass[]; organizations: TutorOrganizationLink[] }
  | { status: 'error'; message: string };

/**
 * 선생님이 수업을 반에 넣을 때 쓰는 공용 선택기. 수업은 언제나 반 수업이라(1:1 과외도 아이 한 명짜리 반)
 * 개인 레슨/반 수업을 고르는 단계 없이 반만 고르거나 만든다. 보이는 반 = 내가 만든 반 + 소속 기관의 반
 * (GET /v1/tutor-classes). 목록에 없으면 이 자리에서 바로 새 반을 만들 수 있고, 소속 기관이 있으면
 * 그 기관 안의 반으로 만들지 고를 수 있다(관리자의 반 목록에도 함께 보인다).
 */
export function TutorClassPicker({ token, value, onChange }: Props) {
  const [load, setLoad] = useState<ClassesLoad>({ status: 'loading' });
  const [newClassName, setNewClassName] = useState('');
  const [newClassOrganizationId, setNewClassOrganizationId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
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

  const createClass = useCallback(async () => {
    const name = newClassName.trim();
    if (!name || load.status !== 'ready') return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createTutorClass(token, {
        name,
        organizationId: newClassOrganizationId ?? undefined,
      });
      setLoad({ status: 'ready', classes: [...load.classes, created], organizations: load.organizations });
      setNewClassName('');
      onChange(created.id);
    } catch (failure: unknown) {
      setCreateError(messageForError(failure, '반을 만들지 못했어요.'));
    } finally {
      setCreating(false);
    }
  }, [newClassName, newClassOrganizationId, load, token, onChange]);

  return (
    <View style={styles.container}>
      {load.status === 'loading' ? (
        <Text style={styles.helper}>반 목록을 불러오는 중이에요…</Text>
      ) : load.status === 'error' ? (
        <>
          <Text style={styles.error}>{load.message}</Text>
          <ActionButton variant="secondaryFull" label="다시 시도" onPress={() => setReloadKey((n) => n + 1)} />
        </>
      ) : (
        <>
          {classOptions.length > 0 ? (
            <SelectField
              label="반 선택"
              placeholder="반을 골라 주세요"
              options={classOptions}
              value={value}
              onChange={onChange}
            />
          ) : (
            <Text style={styles.helper}>아직 반이 없어요. 아래에서 첫 반을 만들어 주세요.</Text>
          )}
          <View style={styles.newClassRow}>
            <View style={styles.newClassField}>
              <TextField
                label={classOptions.length > 0 ? '새 반 만들기 · 선택' : '새 반 이름'}
                value={newClassName}
                onChangeText={setNewClassName}
                placeholder="예: 화요일 오후 반"
                maxLength={60}
              />
            </View>
          </View>
          {load.organizations.length > 0 && newClassName.trim() ? (
            <SelectField
              label="새 반의 소속"
              description="기관 안의 반으로 만들면 관리자의 반 목록에도 보여요."
              options={[
                { value: '', label: '내 개인 반' },
                ...load.organizations.map((org) => ({ value: org.organizationId, label: org.organizationName })),
              ]}
              value={newClassOrganizationId ?? ''}
              onChange={(next) => setNewClassOrganizationId(next === '' ? null : next)}
            />
          ) : null}
          {createError ? <Text style={styles.error}>{createError}</Text> : null}
          {newClassName.trim() ? (
            <ActionButton
              variant="secondaryFull"
              label={creating ? '반 만드는 중…' : '이 이름으로 반 만들기'}
              onPress={createClass}
              loading={creating}
              disabled={creating}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: storybookTheme.spacing.sm },
  newClassRow: { flexDirection: 'row', alignItems: 'flex-end', gap: storybookTheme.spacing.sm },
  newClassField: { flex: 1 },
  helper: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onLightMuted,
  },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
});
