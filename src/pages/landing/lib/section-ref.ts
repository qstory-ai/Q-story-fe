import type { RefObject } from 'react';

/**
 * react-native-web의 View는 DOM 노드를 그대로 ref로 넘겨주지만 타입은 알려주지 않는다 -
 * 스크롤 앵커로 쓰기 위해 HTMLElement로 캐스팅해 sectionRef에 채워 넣는 콜백을 각 섹션이
 * 반복 작성하던 것을 모았다.
 */
export function assignSectionRef(sectionRef: RefObject<HTMLElement | null>) {
  return (node: unknown) => {
    sectionRef.current = node as HTMLElement | null;
  };
}
