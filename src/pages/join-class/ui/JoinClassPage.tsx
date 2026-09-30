import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import {
  ActionButton,
  ErrorState,
  LoadingState,
  RadioGroup,
  SafeAreaView,
  StatusBanner,
  TextField,
  storybookTheme,
} from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { homePathFor, joinExistingClass, previewClassByCode, useAuth, type ClassPreview } from '@/entities/auth';
import { BirthYearChips, listChildren, type Child } from '@/entities/child';
import { RosterStudentPicker, type RosterSelection } from '@/features/class-roster-pick';

const NEW_CHILD = 'new';

type PreviewState =
  | { code: string; status: 'loading' }
  | { code: string; status: 'ready'; preview: ClassPreview }
  | { code: string; status: 'error'; message: string };

/**
 * 반 초대 링크(`/join?code=반코드`). 선생님이 알림장·단체방에 올린 링크 하나로 부모님이 들어와 어느 기관·반의
 * 초대인지 먼저 확인하고, 가입하거나 로그인한 뒤 자기 아이를 골라 반 명단에 연결된다. 코드 없이 오면 예전처럼
 * 학부모 가입으로 넘긴다.
 */
export function JoinClassPage() {
  const [searchParams] = useSearchParams();
  const code = (searchParams.get('code') ?? '').trim().toUpperCase();
  if (!code) return <Navigate to="/?flow=sign-up&role=parent" replace />;
  return <ClassInvite code={code} />;
}

