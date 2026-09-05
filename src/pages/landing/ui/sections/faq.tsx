import type { RefObject } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';

import { assignSectionRef } from '../../lib/section-ref';
import { FAQ_ITEMS } from '../../model/content';
import { sectionStyles } from '../section-styles';

type FaqSectionProps = {
  sectionRef: RefObject<HTMLElement | null>;
};

export function FaqSection({ sectionRef }: FaqSectionProps) {
  return (
    <View
      style={[sectionStyles.section, styles.faqSection]}
      ref={assignSectionRef(sectionRef)}
    >
      <View style={styles.sectionHeading}>
        <Text style={sectionStyles.eyebrow}>자주 묻는 질문</Text>
        <Text style={sectionStyles.sectionTitle} accessibilityRole="header">체험 전,{'\n'}네 가지만 확인하세요.</Text>
      </View>
      <View style={styles.accordion}>
        {FAQ_ITEMS.map((item, index) => (
          <FaqItem key={item.q} question={item.q} answer={item.a} defaultOpen={index === 0} />
        ))}
      </View>
    </View>
  );
}

function FaqItem({ question, answer, defaultOpen = false }: { question: string; answer: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((prev) => !prev)}
      style={styles.faqItem}
    >
      <View style={styles.faqQuestionRow}>
        <Text style={styles.faqQuestion}>{question}</Text>
        <Text style={styles.faqToggle}>{open ? '–' : '+'}</Text>
      </View>
      {open ? <Text style={styles.faqAnswer}>{answer}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // FAQ는 다른 섹션과 달리 옆에 시각 자료 없이 항상 한 컬럼이라, 공유 section의 1040px 폭을
  // 그대로 받으면 답변 문단이 화면 끝까지 늘어져 한 줄이 너무 길어졌다(특히 마지막 음성 저장
  // 문항처럼 여러 문장인 답변). 본문이 읽기 편한 폭(약 640px)을 넘지 않게 좁히고 가운데 둔다.
  faqSection: {
    maxWidth: 640,
  },
  sectionHeading: {
    gap: 10,
  },
  accordion: {
    gap: 10,
  },
  faqItem: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  faqQuestion: {
    flex: 1,
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.md,
    lineHeight: storybookTheme.type.md * storybookTheme.lineHeight.normal,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  faqToggle: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.bold,
  },
  faqAnswer: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21, // lineHeight preserved
    fontWeight: storybookTheme.type.weight.light,
  },
});
