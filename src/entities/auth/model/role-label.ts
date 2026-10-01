import type { Role } from '../api/auth-api';

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '관리자',
  PARENT: '보호자',
  TUTOR: '선생님',
  STAFF: '콘텐츠 운영자',
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}
