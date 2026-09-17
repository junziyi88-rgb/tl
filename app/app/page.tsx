'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import {
  createDeck,
  createMember,
  listReadings,
  createReading,
  updateFeedback,
  deleteReading,
  listCustomSpreads,
  createCustomSpread,
  updateCustomSpread,
  deleteCustomSpread,
  generateInterpretation,
  selectCardsFromDeck,
  updateMemberNickname,
} from '@/lib/cloudbase-api';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BrainCircuit,
  Check,
  ChevronRight,
  Copy,
  Layers3,
  LoaderCircle,
  LogOut,
  MoonStar,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  WandSparkles,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  BUILT_IN_SPREADS,
  CARD_MAP,
  CARDS,
  formatDate,
  normalizeSpread,
  type AiInterpretation,
  type CustomSpread,
  type DeckCard,
  type DrawMode,
  type DrawnCard,
  type Reading,
  type SpreadDefinition,
} from '@/lib/tarot';
import {
  clampFanCenter,
  fanCardTransform,
  visibleFanIndexes,
} from '@/lib/fan';

type Session = { memberId: string; nickname: string; token: string };
type View =
  | 'feed'
  | 'setup'
  | 'builder'
  | 'breathe'
  | 'shuffle'
  | 'fan'
  | 'online'
  | 'physical'
  | 'compose'
  | 'detail';
type SpreadOrigin = 'builtin' | 'saved' | 'temporary';
const SESSION_KEY = 'gongjian-tarot-cloudbase-session-v1';

function CardFace({
  drawn,
  compact = false,
  hidden = false,
  onReveal,
}: {
  drawn: DrawnCard;
  compact?: boolean;
  hidden?: boolean;
  onReveal?: () => void;
}) {
  const card = CARD_MAP.get(drawn.cardId);
  const content = (
    <>
      <div
        className={`tarot-card ${compact ? 'tarot-card--compact' : ''} ${hidden ? 'tarot-card--hidden' : ''}`}
      >
        <img
          src={hidden ? '/card-back.jpg' : (card?.image ?? '/card-back.jpg')}
          alt={
            hidden
              ? '未翻开的塔罗牌'
              : `${card?.nameZh ?? '塔罗牌'} ${drawn.orientation === 'reversed' ? '逆位' : '正位'}`
          }
          className={
            !hidden && drawn.orientation === 'reversed' ? 'rotate-180' : ''
          }
          onError={(event) => {
            event.currentTarget.src = '/card-back.jpg';
          }}
        />
        {!hidden && (
          <span className="orientation-mark">
            {drawn.orientation === 'reversed' ? '逆' : '正'}
          </span>
        )}
      </div>
      {!compact && (
        <div className="mt-3 text-center">
          <p className="text-xs tracking-[0.12em] text-[#a98b5a]">
            {drawn.position}
          </p>
          <p className="mt-1 font-serif text-base font-semibold text-[#f4ecdc]">
            {hidden ? '等待翻开' : card?.nameZh}
          </p>
          {!hidden && (
            <p className="mt-0.5 text-xs text-[#8f889b]">
              {drawn.orientation === 'reversed' ? '逆位' : '正位'}
            </p>
          )}
        </div>
      )}
    </>
  );
  return onReveal ? (
    <button
      type="button"
      className="group cursor-pointer"
      onClick={onReveal}
      aria-label="翻开这张牌"
    >
      {content}
    </button>
  ) : (
    <div>{content}</div>
  );
}
function ReadingCards({
  cards,
  compact = false,
}: {
  cards: DrawnCard[];
  compact?: boolean;
}) {
  return (
    <div
      className="reading-cards"
      style={{
        gridTemplateColumns: `repeat(${Math.min(cards.length, compact ? 6 : 4)}, minmax(0, 1fr))`,
      }}
    >
      {cards.map((card, index) => (
        <CardFace
          key={`${card.positionId}-${index}`}
          drawn={card}
          compact={compact}
        />
      ))}
    </div>
  );
}
function FeedCardNames({ cards }: { cards: DrawnCard[] }) {
  return (
    <div className="feed-card-names">
      {cards.map((card, index) => (
        <span key={`${card.positionId}-${index}`}>
          {CARD_MAP.get(card.cardId)?.nameZh ?? '塔罗牌'}【
          {card.orientation === 'reversed' ? '逆位' : '正位'}】
        </span>
      ))}
    </div>
  );
}
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark">
        <MoonStar className="size-5" />
      </div>
      <div>
        <p className="font-serif text-lg font-semibold tracking-[0.08em] text-[#f5ead5]">
          共见塔罗
        </p>
        <p className="text-[10px] tracking-[0.22em] text-[#81798e]">
          THE SHARED ARCANA
        </p>
      </div>
    </div>
  );
}
function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="page-header">
      <Button
        variant="ghost"
        size="icon-lg"
        onClick={onBack}
        className="text-[#b9b0c4]"
        aria-label="返回"
      >
        <ArrowLeft />
      </Button>
      <p className="font-serif text-lg font-semibold tracking-wide text-[#eee4d2]">
        {title}
      </p>
      <div className="size-9" />
    </header>
  );
}

