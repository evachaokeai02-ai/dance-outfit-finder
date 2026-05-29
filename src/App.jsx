import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  Heart,
  Home,
  MessageCircle,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  WandSparkles,
} from 'lucide-react';
import danceStyles from './data/danceStyles.json';
import products from './data/products.json';
import {
  bodyOptions,
  budgetOptions,
  danceTypeOptions,
  sceneOptions,
  styleOptions,
  visualMap,
} from './config/recommendationConfig';
import {
  buildLooks,
  danceToInfo,
  findDance,
  makeCopyText,
  makeEmptyForm,
  manualToInfo,
} from './lib/recommendationEngine';
import { getFallbackKpopKeywords, getKpopSuggestions } from './lib/dancePipeline';
import { fetchPddProducts } from './lib/pddProducts';

function App() {
  const [page, setPage] = useState('home');
  const [query, setQuery] = useState('');
  const [matchedDance, setMatchedDance] = useState(null);
  const [manualForm, setManualForm] = useState(makeEmptyForm());
  const [finalInfo, setFinalInfo] = useState(null);
  const [notice, setNotice] = useState('');
  const [pddState, setPddState] = useState({ status: 'idle', products: [], error: '' });
  const [registered, setRegistered] = useState(false);
  const [petMessage, setPetMessage] = useState('嗨～你来跳我的舞啦？先告诉我今天想跳哪支！');

  const activeProducts = useMemo(() => {
    if (pddState.products.length > 0) return [...pddState.products, ...products];
    return products;
  }, [pddState.products]);
  const looks = useMemo(() => (finalInfo ? buildLooks(finalInfo, activeProducts) : []), [activeProducts, finalInfo]);

  useEffect(() => {
    if (!finalInfo) {
      setPddState({ status: 'idle', products: [], error: '' });
      return undefined;
    }

    let cancelled = false;
    setPddState({ status: 'loading', products: [], error: '' });

    fetchPddProducts(finalInfo)
      .then((data) => {
        if (cancelled) return;
        if (data.enabled && data.products?.length) {
          setPddState({ status: 'ready', products: data.products, error: '' });
          return;
        }
        setPddState({ status: data.enabled === false ? 'disabled' : 'empty', products: [], error: data.error || '' });
      })
      .catch((error) => {
        if (!cancelled) setPddState({ status: 'error', products: [], error: error.message });
      });

    return () => {
      cancelled = true;
    };
  }, [finalInfo]);

  function goInput() {
    setQuery('');
    setMatchedDance(null);
    setFinalInfo(null);
    setPddState({ status: 'idle', products: [], error: '' });
    setManualForm(makeEmptyForm());
    setPage('input');
  }

  function handleBack() {
    if (['community', 'chat', 'profile', 'register'].includes(page)) {
      setPage('home');
      return;
    }
    if (page === 'input') {
      setPage('home');
      return;
    }
    if (page === 'confirm') {
      setPage('input');
      return;
    }
    if (page === 'manual') {
      setPage(matchedDance ? 'confirm' : 'input');
      return;
    }
    if (page === 'results') {
      setPage(finalInfo?.source === 'match' && matchedDance ? 'confirm' : 'manual');
    }
  }

  function handleSearch() {
    const dance = findDance(query, danceStyles);
    if (dance) {
      setMatchedDance(dance);
      setManualForm(makeEmptyForm(dance));
      setPage('confirm');
      return;
    }
    setMatchedDance(null);
    setManualForm({ ...makeEmptyForm(), danceName: query.trim() || '自定义舞蹈' });
    setPage('manual');
  }

  function generateFromDance() {
    if (!matchedDance) return;
    setFinalInfo(danceToInfo(matchedDance));
    setPage('results');
  }

  function generateFromManual() {
    setFinalInfo(manualToInfo(manualForm, matchedDance));
    setPage('results');
  }

  async function copyLook(look) {
    const text = makeCopyText(look, finalInfo);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setNotice(`已复制「${look.title}」小红书文案，跳完可以去社区晒图～`);
      setPetMessage('文案复制好啦！要不要把这套 Look 挂到社区灵感墙？');
    } catch {
      setNotice('复制失败，可以手动选中文案复制');
    }

    window.setTimeout(() => setNotice(''), 1800);
  }

  function switchTab(nextPage) {
    setPage(nextPage);
    const messages = {
      home: '主页已就位！今天想挑战哪支舞？',
      community: '欢迎来到舞友社区，可以晒穿搭，也能挂二手联系方式。',
      chat: '我在对话室等你，穿搭、客服、尺码都可以问我。',
      profile: registered ? '这是你的舞搭档案，之前的 Look 都会收在这里。' : '先注册一个舞搭身份吧，我会帮你记住风格偏好。',
    };
    setPetMessage(messages[nextPage] || '我在这里陪你搭配～');
  }

  return (
    <main className="min-h-screen px-4 py-5 pb-28 text-ink sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-md flex-col">
        <TopBar page={page} onBack={handleBack} onHome={goInput} />

        {page === 'home' && <HomePage onStart={goInput} onOpenChat={() => switchTab('chat')} />}
        {page === 'input' && (
          <InputPage query={query} setQuery={setQuery} onSearch={handleSearch} />
        )}
        {page === 'confirm' && matchedDance && (
          <ConfirmPage
            dance={matchedDance}
            onGenerate={generateFromDance}
            onAdjust={() => setPage('manual')}
          />
        )}
        {page === 'manual' && (
          <ManualPage form={manualForm} setForm={setManualForm} onGenerate={generateFromManual} />
        )}
        {page === 'results' && finalInfo && (
          <ResultsPage info={finalInfo} looks={looks} pddState={pddState} onCopy={copyLook} onRestart={goInput} />
        )}
        {page === 'community' && <CommunityPage onStart={goInput} />}
        {page === 'chat' && <ChatPage onStart={goInput} />}
        {page === 'profile' && (registered ? <ProfilePage onStart={goInput} onOpenCommunity={() => switchTab('community')} /> : <RegisterPage onRegister={() => { setRegistered(true); setPetMessage('注册成功！以后我会记住你的舞蹈人格和搭配偏好。'); setPage('profile'); }} />)}
      </div>

      <PetAssistant message={petMessage} onChat={() => switchTab('chat')} />
      <BottomNav activePage={page} onNavigate={switchTab} />

      <ComplianceNotice />

      {notice && (
        <div className="fixed bottom-28 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-center text-sm text-white shadow-card">
          {notice}
        </div>
      )}
    </main>
  );
}

