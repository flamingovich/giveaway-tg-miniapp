
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TelegramUser, ContestStep, Contest, WinnerInfo, UserProfile, ProjectPreset, Currency, ContestType, YoutubeConfig } from './types';
import { CoverCropModal } from './components/CoverCropModal';
import usdtCoin1Url from './bg_images/usdt1.png';
import usdtCoin2Url from './bg_images/usdt2.png';
import kleverCoin1Url from './bg_images/klever1.png';
import kleverCoin2Url from './bg_images/klever2.png';
import trcGuideStep1Url from './trc_guide/step1.png';
import trcGuideStep2Url from './trc_guide/step2.png';
import trcGuideStep3Url from './trc_guide/step3.png';
import trcGuideStep4Url from './trc_guide/step4.png';

type BgCoinDecorItem = {
  src: string;
  className: string;
  dur: number;
  delay: number;
  opacity: number;
};

/** Декор фона экрана кошелька (PAYOUT) */
const PAYOUT_USDT_BG_DECOR: BgCoinDecorItem[] = [
  { src: usdtCoin1Url, className: 'top-[4%] -left-[8%] w-[10.5rem]', dur: 5.2, delay: 0, opacity: 0.38 },
  { src: usdtCoin2Url, className: 'top-[16%] -right-[10%] w-[12.5rem]', dur: 6.1, delay: 0.45, opacity: 0.34 },
  { src: usdtCoin1Url, className: 'top-[40%] left-[2%] w-[6.75rem]', dur: 4.7, delay: 0.2, opacity: 0.28 },
  { src: usdtCoin2Url, className: 'bottom-[28%] -left-[4%] w-[9rem]', dur: 5.6, delay: 0.85, opacity: 0.32 },
  { src: usdtCoin1Url, className: 'bottom-[8%] -right-[4%] w-[11rem]', dur: 5.9, delay: 0.1, opacity: 0.36 },
  { src: usdtCoin2Url, className: 'top-[52%] right-[4%] w-[7.25rem]', dur: 4.9, delay: 0.65, opacity: 0.26 },
  { src: usdtCoin1Url, className: 'bottom-[36%] right-[8%] w-[5.5rem]', dur: 5.4, delay: 1.05, opacity: 0.22 },
];

/** Декор фона экрана билета (TICKET_SHOW) */
const TICKET_KLEVER_BG_DECOR: BgCoinDecorItem[] = [
  { src: kleverCoin1Url, className: 'top-[4%] -left-[8%] w-[10.5rem]', dur: 5.2, delay: 0, opacity: 0.38 },
  { src: kleverCoin2Url, className: 'top-[16%] -right-[10%] w-[12.5rem]', dur: 6.1, delay: 0.45, opacity: 0.34 },
  { src: kleverCoin1Url, className: 'top-[40%] left-[2%] w-[6.75rem]', dur: 4.7, delay: 0.2, opacity: 0.28 },
  { src: kleverCoin2Url, className: 'bottom-[28%] -left-[4%] w-[9rem]', dur: 5.6, delay: 0.85, opacity: 0.32 },
  { src: kleverCoin1Url, className: 'bottom-[8%] -right-[4%] w-[11rem]', dur: 5.9, delay: 0.1, opacity: 0.36 },
  { src: kleverCoin2Url, className: 'top-[52%] right-[4%] w-[7.25rem]', dur: 4.9, delay: 0.65, opacity: 0.26 },
  { src: kleverCoin1Url, className: 'bottom-[36%] right-[8%] w-[5.5rem]', dur: 5.4, delay: 1.05, opacity: 0.22 },
];

/** Локальный браузер без Telegram Mini App — только в dev */
const LOCAL_DEV_MOCK_TELEGRAM_USER: TelegramUser = {
  id: 910000000001,
  first_name: 'Local',
  last_name: 'Browser',
  username: 'local_browser',
};
import { 
  CheckBadgeIcon, 
  LinkIcon, 
  ClockIcon, 
  TrashIcon, 
  TrophyIcon, 
  ChevronLeftIcon, 
  ShieldCheckIcon, 
  UsersIcon, 
  GiftIcon, 
  UserCircleIcon, 
  FlagIcon, 
  PlusIcon,
  TicketIcon,
  CurrencyDollarIcon,
  ArrowRightStartOnRectangleIcon,
  BanknotesIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  ChevronDownIcon,
  ArrowPathIcon,
  UserGroupIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  FingerPrintIcon,
  LockClosedIcon,
  KeyIcon,
  UserIcon,
  FaceFrownIcon,
  ShieldExclamationIcon,
  XCircleIcon,
  ShieldCheckIcon as ShieldCheckIconOutline,
  InformationCircleIcon,
  VideoCameraIcon,
  HandThumbUpIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckIcon,
  BeakerIcon,
  HandThumbDownIcon
} from '@heroicons/react/24/outline';

const DB_KEY = 'beef_contests_v7_final';
const PRESETS_KEY = 'beef_project_presets_v7';
const AVATARS_KEY = 'beef_avatars_pool'; 
const ADMIN_ID = 7946967720;
const PROFILE_KEY = 'beef_user_profile_v7_final';
/** refError: показываем кастомный блок (иконка + текст) для неудачной проверки по проекту (не YouTube) */
const REFERRAL_PROJECT_VERIFY_ERROR = '__referral_project_verify_error__';

function isReferralProjectIdFormat(value: string): boolean {
  return /^#.+/u.test(value.trim());
}
const USERS_LIST_KEY = 'beef_registered_users_list_v1';
/** Только локальный dev: сессия после успешного POST /api/dev-auth */
const LOCAL_DEV_ADMIN_SESSION_KEY = 'ludovar_local_dev_admin_until';

function readStoredDevAdminUntil(): number | null {
  if (!import.meta.env.DEV) return null;
  try {
    const raw = sessionStorage.getItem(LOCAL_DEV_ADMIN_SESSION_KEY);
    if (!raw) return null;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      sessionStorage.removeItem(LOCAL_DEV_ADMIN_SESSION_KEY);
      return null;
    }
    return until;
  } catch {
    return null;
  }
}

const apiKvGet = async (key: string) => {
  const res = await fetch(`/api/kv?action=get&key=${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.result ?? null;
};

const apiKvSet = async (key: string, value: any) => {
  await fetch(`/api/kv?action=set&key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
};

const CURRENCIES: Record<Currency, { symbol: string; label: string; rateMult?: number }> = {
  RUB: { symbol: '₽', label: 'RUB' },
  USD: { symbol: '$', label: 'USD' },
  EUR: { symbol: '€', label: 'EUR' },
  KZT: { symbol: '₸', label: 'KZT' },
  UAH: { symbol: '₴', label: 'UAH' },
  BYN: { symbol: 'Br', label: 'BYN' }
};

const AVATAR_COLORS = [
  'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
  'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500'
];

const getFallbackColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

/** Название месяца для подписи «За …» (локаль ru-RU, с заглавной буквы). */
const ruMonthNameLong = (date: Date = new Date()) => {
  const raw = new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

const DURATION_OPTIONS = [
  { label: '5 мин', value: '300000' },
  { label: '10 мин', value: '600000' },
  { label: '30 мин', value: '1800000' },
  { label: '1 час', value: '3600000' },
  { label: '3 часа', value: '10800000' },
  { label: '6 часов', value: '21600000' },
  { label: '12 часов', value: '43200000' },
  { label: '24 часа', value: '86400000' },
  { label: '72 часа', value: '259200000' },
  { label: 'Вручную', value: 'null' }
];

const MALE_NAMES_EN = [
  "Alexey", "Dmitry", "Ivan", "Sergey", "Andrey", "Pavel", "Maxim", "Artem", "Denis", "Vladimir",
  "Mikhail", "Nikolay", "Aleksandr", "Stepan", "Roman", "Igor", "Oleg", "Victor", "Kirill", "Gleb",
  "Boris", "Anatoly", "Leonid", "Yuri", "Konstantin", "Evgeny", "Vladislav", "Stanislav", "Ruslan", "Timur",
  "James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Charles",
  "Christopher", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew", "Joshua",
  "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward", "Jason", "Jeffrey", "Gary",
  "Ryan", "Nicholas", "Eric", "Stephen", "Jacob", "Larry", "Frank", "Scott", "Justin", "Brandon",
  "Raymond", "Gregory", "Samuel", "Benjamin", "Patrick", "Jack", "Alexander", "Dennis", "Jerry", "Tyler",
  "Aaron", "Adam", "Alan", "Albert", "Austin", "Billy", "Bobby", "Bradley", "Bruce", "Bryan", "Carl",
  "Christian", "Craig", "Curtis", "Douglas", "Dylan", "Ethan", "Eugene", "Gabriel", "Harold", "Henry",
  "Isaac", "Jeremy", "Jordan", "Keith", "Kyle", "Logan", "Nathan", "Noah", "Oscar", "Philip"
];

const MALE_NAMES_RU = [
  "Алексей", "Дмитрий", "Иван", "Сергей", "Андрей", "Павел", "Максим", "Артем", "Денис", "Владимир",
  "Михаил", "Николай", "Александр", "Степан", "Роман", "Игорь", "Олег", "Виктор", "Кирилл", "Глеб",
  "Борис", "Анатолий", "Леонид", "Юрий", "Константин", "Евгений", "Владислав", "Станислав", "Тимур",
  "Даниил", "Егор", "Никита", "Илья", "Матвей", "Макар", "Лев", "Марк", "Артемий", "Арсений",
  "Ян", "Савелий", "Демид", "Лука", "Тихон", "Ярослав", "Фёдор", "Пётр", "Семён", "Богдан",
  "Григорий", "Захар", "Елисей", "Филипп", "Артур", "Вадим", "Ростислав", "Георгий", "Леон", "Мирон",
  "Платон", "Эрик", "Герман", "Всеволод", "Демьян", "Прохор", "Гордей", "Климент", "Назар", "Еремей",
  "Валентин", "Валерий", "Василий", "Вениамин", "Виталий", "Вячеслав", "Геннадий", "Герасим", "Давид",
  "Данислав", "Евдоким", "Емельян", "Ефим", "Игнатий", "Иннокентий", "Иосиф", "Кир", "Клим", "Корней",
  "Кузьма", "Лаврентий", "Лукьян", "Маврикий", "Максимильян", "Мефодий", "Модест", "Мстислав", "Никон"
];

const SURNAMES_EN = [
  "Ivanov", "Petrov", "Smirnov", "Kuznetsov", "Popov", "Vasiliev", "Sokolov", "Mikhailov", "Novikov", "Fedorov",
  "Morozov", "Volkov", "Alekseev", "Lebedev", "Semenov", "Egorov", "Pavlov", "Kozlov", "Stepanov", "Nikolaev",
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
  "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
  "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
  "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
  "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes"
];

const SURNAMES_RU = [
  "Иванов", "Петров", "Смирнов", "Кузнецов", "Попов", "Васильев", "Соколов", "Михайлов", "Новиков", "Федоров",
  "Морозов", "Волков", "Алексеев", "Лебедев", "Семенов", "Егоров", "Павлов", "Kozlov", "Stepanov", "Nikolaev",
  "Тихонов", "Белов", "Морозов", "Крылов", "Макаров", "Зайцев", "Соловьев", "Борисов", "Романов", "Воробьев",
  "Фролов", "Медведев", "Семенов", "Жуков", "Куликов", "Беляев", "Тарасов", "Белоусов", "Орлов", "Киселев",
  "Миронов", "Марков", "Никитин", "Соболев", "Королев", "Коновалов", "Федотов", "Щербаков", "Воронин", "Титов",
  "Авдеев", "Агафонов", "Акимов", "Александров", "Алексеев", "Андреев", "Анисимов", "Антонов", "Артемьев",
  "Афанасьев", "Баранов", "Беляков", "Беспалов", "Бирюков", "Блохин", "Бобров", "Богданов", "Бондаренко"
];

const generateHumanLikeName = () => {
  const isRussian = Math.random() > 0.5;
  const names = isRussian ? MALE_NAMES_RU : MALE_NAMES_EN;
  const surnames = isRussian ? SURNAMES_RU : SURNAMES_EN;
  
  let fullName = names[Math.floor(Math.random() * names.length)];
  
  if (Math.random() > 0.4) {
    fullName += " " + surnames[Math.floor(Math.random() * surnames.length)];
  }

  const suffixRoll = Math.random();
  if (suffixRoll > 0.9) {
    fullName += (Math.floor(Math.random() * 9) + 1).toString();
  } else if (suffixRoll > 0.8) {
    fullName += (Math.floor(Math.random() * 90) + 10).toString();
  }

  const caseRoll = Math.random();
  if (caseRoll > 0.9) {
    return fullName.toUpperCase();
  } else if (caseRoll > 0.8) {
    return fullName.toLowerCase();
  } else {
    return fullName;
  }
};

const isValidTronAddress = (val: string) => {
  const v = val.trim();
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v);
};

function shufflePick<T>(items: readonly T[], count: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]!;
    a[i] = a[j]!;
    a[j] = t;
  }
  return a.slice(0, Math.min(count, a.length));
}

const BlurredWinnerName: React.FC<{ name: string }> = ({ name }) => {
  if (name.length <= 4) {
    const first = name.slice(0, 1);
    const last = name.slice(-1);
    const middle = name.slice(1, -1) || '••';
    return (
      <span className="inline-flex items-center">
        {first}
        <span className="blur-[6px] select-none mx-0.5 opacity-60 scale-x-125">
          {middle}
        </span>
        {last}
      </span>
    );
  }

  const firstTwo = name.slice(0, 2);
  const lastTwo = name.slice(-2);
  const middle = name.slice(2, -2);

  return (
    <span className="inline-flex items-center">
      {firstTwo}
      <span className="blur-[7px] select-none mx-0.5 opacity-60 tracking-tighter scale-x-110">
        {middle}
      </span>
      {lastTwo}
    </span>
  );
};

