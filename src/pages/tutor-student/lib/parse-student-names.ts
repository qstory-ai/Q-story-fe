/** 서버(TutorStudentService.BULK_STUDENT_LIMIT)와 같은 값 - 넘으면 서버가 전체를 거절한다. */
export const BULK_STUDENT_LIMIT = 50;

/**
 * 붙여넣은 명단에서 학생 이름을 뽑는다. 줄바꿈·쉼표·탭으로 나누고 앞뒤 공백을 지우며 빈 칸은 버린다.
 * 같은 이름이 두 번 나오면 두 번째부터는 duplicates에 모으고 names에서는 뺀다 - 같은 아이를 두 번 등록해
 * 초대가 두 장 나가는 실수를 막기 위함이다(정말 동명이인이면 이름 뒤에 구분을 붙여 다시 넣으면 된다).
 */
export function parseStudentNames(raw: string): { names: string[]; duplicates: string[] } {
  const seen = new Set<string>();
  const names: string[] = [];
  const duplicates: string[] = [];
  for (const piece of raw.split(/[\n,\t]+/)) {
    const name = piece.trim();
    if (!name) continue;
    const key = name.replace(/\s+/g, '').toLowerCase();
    if (seen.has(key)) {
      duplicates.push(name);
      continue;
    }
    seen.add(key);
    names.push(name);
  }
  return { names, duplicates };
}
