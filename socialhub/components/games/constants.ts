// ============================================================
// Games Section — Constants & Configuration
// ============================================================

// ----------------------------------------------------------
// Trivia Questions Pool (25 questions — randomly pick 5 per game)
// ----------------------------------------------------------
export interface TriviaQuestion {
  question: string;
  options: string[];
  answer: number; // index of correct option
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  // --- Tech & Programming ---
  {
    question: 'Which framework powers React Native cross-platform apps?',
    options: ['React JS', 'Flutter', 'Vue JS', 'Angular'],
    answer: 0,
  },
  {
    question: 'What language is React Native primarily written in?',
    options: ['Python', 'JavaScript', 'Swift', 'Kotlin'],
    answer: 1,
  },
  {
    question: 'Which company created React Native?',
    options: ['Google', 'Apple', 'Meta (Facebook)', 'Microsoft'],
    answer: 2,
  },
  {
    question: 'What does API stand for?',
    options: [
      'Application Programming Interface',
      'Advanced Protocol Integration',
      'Automated Process Input',
      'Application Process Interpreter',
    ],
    answer: 0,
  },
  {
    question: 'Which database query language starts with SELECT?',
    options: ['NoSQL', 'MongoDB', 'SQL', 'GraphQL'],
    answer: 2,
  },

  // --- Social Media ---
  {
    question: 'Which platform introduced the concept of "Stories"?',
    options: ['Instagram', 'Snapchat', 'Facebook', 'TikTok'],
    answer: 1,
  },
  {
    question: 'What year was Twitter (now X) founded?',
    options: ['2004', '2006', '2008', '2010'],
    answer: 1,
  },
  {
    question: 'Which social platform is known for short-form video content?',
    options: ['LinkedIn', 'Pinterest', 'TikTok', 'Reddit'],
    answer: 2,
  },
  {
    question: 'What was Instagram originally called during development?',
    options: ['Burbn', 'Picr', 'Filterly', 'SnapPic'],
    answer: 0,
  },
  {
    question: 'Which platform uses hashtags to categorize content?',
    options: ['All of them', 'Only Twitter', 'Only Instagram', 'Only TikTok'],
    answer: 0,
  },

  // --- SocialHub Features ---
  {
    question: 'What is the maximum character limit for a SocialHub post?',
    options: ['280', '500', '2,000', 'Unlimited'],
    answer: 2,
  },
  {
    question: 'Which technology provides real-time chat in SocialHub?',
    options: ['Socket.io', 'GraphQL', 'REST API', 'FTP'],
    answer: 0,
  },
  {
    question: 'What do you earn in SocialHub by completing daily tasks?',
    options: ['Gems only', 'Coins & XP', 'Followers', 'Nothing'],
    answer: 1,
  },
  {
    question: 'Which cloud platform handles media uploads in SocialHub?',
    options: ['Cloudinary', 'Dropbox', 'Google Drive', 'OneDrive'],
    answer: 0,
  },
  {
    question: 'How many coins do you get from SocialHub daily login?',
    options: ['50', '100', '150', '200'],
    answer: 2,
  },

  // --- General Tech Knowledge ---
  {
    question: 'What does HTML stand for?',
    options: [
      'Hyper Text Markup Language',
      'High Tech Modern Language',
      'Home Tool Markup Language',
      'Hyper Transfer Markup Language',
    ],
    answer: 0,
  },
  {
    question: 'Which company developed the TypeScript language?',
    options: ['Google', 'Microsoft', 'Apple', 'Amazon'],
    answer: 1,
  },
  {
    question: 'What protocol does HTTPS use for security?',
    options: ['SSH', 'SSL/TLS', 'FTP', 'SMTP'],
    answer: 1,
  },
  {
    question: 'What is the main purpose of a CDN?',
    options: [
      'Database management',
      'Deliver content faster globally',
      'Email routing',
      'Code compilation',
    ],
    answer: 1,
  },
  {
    question: 'Which of these is a NoSQL database?',
    options: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'],
    answer: 2,
  },

