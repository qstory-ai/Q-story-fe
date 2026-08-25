import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  CheckCheck,
  ClipboardList,
  Clock,
  Home,
  LogOut,
  MessageCircle,
  Mic,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Users,
  UserRound,
} from 'lucide-react';

/**
 * 이모지 대신 실제 SVG 글리프를 사용한다 - 이모지는 OS/브라우저마다 다르게 렌더링되어서
 * (Windows, macOS, 모바일이 모두 다른 모양의 💬를 그린다) 플랫폼 간 시각적 일관성이 깨졌고,
 * 이는 설계된 아이콘 세트가 아니라 프로토타입용 임시방편처럼 보인다는 문제는 차치하더라도
 * 그렇다. lucide-react는 순수 SVG React 컴포넌트를 제공하는데, react-native-web 위에서
 * RN View/Pressable의 자식으로도 문제없이 렌더링된다 - 웹 전용 앱이므로 react-native-svg
 * 의존성이 필요 없다.
 */
export const ICONS = {
  chat: MessageCircle,
  home: Home,
  replay: RotateCcw,
  next: ArrowRight,
  pause: Pause,
  play: Play,
  captions: Subtitles,
  book: BookOpen,
  user: UserRound,
  logout: LogOut,
  check: Check,
  mic: Mic,
  voice: AudioLines,
  pencil: PenLine,
  sparkles: Sparkles,
  shield: ShieldCheck,
  consent: CheckCheck,
  report: ClipboardList,
  users: Users,
  clock: Clock,
  searchCheck: SearchCheck,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  color = 'currentColor',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const LucideIcon = ICONS[name];
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} aria-hidden="true" />;
}
