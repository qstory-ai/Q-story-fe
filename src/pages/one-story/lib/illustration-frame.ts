/**
 * 리더 배경 삽화(16:9)를 화면에 놓는 자리. 가운데 기준 `cover`로 자르면 기기마다 잘리는 곳이 달랐다(10/24 기기별 미리보기):
 * 휴대폰·2:1 태블릿·노트북처럼 화면이 그림보다 넓으면 위아래가 잘려 서 있는 인물 머리가 상단 버튼 줄 밑으로 들어가고,
 * 아이패드(4:3)처럼 좁으면 양옆이 12.5%씩 잘려 화면 끝 인물이 사라졌다.
 *
 * - 화면이 그림보다 넓으면: 너비에 맞추고 위를 붙인다 - 넘치는 건 아래만 잘린다(아래는 자막 자리, 삽화도 아래를 비워 그린다).
 * - 화면이 그림보다 좁으면: 양옆은 한쪽에 MAX_SIDE_CROP까지만 자르고 위를 붙인다 - 남는 아래는 흐린 바탕이 채운다.
 */
export const ILLUSTRATION_ASPECT = 16 / 9;
/** 좁은 화면에서 한쪽에 잘라도 되는 그림 너비 비율. */
export const MAX_SIDE_CROP = 0.06;

export type IllustrationFrame = { width: number; height: number; left: number; top: number };

export function illustrationFrame(screenWidth: number, screenHeight: number): IllustrationFrame | null {
  if (screenWidth <= 0 || screenHeight <= 0) return null;
  if (screenWidth / screenHeight >= ILLUSTRATION_ASPECT) {
    return { width: screenWidth, height: screenWidth / ILLUSTRATION_ASPECT, left: 0, top: 0 };
  }
  // 높이를 꽉 채우는 너비(cover)와 양옆을 MAX_SIDE_CROP씩만 자르는 너비 중 작은 쪽.
  const width = Math.min(screenHeight * ILLUSTRATION_ASPECT, screenWidth / (1 - 2 * MAX_SIDE_CROP));
  return { width, height: width / ILLUSTRATION_ASPECT, left: (screenWidth - width) / 2, top: 0 };
}
