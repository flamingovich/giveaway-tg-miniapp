export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface WinnerInfo {
  name: string;
  ticketNumber: number;
  prizeWon: number;
  isFake: boolean;
  avatarUrl?: string;
  payoutAddress?: string;
  userId?: number;
  username?: string;
  isHiddenProfile?: boolean;
}

/** Зафиксированный реальный участник (и в настоящем, и в фейковом розыгрыше — ты сам реальный человек). */
export interface GiveawayParticipantEntry {
  userId: number;
  ticketNumber: number;
  displayName: string;
  payoutAddress?: string;
  username?: string;
  avatarUrl?: string;
  hideWinnerProfile?: boolean;
}

export interface UserProfile {
  payoutValue: string;
  payoutType: PayoutType;
  participationCount: number;
  totalWon: number;
  hideWinnerProfile?: boolean;
  savedPayouts: Array<{ type: PayoutType; value: string }>;
  participatedContests: Record<string, number>; // contestId -> ticketNumber
  verifiedProjects?: string[]; // Список ID проектов, где пройдена регистрация
}

export interface ProjectPreset {
  id: string;
  name: string;
  referralLink: string;
  logoDataUrl?: string;
}

export type ContestType = 'casino' | 'youtube';

export interface YoutubeConfig {
  videoUrl: string;
  requireLike: boolean;
  requireComment: boolean;
  watchTimeMinutes: number;
}

export interface Contest {
  id: string;
  title: string;
  description?: string;
  type: ContestType;
  projectId: string; // ID пресета проекта (для casino)
  youtubeConfig?: YoutubeConfig; // Конфиг для youtube
  prizeRub: number;
  prizeType?: 'money' | 'other';
  customPrize?: string;
  imageUrl?: string;
  createdAt: number;
  expiresAt?: number | null;
  participantCount: number; // Общее кол-во билетов
  realParticipantCount: number; // Кол-во реальных людей
  isCompleted?: boolean;
  winners?: WinnerInfo[];
  winnerCount: number;
  realWinnerCount?: number;
  lastTicketNumber: number;
  seed?: string;
  isTest?: boolean; // Флаг тестового розыгрыша
  /** Если true — в пул билетов добавляются «боты»; победители выбираются только из билетов ботов. Реальные игроки никогда не выигрывают. */
  isFakeGiveaway?: boolean;
  /** Реальные участники и их билеты */
  giveawayParticipants?: GiveawayParticipantEntry[];
  /** Билеты, принадлежащие только ботам (для фейкового режима). */
  botTicketNumbers?: number[];
}

export enum ContestStep {
  LIST = 'list',
  CAPTCHA = 'captcha',
  REFERRAL = 'referral',
  PAYOUT = 'payout',
  TICKET_SHOW = 'ticket_show',
  SUCCESS = 'success'
}

export type PayoutType = 'trc20';
export type Currency = 'RUB' | 'USD' | 'EUR' | 'KZT' | 'UAH' | 'BYN';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        initDataUnsafe: {
          user?: TelegramUser;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        };
      };
    };
  }
}