function TopBar({ page, onBack, onHome }) {
  if (page === 'home') {
    return <div className="h-10" />;
  }

  return (
    <div className="mb-4 flex h-10 items-center justify-between">
      <button
        className="grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-card"
        onClick={onBack}
        aria-label="返回"
      >
        <ArrowLeft size={19} />
      </button>
      <button className="text-sm font-semibold text-rose" onClick={onHome}>
        重新开始
      </button>
    </div>
  );
}

function HomePage({ onStart, onOpenChat }) {
  return (
    <section className="flex flex-1 flex-col justify-center safe-bottom">
      <div className="mb-8">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-rose shadow-card">
          <Sparkles size={16} />
          AI 舞搭 idol 在线营业中
        </div>
        <h1 className="text-5xl font-black leading-tight text-ink sm:text-6xl">舞搭一下</h1>
        <p className="mt-5 max-w-xs text-lg leading-8 text-stone-600">
          嗨～你来跳我的舞啦？输入舞蹈，我陪你挑战、搭衣服、发社区！
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 shadow-soft">
        <div className="grid aspect-[5/4] place-items-center rounded-[1.5rem] product-visual" style={{ '--product-bg': visualMap['pink-mint'] }}>
          <div className="rounded-[1.5rem] bg-white/85 px-5 py-4 text-center text-base font-bold text-ink shadow-card">
            <p>今日任务：跳出漂亮视频 ✨</p>
            <p className="mt-2 text-xs text-stone-500">匹配穿搭 · 晒到社区 · 问 AI 搭子</p>
          </div>
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <button
          className="fancy-btn flex h-14 items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white shadow-card"
          onClick={onStart}
        >
          <WandSparkles size={20} />
          开始搭配
        </button>
        <button
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-white px-5 text-base font-bold text-ink shadow-card"
          onClick={onOpenChat}
        >
          <MessageCircle size={19} />
          找搭子聊
        </button>
      </div>
    </section>
  );
}