  // --- Fun & Misc ---
  {
    question: 'What does "404" mean on the internet?',
    options: ['Server Error', 'Page Not Found', 'Access Denied', 'Timeout'],
    answer: 1,
  },
  {
    question: 'Which key combination is "copy" on Windows?',
    options: ['Ctrl+V', 'Ctrl+X', 'Ctrl+C', 'Ctrl+Z'],
    answer: 2,
  },
  {
    question: 'What does the "Git" in GitHub refer to?',
    options: [
      'A version control system',
      'A programming language',
      'A cloud server',
      'A design tool',
    ],
    answer: 0,
  },
  {
    question: 'How many bits are in a byte?',
    options: ['4', '8', '16', '32'],
    answer: 1,
  },
  {
    question: 'Which mobile OS is open-source?',
    options: ['iOS', 'Android', 'Windows Phone', 'BlackBerry OS'],
    answer: 1,
  },
];

/** Randomly pick N questions from the pool */
export function getRandomQuestions(count: number = 5): TriviaQuestion[] {
  const shuffled = [...TRIVIA_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ----------------------------------------------------------
// Memory Game Card Symbols — Multiple Themed Sets
// ----------------------------------------------------------
export const CARD_SYMBOL_SETS = {
  space: ['🚀', '👾', '🌙', '⭐', '🛸', '🪐', '☄️', '🌌'],
  animals: ['🐶', '🐱', '🦊', '🐼', '🐸', '🦋', '🐢', '🦄'],
  food: ['🍕', '🍔', '🍟', '🍩', '🧁', '🍦', '🌮', '🍣'],
  tech: ['💻', '📱', '🎮', '🕹️', '🤖', '💡', '⚡', '🔋'],
  nature: ['🌸', '🌊', '🔥', '⛰️', '🌈', '🍀', '🌺', '❄️'],
  sports: ['⚽', '🏀', '🎾', '🏈', '🎯', '🏆', '🎱', '⛷️'],
};

export type CardTheme = keyof typeof CARD_SYMBOL_SETS;

/** Pick a random theme */
export function getRandomCardTheme(): CardTheme {
  const themes = Object.keys(CARD_SYMBOL_SETS) as CardTheme[];
  return themes[Math.floor(Math.random() * themes.length)];
}

// ----------------------------------------------------------
// Memory Match — LEVEL SYSTEM (Level 1 to ∞)
// ----------------------------------------------------------
export interface LevelConfig {
  level: number;
  pairs: number;          // number of unique pairs
  timeLimit: number;      // seconds
  cols: number;           // grid columns
  bgGradient: [string, string];
  accentColor: string;
  cardBack: string;       // back face color
  themeLabel: string;
  coinReward: number;
  xpReward: number;
}

// Generate level config dynamically
export function getLevelConfig(level: number): LevelConfig {
  // pairs grow: 3,4,4,5,5,6,6,7,7,8,8,9,9,10,10...
  const pairs = Math.min(3 + Math.floor((level - 1) * 0.6), 12);
  // time decreases with level (harder)
  const timeLimit = Math.max(25, 80 - (level - 1) * 4);
  const cols = pairs <= 4 ? 4 : pairs <= 6 ? 4 : 4;

  // Cycle through gradients
  const gradients: Array<[string, string]> = [
    ['#1a1a2e', '#16213e'],  // Dark navy
    ['#0f3460', '#16213e'],  // Deep blue
    ['#1a0533', '#2D0066'],  // Deep purple
    ['#0d2137', '#1a3a5c'],  // Ocean
    ['#1c0a00', '#3d1500'],  // Dark ember
    ['#042F2E', '#134E4A'],  // Dark teal
    ['#0f1923', '#1e3a5f'],  // Midnight
    ['#1f0035', '#3b0066'],  // Ultra violet
  ];
  const accents = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6'];
  const cardBacks = ['#4C1D95', '#1D4ED8', '#065F46', '#92400E', '#991B1B', '#9D174D', '#164E63', '#3B0764'];

  const idx = (level - 1) % gradients.length;

  return {
    level,
    pairs,
    timeLimit,
    cols,
    bgGradient: gradients[idx],
    accentColor: accents[idx],
    cardBack: cardBacks[idx],
    themeLabel: `Level ${level}`,
    coinReward: 20 + level * 10,
    xpReward: 50 + level * 25,
  };
}

// ----------------------------------------------------------
// Memory Game Difficulty Levels (kept for backward compat)
// ----------------------------------------------------------
export interface DifficultyConfig {
  label: string;
  pairs: number;
  columns: number;
  emoji: string;
}

export const DIFFICULTY_LEVELS: Record<string, DifficultyConfig> = {
  easy: { label: 'Easy', pairs: 4, columns: 4, emoji: '😊' },
  medium: { label: 'Medium', pairs: 6, columns: 4, emoji: '🧐' },
  hard: { label: 'Hard', pairs: 8, columns: 4, emoji: '🤯' },
};

// ----------------------------------------------------------
// Reward Configuration Table
// ----------------------------------------------------------
export const GAME_REWARDS = {
  memoryMatch: {
    name: 'Memory Match',
    icon: '🧠',
    iconBg: '#EDE9FE',
    description: 'Flip & match emoji pairs',
    maxCoins: 150,
    maxXp: 400,
    rewardPerDifficulty: {
      easy: { coins: 50, xp: 150 },
      medium: { coins: 100, xp: 300 },
      hard: { coins: 150, xp: 400 },
    },
  },
  spinWheel: {
    name: 'Spin & Win Wheel',
    icon: '🎡',
    iconBg: '#FEF3C7',
    description: 'Spin for fortune prizes',
    maxCoins: 500,
    maxXp: 800,
  },
  trivia: {
    name: 'Trivia Master',
    icon: '❓',
    iconBg: '#D1FAE5',
    description: '5-question tech quiz',
    maxCoins: 200,
    maxXp: 500,
    coinsPerCorrect: 40,
    xpPerCorrect: 100,
  },
  tapSpeed: {
    name: 'Tap Speed Frenzy',
    icon: '⚡',
    iconBg: '#FEE2E2',
    description: '10-sec fast tapping challenge',
    maxCoins: 300,
    maxXp: 600,
    coinsPerTap: 4,
    xpPerTap: 10,
    duration: 10, // seconds
  },
  simonSays: {
    name: 'Simon Color Pattern',
    icon: '🧩',
    iconBg: '#E0F2FE',
    description: 'Repeat color pad sequences',
    maxCoins: 250,
    maxXp: 600,
    coinsPerRound: 50,
    xpPerRound: 120,
  },
};

// ----------------------------------------------------------
// Spin Wheel Segments
// ----------------------------------------------------------
export interface WheelSegment {
  label: string;
  coins: number;
  xp: number;
  color: string;
  emoji: string;
}

export const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: '50 Coins', coins: 50, xp: 150, color: '#3B82F6', emoji: '🎁' },
  { label: '100 Coins', coins: 100, xp: 250, color: '#10B981', emoji: '⚡' },
  { label: '250 Coins', coins: 250, xp: 500, color: '#F59E0B', emoji: '🌟' },
  { label: '500 Coins', coins: 500, xp: 800, color: '#EF4444', emoji: '🔥' },
  { label: '75 Coins', coins: 75, xp: 200, color: '#8B5CF6', emoji: '💎' },
  { label: '150 Coins', coins: 150, xp: 350, color: '#EC4899', emoji: '🎯' },
];

// ----------------------------------------------------------
// Simon Says Colors
// ----------------------------------------------------------
export const SIMON_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B'];

// ----------------------------------------------------------
// Daily Reward Config
// ----------------------------------------------------------
export const DAILY_REWARD = {
  coins: 150,
  xp: 500,
};

// ----------------------------------------------------------
// Cooldown Config
// ----------------------------------------------------------
export const MAX_REWARDED_PLAYS_PER_DAY = 3;

// ----------------------------------------------------------
// Trivia Timer
// ----------------------------------------------------------
export const TRIVIA_TIME_PER_QUESTION = 15; // seconds
