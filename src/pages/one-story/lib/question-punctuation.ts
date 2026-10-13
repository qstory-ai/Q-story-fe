/**
 * 받아 적은 아이 말(STT)에는 물음표가 없다 - "새를 어떻게 살펴보면 좋을 거 같애."처럼 묻는 말도 마침표로
 * 끝나 말풍선이 질문으로 안 읽힌다. 한국어 의문형 어미로 끝나면 끝에 "?"를 붙인다.
 *
 * 일부러 보수적으로 둔다 - 틀려서 평서문에 "?"가 붙는 것보다, 질문에 "?"가 빠지는 쪽이 낫다.
 * - 어미만 보고 질문으로 보는 것: …까(요) / …니 / …냐 / …나요
 * - 의문사(어떻게·왜·뭐·누가·언제·어디·어때 등)가 있을 때만 질문으로 보는 것: …어·…아·…애·…에·…야·…워·…돼 같은
 *   받침 없는 끝소리("같애"·"같에"·"돼"·"어때"·"뭐야"), …지·…죠·…요
 * - 의문사가 있어도 질문으로 안 보는 것: "왜 그런지 알아"처럼 의문사가 …지 마디 안에 묻힌 말(간접 의문),
 *   "뭐 그냥 좋았어"처럼 말버릇으로 쓴 "뭐"
 */

// 어미 하나로 질문이 되는 끝말. "아까"·"언니"처럼 그 글자로 끝나는 낱말은 아래에서 뺀다.
const STRONG_QUESTION_ENDING = /(까요?|니|냐|나요)$/;
const STRONG_ENDING_FALSE_WORDS = new Set(['아까', '까까', '언니', '어머니', '할머니']);

// 이어 말하는 끝말("…보니까", "…갔더니")은 까·니로 끝나도 질문이 아니다.
const CONNECTIVE_ENDING = /(니까요?|더니)$/;

// 의문사가 있어야 질문으로 보는 끝말(반말·존댓말 섞임). 받침 없는 아/어 계열 끝소리("같애", "주워", "뭐야",
// "돼")와 지·죠·요. 받아쓰기가 "같애"를 "같에"로 적기도 해 "에"도 넣는다(ㅔ 전체는 아니다 - "…건데"는
// 묻는 말이 아닐 때가 많다). 다·라·자("갔다", "해라", "가자")는 묻는 말이 아니라 뺀다.
const SOFT_ENDING_VOWELS = new Set([0, 1, 2, 4, 6, 9, 10, 14]); // ㅏ ㅐ ㅑ ㅓ ㅕ ㅘ ㅙ ㅝ
const SOFT_ENDING_SYLLABLES = new Set(['지', '죠', '요', '에']);
const NOT_SOFT_ENDING_SYLLABLES = new Set(['다', '라', '자', '나', '마']);

function hasSoftQuestionEnding(word: string): boolean {
  const last = word.at(-1) ?? '';
  if (SOFT_ENDING_SYLLABLES.has(last)) return true;
  if (NOT_SOFT_ENDING_SYLLABLES.has(last)) return false;
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return false;
  const hasBatchim = code % 28 !== 0;
  return !hasBatchim && SOFT_ENDING_VOWELS.has(Math.floor(code / 28) % 21);
}

// 낱말 앞부분이 이것이면 의문사. 조사가 붙어도("어디에", "뭘", "누구랑") 잡는다.
const QUESTION_WORD_PREFIXES = ['어떻게', '어떡', '어때', '어땠', '어째서', '왜', '뭐', '뭘', '무엇', '무슨', '누가', '누구', '언제', '어디', '얼마', '몇', '어느'];
// 의문사로 시작하지만 묻는 뜻이 아닌 낱말("뭐든지", "언제나", "왜냐하면", "누구나", "어디든").
const NOT_QUESTION_WORD = /^(뭐든|뭐라도|무엇이든|무엇보다|누구나|누구든|누구라도|언제나|언제든|언젠가|어디나|어디든|어디라도|왜냐|몇몇|어느새|어느덧|어느날)/;

const TRAILING_SOFT_PUNCTUATION = /[.。…~\s]+$/;

// 말버릇 "뭐"("뭐 그냥 좋았어") - 바로 뒤에 이런 말이 오면 묻는 뜻이 아니다.
const FILLER_AFTER_MWO = new Set(['그냥', '별로', '그런', '그래도', '어쨌든', '암튼', '아무튼']);
// "그런지"·"있는지"·"할지"·"뭔지" - 의문사가 이런 마디 안에 있으면 문장 전체는 묻는 말이 아닐 수 있다(간접 의문).
const EMBEDDED_CLAUSE_END = /지(를|도|는|가)?$/;

function isQuestionWord(word: string, next: string | undefined): boolean {
  if (NOT_QUESTION_WORD.test(word)) return false;
  if (word === '뭐' && next !== undefined && FILLER_AFTER_MWO.has(next)) return false;
  return QUESTION_WORD_PREFIXES.some((prefix) => word.startsWith(prefix));
}

/** 의문사가 있고, 그 뒤(마지막 낱말 앞)에 …지 마디로 묻히지 않았는지. */
function hasQuestionWord(words: readonly string[]): boolean {
  const last = words.length - 1;
  return words.some((word, index) => {
    if (!isQuestionWord(word, words[index + 1])) return false;
    const embedded = words.slice(index, last).some((w) => EMBEDDED_CLAUSE_END.test(w));
    return !embedded;
  });
}

/** 의문형 어미로 끝나는 한국어 문장인지 - 문장 끝의 마침표·말줄임표는 무시한다. */
export function looksLikeKoreanQuestion(text: string): boolean {
  const body = text.trim().replace(TRAILING_SOFT_PUNCTUATION, '');
  if (!body || /[?!？！]$/.test(body)) return false;
  const words = body.split(/\s+/).map((word) => word.replace(/[,.·"'“”‘’()]/g, '')).filter(Boolean);
  const lastWord = words.at(-1) ?? '';
  if (!/[가-힣]$/.test(lastWord)) return false;
  if (CONNECTIVE_ENDING.test(lastWord)) return false;
  if (STRONG_QUESTION_ENDING.test(lastWord) && !STRONG_ENDING_FALSE_WORDS.has(lastWord)) return true;
  return hasSoftQuestionEnding(lastWord) && hasQuestionWord(words);
}

/**
 * 질문으로 보이면 끝의 마침표를 걷고 "?"를 붙인다. 이미 ?/!로 끝나거나 질문이 아니면 그대로 둔다.
 */
export function punctuateChildQuestion(text: string): string {
  const trimmed = text.trim();
  if (!looksLikeKoreanQuestion(trimmed)) return trimmed;
  return `${trimmed.replace(TRAILING_SOFT_PUNCTUATION, '')}?`;
}
