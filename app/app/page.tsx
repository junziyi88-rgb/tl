'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, BookOpen, Check, ChevronRight, Copy, Layers3, LoaderCircle,
  LogOut, MoonStar, Plus, RefreshCcw, Search, Send, Sparkles, Trash2, UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import {
  CARD_MAP, CARDS, SPREADS, formatDate,
  type DrawMode, type DrawnCard, type Reading, type SpreadKind,
} from '@/lib/tarot';

type Session = { memberId: string; nickname: string; token: string };
type View = 'feed' | 'spread' | 'online' | 'physical' | 'compose' | 'detail';
const SESSION_KEY = 'gongjian-tarot-session-v1';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || '网络暂时不可用，请稍后重试');
  return body as T;
}

function CardFace({ drawn, compact = false, hidden = false, onReveal }: {
  drawn: DrawnCard; compact?: boolean; hidden?: boolean; onReveal?: () => void;
}) {
  const card = CARD_MAP.get(drawn.cardId);
  const image = hidden ? '/card-back.jpg' : card?.image ?? '/card-back.jpg';
  const content = (
    <>
      <div className={`tarot-card ${compact ? 'tarot-card--compact' : ''} ${hidden ? 'tarot-card--hidden' : ''}`}>
        <img src={image} alt={hidden ? '未翻开的塔罗牌' : `${card?.nameZh ?? '塔罗牌'} ${drawn.orientation === 'reversed' ? '逆位' : '正位'}`}
          className={!hidden && drawn.orientation === 'reversed' ? 'rotate-180' : ''}
          onError={(event) => { event.currentTarget.src = '/card-back.jpg'; }} />
        {!hidden && <span className="orientation-mark">{drawn.orientation === 'reversed' ? '逆' : '正'}</span>}
      </div>
      {!compact && <div className="mt-3 text-center"><p className="text-[12px] tracking-[0.18em] text-[#a98b5a]">{drawn.position}</p><p className="mt-1 font-serif text-[17px] font-semibold text-[#f4ecdc]">{hidden ? '等待翻开' : card?.nameZh}</p>{!hidden && <p className="mt-0.5 text-xs text-[#8f889b]">{drawn.orientation === 'reversed' ? '逆位' : '正位'}</p>}</div>}
    </>
  );
  return onReveal ? <button type="button" className="group cursor-pointer" onClick={onReveal} aria-label="翻开这张牌">{content}</button> : <div>{content}</div>;
}

function Brand() {
  return <div className="flex items-center gap-3"><div className="brand-mark"><MoonStar className="size-5" /></div><div><p className="font-serif text-lg font-semibold tracking-[0.08em] text-[#f5ead5]">共见塔罗</p><p className="text-[10px] tracking-[0.22em] text-[#81798e]">THE SHARED ARCANA</p></div></div>;
}

function NicknameGate({ onEnter }: { onEnter: (session: Session) => void }) {
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!nickname.trim()) return setError('请先写下你在群里的昵称');
    setLoading(true); setError('');
    try {
      const session = await api<Session>('/api/members', { method: 'POST', body: JSON.stringify({ nickname }) });
      localStorage.setItem(SESSION_KEY, JSON.stringify(session)); onEnter(session);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '进入失败'); }
    finally { setLoading(false); }
  };
  return <main className="welcome-screen"><div className="star-field" aria-hidden="true" /><section className="welcome-card"><Brand /><div className="welcome-orbit" aria-hidden="true"><span>☾</span><span>✦</span><span>☼</span></div><p className="eyebrow">一个群 · 一套牌 · 共同复盘</p><h1>让每一次抽牌<br />都有迹可循</h1><p className="welcome-copy">输入群昵称，进入大家共用的塔罗记录墙。</p><label className="field-label" htmlFor="nickname">你的昵称</label><Input id="nickname" value={nickname} maxLength={24} autoComplete="nickname" onChange={(event) => setNickname(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} placeholder="例如：小月" className="h-12 rounded-xl border-white/10 bg-white/5 px-4 text-[#f6eddd] placeholder:text-[#6c6577]" />{error && <p className="mt-2 text-sm text-[#db968c]">{error}</p>}<Button onClick={() => void submit()} disabled={loading} className="gold-button mt-4 h-12 w-full rounded-xl text-base">{loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />} 进入记录墙</Button><p className="mt-4 text-center text-xs leading-5 text-[#746e7e]">无需注册。昵称只用于标记你的记录。</p></section></main>;
}

function PageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="page-header"><Button variant="ghost" size="icon-lg" onClick={onBack} className="text-[#b9b0c4] hover:bg-white/5 hover:text-white" aria-label="返回"><ArrowLeft /></Button><p className="font-serif text-lg font-semibold tracking-wide text-[#eee4d2]">{title}</p><div className="size-9" /></header>;
}

function SpreadPicker({ mode, onBack, onSelect }: { mode: DrawMode; onBack: () => void; onSelect: (spread: SpreadKind) => void }) {
  return <section className="panel-page"><PageHeader title={mode === 'online' ? '在线随机抽牌' : '记录线下抽牌'} onBack={onBack} /><div className="mx-auto max-w-3xl px-4 pb-28 pt-8 sm:px-6"><p className="eyebrow">STEP 01 · 选择牌阵</p><h2 className="section-title">这次想看几张牌？</h2><div className="mt-7 grid gap-3">{(Object.entries(SPREADS) as [SpreadKind, typeof SPREADS[SpreadKind]][]).map(([key, spread]) => <button key={key} className="spread-choice group" onClick={() => onSelect(key)}><div className="spread-mini" aria-hidden="true">{spread.positions.map((position) => <span key={position} />)}</div><div className="min-w-0 flex-1 text-left"><p className="font-serif text-xl font-semibold text-[#f0e6d4]">{spread.label}</p><p className="mt-1 truncate text-sm text-[#81798e]">{spread.positions.join(' · ')}</p></div><ChevronRight className="size-5 text-[#8f7547] transition-transform group-hover:translate-x-1" /></button>)}</div></div></section>;
}

