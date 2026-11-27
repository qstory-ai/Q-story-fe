import type { ClassStudentResponse } from '@/entities/auth';
import type { StoryCatalogEntry } from '@/entities/story';

/** 체험 모드에서 이름을 누르면 바로 읽을 이야기 - 이용권 없이 열리는 이야기 중 헨젤과 그레텔을 먼저 고른다. */
export function pickKioskStory(stories: readonly StoryCatalogEntry[]): StoryCatalogEntry | null {
  const open = stories.filter((story) => !story.requiresEntitlement);
  const pool = open.length > 0 ? open : stories;
  return pool.find((story) => /hansel|hg/i.test(story.slug)) ?? pool[0] ?? null;
}

/** 이름 버튼 순서 - 가나다순. 같은 이름이 둘이면 먼저 올린 학생이 앞이다. */
export function sortKioskStudents(students: readonly ClassStudentResponse[]): ClassStudentResponse[] {
  return students
    .filter((student) => !student.endedAt)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.createdAt.localeCompare(b.createdAt));
}

/** 같은 이름이 둘 이상이면 버튼에 구분 표시를 붙여야 한다. */
export function duplicateNames(students: readonly ClassStudentResponse[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const student of students) {
    if (seen.has(student.name)) dup.add(student.name);
    seen.add(student.name);
  }
  return dup;
}

/**
 * 다 읽은 뒤 화면에서 무엇을 보여 줄지.
 * - linked: 보호자가 이미 이어져 있어 리포트가 그쪽으로 갔다.
 * - claim: 현장에서 올린 학생 - 보호자가 QR로 가입하면 오늘 기록까지 보인다.
 * - teacher: 보호자도 연결 코드도 없다(선생님이 미리 올린 명단 학생) - 선생님께 연결을 부탁한다.
 */
export type KioskDoneView =
  | { kind: 'linked'; parentName: string | null }
  | { kind: 'claim'; link: string }
  | { kind: 'teacher' };

export function kioskDoneView(
  student: Pick<ClassStudentResponse, 'status' | 'parentDisplayName' | 'parentClaimCode'>,
  inviteLink: string | null,
): KioskDoneView {
  if (student.status === 'CONFIRMED' || student.parentDisplayName) {
    return { kind: 'linked', parentName: student.parentDisplayName };
  }
  if (student.parentClaimCode && inviteLink) {
    const separator = inviteLink.includes('?') ? '&' : '?';
    return { kind: 'claim', link: `${inviteLink}${separator}claim=${encodeURIComponent(student.parentClaimCode)}` };
  }
  return { kind: 'teacher' };
}
