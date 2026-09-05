import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';

import { styles } from '../styles';

type LoadingPanelProps = {
  title: ReactNode;
  body: string;
  /** 복구 액션(질문 다시 하기/건너뛰기 등) - processing-panel처럼 있는 경우에만 넘긴다. */
  actions?: ReactNode;
};

/**
 * 로딩 상태 화면 3곳(질문 처리 중, 실시간 분기 생성 중, 응답 음성 준비 중)이 공유하던 시각
 * 언어 - 스피너 + 제목 + 본문 + 점 3개 - 를 한 곳으로 모았다. 문구와, 있다면 복구 액션만
 * 호출부가 정한다.
 */
export function LoadingPanel({ title, body, actions }: LoadingPanelProps) {
  return (
    <View style={styles.loadingGroup}>
      <ActivityIndicator color={storybookTheme.color.gold} size="large" />
      <Text style={styles.loadingTitle}>{title}</Text>
      <Text style={styles.loadingBody}>{body}</Text>
      <View style={styles.loadingDots}>
        <View style={styles.loadingDot} />
        <View style={styles.loadingDot} />
        <View style={styles.loadingDot} />
      </View>
      {actions}
    </View>
  );
}
