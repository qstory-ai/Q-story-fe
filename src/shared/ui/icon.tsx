import {
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  GraduationCap,
  Home,
  Lock,
  LogOut,
  Menu,
  MessageCircle,
  Mic,
  Pause,
  PenLine,
  Play,
  Plus,
  RotateCcw,
  Search,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Subtitles,
  Users,
  UserRound,
  X,
} from 'lucide-react';

/**
 * 이모지 대신 SVG 글리프를 쓴다 - 이모지는 OS/브라우저마다 모양이 달라 플랫폼 간 일관성이 깨진다.
 * lucide-react의 순수 SVG 컴포넌트는 RN View/Pressable 자식으로도 그대로 렌더링되므로(웹 전용 앱)
 * react-native-svg가 필요 없다.
 */
export const ICONS = {
  chat: MessageCircle,
  home: Home,
  back: ArrowLeft,
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
  lock: Lock,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  calendarDays: CalendarDays,
  bell: Bell,
  plus: Plus,
  graduationCap: GraduationCap,
  search: Search,
  close: X,
  menu: Menu,
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
