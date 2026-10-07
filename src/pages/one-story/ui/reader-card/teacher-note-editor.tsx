import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';
import { saveTeacherNote, type TeacherNote } from '@/entities/story-completion';

const MAX_NOTE = 1000;

/**
 * 수업 기록의 교사 메모 두 칸(Q-39) - "나만 보기"는 선생님(과 같은 기관 관리자)만, "부모에게 공유"는 부모 리포트의
 * 선생님 한마디로 간다. 저장 실패는 이 칸에만 알리고 리포트 자체는 그대로 둔다.
 */
export function TeacherNoteEditor({
  token,
  completionId,
  initial,
  onSaved,
}: {
  token: string;
  completionId: string;
  initial: TeacherNote | null | undefined;
  onSaved?: (note: TeacherNote) => void;
}) {
  const [internal, setInternal] = useState(initial?.internal ?? '');
  const [forParents, setForParents] = useState(initial?.forParents ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = () => {
    setState('saving');
    saveTeacherNote(token, completionId, {
      internal: internal.trim() || null,
      forParents: forParents.trim() || null,
    })
      .then((saved) => {
        setState('saved');
        onSaved?.(saved);
      })
      .catch(() => setState('error'));
  };

  return (
    <View style={note.stack}>
      <Text style={note.label}>나만 보기</Text>
      <TextInput
        value={internal}
        onChangeText={(value) => {
          setInternal(value.slice(0, MAX_NOTE));
          setState('idle');
        }}
        placeholder="다음 수업에 참고할 메모(부모에게 보이지 않아요)"
        placeholderTextColor={storybookTheme.color.onCardMuted}
        accessibilityLabel="나만 보는 교사 메모"
        multiline
        maxLength={MAX_NOTE}
        style={note.input}
      />
      <Text style={note.label}>부모에게 공유</Text>
      <TextInput
        value={forParents}
        onChangeText={(value) => {
          setForParents(value.slice(0, MAX_NOTE));
          setState('idle');
        }}
        placeholder="오늘 수업에 대해 부모님께 전할 한마디"
        placeholderTextColor={storybookTheme.color.onCardMuted}
        accessibilityLabel="부모에게 공유하는 교사 메모"
        multiline
        maxLength={MAX_NOTE}
        style={note.input}
      />
      <View style={note.row}>
        <Pressable
          accessibilityRole="button"
          onPress={save}
          disabled={state === 'saving'}
          style={[note.button, state === 'saving' && note.buttonDisabled]}
        >
          <Text style={note.buttonText}>{state === 'saving' ? '저장 중…' : '메모 저장'}</Text>
        </Pressable>
        {state === 'saved' && <Text style={note.status}>저장했어요. 보호자 리포트에 공유 칸이 바로 보여요.</Text>}
        {state === 'error' && <Text style={note.error}>저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.</Text>}
      </View>
    </View>
  );
}

const note = StyleSheet.create({
  stack: { gap: 8 },
  label: { color: storybookTheme.color.onCardTitle, fontSize: 13, fontWeight: storybookTheme.type.weight.semibold },
  input: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.sm,
    textAlignVertical: 'top',
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  button: { borderRadius: 999, backgroundColor: storybookTheme.color.primary, paddingHorizontal: 16, paddingVertical: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: storybookTheme.color.onDark, fontSize: 14, fontWeight: storybookTheme.type.weight.semibold },
  status: { color: storybookTheme.color.onCardMuted, fontSize: 13 },
  error: { color: storybookTheme.color.error, fontSize: 13 },
});
