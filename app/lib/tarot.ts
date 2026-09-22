export type DrawMode = 'online' | 'physical';
export type Orientation = 'upright' | 'reversed';

export type TarotCardDefinition = { id: string; nameZh: string; nameEn: string; image: string };
export type CardMeaning = { upright: string; reversed: string };
export type SpreadPosition = { id: string; question: string };
export type SpreadDefinition = { id: string; name: string; positions: SpreadPosition[]; isCustom?: boolean };
export type DrawnCard = { cardId: string; orientation: Orientation; positionId: string; position: string };
export type DeckCard = { cardId: string; orientation: Orientation };
export type AiCardInterpretation = { positionId: string; text: string };
export type AiInterpretation = { cards: AiCardInterpretation[]; synthesis: string; advice: string; disclaimer: string };

export type Reading = {
  id: string;
  memberId: string;
  authorName: string;
  question: string;
  mode: DrawMode;
  spread: SpreadDefinition;
  cards: DrawnCard[];
  interpretation: string;
  aiInterpretation: AiInterpretation | null;
  tags: string[];
  feedback: string;
  createdAt: number;
  updatedAt: number;
};

export type CustomSpread = SpreadDefinition & { isCustom: true; createdAt: number; updatedAt: number };

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
const majorThemes = [
  '自由启程、相信可能与保持好奇', '主动创造、调动资源与清晰表达', '直觉、沉静观察与未说出口的信息',
  '滋养、丰盛与让关系自然成长', '秩序、边界与承担责任', '传统、承诺与共同价值',
  '选择、吸引与价值观的对齐', '推进、意志与掌握方向', '温柔的勇气、耐心与自我调节',
  '独处反思、寻找内在答案', '周期转变、机遇与不可控因素', '公平、因果与诚实衡量',
  '暂停、换位思考与主动放下', '结束旧阶段、蜕变与重新开始', '协调、疗愈与寻找中间道路',
  '执着、诱惑与看见隐性束缚', '突变、真相显露与旧结构瓦解', '希望、复原与坦诚做自己',
  '不安、投射与需要核实的直觉', '明朗、活力与彼此看见', '觉醒、复盘与回应召唤', '完成、整合与进入新循环',
];
const ranksZh = ['王牌', '二', '三', '四', '五', '六', '七', '八', '九', '十', '侍从', '骑士', '王后', '国王'];
const ranksEn = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Page', 'Knight', 'Queen', 'King'];
const rankThemes = [
  '新的种子与纯粹动力', '权衡、互动与两种可能', '合作、成长与初步成果', '稳定、守护与阶段停驻',
  '摩擦、失落与重新排序', '交换、修复与向前过渡', '评估、坚持与策略调整', '行动加速、练习与投入',
  '临近完成、自信与独自承担', '累积结果、责任与一个周期的顶点', '学习、消息与新鲜视角',
  '追求、变化与把意图带进行动', '成熟感受、内在掌控与包容', '外在掌控、责任与长期判断',
];
const suits = [
  { code: 'wa', zh: '权杖', en: 'Wands', theme: '行动、热情、创造力与个人意志' },
  { code: 'cu', zh: '圣杯', en: 'Cups', theme: '情感、关系、直觉与内心需求' },
  { code: 'sw', zh: '宝剑', en: 'Swords', theme: '思考、沟通、冲突与事实判断' },
  { code: 'pe', zh: '星币', en: 'Pentacles', theme: '现实基础、资源、身体感受与长期建设' },
] as const;

const majorCards: TarotCardDefinition[] = majorZh.map((nameZh, index) => ({
  id: `ar${String(index).padStart(2, '0')}`,
  nameZh,
  nameEn: majorEn[index],
  image: `/cards/ar${String(index).padStart(2, '0')}.jpg`,
}));
const minorCards: TarotCardDefinition[] = suits.flatMap((suit) => ranksZh.map((rankZh, index) => {
  const number = String(index + 1).padStart(2, '0');
  return { id: `${suit.code}${number}`, nameZh: `${suit.zh}${rankZh}`, nameEn: `${ranksEn[index]} of ${suit.en}`, image: `/cards/${suit.code}${number}.jpg` };
}));

export const CARDS: readonly TarotCardDefinition[] = [...majorCards, ...minorCards];
export const CARD_MAP = new Map(CARDS.map((card) => [card.id, card]));
export const CARD_MEANINGS: Record<string, CardMeaning> = Object.fromEntries([
  ...majorCards.map((card, index) => [card.id, {
    upright: `${majorThemes[index]}。在当前问题中，它鼓励看清机会，并以成熟而真实的方式回应。`,
    reversed: `${majorThemes[index]}的能量受阻或走向过度。需要检查逃避、误判或失衡，再决定下一步。`,
  }]),
  ...minorCards.map((card) => {
    const suit = suits.find((item) => card.id.startsWith(item.code))!;
    const rankIndex = Number(card.id.slice(2)) - 1;
    return [card.id, {
      upright: `${suit.theme}正在通过“${rankThemes[rankIndex]}”显现。留意它在现实中的具体表现。`,
      reversed: `${suit.theme}在“${rankThemes[rankIndex]}”上出现延迟、压抑或失衡，需要调整节奏与表达。`,
    }];
  }),
]);