const generateRandomSeed = () => {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/** Локальное время пользователя: ночь 23:00–05:00, утро 05:01–09:00, день 09:01–16:30, вечер 16:31–22:59 */
function getTimeGreeting(date: Date): string {
  const t = date.getHours() * 60 + date.getMinutes();
  if (t >= 23 * 60 || t < 5 * 60 + 1) return 'Доброй ночи,';
  if (t <= 9 * 60) return 'Доброе утро,';
  if (t <= 16 * 60 + 30) return 'Добрый день,';
  return 'Добрый вечер,';
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'contests' | 'profile'>('contests');
  /** Вкладка списка розыгрышей на главной: all = активные + завершённые подряд */
  const [giveawaySegment, setGiveawaySegment] = useState<'active' | 'completed' | 'all'>('active');
  const [view, setView] = useState<'user' | 'admin'>('user');
  const [step, setStep] = useState<ContestStep>(ContestStep.LIST);
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [contests, setContests] = useState<Contest[]>([]);
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [avatars, setAvatars] = useState<string[]>([]);
  const [profile, setProfile] = useState<UserProfile>({ 
    payoutValue: '', 
    payoutType: 'trc20',
    participationCount: 0, 
    totalWon: 0, 
    savedPayouts: [],
    participatedContests: {},
    verifiedProjects: []
  });
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null);
  const [currency, setCurrency] = useState<Currency>('RUB');
  const [rates, setRates] = useState<Record<string, number>>({ RUB: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingParticipation, setIsProcessingParticipation] = useState(false);

  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'checking' | 'verified'>('idle');
  /** Смена приветствия по времени суток */
  const [headerTimeTick, setHeaderTimeTick] = useState(0);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPrize, setNewPrize] = useState('');
  const [newPrizeType, setNewPrizeType] = useState<'money' | 'other'>('money');
  const [newCustomPrize, setNewCustomPrize] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [coverCropOpen, setCoverCropOpen] = useState(false);
  const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);
  const [newWinners, setNewWinners] = useState('1');
  const [newProjectId, setNewProjectId] = useState('');
  const [newDuration, setNewDuration] = useState<string>('300000');
  const [newContestType, setNewContestType] = useState<ContestType>('casino');
  const [isNewTest, setIsNewTest] = useState(false);
  /** true = фейк: добавляются боты и выигрывают только они */
  const [newIsFakeGiveaway, setNewIsFakeGiveaway] = useState(false);
  
  const [newYtVideoUrl, setNewYtVideoUrl] = useState('');
  const [newYtRequireLike, setNewYtRequireLike] = useState(false);
  const [newYtRequireComment, setNewYtRequireComment] = useState(false);
  const [newYtWatchTime, setNewYtWatchTime] = useState('1');

  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetLink, setNewPresetLink] = useState('');
  const [newPresetLogo, setNewPresetLogo] = useState<string>('');
  const presetLogoInputRef = useRef<HTMLInputElement | null>(null);

  const [refClickCount, setRefClickCount] = useState(0);
  const [isRefChecking, setIsRefChecking] = useState(false);
  const [refError, setRefError] = useState('');
  const [userTicket, setUserTicket] = useState<number>(0);
  const [isProjectOpened, setIsProjectOpened] = useState(false);
  const [ytTaskStartedAt, setYtTaskStartedAt] = useState<number | null>(null);
  const [referralProjectIdInput, setReferralProjectIdInput] = useState('');
  const [irisVerifyRetryAfter, setIrisVerifyRetryAfter] = useState<number | null>(null);

  // Капча
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [captchaDone, setCaptchaDone] = useState(false);
  const [showPayoutInstruction, setShowPayoutInstruction] = useState(false);
  const [isProbablyFairOpen, setIsProbablyFairOpen] = useState(false);

  const [devAdminUntil, setDevAdminUntil] = useState<number | null>(() =>
    typeof sessionStorage !== 'undefined' ? readStoredDevAdminUntil() : null
  );
  const [showLocalAdminModal, setShowLocalAdminModal] = useState(false);
  const [localAdminSecretInput, setLocalAdminSecretInput] = useState('');
  const [localAdminError, setLocalAdminError] = useState('');
  const [localAdminLoading, setLocalAdminLoading] = useState(false);

  useEffect(() => {
    if (step !== ContestStep.PAYOUT) setShowPayoutInstruction(false);
  }, [step]);

  useEffect(() => {
    if (irisVerifyRetryAfter == null) return;
    const ms = Math.max(0, irisVerifyRetryAfter - Date.now());
    const id = window.setTimeout(() => setIrisVerifyRetryAfter(null), ms);
    return () => window.clearTimeout(id);
  }, [irisVerifyRetryAfter]);

  useEffect(() => {
    if (step !== ContestStep.TICKET_SHOW && step !== ContestStep.REFERRAL) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [step]);

  useEffect(() => {
    if (!showPayoutInstruction) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPayoutInstruction(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPayoutInstruction]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const t = setInterval(() => {
      setDevAdminUntil((u) => {
        if (u === null || u > Date.now()) return u;
        sessionStorage.removeItem(LOCAL_DEV_ADMIN_SESSION_KEY);
        return null;
      });
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setHeaderTimeTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.initDataUnsafe?.user) {
        const currentUser = tg.initDataUnsafe.user;
        setUser(currentUser);
        registerUser(currentUser.id);
      } else if (import.meta.env.DEV) {
        setUser(LOCAL_DEV_MOCK_TELEGRAM_USER);
        registerUser(LOCAL_DEV_MOCK_TELEGRAM_USER.id);
      }
    } else if (import.meta.env.DEV) {
      setUser(LOCAL_DEV_MOCK_TELEGRAM_USER);
      registerUser(LOCAL_DEV_MOCK_TELEGRAM_USER.id);
    }

    fetchData();

    const interval = setInterval(() => {
      fetchData(true);
    }, 5000);

    const savedProfile = localStorage.getItem(PROFILE_KEY);
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      let payoutValue = parsed.payoutValue ?? '';
      if ((parsed.payoutType as string) === 'card') payoutValue = '';
      setProfile((prev) => ({
        ...prev,
        ...parsed,
        payoutType: 'trc20',
        payoutValue,
        verifiedProjects: parsed.verifiedProjects || [],
        savedPayouts: (parsed.savedPayouts || []).filter(
          (s: { type: string }) => s.type !== 'card'
        ),
      }));
    }

    return () => clearInterval(interval);
  }, []);

  const registerUser = async (userId: number) => {
    try {
      let users: number[] = (await apiKvGet(USERS_LIST_KEY)) || [];
      if (!users.includes(userId)) {
        users.push(userId);
        await apiKvSet(USERS_LIST_KEY, users);
      }
    } catch (e) { console.error("User registration failed", e); }
  };

  const fetchData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    
    const safeKVFetch = async (key: string) => {
      try {
        return await apiKvGet(key);
      } catch (e) {
        console.error(`KV Fetch Error (${key}):`, e);
        return null;
      }
    };

    try {
      const [fetchedContestsData, fetchedPresetsData, fetchedAvatarsData] = await Promise.all([
        safeKVFetch(DB_KEY),
        safeKVFetch(PRESETS_KEY),
        safeKVFetch(AVATARS_KEY)
      ]);

      if (fetchedPresetsData) setPresets(fetchedPresetsData);
      if (fetchedAvatarsData) setAvatars(fetchedAvatarsData);

      try {
        const rRes = await fetch('https://open.er-api.com/v6/latest/RUB');
        const rData = await rRes.json();
        if (rData && rData.rates) setRates(rData.rates);
      } catch (e) {
        console.error("Exchange Rate API Error:", e);
      }

      if (fetchedContestsData) {
        const { updated, hasChanges } = completeExpiredContests(
          fetchedContestsData,
          fetchedAvatarsData || avatars
        );
        setContests(updated);
        if (hasChanges) {
          await apiKvSet(DB_KEY, updated);
        }
      }

    } catch (e) { 
      console.error("Critical Fetch Error:", e); 
    } finally { 
      if (!silent) setIsLoading(false); 
    }
  };

  const autoFinish = async (id: string, currentList: Contest[], availableAvatars?: string[]) => {
    const contest = currentList.find(c => c.id === id);
    if (!contest || contest.isCompleted) return;

    let winnerList: WinnerInfo[] | null = null;

    if (contest.isFakeGiveaway === true) {
      winnerList = generateBotOnlyWinners(contest, availableAvatars);
    } else {
      winnerList = generateRealWinners(contest);
      if (!winnerList || winnerList.length === 0) {
        alert(
          'Нечем завершить: нет записанных участников в настоящем розыгрыше. Дождитесь хотя бы одного участия.'
        );
        return;
      }
    }

    const updated = currentList.map((c) =>
      id === c.id
        ? {
            ...c,
            isCompleted: true,
            winners: winnerList!,
            seed: generateRandomSeed(),
          }
        : c
    );
    saveContests(updated);
  };

  /** Для совсем старых фейковых розыгрышей без botTicketNumbers */
  const generateFakeWinners = (contest: Contest, availableAvatars?: string[]): WinnerInfo[] => {
    const winners: WinnerInfo[] = [];
    const prizePer = Math.floor(contest.prizeRub / (contest.winnerCount || 1));
    const usedTickets = new Set<number>();
    const avatarPool =
      availableAvatars && availableAvatars.length > 0
        ? availableAvatars
        : avatars;

    while (
      winners.length < contest.winnerCount &&
      contest.lastTicketNumber > 0
    ) {
      const lucky = Math.floor(Math.random() * contest.lastTicketNumber) + 1;
      if (!usedTickets.has(lucky)) {
        usedTickets.add(lucky);
        const hasAvatar = Math.random() > 0.3;
        const avatarUrl =
          hasAvatar && avatarPool.length > 0
            ? avatarPool[Math.floor(Math.random() * avatarPool.length)]
            : undefined;
        winners.push({
          name: generateHumanLikeName(),
          ticketNumber: lucky,
          prizeWon: prizePer,
          isFake: true,
          avatarUrl,
        });
      }
      if (
        winners.length >= contest.winnerCount ||
        usedTickets.size >= contest.lastTicketNumber
      )
        break;
    }
    return winners;
  };

  /** Фейковый режим: только билеты из botTicketNumbers (боты). */
  const generateBotOnlyWinners = (
    contest: Contest,
    availableAvatars?: string[]
  ): WinnerInfo[] => {
    const pool = contest.botTicketNumbers || [];
    if (pool.length === 0) {
      return generateFakeWinners(contest, availableAvatars);
    }
    const prizePer = Math.floor(contest.prizeRub / (contest.winnerCount || 1));
    const picks = shufflePick(pool, contest.winnerCount);
    const avatarPool =
      availableAvatars && availableAvatars.length > 0
        ? availableAvatars
        : avatars;
    return picks.map((ticket) => {
      const hasAvatar = Math.random() > 0.3;
      const avatarUrl =
        hasAvatar && avatarPool.length > 0
          ? avatarPool[Math.floor(Math.random() * avatarPool.length)]
          : undefined;
      return {
        name: generateHumanLikeName(),
        ticketNumber: ticket,
        prizeWon: prizePer,
        isFake: true,
        avatarUrl,
      };
    });
  };

  const generateRealWinners = (contest: Contest): WinnerInfo[] | null => {
    const pool = contest.giveawayParticipants || [];
    if (pool.length === 0) return null;
    const prizePer = Math.floor(contest.prizeRub / (contest.winnerCount || 1));
    const picks = shufflePick(pool, contest.winnerCount);
    return picks.map((p) => ({
      name: p.displayName || `Участник #${p.ticketNumber}`,
      ticketNumber: p.ticketNumber,
      prizeWon: prizePer,
      isFake: false,
      payoutAddress: p.payoutAddress,
      userId: p.userId,
    }));
  };

  const completeExpiredContests = (
    list: Contest[],
    availableAvatars?: string[]
  ): { updated: Contest[]; hasChanges: boolean } => {
    const now = Date.now();
    let hasChanges = false;

    const updated = list.map((contest) => {
      if (contest.isCompleted || !contest.expiresAt || contest.expiresAt > now) {
        return contest;
      }

      const winners =
        contest.isFakeGiveaway === true
          ? generateBotOnlyWinners(contest, availableAvatars)
          : generateRealWinners(contest) || [];

      hasChanges = true;
      return {
        ...contest,
        isCompleted: true,
        winners,
        seed: generateRandomSeed(),
      };
    });

    return { updated, hasChanges };
  };

  const saveContests = async (list: Contest[]) => {
    if (!list || (list.length === 0 && contests.length > 0)) {
      if (!window.confirm("Вы уверены, что хотите очистить весь список?")) return;
    }
    setContests(list);
    await apiKvSet(DB_KEY, list);
  };

  const savePresets = async (list: ProjectPreset[]) => {
    setPresets(list);
    await apiKvSet(PRESETS_KEY, list);
  };

  const convert = (val: number) => {
    const rate = rates[currency] || 1;
    return (val * rate).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const isAdmin = useMemo(() => {
    if (user?.id === ADMIN_ID) return true;
    if (
      import.meta.env.DEV &&
      devAdminUntil !== null &&
      devAdminUntil > Date.now()
    )
      return true;
    return false;
  }, [user, devAdminUntil]);

  const clearLocalDevAdmin = () => {
    sessionStorage.removeItem(LOCAL_DEV_ADMIN_SESSION_KEY);
    setDevAdminUntil(null);
    setShowLocalAdminModal(false);
    setLocalAdminSecretInput('');
    setLocalAdminError('');
  };

  const handleLocalAdminLogin = async () => {
    setLocalAdminError('');
    setLocalAdminLoading(true);
    try {
      const res = await fetch('/api/dev-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: localAdminSecretInput }),
      });
      let data: { ok?: boolean; until?: number; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        /* empty */
      }
      if (!res.ok) {
        setLocalAdminError(
          data.error ||
            (res.status === 503
              ? 'Задайте LOCAL_ADMIN_SECRET в .env.local (≥16 символов) и перезапустите npm run dev'
              : 'Неверный секрет или ошибка сервера')
        );
        return;
      }
      if (data.until != null && Number.isFinite(data.until)) {
        sessionStorage.setItem(
          LOCAL_DEV_ADMIN_SESSION_KEY,
          String(data.until)
        );
        setDevAdminUntil(data.until);
        setShowLocalAdminModal(false);
        setLocalAdminSecretInput('');
      }
    } catch {
      setLocalAdminError('Сеть или API недоступны — запущен ли npm run dev?');
    } finally {
      setLocalAdminLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = contests.reduce((acc, c) => acc + (c.isCompleted ? c.prizeRub : 0), 0);
    const now = new Date();
    const thisMonth = contests.reduce((acc, c) => {
      const d = new Date(c.createdAt);
      if (c.isCompleted && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) return acc + c.prizeRub;
      return acc;
    }, 0);
    return { total, thisMonth };
  }, [contests]);

  const handleCreateContest = async () => {
    if ((newPrizeType === 'money' && !newPrize) || (newPrizeType === 'other' && !newCustomPrize)) return;
    if (newContestType === 'casino' && !newProjectId) return;
    if (newContestType === 'youtube' && !newYtVideoUrl) return;

    const now = Date.now();
    const duration = newDuration === 'null' ? null : parseInt(newDuration);
    const normalizedTitle = newTitle.trim();
    const contestTitle = normalizedTitle || 'Розыгрыш без названия';
    const normalizedDescription = newDescription.trim();
    
    const newC: Contest = {
      id: now.toString(),
      title: contestTitle,
      description: normalizedDescription || undefined,
      type: newContestType,
      isTest: isNewTest,
      isFakeGiveaway: newIsFakeGiveaway,
      projectId: newContestType === 'casino' ? newProjectId : '',
      youtubeConfig: newContestType === 'youtube' ? {
        videoUrl: newYtVideoUrl,
        requireLike: newYtRequireLike,
        requireComment: newYtRequireComment,
        watchTimeMinutes: parseInt(newYtWatchTime)
      } : undefined,
      prizeRub: newPrizeType === 'money' ? parseInt(newPrize) : 0,
      prizeType: newPrizeType,
      customPrize: newPrizeType === 'other' ? newCustomPrize : undefined,
      imageUrl: newImageUrl || undefined,
      createdAt: now,
      expiresAt: duration ? now + duration : null,
      participantCount: 0,
      realParticipantCount: 0,
      winnerCount: parseInt(newWinners),
      lastTicketNumber: 0,
      giveawayParticipants: [],
      botTicketNumbers: newIsFakeGiveaway ? [] : undefined,
    };
    
    await saveContests([newC, ...contests]);

    if (!isNewTest) {
      try {
        const durationLabel = DURATION_OPTIONS.find(opt => opt.value === newDuration)?.label || 'не указано';
        const prizeDisplay = newPrizeType === 'money' ? `${parseInt(newPrize)}₽` : newCustomPrize;
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: contestTitle,
            prize: prizeDisplay,
            winners: newWinners,
            duration: durationLabel
          })
        });
      } catch (e) { console.error("Notification trigger failed", e); }
    }

    setNewTitle(''); setNewDescription(''); setNewPrize(''); setNewWinners('1'); setNewProjectId('');
    setNewYtVideoUrl(''); setNewYtRequireLike(false); setNewYtRequireComment(false); setNewYtWatchTime('1');
    setNewPrizeType('money'); setNewCustomPrize(''); setNewImageUrl('');
    setCoverCropOpen(false);
    setCoverCropSrc(null);
    setIsNewTest(false);
    setNewIsFakeGiveaway(false);
    window.Telegram?.WebApp?.HapticFeedback.impactOccurred('medium');
  };

  const handleCreatePreset = async () => {
    if (!newPresetName || !newPresetLink) return;
    const newP: ProjectPreset = {
      id: Date.now().toString(),
      name: newPresetName,
      referralLink: newPresetLink,
      logoDataUrl: newPresetLogo || undefined,
    };
    await savePresets([...presets, newP]);
    setNewPresetName(''); setNewPresetLink(''); setNewPresetLogo('');
    window.Telegram?.WebApp?.HapticFeedback.impactOccurred('medium');
  };

  const handlePresetLogoFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.type !== 'image/png') {
      alert('Поддерживается только PNG (желательно с прозрачным фоном).');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('PNG слишком большой. Выберите файл до 3 МБ.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result.startsWith('data:image/png')) {
        alert('Не удалось прочитать PNG.');
        return;
      }
      setNewPresetLogo(result);
    };
    reader.onerror = () => alert('Ошибка чтения файла PNG.');
    reader.readAsDataURL(file);
  };

  const handlePresetLogoPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type === 'image/png');
    if (!imageItem) return;
    e.preventDefault();
    handlePresetLogoFile(imageItem.getAsFile());
  };

  const handleStartContest = (c: Contest) => {
    setSelectedContest(c);
    setRefClickCount(0);
    setRefError('');
    setIsRefChecking(false);
    setVerifyStatus('idle');
    setIsProjectOpened(false);
    setYtTaskStartedAt(null);
    setReferralProjectIdInput('');
    setIrisVerifyRetryAfter(null);
    setCaptchaLoading(false);
    setCaptchaDone(false);

    if (c.isCompleted) {
      setStep(ContestStep.SUCCESS);
      return;
    }

    if (profile.participatedContests[c.id]) {
      setUserTicket(profile.participatedContests[c.id]);
      setStep(ContestStep.TICKET_SHOW);
      return;
    }

    setStep(ContestStep.CAPTCHA);
  };

  const startCaptcha = () => {
    if (captchaLoading || captchaDone) return;
    setCaptchaLoading(true);
    setTimeout(() => {
      setCaptchaLoading(false);
      setCaptchaDone(true);
      if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      setTimeout(() => {
        handleCaptchaSuccess();
      }, 800);
    }, 1800);
  };

  const handleCaptchaSuccess = () => {
    if (!selectedContest) return;
    
    if (selectedContest.type === 'casino') {
      const isVerifiedForThisProject = profile.verifiedProjects?.includes(selectedContest.projectId);
      if (isVerifiedForThisProject) {
        setStep(ContestStep.PAYOUT);
        return;
      }
    }
    setStep(ContestStep.REFERRAL);
  };

  const handleRefCheck = () => {
    const isYoutubeFlow = selectedContest?.type === 'youtube';
    const referralIdOk = isReferralProjectIdFormat(referralProjectIdInput);
    const irisCooldownActive =
      !isYoutubeFlow &&
      irisVerifyRetryAfter != null &&
      Date.now() < irisVerifyRetryAfter;

    if (isYoutubeFlow) {
      if (isRefChecking || !isProjectOpened) return;
    } else {
      if (isRefChecking || !isProjectOpened || !referralIdOk || irisCooldownActive) return;
    }

    if (selectedContest?.type === 'youtube') {
      if (!ytTaskStartedAt) return;
      const requiredMinutes = selectedContest.youtubeConfig?.watchTimeMinutes || 0;
      const elapsedMinutes = (Date.now() - ytTaskStartedAt) / 60000;
      if (elapsedMinutes < requiredMinutes) {
        setRefError(`Вы не выполнили условия розыгрыша: "Посмотреть видео ${requiredMinutes} минут". Досмотрите видео и повторите попытку.`);
        if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        return;
      }
      setStep(ContestStep.PAYOUT);
      setRefClickCount(0);
      if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      return;
    }

    setIsRefChecking(true);
    setRefError('');
    const delay = Math.floor(Math.random() * 2000) + 1000;
    setTimeout(() => {
      setIsRefChecking(false);
      if (refClickCount < 2) {
        setRefError(REFERRAL_PROJECT_VERIFY_ERROR);
        setIrisVerifyRetryAfter(Date.now() + 3000);
        setRefClickCount(prev => prev + 1);
        if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      } else {
        if (selectedContest) {
            const newVerified = Array.from(new Set([...(profile.verifiedProjects || []), selectedContest.projectId]));
            const newProfile = { ...profile, verifiedProjects: newVerified };
            setProfile(newProfile);
            localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));
        }
        setStep(ContestStep.PAYOUT);
        setRefClickCount(0);
        if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
      }
    }, delay);
  };

  const handleFinalizeParticipation = async () => {
    if (!selectedContest || isProcessingParticipation) return;
    setIsProcessingParticipation(true);

    try {
      const actor =
        user ??
        (import.meta.env.DEV ? LOCAL_DEV_MOCK_TELEGRAM_USER : null);
      if (!actor?.id) {
        alert('Не удалось получить ваш Telegram ID. Откройте приложение через Telegram.');
        return;
      }
      if (!isValidTronAddress(profile.payoutValue)) {
        alert('Укажите корректный адрес USDT/TRX в сети TRC‑20 (Tron): 34 символа, начинается с T.');
        return;
      }
      const displayName =
        `${actor.first_name || ''}${actor.last_name ? ` ${actor.last_name}` : ''}`.trim() ||
        `ID ${actor.id}`;

      const res = await fetch('/api/participate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contestId: selectedContest.id,
          userId: actor.id,
          displayName,
          payoutAddress: profile.payoutValue.trim(),
        }),
      });

      if (res.status === 409) {
        alert('Вы уже участвуете в этом розыгрыше.');
        return;
      }
      if (!res.ok) throw new Error('Participation failed');
      const data = await res.json();
      
      const myTicket = data.ticketNumber;
      setUserTicket(myTicket);

      if (data.updatedContests) {
        setContests(data.updatedContests);
      }

      const newSaved = [...profile.savedPayouts];
      if (profile.payoutValue && !newSaved.find(s => s.value === profile.payoutValue)) {
        newSaved.push({ type: profile.payoutType, value: profile.payoutValue });
      }
      const newProfile = { 
        ...profile, 
        participationCount: profile.participationCount + 1,
        savedPayouts: newSaved.slice(-5),
        participatedContests: { ...profile.participatedContests, [selectedContest.id]: myTicket },
        verifiedProjects: Array.from(new Set([...(profile.verifiedProjects || []), selectedContest.projectId]))
      };
      setProfile(newProfile);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(newProfile));

      setStep(ContestStep.TICKET_SHOW);
      if (window.Telegram?.WebApp) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    } catch (e) {
      console.error(e);
      alert("Ошибка при сохранении участия. Попробуйте снова.");
    } finally {
      setIsProcessingParticipation(false);
    }
  };

  const Countdown = ({ expiresAt }: { expiresAt: number }) => {
    const [timeLeft, setTimeLeft] = useState(expiresAt - Date.now());
    useEffect(() => {
      const t = setInterval(() => setTimeLeft(expiresAt - Date.now()), 1000);
      return () => clearInterval(t);
    }, [expiresAt]);

    if (timeLeft <= 0) return null;

    const totalSec = Math.max(0, Math.floor(timeLeft / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n: number) => String(n).padStart(2, '0');

    let text: string;
    if (days > 0) {
      text = `${days}д ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } else if (hours > 0) {
      text = `${hours}:${pad(minutes)}:${pad(seconds)}`;
    } else {
      text = `${minutes}:${pad(seconds)}`;
    }

    return (
      <div
        className="flex items-center justify-end gap-2"
        title="Оставшееся время"
        aria-label={`Оставшееся время: ${text}`}
      >
        <ClockIcon className="h-6 w-6 shrink-0 text-gold/50" strokeWidth={2} />
        <span
          className={`text-right font-mono font-black tabular-nums tracking-tight text-white ${
            days > 0 ? 'max-w-full text-[13px] leading-snug' : 'text-[24px] leading-none'
          }`}
        >
          {text}
        </span>
      </div>
    );
  };

  const contestLists = useMemo(() => {
    const now = Date.now();
    const visibleContests = contests.filter(c => isAdmin || !c.isTest);
    const active = visibleContests.filter(c => !c.isCompleted);
    const completed = visibleContests.filter(c => c.isCompleted);
    return { active, completed };
  }, [contests, isAdmin]);

  const headerActor = useMemo(
    () => user ?? (import.meta.env.DEV ? LOCAL_DEV_MOCK_TELEGRAM_USER : null),
    [user]
  );

  const timeGreeting = useMemo(
    () => getTimeGreeting(new Date()),
    [headerTimeTick]
  );

  const headerDisplayName = useMemo(() => {
    if (!headerActor) return 'Гость';
    const parts = [headerActor.first_name, headerActor.last_name].filter(Boolean);
    const full = parts.join(' ').trim();
    return full || 'Участник';
  }, [headerActor]);

  const selectedProjectPreset = useMemo(() => {
    if (!selectedContest || selectedContest.type !== 'casino') return undefined;
    return presets.find((p) => p.id === selectedContest.projectId);
  }, [selectedContest, presets]);

  return (
    <div className="h-screen bg-matte-black text-[#E2E2E6] overflow-hidden flex flex-col font-sans selection:bg-gold/30 relative">
      <div className="absolute top-[-5%] left-[-10%] w-[60%] h-[50%] bg-gold/5 blur-[100px] rounded-full animate-glow-slow pointer-events-none z-0"></div>
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[40%] bg-gold/3 blur-[80px] rounded-full animate-glow-fast pointer-events-none z-0"></div>

      <div className="px-4 py-5 bg-soft-gray/80 backdrop-blur-lg border-b border-border-gray z-30 shadow-xl relative overflow-hidden shrink-0 shadow-gold/5">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[150%] bg-gold/5 blur-[50px] rounded-full pointer-events-none animate-glow-slow"></div>
        <div className="flex justify-between items-start gap-3 mb-5 relative z-10">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('profile');
                setView('user');
                window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light');
              }}
              className="shrink-0 w-14 h-14 rounded-2xl overflow-hidden border border-gold/35 bg-matte-black/60 shadow-md shadow-gold/10 active:scale-95 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
              aria-label="Открыть профиль"
            >
              {headerActor?.photo_url ? (
                <img
                  src={headerActor.photo_url}
                  alt=""
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-matte-black">
                  <UserCircleIcon className="w-11 h-11 text-gold/35" />
                </div>
              )}
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] text-white/55 leading-snug font-medium">
                {timeGreeting}
              </p>
              <p className="text-[20px] font-black text-white leading-tight tracking-tight truncate mt-0.5">
                {headerDisplayName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-0.5">
            <div className="relative inline-block">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="appearance-none bg-matte-black/60 border border-gold/20 rounded-xl px-3 py-1.5 text-[11px] font-black text-white pr-9 outline-none shadow-md backdrop-blur-md shadow-gold/5"
              >
                {Object.keys(CURRENCIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="w-4 h-4 text-gold absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {isAdmin && (
              <button
                onClick={() => setView(view === 'admin' ? 'user' : 'admin')}
                className="p-2.5 bg-matte-black rounded-xl border border-gold/20 active:scale-90 transition-all shadow-lg hover:shadow-gold/10"
              >
                <ShieldCheckIconOutline className="w-5 h-5 text-gold" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div className="bg-matte-black/60 backdrop-blur-sm p-4 rounded-2xl border border-border-gray/50 flex flex-col gap-2 shadow-lg shadow-black/20">
             <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/5 blur-xl rounded-full"></div>
             <div className="flex items-center gap-2 text-white/50">
               <CurrencyDollarIcon className="h-5 w-5 shrink-0" />
               <p className="text-[13px] font-semibold leading-snug">Всего разыграно</p>
             </div>
             <p className="text-[21px] font-black text-white leading-tight tracking-tight">{convert(stats.total)} {CURRENCIES[currency].symbol}</p>
          </div>
          <div className="bg-matte-black/60 backdrop-blur-sm p-4 rounded-2xl border border-border-gray/50 flex flex-col gap-2 shadow-lg shadow-gold/5">
             <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-gold/5 blur-xl rounded-full"></div>
             <div className="flex items-center gap-2 text-gold/75">
               <SparklesIcon className="h-5 w-5 shrink-0" />
               <p className="text-[13px] font-semibold leading-snug text-gradient-gold">Разыграно за {ruMonthNameLong()}</p>
             </div>
             <p className="text-[21px] font-black text-gradient-gold leading-tight tracking-tight">{convert(stats.thisMonth)} {CURRENCIES[currency].symbol}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 no-scrollbar relative z-10 pb-24">
        {view === 'admin' ? (
          <div className="space-y-5">
             <div className="bg-soft-gray/80 backdrop-blur-md p-5 rounded-3xl border border-border-gray/50 space-y-5 shadow-xl relative overflow-hidden shadow-gold/5">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 blur-3xl"></div>
                <div className="flex items-center gap-2 relative z-10">
                  <PlusIcon className="w-5 h-5 text-gold" />
                  <h3 className="text-[14px] font-black uppercase text-gradient-gold tracking-wide">Новый розыгрыш</h3>
                </div>
                
                <div className="flex gap-2 p-1 bg-matte-black/40 rounded-xl relative z-10">
                  <button onClick={() => setNewContestType('casino')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-lg transition-all ${newContestType === 'casino' ? 'bg-gold text-matte-black' : 'text-white/40'}`}>Казино</button>
                  <button onClick={() => setNewContestType('youtube')} className={`flex-1 py-2 text-[11px] font-black uppercase rounded-lg transition-all ${newContestType === 'youtube' ? 'bg-gold text-matte-black' : 'text-white/40'}`}>YouTube</button>
                </div>

                <div className="space-y-4 relative z-10">
                  <input placeholder="Название розыгрыша (необязательно)" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all"/>
                  <textarea
                    placeholder="Описание розыгрыша (необязательно)"
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    rows={3}
                    className="w-full resize-none bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all"
                  />
                  
                  <div className="space-y-3 p-4 bg-matte-black/40 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 mb-2">
                       <p className="text-[11px] font-black uppercase text-white/40 tracking-wider">Тип приза:</p>
                    </div>
                    <div className="flex gap-2 p-1 bg-matte-black/40 rounded-xl">
                      <button onClick={() => setNewPrizeType('money')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${newPrizeType === 'money' ? 'bg-gold text-matte-black' : 'text-white/40'}`}>Деньги</button>
                      <button onClick={() => setNewPrizeType('other')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${newPrizeType === 'other' ? 'bg-gold text-matte-black' : 'text-white/40'}`}>Что-то иное</button>
                    </div>
                    {newPrizeType === 'money' ? (
                      <input type="number" placeholder="Приз (RUB)" value={newPrize} onChange={e => setNewPrize(e.target.value)} className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all"/>
                    ) : (
                      <input placeholder="Описание приза (например: iPhone 15)" value={newCustomPrize} onChange={e => setNewCustomPrize(e.target.value)} className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all"/>
                    )}
                  </div>

                  <div className="space-y-3 p-4 bg-matte-black/40 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                       <p className="text-[11px] font-black uppercase text-white/40 tracking-wider">Обложка розыгрыша:</p>
                       {newImageUrl && (
                         <button
                           type="button"
                           onClick={() => {
                             setNewImageUrl('');
                             setCoverCropOpen(false);
                             setCoverCropSrc(null);
                           }}
                           className="text-[10px] font-bold text-red-500 uppercase"
                         >
                           Удалить
                         </button>
                       )}
                    </div>
                    <div className="relative group">
                      <input 
                        placeholder="Вставьте ссылку или из буфера" 
                        value={newImageUrl} 
                        onChange={e => setNewImageUrl(e.target.value)} 
                        onPaste={(e) => {
                          const items = e.clipboardData.items;
                          for (let i = 0; i < items.length; i++) {
                            if (items[i].type.indexOf('image') !== -1) {
                              const blob = items[i].getAsFile();
                              if (blob) {
                                e.preventDefault();
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  const data = event.target?.result;
                                  if (typeof data === 'string') {
                                    setCoverCropSrc(data);
                                    setCoverCropOpen(true);
                                  }
                                };
                                reader.readAsDataURL(blob);
                              }
                              break;
                            }
                          }
                        }}
                        className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all pr-12"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                        <PlusIcon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                    {newImageUrl && (
                      <div className="mt-2 space-y-2">
                        <div className="rounded-xl overflow-hidden border border-gold/20 aspect-video bg-matte-black/60 relative group">
                          <img src={newImageUrl} className="w-full h-full object-cover" alt="Preview" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                            <p className="text-[10px] font-black text-white uppercase">Предпросмотр обложки</p>
                          </div>
                        </div>
                        {(newImageUrl.startsWith('data:image/') || /^https?:\/\//i.test(newImageUrl)) && (
                          <button
                            type="button"
                            onClick={() => {
                              setCoverCropSrc(newImageUrl);
                              setCoverCropOpen(true);
                            }}
                            className="w-full rounded-xl border border-gold/35 bg-gold/10 py-2.5 text-[11px] font-black uppercase tracking-wide text-gold-light active:scale-[0.99]"
                          >
                            Обрезать в 16:9
                          </button>
                        )}
                      </div>
                    )}
                    <p className="text-[9px] font-medium text-white/25 leading-snug">
                      Картинка из буфера (Ctrl+V) открывает кадрирование 16:9. По ссылке — нажмите «Обрезать в 16:9» после предпросмотра.
                    </p>
                  </div>

                  {newContestType === 'youtube' && (
                    <div className="space-y-3 p-4 bg-matte-black/40 rounded-2xl border border-white/5">
                      <input placeholder="Ссылка на YouTube видео" value={newYtVideoUrl} onChange={e => setNewYtVideoUrl(e.target.value)} className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all"/>
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[12px] font-bold text-white/60">Поставить лайк</label>
                        <input type="checkbox" checked={newYtRequireLike} onChange={e => setNewYtRequireLike(e.target.checked)} className="accent-gold w-5 h-5"/>
                      </div>
                      <div className="flex items-center justify-between px-2">
                        <label className="text-[12px] font-bold text-white/60">Оставить комментарий</label>
                        <input type="checkbox" checked={newYtRequireComment} onChange={e => setNewYtRequireComment(e.target.checked)} className="accent-gold w-5 h-5"/>
                      </div>
                      <div className="flex items-center justify-between px-2 gap-4">
                        <label className="text-[12px] font-bold text-white/60 shrink-0">Посмотреть видео (мин)</label>
                        <input type="number" value={newYtWatchTime} onChange={e => setNewYtWatchTime(e.target.value)} className="w-20 bg-matte-black/60 p-2 rounded-xl border border-border-gray text-[14px] text-white outline-none text-center"/>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <input type="number" placeholder="Количество победителей" value={newWinners} onChange={e => setNewWinners(e.target.value)} className="bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-all"/>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {newContestType === 'casino' ? (
                      <select value={newProjectId} onChange={e => setNewProjectId(e.target.value)} className="bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-gold font-bold outline-none shadow-inner">
                        <option value="">Проект</option>
                        {presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    ) : (
                      <div className="bg-matte-black/20 p-4 rounded-xl border border-border-gray text-[12px] text-white/20 font-black uppercase flex items-center justify-center">YouTube Тип</div>
                    )}
                    <select value={newDuration} onChange={e => setNewDuration(e.target.value)} className="bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-gold font-bold outline-none shadow-inner">
                      {DURATION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-matte-black/40 rounded-2xl border border-gold/20">
                     <div className="flex items-center gap-3">
                        <BeakerIcon className="w-5 h-5 text-gold/60" />
                        <label className="text-[12px] font-black uppercase text-white/60 tracking-wider">Тестовый розыгрыш</label>
                     </div>
                     <input type="checkbox" checked={isNewTest} onChange={e => setIsNewTest(e.target.checked)} className="accent-gold w-5 h-5 shadow-inner"/>
                  </div>

                  <div className="space-y-2 p-4 bg-matte-black/40 rounded-2xl border border-white/5">
                     <p className="text-[11px] font-black uppercase text-white/40 tracking-wider mb-3">Тип игры победителей</p>
                     <div className="flex gap-2 p-1 bg-matte-black/40 rounded-xl">
                       <button
                         type="button"
                         onClick={() => setNewIsFakeGiveaway(false)}
                         className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${!newIsFakeGiveaway ? 'bg-gold text-matte-black' : 'text-white/40'}`}
                       >
                         Настоящий
                       </button>
                       <button
                         type="button"
                         onClick={() => setNewIsFakeGiveaway(true)}
                         className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${newIsFakeGiveaway ? 'bg-amber-600 text-white' : 'text-white/40'}`}
                       >
                         Фейковый (боты)
                       </button>
                     </div>
                     <p className="text-[9px] text-white/30 leading-relaxed">
                       {newIsFakeGiveaway
                         ? 'К участию добавляются фиктивные билеты; в итогах побеждают только «боты», живые люди не выигрывают.'
                         : 'Участвуют только реальные люди; победители выбираются случайно среди них.'}
                     </p>
                  </div>
                </div>
                <button onClick={handleCreateContest} className="w-full py-4 bg-gold text-matte-black font-black rounded-xl uppercase text-[12px] active:scale-95 transition-all shadow-md relative z-10 shadow-gold/20">Опубликовать</button>
             </div>

             <div className="bg-soft-gray/80 backdrop-blur-md p-5 rounded-3xl border border-gold/40 space-y-5 shadow-xl relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-gold" />
                  <h3 className="text-[14px] font-black uppercase text-gradient-gold tracking-wide">Управление проектами</h3>
                </div>
                <div className="space-y-4">
                   <input placeholder="Название проекта" value={newPresetName} onChange={e => setNewPresetName(e.target.value)} className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold"/>
                   <input placeholder="Реф. ссылка" value={newPresetLink} onChange={e => setNewPresetLink(e.target.value)} className="w-full bg-matte-black/60 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold"/>
                   <div
                     onPaste={handlePresetLogoPaste}
                     className="rounded-xl border border-border-gray/80 bg-matte-black/50 p-3"
                   >
                     <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
                       Логотип проекта (PNG, прозрачный фон)
                     </p>
                     <div className="flex items-center gap-2">
                       <button
                         type="button"
                         onClick={() => presetLogoInputRef.current?.click()}
                         className="rounded-lg border border-gold/35 bg-gold/10 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gold transition-colors hover:bg-gold/15"
                       >
                         Выбрать PNG
                       </button>
                       <span className="text-[10px] font-bold text-white/45">
                         или вставьте из буфера (Ctrl+V)
                       </span>
                     </div>
                     <input
                       ref={presetLogoInputRef}
                       type="file"
                       accept="image/png"
                       className="hidden"
                       onChange={(e) => handlePresetLogoFile(e.target.files?.[0])}
                     />
                     {newPresetLogo && (
                       <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-2.5">
                         <div
                           className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/10"
                           style={{
                             backgroundImage:
                               'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%)',
                             backgroundSize: '12px 12px',
                             backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                           }}
                         >
                           <img src={newPresetLogo} alt="" className="h-full w-full object-contain p-1" />
                         </div>
                         <button
                           type="button"
                           onClick={() => setNewPresetLogo('')}
                           className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-300"
                         >
                           Убрать
                         </button>
                       </div>
                     )}
                   </div>
                   <button onClick={handleCreatePreset} className="w-full py-4 bg-gold text-matte-black font-black rounded-xl uppercase text-[11px] active:scale-95 transition-all">Добавить проект</button>
                </div>
                <div className="space-y-2 mt-4 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                   {presets.map(p => (
                     <div key={p.id} className="flex justify-between items-center bg-matte-black/40 p-3 rounded-xl border border-white/5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-white/10"
                            style={{
                              backgroundImage:
                                'linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.05) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.05) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.05) 75%)',
                              backgroundSize: '10px 10px',
                              backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                            }}
                          >
                            {p.logoDataUrl ? (
                              <img src={p.logoDataUrl} alt="" className="h-full w-full object-contain p-0.5" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] font-black text-white/30">PNG</div>
                            )}
                          </div>
                          <span className="truncate text-[12px] font-bold text-white">{p.name}</span>
                        </div>
                        <button onClick={() => savePresets(presets.filter(pr => pr.id !== p.id))} className="text-red-500/50 hover:text-red-500"><TrashIcon className="w-4 h-4"/></button>
                     </div>
                   ))}
                </div>
             </div>

             <button
               onClick={async () => {
                 if (!window.confirm("Вы точно хотите вручную очистить всю историю розыгрышей?")) return;
                 await fetch('/api/kv?action=clear-contests', { method: 'POST' });
                 setContests([]);
               }}
               className="w-full py-4 border-2 border-red-500/20 text-red-500 font-black rounded-xl uppercase text-[11px] mt-4 relative z-10 shadow-lg active:bg-red-500/5"
             >
               Очистить историю розыгрышей
             </button>
          </div>
        ) : (
          <div className="relative space-y-4">
            {activeTab === 'contests' && (
              <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                <div className="home-main-glow-a absolute -left-[18%] top-[8%] h-[42%] w-[62%] rounded-full bg-gold/14 blur-[88px]" />
                <div className="home-main-glow-b absolute -right-[20%] top-[28%] h-[38%] w-[58%] rounded-full bg-gold/12 blur-[84px]" />
                <div className="home-main-glow-c absolute left-[8%] bottom-[8%] h-[26%] w-[64%] rounded-full bg-amber-300/10 blur-[72px]" />
              </div>
            )}
            {activeTab === 'contests' ? (
              <div className="relative z-[1] flex flex-col min-h-0">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-[20px] font-bold text-white tracking-tight">Розыгрыши</h2>
                  <button
                    type="button"
                    onClick={() => setGiveawaySegment('all')}
                    className={`text-[13px] font-bold px-2 py-1 rounded-lg transition-opacity ${
                      giveawaySegment === 'all'
                        ? 'text-gradient-gold drop-shadow-[0_0_12px_rgba(197,160,89,0.35)]'
                        : 'text-gold/70 hover:text-gold-light'
                    }`}
                  >
                    Все
                  </button>
                </div>

                <div className="flex p-1 rounded-2xl bg-matte-black/55 border border-gold/15 mb-5">
                  <button
                    type="button"
                    onClick={() => setGiveawaySegment('active')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                      giveawaySegment === 'active'
                        ? 'bg-gold-shimmer text-matte-black border border-gold/50 shadow-lg shadow-gold/25'
                        : 'text-white/35 border border-transparent hover:text-gold/60'
                    }`}
                  >
                    <GiftIcon className={`w-4 h-4 shrink-0 ${giveawaySegment === 'active' ? 'text-matte-black' : ''}`} />
                    Активные
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiveawaySegment('completed')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all ${
                      giveawaySegment === 'completed'
                        ? 'bg-gold-shimmer text-matte-black border border-gold/50 shadow-lg shadow-gold/25'
                        : 'text-white/35 border border-transparent hover:text-gold/60'
                    }`}
                  >
                    <TrophyIcon className={`w-4 h-4 shrink-0 ${giveawaySegment === 'completed' ? 'text-matte-black' : ''}`} />
                    Завершённые
                  </button>
                </div>

                {(giveawaySegment === 'active' || giveawaySegment === 'all') && (
                <div className="space-y-4 mb-6">
                  {giveawaySegment === 'all' && contestLists.active.length > 0 && (
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/25 px-1">Активные</p>
                  )}
                  {contestLists.active.length === 0 ? (
                    <div className="relative isolate flex flex-col items-center overflow-hidden rounded-[30px] border border-[rgba(197,160,89,0.28)] bg-[linear-gradient(165deg,rgba(22,20,16,0.9)_0%,rgba(11,11,10,0.96)_58%,rgba(18,16,12,0.92)_100%)] px-6 py-14 shadow-[0_20px_44px_rgba(0,0,0,0.35),0_0_34px_rgba(197,160,89,0.12)] backdrop-blur-sm">
                      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(243,229,171,0.35) 1px, transparent 0)', backgroundSize: '13px 13px' }} />
                      <div className="empty-active-glow-a pointer-events-none absolute -left-[16%] top-[6%] h-44 w-44 rounded-full bg-gold/22 blur-[70px]" />
                      <div className="empty-active-glow-b pointer-events-none absolute -right-[12%] bottom-[12%] h-40 w-40 rounded-full bg-amber-300/18 blur-[64px]" />
                      <div className="relative mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-[24px] border border-gold/35 bg-matte-black/85 shadow-[0_10px_26px_rgba(197,160,89,0.22)]">
                        <FaceFrownIcon className="h-10 w-10 text-gold" strokeWidth={2} />
                      </div>
                      <p className="relative text-center text-[19px] font-black tracking-tight text-white mb-2">Нет активных розыгрышей</p>
                      <p className="relative max-w-[280px] text-center text-[12px] leading-relaxed text-white/45">
                        но скоро они появятся :)
                      </p>
                    </div>
                  ) : (
                    contestLists.active.map(c => {
                      const userParticipation = profile.participatedContests[c.id];
                      const isParticipating = !!userParticipation;
                      return (
                        <div 
                          key={c.id} 
                          onClick={() => handleStartContest(c)}
                          className={`relative rounded-3xl border backdrop-blur-sm transition-all active:scale-[0.98] group overflow-hidden shadow-lg bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold/10 via-soft-gray/70 to-soft-gray/70 ${
                            isParticipating ? 'border-gold/55 ring-2 ring-gold/20 shadow-gold/15' : 'border-gold/30 shadow-gold/5'
                          } ${c.isTest ? 'ring-2 ring-gold/20' : ''}`}
                        >
                          {c.imageUrl && (
                            <div className="relative aspect-video w-full overflow-hidden">
                               <img src={c.imageUrl} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt="" referrerPolicy="no-referrer" />
                               <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[18%] bg-gradient-to-t from-soft-gray/25 via-soft-gray/[0.07] to-transparent" />
                               <div className="absolute left-3 top-3 flex gap-2">
                                  {c.type === 'youtube' && (
                                    <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-600/80 px-2 py-1 backdrop-blur-md">
                                      <VideoCameraIcon className="h-3 w-3 text-white" />
                                      <span className="text-[9px] font-black uppercase text-white">YouTube</span>
                                    </div>
                                  )}
                                  {c.isTest && (
                                    <div className="rounded-lg border border-gold/30 bg-gold/80 px-2 py-1 backdrop-blur-md">
                                      <span className="text-[9px] font-black uppercase text-matte-black">TEST</span>
                                    </div>
                                  )}
                               </div>
                            </div>
                          )}

                          <div className="p-5">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gold/5 blur-2xl pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/[0.02] blur-xl pointer-events-none"></div>
                            <div className="absolute -bottom-2 -left-2 w-12 h-12 border-l border-b border-gold/10 rounded-bl-3xl pointer-events-none"></div>
                            
                            {isParticipating && (
                              <div className="mb-3 flex items-center gap-2 text-gold-light relative z-10">
                                <CheckBadgeIcon className="w-5 h-5" />
                                <span className="text-[12px] font-black uppercase tracking-wider drop-shadow-sm text-gradient-gold">Вы участвуете</span>
                              </div>
                            )}
                            <div className="relative z-10 mb-5 flex min-w-0 items-center gap-2">
                                 {!c.imageUrl && c.type === 'youtube' && <VideoCameraIcon className="h-5 w-5 shrink-0 text-red-500 drop-shadow-sm" />}
                                 <h2 className="min-w-0 flex-1 truncate text-[19px] font-black uppercase leading-[1.15] tracking-tight text-white">{c.title}</h2>
                                 {!c.imageUrl && c.isTest && (
                                   <div className="shrink-0 rounded-lg border border-gold/30 bg-gold/20 px-2 py-1">
                                      <span className="text-[8px] font-black uppercase tracking-widest text-gold">TEST</span>
                                   </div>
                                 )}
                            </div>
                            <div className="relative z-10 grid grid-cols-3 gap-2 border-t border-border-gray/50 pt-5">
                              <div className="min-w-0 space-y-1">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/35">Приз:</p>
                                <p
                                  className={`text-[24px] font-black leading-[1.1] tracking-tight text-gradient-gold ${
                                    c.prizeType === 'other' ? 'line-clamp-2 break-words' : 'truncate'
                                  }`}
                                >
                                  {c.prizeType === 'other' ? c.customPrize : `${convert(c.prizeRub)} ${CURRENCIES[currency].symbol}`}
                                </p>
                              </div>
                              <div className="min-w-0 space-y-1 text-center">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Участников:</p>
                                <div className="flex items-center justify-center gap-1.5">
                                  <UsersIcon className="h-4 w-4 shrink-0 text-gold/45" />
                                  <p className="text-[24px] font-black tabular-nums leading-none text-white">{c.realParticipantCount || 0}</p>
                                </div>
                              </div>
                              <div className="min-w-0 space-y-1 text-right">
                                <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">До итогов:</p>
                                <div className="flex min-h-[1.5rem] items-center justify-end">
                                  {c.expiresAt ? (
                                    <Countdown expiresAt={c.expiresAt} />
                                  ) : (
                                    <span className="text-[24px] font-black tabular-nums leading-none text-white/25">—</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="relative z-10 mt-4 text-[11px] font-bold uppercase tracking-widest text-white/25">
                               <span>Победителей: {c.winnerCount}</span>
                            </div>

                            <div className="relative z-10 mt-6 flex w-full items-center justify-center rounded-2xl bg-gold-shimmer py-[1.1rem] text-[15px] font-black uppercase tracking-wide text-matte-black shadow-xl shadow-gold/20 transition-transform active:scale-95">
                               {isParticipating ? 'ПЕРЕЙТИ В РОЗЫГРЫШ' : 'УЧАСТВОВАТЬ'}
                            </div>

                            {isAdmin && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); if(window.confirm('Завершить розыгрыш и выбрать победителей?')) autoFinish(c.id, contests, avatars); }}
                                className="mt-5 w-full py-4 bg-matte-black/60 border border-gold/40 rounded-2xl text-[12px] font-black text-gradient-gold uppercase relative z-10 hover:bg-gold/10 transition-colors shadow-lg active:scale-95 flex items-center justify-center gap-2"
                              >
                                <TrophyIcon className="w-4 h-4" />
                                Завершить и выбрать победителей
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                )}

                {(giveawaySegment === 'completed' || giveawaySegment === 'all') && (
                <div className="space-y-4 mb-6">
                  {giveawaySegment === 'all' && contestLists.completed.length > 0 && (
                    <div className="flex items-center gap-3 py-2 mt-1">
                      <div className="h-[1px] flex-1 bg-border-gray/50" />
                      <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/25">Завершённые</span>
                      <div className="h-[1px] flex-1 bg-border-gray/50" />
                    </div>
                  )}
                  {contestLists.completed.length === 0 ? (
                    <div className="flex flex-col items-center py-14 px-6 rounded-[28px] bg-matte-black/35 border border-gold/15 backdrop-blur-sm shadow-[0_0_24px_rgba(197,160,89,0.08)]">
                      <div className="w-20 h-20 rounded-2xl bg-gold/10 border border-gold/25 flex items-center justify-center mb-5">
                        <TrophyIcon className="w-10 h-10 text-gold/55" />
                      </div>
                      <p className="text-[17px] font-bold text-white text-center mb-2">Нет завершённых розыгрышей</p>
                      <p className="text-[12px] text-white/40 text-center leading-relaxed max-w-[280px]">
                        Когда розыгрыш завершится, он появится здесь
                      </p>
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                  {contestLists.completed.map(c => {
                    return (
                      <div
                        key={c.id}
                        onClick={() => handleStartContest(c)}
                        className="relative flex flex-col overflow-hidden rounded-[20px] border border-gold/20 bg-soft-gray/85 shadow-[0_8px_28px_rgba(0,0,0,0.45)] transition-all active:scale-[0.98] active:opacity-95 bg-[radial-gradient(ellipse_at_50%_0%,rgba(197,160,89,0.12),transparent_55%)]"
                      >
                        {c.imageUrl ? (
                          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden border-b border-white/10">
                            <img src={c.imageUrl} className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-gradient-to-t from-matte-black/70 via-matte-black/20 to-transparent" />
                            <span className="absolute right-2 top-2 shrink-0 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/75 backdrop-blur-sm">
                              завершен
                            </span>
                          </div>
                        ) : (
                          <div className="relative aspect-[16/9] w-full shrink-0 border-b border-gold/15 bg-gradient-to-br from-gold/20 via-matte-black/80 to-matte-black">
                            <span className="absolute right-2 top-2 shrink-0 rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/75 backdrop-blur-sm">
                              завершен
                            </span>
                          </div>
                        )}
                        <div className="flex min-h-0 flex-col gap-1.5 p-3 pt-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {c.isTest && (
                                <span className="mb-1 inline-block rounded-md border border-gold/25 bg-gold/10 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-gold-light">
                                  test
                                </span>
                              )}
                              <h2 className="truncate text-[16px] font-black uppercase leading-[1.12] tracking-tight text-white">
                                {c.title}
                              </h2>
                            </div>
                          </div>

                          <div className="border-t border-white/10 pt-2">
                            <div className="flex min-h-[2.75rem] items-center justify-between gap-2">
                              <p className="min-w-0 flex-1 text-[16px] font-black leading-tight tracking-tight text-gradient-gold line-clamp-2">
                                {c.prizeType === 'other' ? c.customPrize : `${convert(c.prizeRub)} ${CURRENCIES[currency].symbol}`}
                              </p>
                              <div className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-matte-black/50 px-2">
                                <UsersIcon className="h-5 w-5 text-gold/70" />
                                <span className="text-[13px] font-black tabular-nums leading-none text-white/85">
                                  {c.realParticipantCount || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                  )}
                </div>
                )}

              </div>
            ) : (
              <div className="space-y-4 animate-slide-up">
                <div className="relative overflow-hidden rounded-[30px] border border-gold/20 bg-[linear-gradient(145deg,rgba(27,24,19,0.92)_0%,rgba(16,15,13,0.96)_55%,rgba(25,22,17,0.94)_100%)] p-5 shadow-[0_16px_38px_rgba(0,0,0,0.34),0_0_28px_rgba(197,160,89,0.12)] backdrop-blur-md">
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
                  <div className="pointer-events-none absolute -right-12 -bottom-12 h-44 w-44 rounded-full bg-gold/14 blur-3xl" />
                  <div className="pointer-events-none absolute -left-10 top-[-3.2rem] h-32 w-32 rounded-full bg-amber-300/8 blur-[58px]" />
                  <div className="relative z-[1] flex items-center gap-4">
                  {user?.photo_url ? (
                    <img src={user.photo_url} className="h-[72px] w-[72px] rounded-2xl border-2 border-gold/25 shadow-lg shadow-black/30" alt=""/>
                  ) : (
                    <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-gold/20 bg-matte-black/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <UserCircleIcon className="h-11 w-11 text-gold/25"/>
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-[29px] font-black uppercase leading-none tracking-tight text-white">{user?.first_name || 'Инкогнито'}</h2>
                    <p className="mt-2 text-[12px] font-bold uppercase tracking-[0.18em] text-gold/55">ID: {user?.id || '000000'}</p>
                  </div>
                </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="relative overflow-hidden rounded-[26px] border border-[rgba(197,160,89,0.2)] bg-[linear-gradient(155deg,rgba(27,26,24,0.9)_0%,rgba(18,18,17,0.95)_100%)] p-5 text-center shadow-[0_12px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm transition-shadow active:shadow-gold/10">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(197,160,89,0.08),transparent_55%)]" />
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/30">Участий</p>
                      <p className="text-[31px] font-black leading-none text-white">{profile.participationCount}</p>
                   </div>
                   <div className="relative overflow-hidden rounded-[26px] border border-[rgba(197,160,89,0.24)] bg-[linear-gradient(150deg,rgba(34,29,17,0.9)_0%,rgba(20,18,13,0.95)_100%)] p-5 text-center shadow-[0_12px_30px_rgba(0,0,0,0.32),0_0_18px_rgba(197,160,89,0.1)] backdrop-blur-sm transition-shadow active:shadow-gold/20">
                      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-gold/18 blur-2xl" />
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-gold/55">Выигрыш</p>
                      <p className="text-[31px] font-black leading-none text-gradient-gold">{convert(profile.totalWon || 0)} {CURRENCIES[currency].symbol}</p>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-matte-black/95 backdrop-blur-2xl border-t border-border-gray/50 px-6 py-2 pb-5 flex justify-around z-[90] shadow-[0_-10px_30px_rgba(0,0,0,0.5)] shrink-0 shadow-gold/5">
        <button onClick={() => { setActiveTab('contests'); setView('user'); }} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeTab === 'contests' && view === 'user' ? 'text-gradient-gold drop-shadow-[0_0_8px_rgba(197,160,89,0.3)]' : 'opacity-20'}`}>
          <GiftIcon className="w-5 h-5"/>
          <span className="text-[9px] font-black uppercase tracking-widest">РОЗЫГРЫШИ</span>
        </button>
        <button onClick={() => { setActiveTab('profile'); setView('user'); }} className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${activeTab === 'profile' ? 'text-gradient-gold drop-shadow-[0_0_8px_rgba(197,160,89,0.3)]' : 'opacity-20'}`}>
          <UserCircleIcon className="w-5 h-5"/>
          <span className="text-[9px] font-black uppercase tracking-widest">ПРОФИЛЬ</span>
        </button>
      </nav>

      {step !== ContestStep.LIST && (
        <div
          className={`fixed inset-0 z-[100] flex flex-col bg-matte-black p-6 animate-slide-up no-scrollbar overflow-x-hidden ${
            step === ContestStep.TICKET_SHOW || step === ContestStep.REFERRAL
              ? 'overflow-hidden overscroll-none'
              : 'overflow-y-auto'
          }`}
        >
           <div className="absolute top-[-10%] right-[-10%] w-[70%] h-[50%] bg-gold/[0.07] blur-[120px] rounded-full pointer-events-none z-0"></div>
           <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[40%] bg-gold/[0.04] blur-[100px] rounded-full pointer-events-none z-0"></div>

           {step === ContestStep.REFERRAL && (
             <div
               className="pointer-events-none absolute inset-0 z-[96] overflow-hidden"
               aria-hidden
             >
               <div className="referral-gold-bg-a absolute -left-[18%] top-[4%] h-[min(85vw,400px)] w-[min(85vw,400px)] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(243,229,171,0.45)_0%,rgba(197,160,89,0.22)_35%,transparent_68%)] blur-[90px]" />
               <div className="referral-gold-bg-b absolute -right-[12%] top-[32%] h-[min(70vw,320px)] w-[min(70vw,320px)] rounded-full bg-[radial-gradient(circle_at_55%_45%,rgba(197,160,89,0.38)_0%,rgba(120,90,40,0.12)_42%,transparent_70%)] blur-[78px]" />
               <div className="referral-gold-bg-c absolute bottom-[2%] left-[5%] h-[min(62vw,280px)] w-[min(62vw,280px)] rounded-full bg-[radial-gradient(circle_at_50%_55%,rgba(243,229,171,0.28)_0%,rgba(197,160,89,0.14)_40%,transparent_72%)] blur-[72px]" />
               <div className="referral-gold-bg-d absolute bottom-[18%] right-[-8%] h-[min(55vw,240px)] w-[min(55vw,240px)] rounded-full bg-[radial-gradient(circle_at_45%_50%,rgba(197,160,89,0.32)_0%,transparent_65%)] blur-[64px]" />
               <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_45%,rgba(197,160,89,0.08),transparent_55%)]" />
             </div>
           )}

           {(step === ContestStep.PAYOUT || step === ContestStep.TICKET_SHOW) && (
             <div
               className="pointer-events-none absolute inset-0 z-[97] overflow-hidden"
               aria-hidden
             >
               <div className="payout-bg-glow-a absolute -left-[20%] top-[6%] h-[min(78vw,380px)] w-[min(78vw,380px)] rounded-full bg-emerald-400/[0.32] blur-[96px]" />
               <div className="payout-bg-glow-b absolute -right-[18%] top-[38%] h-[min(65vw,300px)] w-[min(65vw,300px)] rounded-full bg-teal-300/[0.28] blur-[84px]" />
               <div className="payout-bg-glow-c absolute bottom-[4%] left-[10%] h-[min(55vw,260px)] w-[min(55vw,260px)] rounded-full bg-green-400/[0.22] blur-[72px]" />
               <div className="payout-bg-glow-d absolute bottom-[22%] right-[5%] h-[min(48vw,220px)] w-[min(48vw,220px)] rounded-full bg-emerald-300/[0.2] blur-[64px]" />
             </div>
           )}

           {(step === ContestStep.PAYOUT || step === ContestStep.TICKET_SHOW) && (
             <div className="pointer-events-none absolute inset-0 z-[101] overflow-hidden">
               {(step === ContestStep.PAYOUT ? PAYOUT_USDT_BG_DECOR : TICKET_KLEVER_BG_DECOR).map((c, i) => (
                 <div
                   key={`${step}-${i}`}
                   className={`absolute select-none ${c.className}`}
                   style={{
                     animation: `coinLevitate ${c.dur}s ease-in-out infinite`,
                     animationDelay: `${c.delay}s`,
                   }}
                 >
                   <img
                     src={c.src}
                     alt=""
                     className="h-auto w-full object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
                     style={{ opacity: c.opacity }}
                     loading="lazy"
                     draggable={false}
                   />
                 </div>
               ))}
               <div
                 className="absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_42%,rgba(6,95,70,0.2),transparent_68%)]"
                 aria-hidden
               />
               <div
                 className="absolute inset-0 bg-gradient-to-b from-[rgb(4,48,36)]/[0.38] via-[rgb(6,18,14)]/[0.5] to-[rgb(4,42,32)]/[0.42]"
                 aria-hidden
               />
               <div className="absolute inset-0 bg-teal-950/[0.22] mix-blend-multiply" aria-hidden />
             </div>
           )}

           <button
             onClick={() => {
               setStep(ContestStep.LIST);
               setVerifyStatus('idle');
             }}
             className={`absolute top-6 left-6 z-[110] rounded-xl border bg-soft-gray/90 p-2 shadow-xl backdrop-blur-md transition-all active:scale-90 ${
               step === ContestStep.PAYOUT || step === ContestStep.TICKET_SHOW
                 ? 'border-teal-500/35 text-teal-300 shadow-teal-900/20'
                 : 'border-border-gray/50 text-gold shadow-gold/5'
             }`}
           >
             <ChevronLeftIcon className="h-5 w-5" />
           </button>
           
           <div
             className={`relative z-[105] flex flex-1 flex-col items-center justify-center space-y-10 py-10 text-center ${
               step === ContestStep.TICKET_SHOW
                 ? 'min-h-0'
                 : step === ContestStep.REFERRAL
                   ? 'min-h-0 overflow-hidden'
                   : ''
             }`}
           >
              {step === ContestStep.CAPTCHA && (
                <div className="w-full max-w-[340px] space-y-12 animate-pop flex flex-col items-center">
                   <div className="space-y-4 text-center">
                      <h2 className="text-3xl font-black text-white tracking-tighter leading-none uppercase drop-shadow-md">Проверка</h2>
                      <p className="text-[13px] font-bold text-white/20 uppercase tracking-widest font-light">Подтвердите, что вы человек</p>
                   </div>
                   
                   <div className="bg-[#f9f9f9] border border-[#d3d3d3] rounded-[3px] p-2 flex items-center justify-between w-[302px] h-[76px] shadow-lg relative overflow-hidden">
                      <div className="flex items-center gap-3 ml-1 relative z-10">
                        <button 
                          onClick={startCaptcha}
                          disabled={captchaLoading || captchaDone}
                          className="w-[28px] h-[28px] bg-white border-2 border-[#c1c1c1] rounded-[2px] flex items-center justify-center transition-all active:scale-90 disabled:active:scale-100"
                        >
                          {captchaLoading ? (
                            <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />
                          ) : captchaDone ? (
                            <CheckIcon className="w-6 h-6 text-green-600 stroke-[4px]" />
                          ) : null}
                        </button>
                        <span className="text-[14px] text-[#555] font-normal font-sans">
                          {captchaDone ? 'Готово' : 'Я не робот'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center pr-1 opacity-80 scale-[0.85] origin-right relative z-10">
                        <img 
                          src="https://www.gstatic.com/recaptcha/api2/logo_48.png" 
                          className="w-8 h-8 opacity-40 grayscale" 
                          alt="reCAPTCHA"
                        />
                        <span className="text-[8px] text-[#555] mt-1 font-bold">reCAPTCHA</span>
                        <div className="flex gap-1 text-[7px] text-[#555] mt-0.5 opacity-60">
                          <span>Конфиденциальность</span>
                          <span>-</span>
                          <span>Условия</span>
                        </div>
                      </div>
                   </div>
                </div>
              )}

              {step === ContestStep.REFERRAL && (
                <div className="w-full max-w-[340px] animate-pop">
                  <div className="relative overflow-hidden rounded-[28px] border border-gold/30 bg-gradient-to-b from-[#1f1a14] via-[#12100c] to-[#0a0907] p-6 pb-7 pt-7 shadow-[0_12px_48px_rgba(0,0,0,0.55),0_0_40px_rgba(197,160,89,0.14)] backdrop-blur-md">
                    <div
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_55%_at_50%_-15%,rgba(197,160,89,0.16),transparent_52%)]"
                      aria-hidden
                    />
                    <div
                      className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
                      aria-hidden
                    />
                    <div className="relative z-10 space-y-8">
                  <div className="w-20 h-20 bg-gold/10 rounded-[40px] flex items-center justify-center border border-gold/20 mx-auto shadow-lg relative overflow-hidden group shadow-gold/5">
                    <div className="absolute inset-0 bg-gold/10 blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
                    {selectedContest?.type === 'youtube' ? (
                      <VideoCameraIcon className="w-10 h-10 text-red-500 relative z-10"/>
                    ) : selectedProjectPreset?.logoDataUrl ? (
                      <img
                        src={selectedProjectPreset.logoDataUrl}
                        alt=""
                        className="relative z-10 h-11 w-11 object-contain"
                        draggable={false}
                      />
                    ) : (
                      <LinkIcon className="w-10 h-10 text-gold relative z-10"/>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white leading-none drop-shadow-md">Проверка</h2>
                    {selectedContest?.type === 'youtube' ? (
                      <div className="space-y-4 px-1">
                        <p className="text-[12px] uppercase font-bold text-white/35 tracking-widest">Выполните условия участия:</p>
                        <div className="space-y-2 text-left rounded-2xl border border-gold/15 bg-matte-black/45 p-5 backdrop-blur-sm">
                           {selectedContest.youtubeConfig?.requireLike && (
                             <div className="flex items-center gap-3">
                               <HandThumbUpIcon className="w-4 h-4 text-gold/60" />
                               <span className="text-[11px] font-bold text-white/80">Поставить лайк</span>
                             </div>
                           )}
                           {selectedContest.youtubeConfig?.requireComment && (
                             <div className="flex items-center gap-3">
                               <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-gold/60" />
                               <span className="text-[11px] font-bold text-white/80">Оставить комментарий</span>
                             </div>
                           )}
                           <div className="flex items-center gap-3">
                             <ClockIcon className="w-4 h-4 text-gold/60" />
                             <span className="text-[11px] font-bold text-white/80">Посмотреть видео ({selectedContest.youtubeConfig?.watchTimeMinutes} мин)</span>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <p className="px-2 text-[14px] font-semibold uppercase leading-relaxed tracking-wide text-white/58">
                        Подтвердите статус реферала на{' '}
                        {selectedProjectPreset?.name}
                      </p>
                    )}
                  </div>

                  {refError && (
                    <div className="rounded-2xl border border-red-500/35 bg-red-950/25 p-5 shadow-inner shadow-red-900/20">
                      {refError === REFERRAL_PROJECT_VERIFY_ERROR ? (
                        <div className="flex gap-3.5 text-left">
                          <ExclamationTriangleIcon className="h-7 w-7 shrink-0 text-red-400" aria-hidden />
                          <div className="min-w-0 space-y-1.5">
                            <p className="text-[15px] font-black uppercase leading-tight text-red-400">ОШИБКА!</p>
                            <p className="text-[12px] font-bold leading-relaxed text-red-200/90">
                              Проверьте, правильный ли ID с {selectedProjectPreset?.name || 'проект'} и являетесь ли вы моим рефералом и попробуйте снова через 3 секунды.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[13px] font-black uppercase leading-relaxed text-red-400">{refError}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => {
                        const url =
                          selectedContest?.type === 'youtube'
                            ? selectedContest.youtubeConfig?.videoUrl
                            : selectedProjectPreset?.referralLink;
                        window.open(url, '_blank');
                        setIsProjectOpened(true);
                        if (selectedContest?.type === 'youtube') setYtTaskStartedAt(Date.now());
                      }}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl border border-gold/20 bg-soft-gray py-4 text-[12px] font-black uppercase text-gradient-gold shadow-md shadow-gold/5 backdrop-blur-md transition-all hover:bg-gold/5 active:scale-95"
                    >
                      <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                      {selectedContest?.type === 'youtube' ? 'Перейти на видео' : 'Открыть проект'}
                    </button>

                    {selectedContest?.type !== 'youtube' && (
                      <div className="space-y-2 text-left">
                        <label
                          htmlFor="referral-project-id"
                          className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/45"
                        >
                          Введите ваш ID с {selectedProjectPreset?.name || 'проект'}
                        </label>
                        <input
                          id="referral-project-id"
                          type="text"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          value={referralProjectIdInput}
                          onChange={(e) => {
                            setReferralProjectIdInput(e.target.value);
                            if (refError === REFERRAL_PROJECT_VERIFY_ERROR) setRefError('');
                          }}
                          placeholder="Например: #1A2B3C"
                          className="w-full rounded-2xl border border-gold/20 bg-matte-black/55 px-4 py-3.5 font-mono text-[14px] tracking-wide text-white outline-none ring-0 placeholder:text-white/25 focus:border-gold/45 focus:ring-2 focus:ring-gold/15"
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleRefCheck}
                      disabled={
                        isRefChecking ||
                        !isProjectOpened ||
                        (selectedContest?.type !== 'youtube' &&
                          (!isReferralProjectIdFormat(referralProjectIdInput) ||
                            (irisVerifyRetryAfter != null && Date.now() < irisVerifyRetryAfter)))
                      }
                      className={`flex w-full items-center justify-center gap-4 rounded-3xl border py-5 text-[14px] font-black uppercase shadow-lg transition-all active:translate-y-1 ${
                        isRefChecking ||
                        !isProjectOpened ||
                        (selectedContest?.type !== 'youtube' &&
                          (!isReferralProjectIdFormat(referralProjectIdInput) ||
                            (irisVerifyRetryAfter != null && Date.now() < irisVerifyRetryAfter)))
                          ? 'border-gold/30 bg-matte-black/80 text-gold/40 shadow-[inset_0_1px_0_rgba(197,160,89,0.12)] backdrop-blur-sm'
                          : 'border-transparent bg-gold text-matte-black shadow-gold/25'
                      }`}
                    >
                      {isRefChecking ? (
                        <span className="flex items-center gap-3">
                          <ArrowPathIcon className="h-6 w-6 animate-spin" />
                          {selectedContest?.type === 'youtube'
                            ? 'Проверка...'
                            : `Проверка на ${selectedProjectPreset?.name || 'проект'}`}
                        </span>
                      ) : (
                        <span className="flex items-center gap-3">
                          {!isRefChecking &&
                          (!isProjectOpened ||
                            (selectedContest?.type !== 'youtube' &&
                              (!isReferralProjectIdFormat(referralProjectIdInput) ||
                                (irisVerifyRetryAfter != null &&
                                  Date.now() < irisVerifyRetryAfter)))) ? (
                            <LockClosedIcon className="h-5 w-5 text-gold/45" />
                          ) : null}
                          Подтвердить
                        </span>
                      )}
                    </button>
                  </div>
                    </div>
                  </div>
                </div>
              )}

              {step === ContestStep.SUCCESS && selectedContest?.isCompleted && (
                <div className="relative w-full max-w-[440px] animate-fade-in px-1">
                  <div className="pointer-events-none absolute inset-x-0 top-[-56px] z-0 h-48 rounded-[100%] bg-gold/20 blur-3xl" />
                  <div className="pointer-events-none absolute -left-14 top-[36%] z-0 h-44 w-44 rounded-full bg-emerald-500/15 blur-[80px]" />
                  <div className="pointer-events-none absolute -right-12 bottom-10 z-0 h-52 w-52 rounded-full bg-gold/12 blur-[90px]" />

                  <div className="relative z-[1] overflow-hidden rounded-[32px] border border-gold/20 bg-gradient-to-b from-[#17140f]/95 via-matte-black/95 to-[#090805] p-4 shadow-[0_24px_68px_rgba(0,0,0,0.56),0_0_44px_rgba(197,160,89,0.14)]">
                    <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)', backgroundSize: '14px 14px' }} />
                    <div className="pointer-events-none absolute -top-16 right-[-12%] h-52 w-52 rounded-full bg-gold/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 left-1/2 h-48 w-[120%] -translate-x-1/2 rounded-[100%] bg-emerald-500/10 blur-[72px]" />

                    <div className="relative z-[2] space-y-5">
                      <div className="space-y-2 text-center">
                        <h2 className="text-[28px] font-black uppercase leading-none tracking-tighter text-white drop-shadow-md">Итоги розыгрыша</h2>
                        {(() => {
                          const myTicket = profile.participatedContests[selectedContest.id];
                          const currentUserId = user?.id;
                          const isWinner = !!selectedContest.winners?.some((w) => {
                            if (w.isFake) return false;
                            if (currentUserId && w.userId) return w.userId === currentUserId;
                            return !!myTicket && w.ticketNumber === myTicket;
                          });
                          return (
                            <div className={`mx-auto mt-2 inline-flex items-center rounded-full border px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide ${
                              isWinner
                                ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,0.25)]'
                                : 'border-red-400/35 bg-red-500/10 text-red-200 shadow-[0_0_18px_rgba(248,113,113,0.2)]'
                            }`}>
                              {isWinner ? 'Вы выиграли!' : 'Вы не выиграли!'}
                            </div>
                          );
                        })()}
                      </div>
                      {selectedContest.imageUrl ? (
                        <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-gold/25 bg-matte-black/70">
                          <img src={selectedContest.imageUrl} className="h-full w-full object-cover" alt="" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-gradient-to-t from-matte-black/75 via-matte-black/30 to-transparent" />
                        </div>
                      ) : (
                        <div className="aspect-video w-full rounded-[20px] border border-gold/20 bg-[radial-gradient(ellipse_at_60%_30%,rgba(197,160,89,0.24),transparent_55%),linear-gradient(160deg,#1b1914_0%,#0b0a08_100%)]" />
                      )}
                      <div className="space-y-1.5 text-center">
                        <p className="text-[21px] font-black uppercase leading-tight tracking-tight text-gold/95">
                          {selectedContest.title}
                        </p>
                        {selectedContest.description && (
                          <p className="mx-auto max-w-[92%] whitespace-pre-line text-[12px] leading-snug text-white/60">
                            {selectedContest.description}
                          </p>
                        )}
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <p className="mb-3 text-center text-[11px] font-black uppercase tracking-[0.24em] text-white/45">
                          Победители
                        </p>
                      <div className="max-h-[34vh] space-y-3 overflow-y-auto px-1 pr-2 custom-scrollbar">
                        {selectedContest.winners?.map((w, i) => (
                          <div key={i} className="relative overflow-hidden rounded-[24px] border border-gold/20 bg-[linear-gradient(150deg,rgba(21,18,12,0.92)_0%,rgba(14,12,9,0.95)_52%,rgba(18,15,10,0.93)_100%)] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.34),0_0_14px_rgba(197,160,89,0.08)] backdrop-blur-md">
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
                            <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gold/12 blur-3xl" />
                            <div className="pointer-events-none absolute -left-8 bottom-[-2.4rem] h-20 w-24 rounded-full bg-amber-400/5 blur-2xl" />
                            <div className="relative z-10 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3 text-left">
                              <div className="shrink-0">
                                {w.avatarUrl ? (
                                  <img src={w.avatarUrl} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full border border-gold/40 object-cover shadow-sm" alt="" />
                                ) : (
                                  <div className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-[12px] font-black text-white shadow-inner ${getFallbackColor(w.name)}`}>
                                    {w.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                                <div className="min-w-0">
                                  <div className="text-[clamp(0.82rem,3.5vw,0.95rem)] font-black leading-tight tracking-tight text-white break-words">
                                    <BlurredWinnerName name={w.name} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {isAdmin && w.payoutAddress && (
                                  <button
                                    type="button"
                                    title="Скопировать адрес TRC‑20"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(w.payoutAddress || '');
                                    }}
                                    className="rounded-lg bg-gold/10 p-1.5 text-gold transition-transform active:scale-90"
                                  >
                                    <ClipboardDocumentIcon className="h-4 w-4" />
                                  </button>
                                )}
                                <p className="text-right leading-tight">
                                  <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-white/90">Приз:</span>
                                  <span className="bg-gradient-to-r from-emerald-300 via-green-300 to-emerald-400 bg-clip-text text-[18px] font-black tracking-tight text-transparent drop-shadow-[0_0_12px_rgba(16,185,129,0.32)]">
                                    +{convert(w.prizeWon)} {CURRENCIES[currency].symbol}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      </div>

                      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-[#0f1412]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_rgba(0,0,0,0.35)]">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent" />
                        <div className="pointer-events-none absolute -right-10 top-1 h-24 w-24 rounded-full bg-emerald-400/12 blur-2xl" />
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10">
                              <ShieldCheckIconOutline className="h-4 w-4 text-emerald-300" />
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Probably Fair</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsProbablyFairOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:bg-emerald-500/15"
                          >
                            Подтверждено
                            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isProbablyFairOpen ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {isProbablyFairOpen && (
                          <>
                            <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-widest text-white/45">
                              <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2">
                                <p className="text-white/35">ID розыгрыша</p>
                                <p className="mt-1 text-[11px] tracking-normal text-white">{selectedContest.id.slice(0, 10)}</p>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-black/35 px-2.5 py-2 text-right">
                                <p className="text-white/35">Завершен</p>
                                <p className="mt-1 text-[11px] tracking-normal text-emerald-200">{new Date(selectedContest.expiresAt || selectedContest.createdAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' })}</p>
                              </div>
                            </div>

                            <div className="mt-2 rounded-xl border border-white/10 bg-black/45 p-2.5">
                              <div className="mb-1 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-white/35">
                                <span>Серверный seed</span>
                                <span className="text-emerald-300">SHA256 commit</span>
                              </div>
                              <p className="select-all break-all font-mono text-[10px] leading-relaxed text-white/75">
                                {selectedContest.seed || '0000000000000000000000000000000000000000000000000000000000000000'}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setStep(ContestStep.LIST);
                          setVerifyStatus('idle');
                        }}
                        className="w-full rounded-3xl bg-gold py-5 text-[15px] font-black uppercase tracking-widest text-matte-black shadow-xl shadow-gold/20 transition-all active:translate-y-1"
                      >
                        Назад
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step === ContestStep.PAYOUT && (
                <div className="relative w-full max-w-[380px] animate-pop px-1">
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-[108%] max-w-[410px] -translate-x-1/2 -translate-y-1/2"
                    aria-hidden
                  >
                    <div className="payout-card-glow-a absolute inset-[-8%] rounded-[44px] bg-gradient-to-br from-emerald-400/[0.42] via-teal-400/[0.28] to-emerald-500/[0.38] blur-[36px]" />
                    <div className="payout-card-glow-b absolute inset-[4%] rounded-[36px] bg-teal-200/[0.18] blur-[22px]" />
                  </div>

                  <div className="relative z-[1] overflow-hidden rounded-[32px] border border-teal-500/35 bg-gradient-to-b from-[#152a26]/95 via-matte-black/92 to-[#0a1210] p-8 shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_48px_rgba(45,212,191,0.22)]">
                    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-500/20 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 left-1/2 h-40 w-[120%] -translate-x-1/2 rounded-[100%] bg-emerald-600/[0.09] blur-3xl" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/40 to-transparent" />

                    <div className="relative z-[2] space-y-6 text-left">
                      <div>
                        <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.32em] text-teal-400/75">
                          Адрес для выплаты
                        </p>
                        <h2 className="text-[28px] font-black uppercase leading-[1.05] tracking-tight text-white">
                          Кошелёк TRC‑20
                        </h2>
                      </div>

                      <div className="space-y-2.5">
                        <label
                          htmlFor="payout-trc20-input"
                          className="flex items-center gap-2.5 text-[15px] font-bold leading-snug text-white/90"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-teal-500/35 bg-teal-500/15">
                            <BanknotesIcon className="h-5 w-5 text-teal-300" />
                          </span>
                          Введите адрес кошелька
                        </label>
                        <div className="rounded-2xl border-2 border-teal-500/45 bg-[#0f1614] p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.55)] transition-[border-color,box-shadow] focus-within:border-teal-400 focus-within:shadow-[inset_0_2px_8px_rgba(0,0,0,0.45),0_0_0_3px_rgba(45,212,191,0.16)]">
                          <input
                            id="payout-trc20-input"
                            placeholder="T…"
                            value={profile.payoutValue}
                            onChange={(e) =>
                              setProfile({ ...profile, payoutValue: e.target.value.trim() })
                            }
                            autoComplete="off"
                            spellCheck={false}
                            inputMode="text"
                            className="w-full rounded-[14px] border border-teal-900/40 bg-[#1a2421] px-4 py-4 font-mono text-[15px] leading-snug text-stone-100 outline-none placeholder:text-stone-500 focus:border-teal-500/55 focus:bg-[#1f2b27]"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowPayoutInstruction(true)}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-teal-500/40 bg-teal-950/30 py-4 text-[13px] font-black uppercase tracking-wide text-teal-200/95 shadow-inner transition-all hover:bg-teal-900/35 active:scale-[0.98]"
                        >
                          <InformationCircleIcon className="h-5 w-5 shrink-0 text-teal-300 opacity-95" />
                          Инструкция
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleFinalizeParticipation()}
                          disabled={
                            !isValidTronAddress(profile.payoutValue) ||
                            isProcessingParticipation
                          }
                          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-teal-400 via-emerald-500 to-teal-600 py-5 text-[15px] font-black uppercase tracking-widest text-emerald-950 shadow-xl shadow-teal-900/35 transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-25"
                        >
                          {isProcessingParticipation ? (
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                          ) : (
                            'Занять место'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === ContestStep.TICKET_SHOW && (
                <div className="relative w-full max-w-[360px] animate-pop px-4 py-8">
                  <div className="relative isolate">
                    <div
                      className="pointer-events-none absolute -inset-12 z-0 overflow-visible sm:-inset-14"
                      aria-hidden
                    >
                      <div className="ticket-card-glow-a absolute inset-0 rounded-[36px] bg-[radial-gradient(ellipse_78%_72%_at_50%_46%,rgba(94,234,212,0.22)_0%,rgba(45,212,191,0.1)_38%,rgba(6,95,70,0.04)_62%,transparent_78%)] blur-[52px]" />
                      <div className="ticket-card-glow-b absolute inset-[8%] rounded-[30px] bg-[radial-gradient(ellipse_70%_65%_at_50%_52%,rgba(204,251,241,0.12)_0%,rgba(20,184,166,0.06)_40%,transparent_68%)] blur-[36px]" />
                    </div>

                    <div className="relative z-[1] overflow-hidden rounded-[22px] border-2 border-teal-500/45 bg-gradient-to-b from-[#0f1f1b] via-[#0a1412] to-[#050a09] shadow-[0_24px_56px_rgba(0,0,0,0.65),0_0_32px_rgba(45,212,191,0.12)]">
                    <div
                      className="pointer-events-none absolute inset-0 opacity-[0.12]"
                      style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(167,243,208,0.35) 1px, transparent 0)`,
                        backgroundSize: '14px 14px',
                      }}
                      aria-hidden
                    />

                    <div className="relative z-[2] px-6 pb-5 pt-6 text-left">
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-teal-500/55">Розыгрыш</p>
                      <h3 className="mt-1 text-[24px] font-black uppercase leading-[1.1] tracking-tight text-white">
                        {selectedContest?.title}
                      </h3>
                    </div>

                    <div className="relative z-[2] flex h-7 items-center bg-[#060d0b]">
                      <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 border-t border-dashed border-teal-500/35" aria-hidden />
                      <div className="relative z-10 flex w-full justify-between px-3">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <span
                            key={i}
                            className="block h-2.5 w-2.5 shrink-0 rounded-full border border-teal-600/40 bg-[#050a08] shadow-[inset_0_1px_0_rgba(45,212,191,0.12)]"
                          />
                        ))}
                      </div>
                    </div>

                    <div className="relative z-[2] flex flex-col items-center bg-gradient-to-b from-[#071210] to-[#040807] px-5 pb-8 pt-7">
                      <span className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.55em] text-teal-400/65">
                        Статус участия
                      </span>
                      <h1 className="whitespace-nowrap text-center text-[clamp(1.45rem,7.2vw,2.3rem)] font-black uppercase leading-[0.98] tracking-tight text-white drop-shadow-[0_2px_24px_rgba(45,212,191,0.18)]">
                        ВЫ УЧАСТВУЕТЕ
                      </h1>

                      <div className="mt-8 flex items-center gap-3 rounded-full border border-teal-400/40 bg-teal-500/10 px-6 py-2.5 shadow-[inset_0_1px_0_rgba(167,243,208,0.12)] backdrop-blur-sm">
                        <img
                          src={kleverCoin1Url}
                          alt=""
                          className="h-7 w-7 shrink-0 object-contain drop-shadow-md"
                          loading="lazy"
                          draggable={false}
                        />
                        <span className="text-[14px] font-black tracking-wide text-emerald-100">
                          Удачи!
                        </span>
                      </div>
                    </div>
                  </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep(ContestStep.LIST)}
                    className="relative z-[2] mt-8 w-full rounded-2xl border-2 border-teal-500/40 bg-matte-black/55 py-5 text-[14px] font-black uppercase tracking-wide text-teal-100 shadow-[0_0_28px_rgba(20,184,166,0.12)] backdrop-blur-md transition-all hover:border-teal-400/55 hover:bg-teal-950/25 active:scale-[0.98]"
                  >
                    На главную
                  </button>
                </div>
              )}

              {step === ContestStep.PAYOUT && showPayoutInstruction && (
                <div
                  className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:pb-4"
                  onClick={() => setShowPayoutInstruction(false)}
                  role="presentation"
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="payout-instr-title"
                    className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-teal-500/40 bg-[#101816] p-6 shadow-2xl shadow-teal-950/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/50 to-transparent" />
                    <div className="flex items-start justify-between gap-4">
                      <h3
                        id="payout-instr-title"
                        className="bg-gradient-to-r from-teal-300 to-emerald-400 bg-clip-text text-[16px] font-black uppercase leading-tight tracking-tight text-transparent"
                      >
                        Инструкция
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowPayoutInstruction(false)}
                        className="shrink-0 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/85 transition-colors active:scale-95 hover:bg-white/10"
                      >
                        Закрыть
                      </button>
                    </div>

                    <div className="mt-4 max-h-[72vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                      <div className="rounded-2xl border border-teal-700/25 bg-black/30 p-3">
                        <p className="text-[13px] font-bold leading-relaxed text-teal-100/90">
                          Как скопировать адрес USDT (TRC‑20)
                        </p>
                      </div>

                      {[
                        {
                          title: 'Шаг 1',
                          text: 'Откройте пополнение: нажмите кнопку "+" в правом верхнем углу приложения.',
                          img: trcGuideStep1Url,
                        },
                        {
                          title: 'Шаг 2',
                          text: 'Выберите раздел CRYPTO CURRENCY.',
                          img: trcGuideStep2Url,
                        },
                        {
                          title: 'Шаг 3',
                          text: 'Выберите USDT и обязательно сеть TRC‑20.',
                          img: trcGuideStep3Url,
                        },
                        {
                          title: 'Шаг 4',
                          text: 'Нажмите "Копировать" и вставьте адрес в поле кошелька здесь.',
                          img: trcGuideStep4Url,
                        },
                      ].map((step, idx) => (
                        <div
                          key={step.title}
                          className="overflow-hidden rounded-2xl border border-teal-700/30 bg-[#0d1513]/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        >
                          <div className="flex items-center justify-between border-b border-white/10 bg-teal-950/35 px-3 py-2.5">
                            <span className="text-[12px] font-black uppercase tracking-[0.16em] text-teal-200/95">
                              {step.title}
                            </span>
                            <span className="text-[11px] font-bold text-white/55">{idx + 1}/4</span>
                          </div>
                          <img src={step.img} alt="" className="w-full object-cover" />
                          <p className="px-3 pb-3 pt-2.5 text-[14px] font-semibold leading-snug text-white/90">
                            {step.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
           </div>
        </div>
      )}

      {import.meta.env.DEV && user?.id !== ADMIN_ID && (
        <>
          <div className="fixed bottom-24 left-3 z-[115] flex flex-col gap-2 max-w-[240px] pointer-events-auto">
            {devAdminUntil !== null && devAdminUntil > Date.now() ? (
              <>
                <div className="text-[9px] font-bold uppercase tracking-tight text-gradient-gold bg-matte-black/95 border border-gold/40 rounded-xl px-3 py-2 backdrop-blur-md leading-relaxed shadow-lg shadow-gold/15">
                  Локальная админка · до{' '}
                  {new Date(devAdminUntil).toLocaleString()}
                </div>
                <button
                  type="button"
                  onClick={clearLocalDevAdmin}
                  className="text-[10px] font-black uppercase text-white/70 bg-matte-black/90 border border-white/10 rounded-xl px-3 py-2 active:scale-95 transition-transform"
                >
                  Выйти из локальной админки
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowLocalAdminModal(true);
                  setLocalAdminError('');
                }}
                className="text-[10px] font-black uppercase text-gold bg-matte-black/95 border border-gold/35 rounded-xl px-3 py-2 shadow-lg backdrop-blur-md active:scale-95 transition-transform"
              >
                Локальная админка (dev)
              </button>
            )}
          </div>

          {showLocalAdminModal && (
            <div className="fixed inset-0 z-[200] bg-black/75 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="w-full max-w-sm bg-soft-gray border border-gold/25 rounded-3xl p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-2 text-gold">
                  <KeyIcon className="w-5 h-5 shrink-0" />
                  <h3 className="text-[13px] font-black uppercase tracking-wide leading-tight">
                    Вход в админку · только dev
                  </h3>
                </div>
                <p className="text-[11px] text-white/45 leading-relaxed">
                  Секрет задаётся в{' '}
                  <span className="font-mono text-white/65">.env.local</span> на
                  твоём компьютере (
                  <span className="font-mono text-white/65">
                    LOCAL_ADMIN_SECRET
                  </span>
                  ). В сборку клиента он не попадает.
                </p>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder="Введите LOCAL_ADMIN_SECRET"
                  value={localAdminSecretInput}
                  onChange={(e) => setLocalAdminSecretInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      void handleLocalAdminLogin();
                  }}
                  className="w-full bg-matte-black/70 p-4 rounded-xl border border-border-gray text-[14px] text-white outline-none focus:border-gold transition-colors"
                />
                {localAdminError && (
                  <p className="text-[11px] text-red-400 font-bold leading-snug">
                    {localAdminError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowLocalAdminModal(false);
                      setLocalAdminSecretInput('');
                      setLocalAdminError('');
                    }}
                    className="flex-1 py-3 rounded-xl border border-white/10 text-[11px] font-black uppercase text-white/55"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={localAdminLoading || !localAdminSecretInput.trim()}
                    onClick={() => void handleLocalAdminLogin()}
                    className="flex-1 py-3 rounded-xl bg-gold text-matte-black text-[11px] font-black uppercase disabled:opacity-30"
                  >
                    {localAdminLoading ? 'Проверка…' : 'Войти'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <CoverCropModal
        open={coverCropOpen}
        imageSrc={coverCropSrc}
        onClose={() => {
          setCoverCropOpen(false);
          setCoverCropSrc(null);
        }}
        onApply={(dataUrl) => {
          setNewImageUrl(dataUrl);
          setCoverCropOpen(false);
          setCoverCropSrc(null);
        }}
      />

      <style>{`
        @keyframes glow-slow {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          50% { transform: translate(5%, 3%) scale(1.1); opacity: 0.6; }
        }
        @keyframes glow-fast {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
          50% { transform: translate(-4%, -6%) scale(1.05); opacity: 0.5; }
        }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-subtle { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
        @keyframes coinLevitate {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -12px, 0); }
        }
        @keyframes payoutBgGlowA {
          0%, 100% { opacity: 0.38; transform: scale(1) translate3d(0, 0, 0); }
          50% { opacity: 0.72; transform: scale(1.1) translate3d(2%, -1%, 0); }
        }
        @keyframes payoutBgGlowB {
          0%, 100% { opacity: 0.32; transform: scale(1.02) translate3d(0, 0, 0); }
          50% { opacity: 0.65; transform: scale(1.14) translate3d(-2%, 2%, 0); }
        }
        @keyframes payoutBgGlowC {
          0%, 100% { opacity: 0.26; transform: scale(1) translate3d(0, 0, 0); }
          48% { opacity: 0.55; transform: scale(1.18) translate3d(1%, 2%, 0); }
        }
        @keyframes payoutBgGlowD {
          0%, 100% { opacity: 0.22; transform: scale(1.04) translate3d(0, 0, 0); }
          50% { opacity: 0.48; transform: scale(1.08) translate3d(-1%, -2%, 0); }
        }
        @keyframes referralGoldBgA {
          0%, 100% { opacity: 0.52; transform: scale(1) translate3d(0, 0, 0); }
          50% { opacity: 0.88; transform: scale(1.1) translate3d(2.5%, -2%, 0); }
        }
        @keyframes referralGoldBgB {
          0%, 100% { opacity: 0.42; transform: scale(1.02) translate3d(0, 0, 0); }
          50% { opacity: 0.78; transform: scale(1.16) translate3d(-3%, 2.5%, 0); }
        }
        @keyframes referralGoldBgC {
          0%, 100% { opacity: 0.38; transform: scale(1) translate3d(0, 0, 0); }
          48% { opacity: 0.72; transform: scale(1.12) translate3d(2%, 2%, 0); }
        }
        @keyframes referralGoldBgD {
          0%, 100% { opacity: 0.36; transform: scale(1.03) translate3d(0, 0, 0); }
          50% { opacity: 0.68; transform: scale(1.1) translate3d(-2%, -2.5%, 0); }
        }
        @keyframes payoutCardGlowA {
          0%, 100% { opacity: 0.55; transform: scale(0.94); }
          50% { opacity: 0.95; transform: scale(1.08); }
        }
        @keyframes payoutCardGlowB {
          0%, 100% { opacity: 0.35; transform: scale(1.06); }
          50% { opacity: 0.7; transform: scale(0.98); }
        }
        @keyframes ticketCardGlowA {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.72; transform: scale(1.04); }
        }
        @keyframes ticketCardGlowB {
          0%, 100% { opacity: 0.38; transform: scale(1.02); }
          50% { opacity: 0.55; transform: scale(0.99); }
        }
        @keyframes homeMainGlowA {
          0%, 100% { opacity: 0.26; transform: scale(1) translate3d(0, 0, 0); }
          50% { opacity: 0.5; transform: scale(1.15) translate3d(2%, -2%, 0); }
        }
        @keyframes homeMainGlowB {
          0%, 100% { opacity: 0.24; transform: scale(1.02) translate3d(0, 0, 0); }
          50% { opacity: 0.48; transform: scale(1.12) translate3d(-2%, 2%, 0); }
        }
        @keyframes homeMainGlowC {
          0%, 100% { opacity: 0.2; transform: scale(1) translate3d(0, 0, 0); }
          50% { opacity: 0.42; transform: scale(1.16) translate3d(1.5%, 2.5%, 0); }
        }
        @keyframes emptyActiveGlowA {
          0%, 100% { opacity: 0.28; transform: scale(1) translate3d(0, 0, 0); }
          50% { opacity: 0.55; transform: scale(1.14) translate3d(2%, -1.5%, 0); }
        }
        @keyframes emptyActiveGlowB {
          0%, 100% { opacity: 0.22; transform: scale(1.03) translate3d(0, 0, 0); }
          50% { opacity: 0.45; transform: scale(1.1) translate3d(-1.5%, 2%, 0); }
        }
        .payout-bg-glow-a { animation: payoutBgGlowA 8s ease-in-out infinite; }
        .payout-bg-glow-b { animation: payoutBgGlowB 9.5s ease-in-out infinite; animation-delay: -2.5s; }
        .payout-bg-glow-c { animation: payoutBgGlowC 7.2s ease-in-out infinite; animation-delay: -1.2s; }
        .payout-bg-glow-d { animation: payoutBgGlowD 6.4s ease-in-out infinite; animation-delay: -3s; }
        .home-main-glow-a { animation: homeMainGlowA 9s ease-in-out infinite; }
        .home-main-glow-b { animation: homeMainGlowB 10.5s ease-in-out infinite; animation-delay: -2.4s; }
        .home-main-glow-c { animation: homeMainGlowC 8.2s ease-in-out infinite; animation-delay: -1.3s; }
        .empty-active-glow-a { animation: emptyActiveGlowA 6.8s ease-in-out infinite; }
        .empty-active-glow-b { animation: emptyActiveGlowB 7.6s ease-in-out infinite; animation-delay: -2.1s; }
        .referral-gold-bg-a { animation: referralGoldBgA 7.5s ease-in-out infinite; }
        .referral-gold-bg-b { animation: referralGoldBgB 9s ease-in-out infinite; animation-delay: -2.2s; }
        .referral-gold-bg-c { animation: referralGoldBgC 6.8s ease-in-out infinite; animation-delay: -1s; }
        .referral-gold-bg-d { animation: referralGoldBgD 7.8s ease-in-out infinite; animation-delay: -3.4s; }
        .payout-card-glow-a { animation: payoutCardGlowA 4.2s ease-in-out infinite; }
        .payout-card-glow-b { animation: payoutCardGlowB 3.4s ease-in-out infinite; animation-delay: -1.1s; }
        .ticket-card-glow-a { animation: ticketCardGlowA 5.5s ease-in-out infinite; }
        .ticket-card-glow-b { animation: ticketCardGlowB 4.8s ease-in-out infinite; animation-delay: -1.4s; }
        
        .animate-glow-slow { animation: glow-slow 18s ease-in-out infinite; }
        .animate-glow-fast { animation: glow-fast 12s ease-in-out infinite; }
        .animate-spin-slow { animation: spin-slow 8s linear infinite; }
        .animate-pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
        
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop { 0% { transform: scale(0.92); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes shine {
          to { background-position: 200% center; }
        }
        
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.19, 1, 0.22, 1) forwards; }
        .animate-pop { animation: pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        .text-gradient-gold {
          background: linear-gradient(to right, #C5A059, #F3E5AB, #C5A059);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shine 3s linear infinite;
        }

        .bg-gold-shimmer {
          background: linear-gradient(to right, #C5A059, #F3E5AB, #C5A059);
          background-size: 200% auto;
          animation: shine 3s linear infinite;
        }

        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(197, 160, 89, 0.25); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default App;
