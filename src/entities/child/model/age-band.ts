import type { AgeBand } from '../api/child-api';

/** IA 상 아이 등록 폼에서 고르게 될 라벨. 표시는 여기, 저장/전송은 AgeBand 문자열로. */
export const AGE_BAND_LABELS: Record<AgeBand, string> = {
  '4-5': '4-5세',
  '6-7': '6-7세',
  '8-9': '8-9세',
  '10-11': '10-11세',
  '12+': '12세 이상',
};

/**
 * 선생님 쪽 학생 등록(TutorStudentNewPage)은 연령대를 "7세"처럼 한 살 단위 라벨로 저장하는데,
 * 부모 쪽 아이 프로필은 위 AgeBand 구간을 쓴다. 선생님 초대로 부모 계정을 만들 때 초대에 실린
 * 아이 연령대를 아이 프로필 폼에 미리 채우려고 라벨 → 구간으로 변환한다. "6-7세" 같은 구간
 * 라벨이나 숫자가 없는 값은 첫 숫자만 보거나, 그마저 없으면 undefined(폼 기본값 유지).
 */
export function ageBandFromLabel(label: string | null | undefined): AgeBand | undefined {
  const match = label?.match(/\d+/);
  if (!match) return undefined;
  const age = Number(match[0]);
  if (age <= 5) return '4-5';
  if (age <= 7) return '6-7';
  if (age <= 9) return '8-9';
  if (age <= 11) return '10-11';
  return '12+';
}

/**
 * 홈의 "아이에게 추천하는 작품" 섹션에서 각 연령대와 매칭될 story.category 후보. story-api의
 * category는 짧은 한글 문자열이라 여기서 세트로 묶어두고, 여러 카테고리를 겹쳐도 되는 연령대는
 * 여러 개를 포함해 폭넓게 매칭한다. 매핑이 비면 최근 순서 그대로 가져와 fallback.
 */
export const AGE_BAND_CATEGORY_HINTS: Record<AgeBand, readonly string[]> = {
  '4-5': ['첫걸음', '유아', '그림책'],
  '6-7': ['모험', '그림책', '탐구'],
  '8-9': ['모험', '탐구', '성장'],
  '10-11': ['성장', '탐구', '고전'],
  '12+': ['고전', '성장'],
};

/* -------------------------------------------------------------- 출생연도(~년생) */

/** 연 나이 = 올해 - 출생연도. 생일을 받지 않으므로 만 나이 대신 이 값을 쓴다(서버 ChildAge와 같은 규칙). */
export function ageFromBirthYear(birthYear: number): number {
  return Math.max(0, new Date().getFullYear() - birthYear);
}

export function ageBandFromBirthYear(birthYear: number): AgeBand {
  const age = ageFromBirthYear(birthYear);
  if (age <= 5) return '4-5';
  if (age <= 7) return '6-7';
  if (age <= 9) return '8-9';
  if (age <= 11) return '10-11';
  return '12+';
}

/** 선택 칩에 쓸 출생연도 목록 - 어린 순(올해-minAge)부터. */
export function birthYearOptions(minAge = 4, maxAge = 12): number[] {
  const year = new Date().getFullYear();
  const years: number[] = [];
  for (let age = minAge; age <= maxAge; age += 1) years.push(year - age);
  return years;
}

/** "2019년생 · 7세" */
export function formatBirthYear(birthYear: number): string {
  return `${birthYear}년생 · ${ageFromBirthYear(birthYear)}세`;
}

/** 출생연도가 있으면 그것으로, 없는 예전 프로필은 저장된 연령대/라벨로 표시한다. */
export function formatChildAge(child: { birthYear?: number | null; ageBand: AgeBand }): string {
  return child.birthYear ? formatBirthYear(child.birthYear) : AGE_BAND_LABELS[child.ageBand];
}

export function formatStudentAge(student: { birthYear?: number | null; ageBand: string }): string {
  return student.birthYear ? formatBirthYear(student.birthYear) : student.ageBand;
}

/** 출생연도가 없는 예전 프로필을 편집할 때 칩의 초기 선택 - 연령대 구간의 가운데 나이로. */
export function defaultBirthYearForBand(band?: AgeBand | string | null): number {
  const year = new Date().getFullYear();
  const match = band?.match(/\d+/);
  const age = match ? Number(match[0]) : 7;
  return year - Math.min(Math.max(age, 4), 12);
}