function NicknameGate({ onEnter }: { onEnter: (session: Session) => void }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!nickname.trim()) return setError('请先写下你在群里的昵称');
    setLoading(true);
    setError('');
    try {
      const session = await createMember(nickname);
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      onEnter(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '进入失败');
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="welcome-screen">
      <div className="star-field" aria-hidden="true" />
      <section className="welcome-card">
        <Brand />
        <div className="welcome-orbit" aria-hidden="true">
          <span>☾</span>
          <span>✦</span>
          <span>☼</span>
        </div>
        <h1>共见塔罗</h1>
        <p className="welcome-copy">输入群昵称，进入大家共用的塔罗记录墙。</p>
        <label className="field-label" htmlFor="nickname">
          你的昵称
        </label>
        <Input
          id="nickname"
          value={nickname}
          maxLength={24}
          onChange={(event) => setNickname(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
          }}
          placeholder="例如：小月"
          className="form-control h-12"
        />
        {error && <p className="mt-2 text-sm text-[#db968c]">{error}</p>}
        <Button
          onClick={() => void submit()}
          disabled={loading}
          className="gold-button mt-4 h-12 w-full rounded-xl text-base"
        >
          {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          进入记录墙
        </Button>
      </section>
    </main>
  );
}

function SpreadBuilder({
  initial,
  onBack,
  onUse,
  onSave,
}: {
  initial?: SpreadDefinition;
  onBack: () => void;
  onUse: (spread: SpreadDefinition) => void;
  onSave?: (spread: SpreadDefinition) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '本次自建牌阵');
  const [positions, setPositions] = useState(
    initial?.positions ?? [{ id: crypto.randomUUID(), question: '' }],
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const move = (index: number, direction: -1 | 1) =>
    setPositions((items) => {
      const next = [...items];
      const target = index + direction;
      if (target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const value = () =>
    normalizeSpread({
      id: initial?.id ?? crypto.randomUUID(),
      name,
      isCustom: true,
      positions,
    });
  const valid =
    name.trim() &&
    positions.length >= 1 &&
    positions.length <= 12 &&
    positions.every((position) => position.question.trim());
  return (
    <section className="panel-page">
      <PageHeader
        title={initial ? '编辑自建牌阵' : '临时自建牌阵'}
        onBack={onBack}
      />
      <div className="mx-auto max-w-3xl px-4 pb-32 pt-7 sm:px-6">
        <p className="eyebrow">1–12 张牌 · 每张都有自己的小问题</p>
        <h2 className="section-title">搭好这次的观察框架</h2>
        <div className="mt-7">
          <label className="field-label" htmlFor="spread-name">
            牌阵名称
          </label>
          <Input
            id="spread-name"
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            className="form-control"
          />
        </div>
        <div className="mt-5 space-y-3">
          {positions.map((position, index) => (
            <Card
              key={position.id}
              className="border border-white/8 bg-white/[0.035] py-0"
            >
              <CardContent className="flex items-center gap-2 p-3">
                <span className="position-number">{index + 1}</span>
                <Input
                  aria-label={`第 ${index + 1} 张牌的小问题`}
                  value={position.question}
                  maxLength={80}
                  onChange={(event) =>
                    setPositions((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, question: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="例如：我真正担心什么？"
                  className="form-control flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="上移"
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={index === positions.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="下移"
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={positions.length === 1}
                  onClick={() =>
                    setPositions((items) =>
                      items.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label="删除牌位"
                >
                  <X />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-4 w-full border-dashed border-[#8d7449]/50 bg-transparent text-[#c5a66f]"
          disabled={positions.length >= 12}
          onClick={() =>
            setPositions((items) => [
              ...items,
              { id: crypto.randomUUID(), question: '' },
            ])
          }
        >
          <Plus />
          增加一张牌
        </Button>
        {error && <p className="mt-4 text-sm text-[#dc9a90]">{error}</p>}
      </div>
      <div className="bottom-bar">
        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
          {onSave && (
            <Button
              variant="outline"
              disabled={!valid || saving}
              onClick={async () => {
                setSaving(true);
                setError('');
                try {
                  await onSave(value());
                } catch (reason) {
                  setError(
                    reason instanceof Error ? reason.message : '保存失败',
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Check />
              保存修改
            </Button>
          )}
          <Button
            className="gold-button h-12"
            disabled={!valid}
            onClick={() => onUse(value())}
          >
            <WandSparkles />
            用于本次问题
          </Button>
        </div>
      </div>
    </section>
  );
}

function AiPreview({ value }: { value: AiInterpretation }) {
  return (
    <div className="ai-preview">
      <div className="flex items-center gap-2">
        <BrainCircuit className="size-5 text-[#c7a663]" />
        <h3>AI 辅助解读</h3>
      </div>
      <div className="mt-4 space-y-4">
        {value.cards.map((item, index) => (
          <div key={item.positionId}>
            <p className="ai-position">牌位 {index + 1}</p>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
      <div className="ai-summary">
        <b>综合观察</b>
        <p>{value.synthesis}</p>
        <b>行动建议</b>
        <p>{value.advice}</p>
      </div>
      <p className="ai-disclaimer">{value.disclaimer}</p>
    </div>
  );
}

function RitualStage({
  kind,
  question,
  onBack,
  onContinue,
  loading,
  error,
}: {
  kind: 'breathe' | 'shuffle';
  question: string;
  onBack: () => void;
  onContinue: () => void;
  loading: boolean;
  error: string;
}) {
  const breathing = kind === 'breathe';
  return (
    <section className="ritual-page">
      <PageHeader
        title={breathing ? '让问题安静下来' : '正在洗牌'}
        onBack={onBack}
      />
      <div className="ritual-content">
        <p className="eyebrow">
          {breathing ? 'BE PRESENT' : 'SHUFFLING THE ARCANA'}
        </p>
        <div
          className={breathing ? 'breath-orbit' : 'shuffle-orbit'}
          aria-hidden="true"
        >
          {breathing ? (
            <>
              <span>☾</span>
              <i />
              <i />
            </>
          ) : (
            <>
              <span />
              <span />
              <span />
            </>
          )}
        </div>
        <h1>
          {breathing ? '深呼吸…默念你的问题' : '打乱牌序，随机洗牌中…'}
        </h1>
        <p className="ritual-question">{question}</p>
        <p className="ritual-guide">
          {breathing
            ? '吸气时感受此刻，呼气时放下预设。准备好后，再让牌面回应你。'
            : '78 张牌正在形成只属于这次提问的顺序。摊开后，每张牌背后的答案将保持不变。'}
        </p>
        {error && <p className="ritual-error">{error}</p>}
      </div>
      <div className="bottom-bar">
        <Button
          className="gold-button h-12 w-full"
          disabled={loading}
          onClick={onContinue}
        >
          {loading ? (
            <>
              <LoaderCircle className="animate-spin" />
              请稍候
            </>
          ) : breathing ? (
            <>
              <Sparkles />
              我准备好了
            </>
          ) : (
            <>
              <RefreshCcw />
              重新洗牌
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

function TarotFan({
  total,
  required,
  selected,
  onBack,
  onSelect,
  onFinish,
  loading,
  error,
}: {
  total: number;
  required: number;
  selected: number[];
  onBack: () => void;
  onSelect: (index: number) => void;
  onFinish: () => void;
  loading: boolean;
  error: string;
}) {
  const visibleCount = Math.min(21, total);
  const [center, setCenter] = useState(Math.floor((total - 1) / 2));
  const [dragging, setDragging] = useState(false);
  const [width, setWidth] = useState(390);
  const stageRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef(center);
  const dragRef = useRef({
    active: false,
    startX: 0,
    startCenter: center,
    moved: false,
  });
  const suppressClick = useRef(false);
  const indexes = useMemo(
    () => visibleFanIndexes(total, center, visibleCount),
    [center, total, visibleCount],
  );

  useEffect(() => {
    if (!stageRef.current) return;
    const update = () => setWidth(stageRef.current?.clientWidth ?? 390);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  const moveCenter = (value: number, elastic = false) => {
    let next = clampFanCenter(value, total);
    if (elastic && value < 0) next = Math.max(-2.4, value * 0.18);
    if (elastic && value > total - 1) {
      next = total - 1 + Math.min(2.4, (value - (total - 1)) * 0.18);
    }
    centerRef.current = next;
    setCenter(next);
  };
  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startCenter: center,
      moved: false,
    };
  };
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.active) return;
    const delta = event.clientX - dragRef.current.startX;
    if (Math.abs(delta) > 30) dragRef.current.moved = true;
    if (Math.abs(delta) > 8) {
      const effectiveDelta = delta - Math.sign(delta) * 8;
      moveCenter(dragRef.current.startCenter - effectiveDelta / 26, true);
    }
  };
  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressClick.current = dragRef.current.moved;
    dragRef.current.active = false;
    setDragging(false);
    moveCenter(Math.round(clampFanCenter(centerRef.current, total)));
  };

  return (
    <section className="fan-page">
      <PageHeader title="亲手抽取你的牌" onBack={onBack} />
      <div className="fan-copy">
        <p className="fan-intro">
          牌已洗好，每张牌的位置都已固定。现在，请亲手抽取。
        </p>
        <h1>
          {selected.length < required
            ? `抽取第 ${selected.length + 1} 张牌`
            : '牌已经选好了'}
        </h1>
        <p>左右拖动牌阵，凭直觉点击一张牌</p>
        <div
          className="fan-progress"
          aria-label={`已选择 ${selected.length} 张，共需 ${required} 张`}
        >
          {Array.from({ length: required }, (_, index) => (
            <span key={index} className={index < selected.length ? 'active' : ''}>
              {index + 1}
            </span>
          ))}
        </div>
      </div>
      <div
        ref={stageRef}
        className={`fan-stage ${dragging ? 'is-dragging' : 'is-settling'}`}
        aria-label="可左右拖动的塔罗牌阵"
      >
        {indexes.map((deckIndex, slot) => {
          const transform = fanCardTransform(
            deckIndex,
            center,
            width,
          );
          const chosenAt = selected.indexOf(deckIndex);
          const chosen = chosenAt >= 0;
          return (
            <button
              type="button"
              key={deckIndex}
              className={`fan-card ${chosen ? 'fan-card--chosen' : ''}`}
              style={
                {
                  '--fan-x': `${transform.x}px`,
                  '--fan-y': `${transform.y}px`,
                  '--fan-rotation': `${transform.rotation}deg`,
                  zIndex: chosen ? 100 + chosenAt : 20 + slot,
                } as CSSProperties
              }
              aria-label={
                chosen
                  ? `第 ${chosenAt + 1} 张已选择的牌`
                  : `选择牌堆中的第 ${deckIndex + 1} 张`
              }
              aria-pressed={chosen}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') moveCenter(center - 2);
                if (event.key === 'ArrowRight') moveCenter(center + 2);
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                if (chosen || selected.length < required) onSelect(deckIndex);
              }}
            >
              <span>{chosen ? chosenAt + 1 : '✦'}</span>
            </button>
          );
        })}
        <div className="fan-table-mark" aria-hidden="true">
          <MoonStar />
        </div>
      </div>
      <div className="fan-footer">
        <p>
          {selected.length
            ? `已选择 ${selected.length} / ${required} 张`
            : '牌面已经固定，只等你的选择'}
        </p>
        {error && <p className="ritual-error">{error}</p>}
        <div className="fan-actions fan-actions--single">
          <Button
            className="gold-button h-12"
            disabled={selected.length !== required || loading}
            onClick={onFinish}
          >
            {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
            {selected.length === required
              ? '让牌面显现'
              : `还需选择 ${required - selected.length} 张`}
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const aiBusy = useRef(false);
  const draftRevision = useRef(0);
  const ritualRevision = useRef(0);
  const invalidateAi = () => {
    draftRevision.current += 1;
    setAiVersions([]);
    setSelectedAi(null);
    setDraftId(crypto.randomUUID());
  };
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('feed');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [customSpreads, setCustomSpreads] = useState<CustomSpread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<DrawMode>('online');
  const [question, setQuestion] = useState('');
  const [selectedSpread, setSelectedSpread] = useState<SpreadDefinition | null>(
    null,
  );
  const [spreadOrigin, setSpreadOrigin] = useState<SpreadOrigin>('builtin');
  const [editingSpread, setEditingSpread] = useState<
    CustomSpread | undefined
  >();
  const [cards, setCards] = useState<DrawnCard[]>([]);
  const [deck, setDeck] = useState<DeckCard[]>([]);
  const [fanSelected, setFanSelected] = useState<number[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [interpretation, setInterpretation] = useState('');
  const [tags, setTags] = useState('');
  const [aiVersions, setAiVersions] = useState<AiInterpretation[]>([]);
  const [selectedAi, setSelectedAi] = useState<AiInterpretation | null>(null);
  const [draftId, setDraftId] = useState('');
  const [active, setActive] = useState<Reading | null>(null);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | DrawMode>('all');
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const announce = (message: string) => {
    setNotice(message);
    setTimeout(() => setNotice(''), 2300);
  };
  const loadReadings = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await listReadings();
      setReadings(items);
      const id = new URLSearchParams(location.search).get('reading');
      const requested = items.find((item) => item.id === id);
      if (requested) {
        setActive(requested);
        setView('detail');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取失败');
    } finally {
      setLoading(false);
    }
  };
  const loadCustomSpreads = async () => {
    try {
      setCustomSpreads(await listCustomSpreads());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取我的牌阵失败');
    }
  };
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as Session;
          const current = await createMember(saved.nickname);
          if (!cancelled) {
            setSession(current);
            localStorage.setItem(SESSION_KEY, JSON.stringify(current));
            void loadCustomSpreads();
          }
        }
      } catch {
        localStorage.removeItem(SESSION_KEY);
      }
      if (!cancelled) void loadReadings();
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const handler = () => {
      const id = new URLSearchParams(location.search).get('reading');
      const reading = readings.find((item) => item.id === id);
      if (reading) {
        setActive(reading);
        setView('detail');
      } else setView('feed');
    };
    addEventListener('popstate', handler);
    return () => removeEventListener('popstate', handler);
  }, [readings]);
  const filtered = useMemo(
    () =>
      readings.filter((reading) => {
        const needle = query.trim().toLowerCase();
        return (
          (modeFilter === 'all' || reading.mode === modeFilter) &&
          (!needle ||
            [reading.question, reading.authorName, ...reading.tags]
              .join(' ')
              .toLowerCase()
              .includes(needle))
        );
      }),
    [readings, query, modeFilter],
  );
  if (!session)
    return (
      <NicknameGate
        onEnter={(next) => {
          setSession(next);
          void loadCustomSpreads();
        }}
      />
    );

  const goFeed = () => {
    invalidateAi();
    history.pushState({}, '', location.pathname);
    setView('feed');
    setActive(null);
    setError('');
    void loadReadings();
  };
  const start = (nextMode: DrawMode) => {
    ritualRevision.current += 1;
    invalidateAi();
    setMode(nextMode);
    setQuestion('');
    setSelectedSpread(null);
    setCards([]);
    setDeck([]);
    setFanSelected([]);
    setInterpretation('');
    setTags('');
    setAiVersions([]);
    setSelectedAi(null);
    setDraftId(crypto.randomUUID());
    setError('');
    setView('setup');
  };
  const useSpread = (spread: SpreadDefinition, origin: SpreadOrigin) => {
    invalidateAi();
    setSelectedSpread(spread);
    setSpreadOrigin(origin);
    setError('');
    setView('setup');
  };
  const beginDraw = () => {
    if (!selectedSpread) {
      setError('请先选择牌阵');
      return;
    }
    if (!question.trim()) {
      setError('请写下本次问题');
      return;
    }
    if (mode === 'physical') {
      setCards(
        selectedSpread.positions.map((position) => ({
          cardId: '',
          orientation: 'upright',
          positionId: position.id,
          position: position.question,
        })),
      );
      setView('physical');
      return;
    }
    ritualRevision.current += 1;
    setDeck([]);
    setFanSelected([]);
    setView('breathe');
  };
  const prepareOnlineDraw = async () => {
    const revision = ritualRevision.current + 1;
    ritualRevision.current = revision;
    setView('shuffle');
    setLoading(true);
    setError('');
    try {
      const nextDeck = createDeck();
      setDeck(nextDeck);
      setFanSelected([]);
      await new Promise((resolve) => setTimeout(resolve, 2200));
      if (ritualRevision.current === revision) setView('fan');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '洗牌失败，请重试');
    } finally {
      if (ritualRevision.current === revision) setLoading(false);
    }
  };
  const finalizeFanSelection = () => {
    if (!selectedSpread || fanSelected.length !== selectedSpread.positions.length)
      return;
    try {
      setCards(selectCardsFromDeck(deck, selectedSpread, fanSelected));
      setRevealed(0);
      setView('online');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '牌面没有显现，请重试');
    }
  };
  const saveNickname = async () => {
    setLoading(true);
    setError('');
    try {
      const next = await updateMemberNickname(nicknameDraft);
      setSession(next);
      localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      setReadings((items) =>
        items.map((item) =>
          item.memberId === next.memberId
            ? { ...item, authorName: next.nickname }
            : item,
        ),
      );
      setActive((item) =>
        item?.memberId === next.memberId
          ? { ...item, authorName: next.nickname }
          : item,
      );
      setEditingNickname(false);
      announce('昵称和历史记录已更新');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '昵称修改失败');
    } finally {
      setLoading(false);
    }
  };
  const generateAi = async () => {
    if (!selectedSpread || aiVersions.length >= 3 || aiBusy.current) return;
    aiBusy.current = true;
    const revision = draftRevision.current;
    setLoading(true);
    setError('');
    try {
      const result = await generateInterpretation({
        draftId,
        question,
        spread: selectedSpread,
        cards,
      });
      if (revision === draftRevision.current) {
        setAiVersions((items) => [...items, result]);
        setSelectedAi(result);
      }
    } catch (reason) {
      if (revision === draftRevision.current)
        setError(reason instanceof Error ? reason.message : 'AI 解牌失败');
    } finally {
      aiBusy.current = false;
      setLoading(false);
    }
  };
  const saveRecord = async (alsoSaveSpread: boolean) => {
    if (!selectedSpread) return;
    setLoading(true);
    setError('');
    try {
      const reading = await createReading({
        memberId: session.memberId,
        authorName: session.nickname,
        question,
        interpretation,
        aiInterpretation: selectedAi,
        mode,
        spread: selectedSpread,
        cards,
        tags: tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 3),
        idempotencyKey: draftId,
      });
      if (alsoSaveSpread && spreadOrigin === 'temporary') {
        const saved = await createCustomSpread(selectedSpread);
        setCustomSpreads((items) => [saved, ...items]);
      }
      setReadings((items) => [
        reading,
        ...items.filter((item) => item.id !== reading.id),
      ]);
      setActive(reading);
      history.pushState({}, '', `?reading=${reading.id}`);
      setView('detail');
      announce(alsoSaveSpread ? '记录和牌阵已保存' : '记录已保存');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };

  if (view === 'builder')
    return (
      <SpreadBuilder
        initial={editingSpread}
        onBack={() => setView('setup')}
        onUse={(value) =>
          void useSpread(value, editingSpread ? 'saved' : 'temporary')
        }
        onSave={
          editingSpread
            ? async (value) => {
                const updated = await updateCustomSpread(
                  editingSpread.id,
                  value,
                );
                setCustomSpreads((items) =>
                  items.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                );
                setEditingSpread(updated);
                announce('牌阵已更新');
              }
            : undefined
        }
      />
    );
  if (view === 'setup')
    return (
      <section className="panel-page">
        <PageHeader
          title={mode === 'online' ? '随机抽牌，AI解答' : '记录线下牌面'}
          onBack={goFeed}
        />
        <div className="mx-auto max-w-4xl px-4 pb-36 pt-7 sm:px-6">
          <h2 className="section-title">这次真正想看清什么？</h2>
          <Textarea
            id="first-question"
            aria-label="这次真正想看清什么？"
            value={question}
            maxLength={160}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={
              selectedSpread?.id === 'two-choice'
                ? '请明确写出：A 代表哪个选择，B 代表哪个选择。'
                : '例如：未来三个月，我和对方的关系会怎样发展？'
            }
            className="form-control mt-4 min-h-24"
          />
          {selectedSpread?.id === 'two-choice' && (
            <p className="mt-2 text-sm leading-6 text-[#b99a63]">
              请在问题中说清楚 A 和 B 分别代表哪个选择，例如：“A 留在现在的岗位，B 接受新工作，我该如何选择？”
            </p>
          )}
          <div className="mt-8 flex items-center justify-between">
            <h2 className="section-title">选择牌阵</h2>
            <Badge
              variant="outline"
              className="border-[#8d7449]/35 text-[#b99a63]"
            >
              {BUILT_IN_SPREADS.length} 个
            </Badge>
          </div>
          <Button
            variant="outline"
            className="mt-4 h-10 border-dashed border-[#8d7449]/45 bg-transparent px-4 text-sm text-[#c5a66f]"
            onClick={() => {
              setEditingSpread(undefined);
              setView('builder');
            }}
          >
            <Plus />
            自建牌阵
          </Button>
          <div className="spread-grid mt-4">
            {BUILT_IN_SPREADS.map((spread) => (
              <button
                key={spread.id}
                className={`spread-choice group ${selectedSpread?.id === spread.id ? 'selected' : ''}`}
                onClick={() => useSpread(spread, 'builtin')}
              >
                <div className="spread-count">{spread.positions.length}</div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="font-serif text-lg font-semibold text-[#f0e6d4]">
                    {spread.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-[#81798e]">
                    {spread.positions
                      .map((position) => position.question)
                      .join(' · ')}
                  </p>
                </div>
                <ChevronRight />
              </button>
            ))}
          </div>
          <div className="mt-8">
            <p className="eyebrow">我的牌阵</p>
            <div className="mt-3 grid gap-3">
              {customSpreads.map((spread) => (
                <div key={spread.id} className="saved-spread">
                  <button
                    onClick={() => useSpread(spread, 'saved')}
                  >
                    <b>{spread.name}</b>
                    <small>{spread.positions.length} 张牌</small>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingSpread(spread);
                      setView('builder');
                    }}
                    aria-label={`编辑${spread.name}`}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      if (!confirm(`删除“${spread.name}”吗？`)) return;
                      try {
                        await deleteCustomSpread(spread.id);
                        setCustomSpreads((items) =>
                          items.filter((item) => item.id !== spread.id),
                        );
                      } catch (reason) {
                        setError(
                          reason instanceof Error ? reason.message : '删除失败',
                        );
                      }
                    }}
                    aria-label={`删除${spread.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="mt-4 text-sm text-[#dc9a90]">{error}</p>}
        </div>
        <div className="bottom-bar">
          <Button
            className="gold-button h-12 w-full"
            disabled={!selectedSpread || !question.trim()}
            onClick={beginDraw}
          >
            <Sparkles />
            {selectedSpread
              ? `使用“${selectedSpread.name}”继续`
              : '选择牌阵后继续'}
          </Button>
        </div>
      </section>
    );
  if (view === 'breathe' && selectedSpread)
    return (
      <RitualStage
        kind="breathe"
        question={question}
        onBack={() => setView('setup')}
        onContinue={() => void prepareOnlineDraw()}
        loading={loading}
        error={error}
      />
    );
  if (view === 'shuffle' && selectedSpread)
    return (
      <RitualStage
        kind="shuffle"
        question={question}
        onBack={() => {
          ritualRevision.current += 1;
          setLoading(false);
          setView('breathe');
        }}
        onContinue={() => void prepareOnlineDraw()}
        loading={loading}
        error={error}
      />
    );
  if (view === 'fan' && selectedSpread)
    return (
      <TarotFan
        total={deck.length}
        required={selectedSpread.positions.length}
        selected={fanSelected}
        onBack={() => setView('breathe')}
        onSelect={(index) =>
          setFanSelected((items) =>
            items.includes(index)
              ? items.filter((item) => item !== index)
              : [...items, index],
          )
        }
        onFinish={finalizeFanSelection}
        loading={loading}
        error={error}
      />
    );
  if (view === 'online' && selectedSpread) {
    const allRevealed = revealed >= cards.length;
    return (
      <section className="panel-page">
        <PageHeader
          title={selectedSpread.name}
          onBack={() => setView('setup')}
        />
        <div className="mx-auto max-w-5xl px-4 pb-32 pt-7 sm:px-6">
          <div className="question-ribbon">你问：{question}</div>
          <div className="mt-5 text-center">
            <p className="eyebrow">点击牌背，按牌位逐张翻开</p>
            <h2 className="section-title">让牌面慢慢显现</h2>
          </div>
          <div
            className="reading-cards mt-9"
            style={{
              gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {cards.map((card, index) => (
              <CardFace
                key={card.positionId}
                drawn={card}
                hidden={index >= revealed}
                onReveal={
                  index === revealed
                    ? () => setRevealed((value) => value + 1)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
        <div className="bottom-bar">
          <Button
            className="gold-button h-12 w-full"
            disabled={!allRevealed}
            onClick={() => setView('compose')}
          >
            {allRevealed ? (
              <>
                <BrainCircuit />
                查看并解读
              </>
            ) : (
              `已翻开 ${revealed} / ${cards.length}`
            )}
          </Button>
        </div>
      </section>
    );
  }
  if (view === 'physical' && selectedSpread) {
    const complete =
      cards.every((card) => card.cardId) &&
      new Set(cards.map((card) => card.cardId)).size === cards.length;
    return (
      <section className="panel-page">
        <PageHeader title="记录线下牌面" onBack={() => setView('setup')} />
        <div className="mx-auto max-w-3xl px-4 pb-32 pt-7 sm:px-6">
          <div className="question-ribbon">你问：{question}</div>
          <h2 className="section-title mt-6">按牌位填入抽到的牌</h2>
          <div className="mt-5 grid gap-4">
            {cards.map((drawn, index) => (
              <Card
                key={drawn.positionId}
                className="border border-white/8 bg-white/[0.035] py-0"
              >
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_1.5fr_110px] sm:items-center">
                  <div>
                    <p className="text-xs text-[#89734c]">牌位 {index + 1}</p>
                    <p className="mt-1 font-serif text-lg text-[#eee3d0]">
                      {drawn.position}
                    </p>
                  </div>
                  <NativeSelect
                    value={drawn.cardId}
                    aria-label={`牌位 ${index + 1} 塔罗牌`}
                    onChange={(event) => {
                      invalidateAi();
                      setCards((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, cardId: event.target.value }
                            : item,
                        ),
                      );
                    }}
                  >
                    <NativeSelectOption value="">选择塔罗牌</NativeSelectOption>
                    {CARDS.map((card) => (
                      <NativeSelectOption key={card.id} value={card.id}>
                        {card.nameZh} · {card.nameEn}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  <NativeSelect
                    value={drawn.orientation}
                    aria-label={`牌位 ${index + 1} 正逆位`}
                    onChange={(event) => {
                      invalidateAi();
                      setCards((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                ...item,
                                orientation: event.target
                                  .value as DrawnCard['orientation'],
                              }
                            : item,
                        ),
                      );
                    }}
                  >
                    <NativeSelectOption value="upright">
                      正位
                    </NativeSelectOption>
                    <NativeSelectOption value="reversed">
                      逆位
                    </NativeSelectOption>
                  </NativeSelect>
                </CardContent>
              </Card>
            ))}
          </div>
          {cards.some((card) => card.cardId) &&
            new Set(
              cards.filter((card) => card.cardId).map((card) => card.cardId),
            ).size !== cards.filter((card) => card.cardId).length && (
              <p className="mt-4 text-sm text-[#d69a8f]">
                同一次记录不能重复选择同一张牌。
              </p>
            )}
        </div>
        <div className="bottom-bar">
          <Button
            className="gold-button h-12 w-full"
            disabled={!complete}
            onClick={() => setView('compose')}
          >
            <BrainCircuit />
            查看并解读
          </Button>
        </div>
      </section>
    );
  }
  if (view === 'compose' && selectedSpread)
    return (
      <section className="panel-page">
        <PageHeader
          title="这次的牌面"
          onBack={() => setView(mode === 'online' ? 'online' : 'physical')}
        />
        <div className="mx-auto max-w-4xl px-4 pb-40 pt-7 sm:px-6">
          <div className="question-ribbon">你问：{question}</div>
          <ReadingCards cards={cards} />
          <div className="mt-8">
            <Button
              className="gold-button h-12 w-full"
              disabled={loading || aiVersions.length >= 3}
              onClick={() => void generateAi()}
            >
              {loading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <BrainCircuit />
              )}
              {aiVersions.length
                ? `再生成一版（${aiVersions.length}/3）`
                : 'AI 解牌'}
            </Button>
          </div>
          {selectedAi && <AiPreview value={selectedAi} />}
          <div className="mt-8 space-y-6">
            <div>
              <label className="field-label" htmlFor="interpretation">
                我的解读{' '}
                <span className="font-normal text-[#6e6878]">
                  （选填，与 AI 分开显示）
                </span>
              </label>
              <Textarea
                id="interpretation"
                maxLength={4000}
                value={interpretation}
                onChange={(event) => setInterpretation(event.target.value)}
                placeholder="记录你自己的感受、判断或联想……"
                className="form-control min-h-32"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="tags">
                标签{' '}
                <span className="font-normal text-[#6e6878]">
                  （选填，最多 3 个）
                </span>
              </label>
              <Input
                id="tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder="关系，沟通，成长"
                className="form-control"
              />
            </div>
            {error && (
              <p className="rounded-xl border border-[#8e514a]/30 bg-[#8e514a]/10 p-3 text-sm text-[#e0a096]">
                {error}
              </p>
            )}
            <Button
              variant="ghost"
              className="w-full text-[#8f889b]"
              onClick={goFeed}
            >
              <X />
              不保存，结束本次
            </Button>
          </div>
        </div>
        <div className="bottom-bar">
          <div
            className={`grid w-full gap-2 ${spreadOrigin === 'temporary' ? 'sm:grid-cols-2' : ''}`}
          >
            <Button
              className="gold-button h-12"
              onClick={() => void saveRecord(false)}
              disabled={loading}
            >
              <Send />
              {spreadOrigin === 'temporary' ? '仅保存本次记录' : '保存本次记录'}
            </Button>
            {spreadOrigin === 'temporary' && (
              <Button
                variant="outline"
                className="h-12 border-[#b99351]/45 bg-[#1c1822] text-[#e5c788]"
                onClick={() => void saveRecord(true)}
                disabled={loading}
              >
                <Check />
                记录和牌阵都保存
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  if (view === 'detail' && active)
    return (
      <Detail
        reading={active}
        session={session}
        onBack={goFeed}
        onChanged={(updated) => {
          setActive(updated);
          setReadings((items) =>
            items.map((item) => (item.id === updated.id ? updated : item)),
          );
        }}
        onDeleted={goFeed}
        announce={announce}
      />
    );

  return (
    <main className="min-h-screen pb-28">
      <header className="site-header">
        <Brand />
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => {
              setNicknameDraft(session.nickname);
              setEditingNickname(true);
              setError('');
            }}
            aria-label="修改昵称"
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={async () => {
              await navigator.clipboard.writeText(location.origin);
              announce('链接已复制');
            }}
            aria-label="复制网站链接"
          >
            <Copy />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => {
              localStorage.removeItem(SESSION_KEY);
              setSession(null);
            }}
            aria-label="退出昵称"
          >
            <LogOut />
          </Button>
        </div>
      </header>
      {editingNickname && (
        <div className="nickname-overlay" role="dialog" aria-modal="true">
          <div className="nickname-dialog">
            <p className="eyebrow">UPDATE PROFILE</p>
            <h2>修改昵称</h2>
            <p>保存后，你之前发布的全部塔罗记录也会同步更新。</p>
            <Input
              value={nicknameDraft}
              maxLength={24}
              autoFocus
              onChange={(event) => setNicknameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveNickname();
              }}
              className="form-control mt-5"
              aria-label="新昵称"
            />
            {error && <p className="mt-3 text-sm text-[#dc9a90]">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setEditingNickname(false)}>
                取消
              </Button>
              <Button
                className="gold-button"
                disabled={loading || !nicknameDraft.trim()}
                onClick={() => void saveNickname()}
              >
                {loading ? <LoaderCircle className="animate-spin" /> : <Check />}
                保存昵称
              </Button>
            </div>
          </div>
        </div>
      )}
      <section className="feed-hero">
        <div>
          <p className="eyebrow">WELCOME BACK</p>
          <h1>{session.nickname}</h1>
          <p>
            {readings.length
              ? `共同留下 ${readings.length} 次观察`
              : '记录墙还是空的'}
          </p>
        </div>
        <div className="hero-moon" aria-hidden="true">
          <span>☾</span>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="action-grid">
          <button
            className="action-card action-card--gold"
            onClick={() => start('online')}
          >
            <span className="action-icon">
              <Sparkles />
            </span>
            <span>
              <b>随机抽牌，AI解答</b>
            </span>
            <ChevronRight />
          </button>
          <button className="action-card" onClick={() => start('physical')}>
            <span className="action-icon">
              <Layers3 />
            </span>
            <span>
              <b>记录线下牌面</b>
            </span>
            <ChevronRight />
          </button>
        </div>
        <div className="feed-toolbar">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#70697b]" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索问题、成员或标签"
              className="h-10 border-white/8 bg-white/[0.035] pl-9 text-[#e7dece]"
            />
          </div>
          <NativeSelect
            className="w-32"
            value={modeFilter}
            onChange={(event) =>
              setModeFilter(event.target.value as typeof modeFilter)
            }
          >
            <NativeSelectOption value="all">全部方式</NativeSelectOption>
            <NativeSelectOption value="online">
              随机抽牌，AI解答
            </NativeSelectOption>
            <NativeSelectOption value="physical">
              记录线下牌面
            </NativeSelectOption>
          </NativeSelect>
        </div>
        {error && (
          <div className="error-state">
            <p>{error}</p>
            <Button variant="outline" onClick={() => void loadReadings()}>
              <RefreshCcw />
              重试
            </Button>
          </div>
        )}
        {loading && !readings.length && (
          <div className="empty-state">
            <LoaderCircle className="animate-spin" />
            <p>正在翻阅记录……</p>
          </div>
        )}
        {!loading && !filtered.length && !error && (
          <div className="empty-state">
            <div className="empty-orbit">
              <MoonStar />
            </div>
            <h2>{readings.length ? '没有符合筛选的记录' : '记录墙还是空的'}</h2>
            <p>
              {readings.length
                ? '换个关键词或方式看看。'
                : '从第一条记录开始。'}
            </p>
          </div>
        )}
        <div className="reading-list">
          {filtered.map((reading) => (
            <article
              key={reading.id}
              className="reading-item"
              onClick={() => {
                history.pushState({}, '', `?reading=${reading.id}`);
                setActive(reading);
                setView('detail');
              }}
            >
              <div className="reading-meta">
                <span className="avatar">
                  <UserRound />
                </span>
                <span>
                  <b>{reading.authorName}</b>
                  <small>{formatDate(reading.createdAt)}</small>
                </span>
                <Badge
                  variant="outline"
                  className="ml-auto border-[#8d7449]/35 text-[#b99a63]"
                >
                  {reading.spread.name}
                </Badge>
              </div>
              <h2>{reading.question}</h2>
              <FeedCardNames cards={reading.cards} />
              <p className="reading-excerpt">
                {reading.interpretation ||
                  reading.aiInterpretation?.synthesis ||
                  '这条记录只保存了牌面。'}
              </p>
            </article>
          ))}
        </div>
      </section>
      <Button
        className="floating-draw gold-button"
        onClick={() => start('online')}
      >
        <Plus />
        抽牌
      </Button>
      {notice && (
        <div className="toast">
          <Check />
          {notice}
        </div>
      )}
    </main>
  );
}

function Detail({
  reading,
  session,
  onBack,
  onChanged,
  onDeleted,
  announce,
}: {
  reading: Reading;
  session: Session;
  onBack: () => void;
  onChanged: (reading: Reading) => void;
  onDeleted: () => void;
  announce: (message: string) => void;
}) {
  const owned = reading.memberId === session.memberId;
  const [feedback, setFeedback] = useState(reading.feedback);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const saveFeedback = async () => {
    setLoading(true);
    try {
      const updated = await updateFeedback(reading.id, feedback);
      onChanged(updated);
      announce('反馈已保存');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '保存失败');
    } finally {
      setLoading(false);
    }
  };
  const remove = async () => {
    if (!confirm('确定删除这条记录吗？删除后无法恢复。')) return;
    setLoading(true);
    try {
      await deleteReading(reading.id);
      announce('记录已删除');
      onDeleted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败');
      setLoading(false);
    }
  };
  const copyShare = async () => {
    const line = reading.cards
      .map(
        (drawn) =>
          `${drawn.position}：${CARD_MAP.get(drawn.cardId)?.nameZh}${drawn.orientation === 'reversed' ? '（逆位）' : ''}`,
      )
      .join('｜');
    await navigator.clipboard.writeText(
      `🔮 ${reading.authorName} 的塔罗记录\n${reading.question}\n${line}\n${location.href}`,
    );
    announce('分享文案已复制');
  };
  return (
    <section className="panel-page pb-20">
      <PageHeader title={reading.spread.name} onBack={onBack} />
      <article className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6">
        <div className="detail-heading">
          <div className="reading-meta">
            <span className="avatar">
              <UserRound />
            </span>
            <span>
              <b>{reading.authorName}</b>
              <small>{formatDate(reading.createdAt)}</small>
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-[#8d7449]/35 text-[#b99a63]"
          >
            {reading.mode === 'online' ? '随机抽牌，AI解答' : '记录线下牌面'}
          </Badge>
        </div>
        <h1 className="detail-title">{reading.question}</h1>
        <ReadingCards cards={reading.cards} />
        {reading.aiInterpretation && (
          <section className="detail-block">
            <AiPreview value={reading.aiInterpretation} />
          </section>
        )}
        <section className="detail-block">
          <p className="eyebrow">记录者自己的解读</p>
          <p className="detail-copy">
            {reading.interpretation || '这次没有填写个人解读。'}
          </p>
        </section>
        <section className="feedback-block">
          <h2>后续反馈</h2>
          {owned ? (
            <div className="mt-4 flex gap-3">
              <Input
                aria-label="后续反馈"
                value={feedback}
                maxLength={200}
                onChange={(event) =>
                  setFeedback(event.target.value.replace(/[\r\n]/g, ''))
                }
                className="form-control"
              />
              <Button
                onClick={() => void saveFeedback()}
                disabled={loading}
                className="gold-button"
              >
                <Check />
                保存
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-[#d5cbbb]">
              {reading.feedback || '记录者还没有补充反馈。'}
            </p>
          )}
        </section>
        {error && <p className="mt-4 text-sm text-[#dc9a90]">{error}</p>}
        <div className="detail-actions">
          <Button variant="outline" onClick={() => void copyShare()}>
            <Copy />
            复制到微信群
          </Button>
          {owned && (
            <Button
              variant="destructive"
              onClick={() => void remove()}
              disabled={loading}
            >
              <Trash2 />
              删除记录
            </Button>
          )}
        </div>
      </article>
    </section>
  );
}