function ReadingCards({ cards, compact = false }: { cards: DrawnCard[]; compact?: boolean }) {
  return <div className={`reading-cards reading-cards--${cards.length}`}>{cards.map((card, index) => <CardFace key={`${card.cardId}-${index}`} drawn={card} compact={compact} />)}</div>;
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>('feed');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<DrawMode>('online');
  const [spread, setSpread] = useState<SpreadKind>('one');
  const [cards, setCards] = useState<DrawnCard[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [active, setActive] = useState<Reading | null>(null);
  const [question, setQuestion] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [tags, setTags] = useState('');
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<'all' | DrawMode>('all');
  const [notice, setNotice] = useState('');

  const loadReadings = async () => {
    setLoading(true); setError('');
    try {
      const items = await api<Reading[]>('/api/readings'); setReadings(items);
      const requestedId = new URLSearchParams(location.search).get('reading');
      const requested = items.find((item) => item.id === requestedId);
      if (requested) { setActive(requested); setView('detail'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : '读取失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => { try { const saved = localStorage.getItem(SESSION_KEY); if (saved) setSession(JSON.parse(saved)); } catch { localStorage.removeItem(SESSION_KEY); } void loadReadings(); }, []);
  useEffect(() => { const handler = () => { const id = new URLSearchParams(location.search).get('reading'); const reading = readings.find((item) => item.id === id); if (reading) { setActive(reading); setView('detail'); } else setView('feed'); }; addEventListener('popstate', handler); return () => removeEventListener('popstate', handler); }, [readings]);
  useEffect(() => {
    type ToolInput = { mode?: unknown };
    type ModelContext = { registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'start_tarot_reading',
      title: '开始塔罗记录',
      description: '在可见页面中开始一次在线随机抽牌或线下抽牌记录流程。',
      inputSchema: {
        type: 'object',
        properties: { mode: { type: 'string', enum: ['online', 'physical'], description: 'online 为在线随机抽牌，physical 为记录线下抽牌' } },
        required: ['mode'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: ToolInput) {
        if (input.mode !== 'online' && input.mode !== 'physical') throw new Error('mode 必须是 online 或 physical');
        setMode(input.mode); setCards([]); setQuestion(''); setInterpretation(''); setTags(''); setError(''); setView('spread');
        return { status: 'ready', mode: input.mode, nextStep: 'choose_spread' };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  const filtered = useMemo(() => readings.filter((reading) => { const matchesMode = modeFilter === 'all' || reading.mode === modeFilter; const needle = query.trim().toLowerCase(); const matchesQuery = !needle || [reading.question, reading.authorName, ...reading.tags].join(' ').toLowerCase().includes(needle); return matchesMode && matchesQuery; }), [readings, query, modeFilter]);
  if (!session) return <NicknameGate onEnter={setSession} />;

  const goFeed = () => { history.pushState({}, '', location.pathname); setView('feed'); setActive(null); setError(''); void loadReadings(); };
  const start = (nextMode: DrawMode) => { setMode(nextMode); setCards([]); setQuestion(''); setInterpretation(''); setTags(''); setError(''); setView('spread'); };
  const chooseSpread = async (nextSpread: SpreadKind) => {
    setSpread(nextSpread); setError('');
    if (mode === 'physical') { setCards(SPREADS[nextSpread].positions.map((position) => ({ cardId: '', orientation: 'upright', position }))); setView('physical'); return; }
    setLoading(true);
    try { const result = await api<{ cards: DrawnCard[] }>('/api/draw', { method: 'POST', body: JSON.stringify({ spread: nextSpread }) }); setCards(result.cards); setRevealed(0); setView('online'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '抽牌失败'); }
    finally { setLoading(false); }
  };
  const openDetail = (reading: Reading) => { history.pushState({}, '', `?reading=${reading.id}`); setActive(reading); setView('detail'); scrollTo({ top: 0, behavior: 'smooth' }); };
  const announce = (message: string) => { setNotice(message); setTimeout(() => setNotice(''), 2200); };

  if (view === 'spread') return <SpreadPicker mode={mode} onBack={goFeed} onSelect={(value) => void chooseSpread(value)} />;
  if (view === 'online') {
    const allRevealed = revealed >= cards.length;
    return <section className="panel-page"><PageHeader title={SPREADS[spread].label} onBack={() => setView('spread')} /><div className="mx-auto max-w-5xl px-4 pb-32 pt-7 sm:px-6"><div className="text-center"><p className="eyebrow">点击牌背，逐张翻开</p><h2 className="section-title">让牌面慢慢显现</h2></div><div className={`reading-cards reading-cards--${cards.length} mt-9`}>{cards.map((card, index) => <CardFace key={card.cardId} drawn={card} hidden={index >= revealed} onReveal={index === revealed ? () => setRevealed((value) => value + 1) : undefined} />)}</div></div><div className="bottom-bar"><Button className="gold-button h-12 w-full rounded-xl text-base" disabled={!allRevealed} onClick={() => setView('compose')}>{allRevealed ? <><BookOpen /> 写下我的解读</> : `已翻开 ${revealed} / ${cards.length}`}</Button></div></section>;
  }
  if (view === 'physical') {
    const complete = cards.every((card) => card.cardId) && new Set(cards.map((card) => card.cardId)).size === cards.length;
    return <section className="panel-page"><PageHeader title="记录线下牌面" onBack={() => setView('spread')} /><div className="mx-auto max-w-3xl px-4 pb-32 pt-7 sm:px-6"><p className="eyebrow">{SPREADS[spread].label}</p><h2 className="section-title">按抽牌顺序选择牌面</h2><div className="mt-7 grid gap-4">{cards.map((drawn, index) => <Card key={drawn.position} className="border border-white/8 bg-white/[0.035] py-0 ring-0"><CardContent className="grid gap-3 p-4 sm:grid-cols-[88px_1fr_110px] sm:items-center"><div><p className="text-xs tracking-[0.18em] text-[#89734c]">位置 {index + 1}</p><p className="mt-1 font-serif text-lg text-[#eee3d0]">{drawn.position}</p></div><NativeSelect className="w-full" value={drawn.cardId} onChange={(event) => setCards((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, cardId: event.target.value } : item))}><NativeSelectOption value="">选择塔罗牌</NativeSelectOption>{CARDS.map((card) => <NativeSelectOption key={card.id} value={card.id}>{card.nameZh} · {card.nameEn}</NativeSelectOption>)}</NativeSelect><NativeSelect className="w-full" value={drawn.orientation} onChange={(event) => setCards((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, orientation: event.target.value as DrawnCard['orientation'] } : item))}><NativeSelectOption value="upright">正位</NativeSelectOption><NativeSelectOption value="reversed">逆位</NativeSelectOption></NativeSelect></CardContent></Card>)}</div>{!complete && cards.some((card) => card.cardId) && new Set(cards.map((card) => card.cardId)).size !== cards.length && <p className="mt-4 text-sm text-[#d69a8f]">同一次记录不能重复选择同一张牌。</p>}</div><div className="bottom-bar"><Button className="gold-button h-12 w-full rounded-xl text-base" disabled={!complete} onClick={() => setView('compose')}><BookOpen /> 继续填写记录</Button></div></section>;
  }
  if (view === 'compose') {
    const publish = async () => {
      if (!question.trim() || !interpretation.trim()) return setError('请填写占卜问题和你的解读');
      setLoading(true); setError('');
      try {
        const reading = await api<Reading>('/api/readings', { method: 'POST', headers: { authorization: `Bearer ${session.token}` }, body: JSON.stringify({ memberId: session.memberId, question, interpretation, mode, spread, cards, tags: tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 3), idempotencyKey: crypto.randomUUID() }) });
        setReadings((items) => [reading, ...items]); setActive(reading); setView('detail'); history.pushState({}, '', `?reading=${reading.id}`); announce('记录已发布');
      } catch (reason) { setError(reason instanceof Error ? reason.message : '发布失败'); }
      finally { setLoading(false); }
    };
    return <section className="panel-page"><PageHeader title="写下这次记录" onBack={() => setView(mode === 'online' ? 'online' : 'physical')} /><div className="mx-auto max-w-3xl px-4 pb-32 pt-7 sm:px-6"><ReadingCards cards={cards} compact /><div className="mt-8 space-y-6"><div><label className="field-label" htmlFor="question">占卜主题或问题</label><Input id="question" maxLength={160} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="例如：这周的工作状态如何？" className="form-control" /></div><div><label className="field-label" htmlFor="interpretation">我的解读</label><Textarea id="interpretation" maxLength={4000} value={interpretation} onChange={(event) => setInterpretation(event.target.value)} placeholder="记录你此刻看到的线索、感受和判断……" className="form-control min-h-36 resize-y" /></div><div><label className="field-label" htmlFor="tags">标签 <span className="font-normal text-[#6e6878]">（可选，逗号分隔，最多 3 个）</span></label><Input id="tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="工作，关系，成长" className="form-control" /></div>{error && <p className="rounded-xl border border-[#8e514a]/30 bg-[#8e514a]/10 p-3 text-sm text-[#e0a096]">{error}</p>}</div></div><div className="bottom-bar"><Button className="gold-button h-12 w-full rounded-xl text-base" onClick={() => void publish()} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : <Send />} 发布到记录墙</Button></div></section>;
  }
  if (view === 'detail' && active) return <Detail reading={active} session={session} onBack={goFeed} onChanged={(updated) => { setActive(updated); setReadings((items) => items.map((item) => item.id === updated.id ? updated : item)); }} onDeleted={goFeed} announce={announce} />;

  return <main className="min-h-screen pb-28"><header className="site-header"><Brand /><div className="flex items-center gap-1"><Button variant="ghost" size="icon-lg" className="text-[#958da1] hover:bg-white/5 hover:text-white" onClick={async () => { await navigator.clipboard.writeText(location.origin); announce('链接已复制'); }} aria-label="复制网站链接"><Copy /></Button><Button variant="ghost" size="icon-lg" className="text-[#958da1] hover:bg-white/5 hover:text-white" onClick={() => { localStorage.removeItem(SESSION_KEY); setSession(null); }} aria-label="退出昵称"><LogOut /></Button></div></header><section className="feed-hero"><div><p className="eyebrow">WELCOME BACK · {session.nickname}</p><h1>大家的塔罗记录</h1><p>{readings.length ? `已经共同留下 ${readings.length} 次观察` : '从第一次抽牌开始，共同积累真实反馈'}</p></div><div className="hero-moon" aria-hidden="true"><span>☾</span></div></section><section className="mx-auto max-w-5xl px-4 sm:px-6"><div className="action-grid"><button className="action-card action-card--gold" onClick={() => start('online')}><span className="action-icon"><Sparkles /></span><span><b>在线随机抽牌</b><small>洗牌、翻牌并记录解读</small></span><ChevronRight /></button><button className="action-card" onClick={() => start('physical')}><span className="action-icon"><Layers3 /></span><span><b>记录线下抽牌</b><small>选择实际抽到的牌面</small></span><ChevronRight /></button></div><div className="feed-toolbar"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#70697b]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索问题、成员或标签" className="h-10 border-white/8 bg-white/[0.035] pl-9 text-[#e7dece]" /></div><NativeSelect className="w-32" value={modeFilter} onChange={(event) => setModeFilter(event.target.value as typeof modeFilter)}><NativeSelectOption value="all">全部方式</NativeSelectOption><NativeSelectOption value="online">在线抽牌</NativeSelectOption><NativeSelectOption value="physical">线下记录</NativeSelectOption></NativeSelect></div>{error && <div className="error-state"><p>{error}</p><Button variant="outline" onClick={() => void loadReadings()}><RefreshCcw />重试</Button></div>}{loading && !readings.length ? <div className="empty-state"><LoaderCircle className="animate-spin" /><p>正在翻阅记录……</p></div> : null}{!loading && !filtered.length && !error ? <div className="empty-state"><div className="empty-orbit"><MoonStar /></div><h2>{readings.length ? '没有符合筛选的记录' : '记录墙还是空的'}</h2><p>{readings.length ? '换个关键词或方式看看。' : '抽一张牌，为大家留下第一条记录。'}</p>{!readings.length && <Button className="gold-button mt-3" onClick={() => start('online')}><Plus />开始抽牌</Button>}</div> : null}<div className="reading-list">{filtered.map((reading) => <article key={reading.id} className="reading-item" onClick={() => openDetail(reading)}><div className="reading-meta"><span className="avatar"><UserRound /></span><span><b>{reading.authorName}</b><small>{formatDate(reading.createdAt)}</small></span><Badge variant="outline" className="ml-auto border-[#8d7449]/35 text-[#b99a63]">{reading.mode === 'online' ? '在线抽牌' : '线下记录'}</Badge></div><h2>{reading.question}</h2><div className="mt-4 flex items-end justify-between gap-4"><ReadingCards cards={reading.cards} compact /><ChevronRight className="mb-5 size-5 shrink-0 text-[#655f70]" /></div><p className="reading-excerpt">{reading.interpretation}</p><div className="mt-4 flex flex-wrap items-center gap-2">{reading.tags.map((tag) => <Badge key={tag} variant="secondary" className="bg-white/5 text-[#aaa2b3]">#{tag}</Badge>)}{reading.feedback && <span className="ml-auto flex items-center gap-1 text-xs text-[#8fb6a6]"><Check className="size-3" /> 已有真实反馈</span>}</div></article>)}</div></section><Button className="floating-draw gold-button" onClick={() => start('online')}><Plus /> 抽牌</Button>{notice && <div className="toast"><Check />{notice}</div>}</main>;
}

function Detail({ reading, session, onBack, onChanged, onDeleted, announce }: { reading: Reading; session: Session; onBack: () => void; onChanged: (reading: Reading) => void; onDeleted: () => void; announce: (message: string) => void }) {
  const owned = reading.memberId === session.memberId;
  const [feedback, setFeedback] = useState(reading.feedback);
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const saveFeedback = async () => { setLoading(true); setError(''); try { const updated = await api<Reading>(`/api/readings/${reading.id}`, { method: 'PATCH', headers: { authorization: `Bearer ${session.token}`, 'x-member-id': session.memberId }, body: JSON.stringify({ feedback }) }); onChanged(updated); announce('反馈已保存'); } catch (reason) { setError(reason instanceof Error ? reason.message : '保存失败'); } finally { setLoading(false); } };
  const deleteReading = async () => { if (!confirm('确定删除这条记录吗？删除后无法恢复。')) return; setLoading(true); setError(''); try { await api(`/api/readings/${reading.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${session.token}`, 'x-member-id': session.memberId, 'x-admin-key': adminKey } }); announce('记录已删除'); onDeleted(); } catch (reason) { setError(reason instanceof Error ? reason.message : '删除失败'); setLoading(false); } };
  const copyShare = async () => { const cardLine = reading.cards.map((drawn) => `${drawn.position}：${CARD_MAP.get(drawn.cardId)?.nameZh}${drawn.orientation === 'reversed' ? '（逆位）' : ''}`).join('｜'); await navigator.clipboard.writeText(`🔮 ${reading.authorName} 的塔罗记录\n${reading.question}\n${cardLine}\n${location.href}`); announce('分享文案已复制'); };
  return <section className="panel-page pb-20"><PageHeader title="塔罗记录" onBack={onBack} /><article className="mx-auto max-w-4xl px-4 pb-16 pt-8 sm:px-6"><div className="detail-heading"><div className="reading-meta"><span className="avatar"><UserRound /></span><span><b>{reading.authorName}</b><small>{formatDate(reading.createdAt)}</small></span></div><Badge variant="outline" className="border-[#8d7449]/35 text-[#b99a63]">{reading.mode === 'online' ? '在线抽牌' : '线下记录'}</Badge></div><h1 className="detail-title">{reading.question}</h1><ReadingCards cards={reading.cards} /><section className="detail-block"><p className="eyebrow">当时的解读</p><p className="detail-copy">{reading.interpretation}</p>{reading.tags.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{reading.tags.map((tag) => <Badge key={tag} variant="secondary" className="bg-white/5 text-[#aaa2b3]">#{tag}</Badge>)}</div>}</section><section className="feedback-block"><div><p className="eyebrow">真实反馈</p><h2>后来，事情怎么样了？</h2></div>{owned ? <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Input aria-label="真实反馈" value={feedback} maxLength={200} onChange={(event) => setFeedback(event.target.value.replace(/[\r\n]/g, ''))} placeholder="用一句话记录真实发生的结果" className="form-control h-11" /><Button onClick={() => void saveFeedback()} disabled={loading} className="gold-button h-11 shrink-0"><Check />保存反馈</Button></div> : <p className="mt-4 text-base leading-7 text-[#d5cbbb]">{reading.feedback || '记录者还没有补充反馈。'}</p>}{owned && reading.feedback && <p className="mt-3 text-sm text-[#90899a]">当前：{reading.feedback}</p>}</section>{error && <p className="mt-4 text-sm text-[#dc9a90]">{error}</p>}<div className="detail-actions"><Button variant="outline" onClick={() => void copyShare()} className="border-white/10 bg-white/[0.03] text-[#d8cebd]"><Copy />复制到微信群</Button>{owned ? <Button variant="destructive" onClick={() => void deleteReading()} disabled={loading}><Trash2 />删除记录</Button> : <div className="flex w-full gap-2 sm:ml-auto sm:w-auto"><Input type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} placeholder="群主管理密钥" className="max-w-44 border-white/10 bg-white/[0.03]" /><Button variant="destructive" disabled={!adminKey || loading} onClick={() => void deleteReading()}><Trash2 />删除</Button></div>}</div></article></section>;
}
