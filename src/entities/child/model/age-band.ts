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
