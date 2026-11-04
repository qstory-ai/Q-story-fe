/**
 * 선생님·관리자 화면 경로를 한 곳에 둔다(Q-35). 반(ClassGroup)은 classes, 수업(Lesson)은 lessons다.
 * 예전 경로는 shared/config legacy-redirects가 새 경로로 옮긴다 - 북마크·알림 링크가 계속 열리게.
 */
export const TUTOR_PATHS = {
  /** 반·학생 탭 - 내 반 목록과 반에 들어온 아이. */
  classes: '/tutor/classes',
  newClass: '/tutor/classes/new',
  classDetail: (classId: string) => `/tutor/classes/${classId}`,
  student: (studentId: string) => `/tutor/students/${studentId}`,
  /** 수업 탭 - 예정/진행/완료 수업. */
  lessons: '/tutor/lessons',
  lesson: (lessonId: string) => `/tutor/lessons/${lessonId}`,
} as const;

export const ORGANIZATION_PATHS = {
  classes: '/organization/classes',
  classDetail: (classId: string) => `/organization/classes/${classId}`,
  student: (classId: string, studentId: string) => `/organization/classes/${classId}/students/${studentId}`,
  /** 학기 마무리 - 반의 지금 학생마다 다음 반·그대로·수료를 정한다. */
  termTransition: (classId: string) => `/organization/classes/${classId}/term`,
  /** 리포트 탭 - 이용 현황과 기관 리포트를 합친 화면. */
  reports: '/organization/reports',
} as const;

export function reportDetailPath(completionId: string): string {
  return `/reports/${completionId}`;
}
