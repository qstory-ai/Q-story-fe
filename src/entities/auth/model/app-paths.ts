/**
 * 선생님·관리자 화면 경로를 한 곳에 둔다(Q-35). 반(ClassGroup)은 classes, 수업(Lesson)은 lessons다.
 * 예전 경로는 legacyRedirectPath가 새 경로로 옮긴다 - 북마크·알림 링크가 계속 열리게.
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
  /** 리포트 탭 - 이용 현황과 기관 리포트를 합친 화면. */
  reports: '/organization/reports',
} as const;

export function reportDetailPath(completionId: string): string {
  return `/reports/${completionId}`;
}

/**
 * 예전 경로 → 새 경로. 해당 없으면 null. 쿼리·해시는 호출부가 그대로 붙인다.
 *  - /tutor/students            → /tutor/classes (반·학생 목록. 학생 상세 /tutor/students/:id는 그대로)
 *  - /tutor/class-groups/new    → /tutor/classes/new
 *  - /tutor/class-groups/:id    → /tutor/classes/:id
 *  - /organization/usage        → /organization/reports (이용 현황 + 기관 리포트 통합)
 *
 * 예전 /tutor/classes(수업 목록)는 이제 반·학생 목록이라 옮기지 않는다 - 그 자리가 새 화면이다.
 */
export function legacyRedirectPath(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/tutor/students') return TUTOR_PATHS.classes;
  if (path === '/tutor/class-groups') return TUTOR_PATHS.classes;
  if (path === '/tutor/class-groups/new') return TUTOR_PATHS.newClass;
  const classGroup = path.match(/^\/tutor\/class-groups\/([^/]+)$/);
  if (classGroup) return TUTOR_PATHS.classDetail(classGroup[1]);
  if (path === '/organization/usage') return ORGANIZATION_PATHS.reports;
  return null;
}
