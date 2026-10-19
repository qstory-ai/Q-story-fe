/**
 * 질문 초대 대사가 무엇을 묻는지 - "궁금한 게 있어?"처럼 궁금증을 묻는지, "어떻게 하면 좋을까?"처럼 아이의 방법(생각)을
 * 묻는지. 초대 카드의 버튼·안내 문구를 질문에 맞춘다(방법을 묻는데 "궁금한 거 물어보기"가 뜨지 않게).
 */
export type InviteAskKind = 'curiosity' | 'idea';

const IDEA_PATTERN = /어떻게|좋을까|방법/;

export function inviteAskKind(prompt: string): InviteAskKind {
  return IDEA_PATTERN.test(prompt) ? 'idea' : 'curiosity';
}

export function inviteAskCopy(kind: InviteAskKind): { askLabel: string; help: string } {
  return kind === 'idea'
    ? { askLabel: '내 생각 말하기', help: '생각나는 방법을 말해 봐요. 없으면 이야기를 계속 들어도 돼요.' }
    : { askLabel: '궁금한 거 물어보기', help: '궁금한 게 있으면 물어봐요. 없으면 이야기를 계속 들어도 돼요.' };
}
