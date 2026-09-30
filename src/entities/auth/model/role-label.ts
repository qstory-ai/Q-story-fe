import type { Role } from '../api/auth-api';

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '기관 및 단체',
  PARENT: '학부모',
  TUTOR: '선생님',
  STAFF: '콘텐츠 운영자',
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role];
}
