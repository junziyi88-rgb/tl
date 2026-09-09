export type DrawMode = 'online' | 'physical';
export type Orientation = 'upright' | 'reversed';
export type SpreadKind = 'one' | 'three' | 'five';

export type TarotCardDefinition = {
  id: string;
  nameZh: string;
  nameEn: string;
  image: string;
};

export type DrawnCard = {
  cardId: string;
  orientation: Orientation;
  position: string;
};

export type Reading = {
  id: string;
  memberId: string;
  authorName: string;
  question: string;
  mode: DrawMode;
  spread: SpreadKind;
  cards: DrawnCard[];
  interpretation: string;
  tags: string[];
  feedback: string;
  createdAt: number;
  updatedAt: number;
};

const majorZh = [
  '愚者', '魔术师', '女祭司', '皇后', '皇帝', '教皇', '恋人', '战车', '力量', '隐者',
  '命运之轮', '正义', '倒吊人', '死神', '节制', '恶魔', '高塔', '星星', '月亮', '太阳', '审判', '世界',
];

const majorEn = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant',
  'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
  'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star', 'The Moon',
  'The Sun', 'Judgement', 'The World',
];

const ranksZh = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍从', '骑士', '王后', '国王'];
const ranksEn = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];
const suits = [
  { code: 'wa', zh: '权杖', en: 'Wands' },
  { code: 'cu', zh: '圣杯', en: 'Cups' },
  { code: 'sw', zh: '宝剑', en: 'Swords' },
  { code: 'pe', zh: '星币', en: 'Pentacles' },
] as const;

const majorCards: TarotCardDefinition[] = majorZh.map((nameZh, index) => ({
  id: `ar${String(index).padStart(2, '0')}`,
  nameZh,
  nameEn: majorEn[index],
  image: `/cards/ar${String(index).padStart(2, '0')}.jpg`,
}));

const minorCards: TarotCardDefinition[] = suits.flatMap((suit) =>
  ranksZh.map((rankZh, index) => {
    const number = String(index + 1).padStart(2, '0');
    return {
      id: `${suit.code}${number}`,
      nameZh: `${suit.zh}${rankZh}`,
      nameEn: `${ranksEn[index]} of ${suit.en}`,
      image: `/cards/${suit.code}${number}.jpg`,
    };
  }),
);

export const CARDS: readonly TarotCardDefinition[] = [...majorCards, ...minorCards];
export const CARD_MAP = new Map(CARDS.map((card) => [card.id, card]));

export const SPREADS: Record<SpreadKind, { label: string; positions: string[] }> = {
  one: { label: '单张指引', positions: ['本次指引'] },
  three: { label: '时间之流', positions: ['过去', '现在', '未来'] },
  five: { label: '五张探索', positions: ['现状', '阻碍', '根源', '建议', '可能结果'] },
};

export function isSpread(value: unknown): value is SpreadKind {
  return value === 'one' || value === 'three' || value === 'five';
}

export function isMode(value: unknown): value is DrawMode {
  return value === 'online' || value === 'physical';
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp));
}
