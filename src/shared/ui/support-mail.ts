import { Linking } from 'react-native';

/** 문의 메일 주소 - 소개 화면 문의 버튼과 마이페이지 고객지원·설정이 함께 쓴다. */
export const SUPPORT_EMAIL = 'qstoryai@gmail.com';

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
