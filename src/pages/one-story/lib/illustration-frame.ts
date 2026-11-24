/**
 * 리더 배경 삽화(16:9)를 화면에 놓는 자리. 가운데 기준 `cover`로 자르면 기기마다 잘리는 곳이 달랐다(10/24 기기별 미리보기):
 * 휴대폰·2:1 태블릿·노트북처럼 화면이 그림보다 넓으면 위아래가 잘려 서 있는 인물 머리가 상단 버튼 줄 밑으로 들어가고,
 * 아이패드(4:3)처럼 좁으면 양옆이 12.5%씩 잘려 화면 끝 인물이 사라졌다.
 *
 * - 화면이 그림보다 넓으면: 너비에 맞추고 위를 붙인다 - 넘치는 건 아래만 잘린다(아래는 자막 자리, 삽화도 아래를 비워 그린다).
 * - 화면이 그림보다 좁으면: 양옆은 한쪽에 MAX_SIDE_CROP까지만 자르고 위를 붙인다 - 남는 아래는 흐린 바탕이 채운다.
 * - 세로 화면(휴대폰 세로)은 위에 붙이면 그림이 손바닥만 하게 뜨고 아래 절반이 흐린 바탕뿐이었다(11/24).
 *   그래서 양옆을 PORTRAIT_SIDE_CROP까지 더 잘라 그림을 키우고, 자막 위 영역의 가운데쯤(PORTRAIT_CENTER)에 놓는다.
 */
export const ILLUSTRATION_ASPECT = 16 / 9;
/** 좁은 화면에서 한쪽에 잘라도 되는 그림 너비 비율. */
export const MAX_SIDE_CROP = 0.06;
/** 세로 화면에서 한쪽에 잘라도 되는 그림 너비 비율. 16:9 그림의 양 끝 인물은 대개 이 안쪽에 있다. */
export const PORTRAIT_SIDE_CROP = 0.14;
/** 세로 화면에서 그림 가운데를 놓을 높이(화면 높이 비율). 아래 자막 카드를 피해 조금 위에 둔다. */
export const PORTRAIT_CENTER = 0.42;

export type IllustrationFrame = { width: number; height: number; left: number; top: number };

export function illustrationFrame(screenWidth: number, screenHeight: number): IllustrationFrame | null {
  if (screenWidth <= 0 || screenHeight <= 0) return null;
  if (screenWidth / screenHeight >= ILLUSTRATION_ASPECT) {
    return { width: screenWidth, height: screenWidth / ILLUSTRATION_ASPECT, left: 0, top: 0 };
  }
  if (screenWidth < screenHeight) {
    const width = screenWidth / (1 - 2 * PORTRAIT_SIDE_CROP);
    const height = width / ILLUSTRATION_ASPECT;
    const top = Math.max(0, screenHeight * PORTRAIT_CENTER - height / 2);
    return { width, height, left: (screenWidth - width) / 2, top };
  }
  // 높이를 꽉 채우는 너비(cover)와 양옆을 MAX_SIDE_CROP씩만 자르는 너비 중 작은 쪽.
  const width = Math.min(screenHeight * ILLUSTRATION_ASPECT, screenWidth / (1 - 2 * MAX_SIDE_CROP));
  return { width, height: width / ILLUSTRATION_ASPECT, left: (screenWidth - width) / 2, top: 0 };
}