const spread = (id: string, name: string, questions: string[]): SpreadDefinition => ({
  id,
  name,
  positions: questions.map((question, index) => ({ id: `${id}-${index + 1}`, question })),
});

export const BUILT_IN_SPREADS: readonly SpreadDefinition[] = [
  spread('three-card', '三张无牌阵', ['第一张牌', '第二张牌', '第三张牌']),
  spread('three-card-guidance', '带指引牌的三张无牌阵', ['第一张牌', '第二张牌', '第三张牌', '指引牌']),
  spread('timeline', '时间之流', ['过去', '现在', '未来']),
  spread('one-card', '一张牌', ['本次指引']),
  spread('exploration', '探索', ['现状', '阻碍', '根源', '建议', '可能结果']),
  spread('two-choice', '二选一抉择', ['当前处境', '选择 A 的发展', '选择 A 的结果', '选择 B 的发展', '选择 B 的结果']),
  spread('venus-love', '维纳斯之爱', ['你的真心', '对方真心', '你受到的影响', '对方受到的影响', '问题阻碍', '结果', '你未来心境', '对方未来心境']),
  spread('love-answer', '爱的解答', ['过去感情状态', '你的心情/态度', '对方的心情/态度', '结果']),
  spread('inner-voice', '心之声', ['感情现状', '不久的未来', '对你的印象（内在）', '对你的印象（外在）', '对方心态', '对你的期望', '你的心态', '建议']),
  spread('know-their-heart', '他心知', ['对你的潜意识感受', '对你的想法打算', '对你的态度方式']),
  spread('lover-pyramid', '恋人金字塔', ['你的现状', '目前关系', '对方现状', '结果']),
  spread('emotional-realm', '情感之境', ['你目前的状态想法', '对方目前的状态想法', '现状', '未来趋势', '最终结果']),
  spread('love-cross', '爱情十字', ['当事人的状态想法', '对方对当事人的态度', '感情现状', '问题阻碍', '未来发展']),
  spread('relationship-outlook', '关系前景', ['你的看法', '对方看法', '关系现状', '未来发展']),
  spread('friendship', '友谊牌阵', ['你对对方的看法', '对方对你的看法', '你认为的关系现状', '对方认为的关系现状', '你期待的未来发展', '对方期待的未来发展']),
];

export function normalizeSpread(value: Partial<SpreadDefinition>): SpreadDefinition {
  return {
    id: String(value.id || crypto.randomUUID()).slice(0, 80),
    name: String(value.name || '本次自建牌阵').trim().slice(0, 40),
    isCustom: value.isCustom ?? false,
    positions: Array.isArray(value.positions) ? value.positions.map((position, index) => ({
      id: String(position?.id || `p${index + 1}`).slice(0, 80),
      question: String(position?.question || '').trim().slice(0, 80),
    })) : [],
  };
}

export function validateSpread(value: unknown): { ok: true; value: SpreadDefinition } | { ok: false; error: string } {
  if (!value || typeof value !== 'object') return { ok: false, error: '牌阵数据无效' };
  const raw = value as SpreadDefinition;
  if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40) return { ok: false, error: '请填写 40 字以内的牌阵名称' };
  if (!Array.isArray(raw.positions) || raw.positions.some((position) => !position || typeof position.id !== 'string' || !position.id.trim() || position.id.length > 80 || typeof position.question !== 'string' || !position.question.trim() || position.question.length > 80)) return { ok: false, error: '请填写每张牌的小问题（80 字以内）' };
  const normalized = normalizeSpread(raw);
  if (!normalized.name) return { ok: false, error: '请填写牌阵名称' };
  const basePositions = normalized.positions.filter((position) => !position.id.includes('-supplement-'));
  if (basePositions.length < 1 || basePositions.length > 12 || normalized.positions.length > 21) return { ok: false, error: '牌阵需要 1–12 张牌，补抽后最多 21 张' };
  if (normalized.positions.some((position) => !position.question)) return { ok: false, error: '请填写每张牌的小问题' };
  if (new Set(normalized.positions.map((position) => position.id)).size !== normalized.positions.length) return { ok: false, error: '牌位标识不能重复' };
  return { ok: true, value: normalized };
}

export function isMode(value: unknown): value is DrawMode { return value === 'online' || value === 'physical' }
export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}