function ClassInvite({ code }: { code: string }) {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<PreviewState>({ code, status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    previewClassByCode(code)
      .then((preview) => {
        if (!cancelled) setLoad({ code, status: 'ready', preview });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoad({ code, status: 'error', message: messageForError(failure, '반 초대를 확인하지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  const effective: PreviewState = load.code === code ? load : { code, status: 'loading' };
  const here = `/join?code=${encodeURIComponent(code)}`;

  let body;
  if (effective.status === 'loading' || state.status === 'loading') {
    body = <LoadingState label="반 초대를 확인하는 중이에요…" />;
  } else if (effective.status === 'error') {
    body = (
      <View style={styles.card}>
        <ErrorState
          message={effective.message}
          onRetry={() => {
            setLoad({ code, status: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
        <Text style={styles.note}>반 코드가 바뀌었거나 잘못 복사됐을 수 있어요. 선생님께 링크를 다시 받아 주세요.</Text>
        <ActionButton variant="secondaryFull" label="서재로 가기" onPress={() => navigate('/', { replace: true })} />
      </View>
    );
  } else {
    const { preview } = effective;
    body = (
      <>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>{preview.tutorDisplayName ? `${preview.tutorDisplayName} 선생님이 보낸 반 초대` : '반 초대'}</Text>
          <Text style={styles.title}>
            {preview.organizationName ? `${preview.organizationName}\n` : ''}
            {preview.className}
          </Text>
          <Text style={styles.lead}>
            반에 들어오면 유치원에서 함께 읽은 동화와 나눈 이야기를 반 수업 리포트로 받아 보고, 같은 동화를 집에서 아이와 다시 읽을 수 있어요.
          </Text>
        </View>
        {state.status !== 'authenticated' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>우리 아이 반이 맞다면 계속할게요</Text>
            <ActionButton
              variant="gold"
              label="처음이에요 · 계정 만들고 반에 들어가기"
              onPress={() => navigate(`/?flow=sign-up&role=parent&classCode=${encodeURIComponent(code)}`)}
            />
            <ActionButton
              variant="secondaryFull"
              label="이미 계정이 있어요 · 로그인하고 들어가기"
              onPress={() => navigate(`/?flow=sign-in&next=${encodeURIComponent(here)}`)}
            />
          </View>
        ) : state.user.role !== 'PARENT' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>학부모 계정으로만 반에 들어갈 수 있어요</Text>
            <Text style={styles.note}>지금은 학부모가 아닌 계정으로 로그인돼 있어요. 로그아웃한 뒤 학부모 계정으로 이 링크를 다시 열어 주세요.</Text>
            <ActionButton variant="gold" label="로그아웃" onPress={logout} />
          </View>
        ) : (
          <ChildPicker
            token={state.token}
            preview={preview}
            onJoined={(homePath) => navigate(homePath, { replace: true })}
          />
        )}
      </>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 로그인된 학부모 - 이미 등록한 아이를 고르거나 새 아이를 적어 반 명단에 연결한다. */
function ChildPicker({
  token,
  preview,
  onJoined,
}: {
  token: string;
  preview: ClassPreview;
  onJoined: (homePath: string) => void;
}) {
  const { setSession } = useAuth();
  const [children, setChildren] = useState<Child[] | null>(null);
  // 목록을 못 불러왔는데 "아이 없음"으로 보면 이미 있는 아이를 또 만들게 된다 - 오류로 보이고 다시 시도하게 한다.
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [childrenAttempt, setChildrenAttempt] = useState(0);
  const [selected, setSelected] = useState<string>(NEW_CHILD);
  const [childName, setChildName] = useState('');
  const [childBirthYear, setChildBirthYear] = useState<number>(() => new Date().getFullYear() - 6);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<{ childName: string; homePath: string } | null>(null);
  const [rosterSelection, setRosterSelection] = useState<RosterSelection>({ kind: 'not-needed' });

  useEffect(() => {
    let cancelled = false;
    listChildren(token)
      .then((list) => {
        if (cancelled) return;
        setChildren(list);
        if (list.length > 0) setSelected(list[0].id);
      })
      .catch((failure: unknown) => {
        if (!cancelled) setChildrenError(messageForError(failure, '아이 정보를 불러오지 못했어요.'));
      });
    return () => {
      cancelled = true;
    };
  }, [token, childrenAttempt]);

  if (childrenError) {
    return (
      <ErrorState
        message={childrenError}
        onRetry={() => {
          setChildrenError(null);
          setChildrenAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (children === null) return <LoadingState label="아이 정보를 불러오는 중이에요…" />;

  if (joined) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{`${joined.childName}이(가) ${preview.className}에 들어갔어요`}</Text>
        <Text style={styles.note}>반 수업이 끝나면 리포트가 도착했다고 알려드릴게요. 반 연결은 마이페이지 &gt; 수업 연결에서 볼 수 있어요.</Text>
        <ActionButton variant="gold" label="홈으로 가기" onPress={() => onJoined(joined.homePath)} />
      </View>
    );
  }

  const isNew = selected === NEW_CHILD;
  // 명단과 비교할 이름 - 새 아이면 적은 이름, 이미 등록한 아이면 그 아이 이름.
  const nameForRoster = isNew ? childName : (children.find((child) => child.id === selected)?.name ?? '');
  const canSubmit =
    !submitting && (!isNew || childName.trim().length > 0) && rosterSelection.kind !== 'pending';

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const response = await joinExistingClass(
        token,
        {
          ...(isNew
            ? { classCode: preview.classCode, childName: childName.trim(), childBirthYear }
            : { classCode: preview.classCode, childId: selected }),
          rosterStudentId: rosterSelection.kind === 'student' ? rosterSelection.id : undefined,
        },
      );
      // 반 소속으로 기관 이용권이 생길 수 있어 응답의 사용자 정보로 세션을 갱신한다.
      setSession(response.token, response.user);
      const name = isNew ? childName.trim() : (children?.find((child) => child.id === selected)?.name ?? '아이');
      setJoined({ childName: name, homePath: homePathFor(response.user) });
    } catch (failure) {
      setError(messageForError(failure, '반에 들어가지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>어느 아이를 반에 연결할까요?</Text>
      <Text style={styles.note}>선생님 명단에 있는 이름과 같으면 그 학생과 바로 이어지고, 다르면 명단에서 골라 주세요. 아이가 여럿이면 한 명씩 연결해 주세요.</Text>
      <RadioGroup
        accessibilityLabel="반에 연결할 아이"
        value={selected}
        onChange={setSelected}
        options={[
          ...children.map((child) => ({
            value: child.id,
            label: child.name,
            description: child.birthYear ? `${child.birthYear}년생` : undefined,
          })),
          { value: NEW_CHILD, label: children.length > 0 ? '다른 아이 새로 등록' : '아이 등록하기' },
        ]}
      />
      {isNew ? (
        <>
          <TextField label="아이 이름 또는 별명" value={childName} onChangeText={setChildName} placeholder="예: 민서" />
          <BirthYearChips value={childBirthYear} onChange={setChildBirthYear} minAge={3} maxAge={12} />
        </>
      ) : null}
      <RosterStudentPicker classCode={preview.classCode} childName={nameForRoster} onChange={setRosterSelection} />
      {error ? <StatusBanner variant="warning" label={error} /> : null}
      <ActionButton
        variant="gold"
        label={submitting ? '연결하는 중…' : `${preview.className}에 연결하기`}
        onPress={() => {
          void submit();
        }}
        loading={submitting}
        disabled={!canSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingVertical: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.lg,
  },
  hero: { gap: storybookTheme.spacing.sm },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  lead: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ms,
  },
  cardTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  note: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
});
