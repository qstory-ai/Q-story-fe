import { Linking } from 'react-native';

import { SUPPORT_EMAIL } from '@/shared/config';

/** 문의 메일 주소는 shared/config의 SUPPORT_EMAIL 하나로 둔다 - 소개 화면·마이페이지 화면이 이 경로로도 쓴다. */
export { SUPPORT_EMAIL };

export function supportMailHref(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/** 메일 앱을 연다. 열지 못하면(메일 앱 없음 등) 주소를 알려 준다 - 주소는 화면에도 함께 적어 둔다. */
export async function openSupportMail(subject: string): Promise<void> {
  try {
    await Linking.openURL(supportMailHref(subject));
  } catch {
    if (typeof window !== 'undefined') window.alert?.(`문의 메일: ${SUPPORT_EMAIL}`);
  }
}
