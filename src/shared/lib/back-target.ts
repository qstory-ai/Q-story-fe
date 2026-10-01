import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * react-router는 히스토리의 첫 항목(주소창·외부 링크로 바로 연 화면)에 key 'default'를 준다 -
 * 그때 navigate(-1)은 앱 밖으로 나가므로 대체 경로로 보낸다.
 */
export function backTarget(locationKey: string, fallback: string): -1 | string {
  return locationKey === 'default' ? fallback : -1;
}

/** "왔던 곳으로, 없으면 fallback으로" 뒤로가기 핸들러. 페이지의 조기 return보다 위에서 호출한다. */
export function useBackOr(fallback: string): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    const target = backTarget(key, fallback);
    if (target === -1) navigate(-1);
    else navigate(target, { replace: true });
  }, [key, fallback, navigate]);
}