function InputPage({ query, setQuery, onSearch }) {
  const [onlyKpop, setOnlyKpop] = useState(true);
  const suggestions = useMemo(() => getKpopSuggestions(danceStyles, onlyKpop, 8), [onlyKpop]);
  const fallbackKeywords = getFallbackKpopKeywords();

  return (
    <section className="flex flex-1 flex-col pt-8 safe-bottom">
      <PageTitle eyebrow="第一步" title="你今天要跳哪支舞？" subtitle="先支持 K-pop / 女团舞，输入舞蹈名或歌曲名，我会从本地舞蹈库里识别风格。" />

      <div className="glass-panel mt-7 rounded-[1.75rem] p-5 shadow-soft">
        <label className="text-sm font-bold text-stone-600" htmlFor="dance-input">
          舞蹈名 / 歌曲名
        </label>
        <input
          id="dance-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch();
          }}
          placeholder="比如 Super Shy、Drama、Like Jennie"
          className="mt-3 h-14 w-full rounded-2xl border border-rose/15 bg-blush/50 px-4 text-base outline-none transition focus:border-rose focus:bg-white"
        />
        <button
          className="fancy-btn mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-base font-bold text-white shadow-card disabled:cursor-not-allowed disabled:bg-stone-300 disabled:bg-none"
          onClick={onSearch}
          disabled={!query.trim()}
        >
          <Search size={19} />
          识别舞蹈风格
        </button>
      </div>

      <div className="mt-6 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-card backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold text-stone-600">{onlyKpop ? '先试试这些 K-pop' : '先试试这些热门舞'}</p>
          <button
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-white"
            onClick={() => setOnlyKpop((current) => !current)}
          >
            {onlyKpop ? '切换: 全部舞种' : '切换: 仅K-pop'}
          </button>
        </div>

        {suggestions.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((dance) => (
            <button
              key={dance.id}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-card"
              onClick={() => setQuery(dance.danceName)}
            >
              {dance.danceName}
            </button>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-sm text-stone-500">暂时没有匹配的 K-pop 舞蹈，你可以先试这些关键词：</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {fallbackKeywords.map((word) => (
                <button
                  key={word}
                  className="rounded-full bg-blush px-3 py-2 text-xs font-bold text-rose"
                  onClick={() => setQuery(word)}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ConfirmPage({ dance, onGenerate, onAdjust }) {
  return (
    <section className="pb-6">
      <PageTitle eyebrow="匹配成功" title="确认这支舞的穿搭方向" subtitle="如果感觉不对，可以手动调整风格、预算和身材诉求。" />

      <div className="mt-6 rounded-[1.75rem] bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-rose">舞蹈名</p>
            <h2 className="mt-1 text-3xl font-black">{dance.danceName}</h2>
            <p className="mt-2 text-sm font-semibold text-stone-500">{dance.artist}</p>
          </div>
          <div className="rounded-full bg-lemon/70 px-3 py-2 text-sm font-bold text-stone-800">
            {dance.danceType}
          </div>
        </div>

        <InfoBlock title="风格标签" items={dance.styleTags} />
        <InfoBlock title="适合场景" items={dance.sceneTags} />
        <InfoBlock title="打歌服关键词" items={dance.outfitKeywords} />

        {dance.stageOutfitProfiles?.length > 0 && (
          <div className="mt-5 border-t border-rose/10 pt-5">
            <p className="text-sm font-bold text-stone-500">打歌服 / MV 参考层级</p>
            <div className="mt-3 grid gap-3">
              {dance.stageOutfitProfiles.map((profile) => (
                <div key={profile.name} className="rounded-2xl bg-blush/60 p-3">
                  <p className="text-sm font-black text-ink">{profile.name}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-stone-600">{profile.summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-rose/10 pt-5">
          <p className="text-sm font-bold text-stone-500">风格归纳说明</p>
          <p className="mt-2 leading-7 text-stone-700">{dance.stageOutfitSummary}</p>
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 grid gap-3 bg-gradient-to-t from-[#fff7f7] via-[#fff7f7] to-transparent pt-4 safe-bottom">
        <button
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-bold text-white shadow-card"
          onClick={onGenerate}
        >
          <WandSparkles size={20} />
          生成穿搭
        </button>
        <button
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-base font-bold text-ink shadow-card"
          onClick={onAdjust}
        >
          <SlidersHorizontal size={19} />
          我想调整
        </button>
      </div>
    </section>
  );
}

function ManualPage({ form, setForm, onGenerate }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <section className="pb-6">
      <PageTitle eyebrow="手动补充" title="告诉我你想要的感觉" subtitle="匹配不到也没关系，选几个方向一样能生成三套 Look。" />

      <div className="mt-6 rounded-[1.75rem] bg-white p-5 shadow-soft">
        <FieldTitle title="舞蹈类型" />
        <ChipGroup options={danceTypeOptions} value={form.danceType} onChange={(value) => update('danceType', value)} />

        <FieldTitle title="风格" />
        <ChipGroup options={styleOptions} value={form.style} onChange={(value) => update('style', value)} />

        <FieldTitle title="场景" />
        <ChipGroup options={sceneOptions} value={form.scene} onChange={(value) => update('scene', value)} />

        <FieldTitle title="预算" />
        <ChipGroup options={budgetOptions} value={form.budget} onChange={(value) => update('budget', value)} />

        <FieldTitle title="身材诉求" />
        <ChipGroup options={bodyOptions} value={form.body} onChange={(value) => update('body', value)} />

        <FieldTitle title="想要的穿搭感觉" optional />
        <textarea
          value={form.freeText}
          onChange={(event) => update('freeText', event.target.value)}
          placeholder="比如不想太露、想像打歌服一点、要适合夜景拍摄"
          className="mt-3 min-h-28 w-full resize-none rounded-2xl border border-rose/15 bg-blush/50 px-4 py-3 leading-7 outline-none transition focus:border-rose focus:bg-white"
        />
      </div>

      <button
        className="sticky bottom-4 mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-bold text-white shadow-card"
        onClick={onGenerate}
      >
        <WandSparkles size={20} />
        生成穿搭
      </button>
    </section>
  );
}

function ResultsPage({ info, looks, pddState, onCopy, onRestart }) {
  return (
    <section className="pb-8">
      <PageTitle eyebrow="搭配完成" title={`《${info.danceName}》的 3 套出片 Look`} subtitle="每套都按风格、场景、预算和动作需求做了本地打分推荐。" />

      <div className="mt-5 flex flex-wrap gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${pddState.status === 'ready' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {pddState.status === 'ready' ? '拼多多实时商品' : pddState.status === 'loading' ? '正在连接拼多多' : '示例商品'}
        </span>
        {[info.danceType, ...info.styleTags, ...info.sceneTags, ...info.bodyTags].filter(Boolean).map((tag) => (
          <span key={tag} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-stone-600 shadow-card">
            {tag}
          </span>
        ))}
      </div>

      <PddStatus state={pddState} />

      <div className="mt-6 grid gap-5">
        {looks.map((look) => (
          <LookCard key={look.key} look={look} info={info} onCopy={() => onCopy(look)} />
        ))}
      </div>

      <button
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-4 text-base font-bold text-ink shadow-card"
        onClick={onRestart}
      >
        <RotateCcw size={19} />
        再搭一支舞
      </button>
    </section>
  );
}

function LookCard({ look, info, onCopy }) {
  const items = [
    ['上衣', look.top],
    ['下装', look.bottom],
    ['鞋子', look.shoes],
    ['配饰', look.accessory],
  ];

  return (
    <article className="rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1 rounded-full bg-blush px-3 py-1.5 text-xs font-bold text-rose">
            <CheckCircle2 size={14} />
            {look.label}
          </p>
          <h2 className="mt-3 text-2xl font-black">{look.title}</h2>
          <p className="mt-2 text-sm font-bold text-stone-500">{look.styleLine}</p>
        </div>
        <ProductVisual product={look.top} />
      </div>

      <p className="mt-5 leading-7 text-stone-700">{look.tone}</p>

      <div className="mt-5 grid gap-3">
        {items.map(([label, product]) => (
          <ProductRow key={product.id} label={label} product={product} />
        ))}
      </div>

      <TextBlock title="推荐理由" text={look.reason} />
      <TextBlock title="拍摄建议" text={look.photoTip} />

      <div className="mt-5 flex flex-wrap gap-2">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${items.some(([, product]) => product.source === 'pdd') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {items.some(([, product]) => product.source === 'pdd') ? '拼多多实时商品' : '示例商品'}
        </span>
        {items.map(([label, product]) => (
          <a
            key={product.id}
            href={product.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-2 text-xs font-bold text-white"
          >
            <ShoppingBag size={14} />
            {label}链接
          </a>
        ))}
      </div>

      <button
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-rose px-4 text-sm font-bold text-white shadow-card"
        onClick={onCopy}
      >
        <Copy size={17} />
        复制小红书文案
      </button>

      <p className="mt-3 text-xs leading-5 text-stone-400">
        文案会包含《{info.danceName}》、单品名称、推荐理由和拍摄建议；如果环境变量已配置，会优先展示拼多多实时商品链接。
      </p>
    </article>
  );
}

function PddStatus({ state }) {
  if (state.status === 'idle' || state.status === 'ready') return null;

  const textMap = {
    loading: '正在按这支舞的打歌服关键词连接拼多多商品库，先用本地候选保证页面可用。',
    disabled: '拼多多 API 已接入：部署后配置 PDD_CLIENT_ID / PDD_CLIENT_SECRET / PDD_PID 即可切换实时商品。',
    empty: '拼多多 API 暂无匹配商品，当前展示本地候选。',
    error: '拼多多 API 本次请求失败，当前展示本地候选。',
  };

  return (
    <div className="mt-5 rounded-3xl border border-amber-100 bg-amber-50/80 p-4 text-sm font-semibold leading-6 text-amber-800">
      {textMap[state.status] || textMap.error}
    </div>
  );
}

function ProductRow({ label, product }) {
  return (
    <div className="flex items-center gap-3 border-t border-rose/10 pt-3 first:border-t-0 first:pt-0">
      <ProductVisual product={product} small />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-stone-400">{label}</p>
        <p className="truncate text-sm font-black text-ink">{product.name}</p>
        {product.pdd?.salesTip && <p className="mt-0.5 text-xs font-semibold text-emerald-600">拼多多 {product.pdd.salesTip}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-lemon/70 px-2.5 py-1 text-xs font-bold text-stone-700">
        {product.priceRange}
      </span>
    </div>
  );
}

function ProductVisual({ product, small = false }) {
  return (
    <div
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl product-visual ${small ? 'h-12 w-12' : 'h-20 w-20'}`}
      style={{ '--product-bg': visualMap[product.image] || visualMap['pink-mint'] }}
      aria-label={product.name}
    >
      {product.pdd?.thumbUrl ? (
        <img className="h-full w-full object-cover" src={product.pdd.thumbUrl} alt={product.name} loading="lazy" />
      ) : (
        <span className={`${small ? 'text-xs' : 'text-sm'} font-black text-white drop-shadow`}>
          {categoryName(product.category)}
        </span>
      )}
    </div>
  );
}

function PageTitle({ eyebrow, title, subtitle }) {
  return (
    <header>
      <p className="inline-flex rounded-full bg-white px-3 py-2 text-sm font-bold text-rose shadow-card">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-black leading-tight text-ink">{title}</h1>
      <p className="mt-3 leading-7 text-stone-600">{subtitle}</p>
    </header>
  );
}

function FieldTitle({ title, optional = false }) {
  return (
    <div className="mb-3 mt-6 first:mt-0">
      <p className="text-sm font-black text-stone-700">
        {title}
        {optional && <span className="ml-2 text-xs font-bold text-stone-400">可选</span>}
      </p>
    </div>
  );
}

function ChipGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              active ? 'bg-ink text-white shadow-card' : 'bg-blush text-stone-600'
            }`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function InfoBlock({ title, items }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-bold text-stone-500">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item} className="rounded-full bg-blush px-3 py-2 text-sm font-bold text-stone-700">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TextBlock({ title, text }) {
  return (
    <div className="mt-5 border-t border-rose/10 pt-4">
      <p className="text-sm font-bold text-stone-500">{title}</p>
      <p className="mt-2 leading-7 text-stone-700">{text}</p>
    </div>
  );
}



const communityPosts = [
  {
    id: 'look-wall-1',
    user: 'Mina',
    dance: 'Super Shy 练习室',
    title: '薄荷粉短上衣 + 阔腿裤，跳起来很轻',
    tag: '可交流二手',
    contact: '小红书：@minadance',
  },
  {
    id: 'look-wall-2',
    user: 'Jelly',
    dance: 'Drama 镜面挑战',
    title: '黑银 Y2K 套装，适合夜景和地下车库',
    tag: '穿搭晒单',
    contact: '评论区蹲同款',
  },
  {
    id: 'look-wall-3',
    user: 'Nari',
    dance: 'Like Jennie solo',
    title: '红色发带 + 低腰裙，镜头记忆点很强',
    tag: '出片灵感',
    contact: '微信备注：舞搭',
  },
];

const savedLooks = [
  '甜酷练习室 Look',
  '女团打歌舞台 Look',
  '夜景翻跳短视频 Look',
];

function PetAssistant({ message, onChat }) {
  return (
    <button
      className="fixed bottom-24 right-4 z-30 flex max-w-[17rem] items-end gap-2 text-left sm:right-[calc(50%-13rem)]"
      onClick={onChat}
      aria-label="打开 AI 舞搭客服"
    >
      <div className="rounded-3xl rounded-br-md border border-white/80 bg-white/90 px-4 py-3 text-xs font-bold leading-5 text-stone-700 shadow-soft backdrop-blur">
        {message}
      </div>
      <div className="pet-bob grid h-14 w-14 shrink-0 place-items-center rounded-[1.25rem] bg-ink text-white shadow-card">
        <Bot size={28} />
      </div>
    </button>
  );
}

function BottomNav({ activePage, onNavigate }) {
  const tabs = [
    { key: 'home', label: '主页', icon: Home },
    { key: 'community', label: '社区', icon: UsersRound },
    { key: 'chat', label: '对话', icon: MessageCircle },
    { key: 'profile', label: '我的', icon: UserRound },
  ];

  const normalizedActive = ['input', 'confirm', 'manual', 'results'].includes(activePage) ? 'home' : activePage;

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-md -translate-x-1/2 px-4 pb-3 safe-bottom">
      <div className="grid grid-cols-4 gap-1 rounded-[1.5rem] border border-white/80 bg-white/90 p-2 shadow-soft backdrop-blur">
        {tabs.map(({ key, label, icon: Icon }) => {
          const active = normalizedActive === key;
          return (
            <button
              key={key}
              className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-black transition ${
                active ? 'bg-ink text-white shadow-card' : 'text-stone-500 hover:bg-blush'
              }`}
              onClick={() => onNavigate(key)}
            >
              <Icon size={18} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function CommunityPage({ onStart }) {
  return (
    <section className="pb-8">
      <PageTitle
        eyebrow="舞友社区"
        title="看看大家今天怎么跳、怎么穿"
        subtitle="这里可以晒翻跳穿搭，也可以挂出跳完闲置的二手信息；小程序只展示联系方式，不参与交易。"
      />

      <button className="fancy-btn mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full px-5 py-4 text-sm font-bold text-white shadow-card" onClick={onStart}>
        <Sparkles size={18} />
        先生成我的穿搭再发布
      </button>

      <div className="mt-6 grid gap-4">
        {communityPosts.map((post, index) => (
          <article key={post.id} className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/80 p-4 shadow-soft backdrop-blur">
            <div className="flex gap-4">
              <div className="grid h-24 w-24 shrink-0 place-items-center rounded-[1.5rem] product-visual text-center text-sm font-black text-white" style={{ '--product-bg': index % 2 ? visualMap['lavender-blue'] : visualMap['pink-mint'] }}>
                OOTD
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-ink">@{post.user}</p>
                  <span className="rounded-full bg-lemon/70 px-2.5 py-1 text-xs font-black text-stone-700">{post.tag}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-rose">{post.dance}</p>
                <h2 className="mt-2 text-base font-black leading-6">{post.title}</h2>
                <p className="mt-2 text-xs font-semibold text-stone-500">联系方式：{post.contact}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChatPage({ onStart }) {
  const quickReplies = ['这支舞适合露腰吗？', '帮我找显腿长的鞋', '想把旧衣服挂社区'];

  return (
    <section className="pb-8">
      <PageTitle eyebrow="AI 对话" title="你的舞搭客服 / 代码宠物上线" subtitle="之后可以接入真人客服或 AI idol。现在先用对话样式承接搭配、尺码、社区发布和二手说明。" />

      <div className="mt-6 rounded-[1.75rem] bg-white p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white">
            <Bot size={22} />
          </div>
          <div className="rounded-3xl rounded-tl-md bg-blush px-4 py-3 text-sm font-semibold leading-6 text-stone-700">
            Hi，我是舞搭小偶像。你来跳我的舞啦？把舞名、预算、身材顾虑丢给我，我会陪你从搭配聊到发布。
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          {quickReplies.map((reply) => (
            <button key={reply} className="rounded-2xl border border-rose/10 bg-white px-4 py-3 text-left text-sm font-bold text-stone-700 shadow-card">
              {reply}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-2 rounded-full bg-blush p-2">
          <input className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold outline-none" placeholder="输入想问的穿搭问题…" />
          <button className="rounded-full bg-ink px-4 py-2 text-sm font-black text-white">发送</button>
        </div>
      </div>

      <button className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-base font-bold text-ink shadow-card" onClick={onStart}>
        <WandSparkles size={19} />
        直接去搭一套
      </button>
    </section>
  );
}

function RegisterPage({ onRegister }) {
  return (
    <section className="pb-8">
      <PageTitle eyebrow="注册档案" title="创建你的舞搭身份" subtitle="注册后可以保存之前搭过的衣服、头像、个人信息和偏好，让小程序更像一个互动社区。" />

      <div className="mt-6 rounded-[1.75rem] bg-white p-5 shadow-soft">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-[2rem] bg-gradient-to-br from-rose to-violet-400 text-3xl font-black text-white shadow-card">
          D
        </div>
        <label className="mt-6 block text-sm font-black text-stone-600">昵称</label>
        <input className="mt-2 h-14 w-full rounded-2xl border border-rose/15 bg-blush/50 px-4 py-3 font-semibold outline-none focus:border-rose focus:bg-white" defaultValue="闪闪练习生" />
        <label className="mt-4 block text-sm font-black text-stone-600">手机号 / 微信</label>
        <input className="mt-2 h-14 w-full rounded-2xl border border-rose/15 bg-blush/50 px-4 py-3 font-semibold outline-none focus:border-rose focus:bg-white" placeholder="用于社区联系展示前确认" />
        <button className="fancy-btn mt-6 flex h-14 w-full items-center justify-center rounded-full text-base font-black text-white shadow-card" onClick={onRegister}>
          完成注册
        </button>
      </div>
    </section>
  );
}

function ProfilePage({ onStart, onOpenCommunity }) {
  return (
    <section className="pb-8">
      <div className="rounded-[2rem] bg-white p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 place-items-center rounded-[1.75rem] bg-gradient-to-br from-rose to-violet-400 text-2xl font-black text-white shadow-card">D</div>
          <div>
            <p className="text-sm font-bold text-rose">已注册舞搭用户</p>
            <h1 className="mt-1 text-3xl font-black">闪闪练习生</h1>
            <p className="mt-1 text-sm font-semibold text-stone-500">偏好：女团 · 甜酷 · 显腿长</p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.75rem] bg-white/85 p-5 shadow-soft">
        <h2 className="text-lg font-black">我之前搭过的衣服</h2>
        <div className="mt-4 grid gap-3">
          {savedLooks.map((look) => (
            <div key={look} className="flex items-center justify-between rounded-2xl bg-blush/70 px-4 py-3">
              <span className="font-bold text-stone-700">{look}</span>
              <Heart size={18} className="text-rose" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button className="flex h-14 items-center justify-center rounded-full bg-ink px-4 text-sm font-black text-white shadow-card" onClick={onStart}>再搭一套</button>
        <button className="flex h-14 items-center justify-center rounded-full bg-white px-4 text-sm font-black text-ink shadow-card" onClick={onOpenCommunity}>去社区发布</button>
      </div>
    </section>
  );
}

function ComplianceNotice() {
  return (
    <section className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-stone-200/70 bg-white/80 p-4 text-xs leading-6 text-stone-500 shadow-card">
      <p>
        本工具为独立舞蹈穿搭灵感推荐产品，非拼多多、淘宝、小红书等平台官方产品，亦不代表上述平台的官方推荐或背书。
      </p>
      <p className="mt-3">
        本工具展示的商品信息、图片、价格、库存、优惠、物流及售后服务均以第三方平台实际页面为准。本工具仅提供穿搭灵感与商品信息聚合，不参与商品交易、发货、售后或质量保证。
      </p>
      <p className="mt-3">
        如页面包含 AI 生成穿搭图，该图片仅为虚拟示意效果，不代表真实商品上身效果。
      </p>
    </section>
  );
}

function categoryName(category) {
  const names = {
    top: '上衣',
    bottom: '下装',
    shoes: '鞋',
    accessory: '配',
  };
  return names[category] || '搭';
}

export default App;
