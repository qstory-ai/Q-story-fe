/**
 * 누가 아이와 함께 읽는지 - 시작 화면 문구를 고른다.
 * - CLASS: 반 수업(lessonId) - 선생님이 반 아이들과 읽는다.
 * - TEACHER: 선생님이 학생 한 명과 읽는 세션(tutorStudentId)이거나 선생님·관리자 계정으로 연 이야기.
 * - HOME: 가정에서 보호자와 아이가 읽는다(비로그인 데모 포함).
 */
export type ReadingContext = 'HOME' | 'TEACHER' | 'CLASS';

export function readingContextFor(input: {
  lessonId?: string | null;
  tutorStudentId?: string | null;
  role?: string | null;
}): ReadingContext {
  if (input.lessonId) return 'CLASS';
  if (input.tutorStudentId || input.role === 'TUTOR' || input.role === 'DIRECTOR') return 'TEACHER';
  return 'HOME';
}

/** 시작 화면 큰 제목 - PM이 바꾸기 쉽게 한 곳에 둔다. */
export const IDLE_HEADLINE = '궁금한 걸 물어보면\n이야기가 달라져요';

export function idleSubtitleFor(context: ReadingContext): string {
  switch (context) {
    case 'CLASS':
      return '선생님과 반 아이들이 한 화면에서 듣고, 말하고, 선택하며 끝까지 함께 읽는 이야기예요.';
    case 'TEACHER':
      return '선생님과 아이가 한 화면에서 듣고, 말하고, 선택하며 끝까지 함께 읽는 이야기예요.';
    case 'HOME':
      return '부모님과 아이가 한 화면에서 듣고, 말하고, 선택하며 끝까지 함께 읽는 이야기예요.';
  }
}

export function idleStatusFor(context: ReadingContext): string {
  switch (context) {
    case 'CLASS':
      return '반 아이들과 함께 읽을 준비';
    case 'TEACHER':
      return '선생님과 함께 읽을 준비';
    case 'HOME':
      return '부모님과 함께 읽을 준비';
  }
}
