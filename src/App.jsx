import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  RotateCcw,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import danceStyles from './data/danceStyles.json';
import products from './data/products.json';

const danceTypeOptions = ['K-pop', 'Jazz', '路演', '练舞房', 'Urban', '女团', '其他'];
const styleOptions = ['甜酷', '辣妹', '清冷', '运动', 'Y2K', '学院', '暗黑', '元气', '性感', '甜辣', '妈咪'];
const sceneOptions = ['练舞房', '户外', '舞台', '路演', '夜景'];
const budgetOptions = ['100以内', '100-300', '300-500', '500+'];
const bodyOptions = ['显腿长', '显腰', '遮胯', '不露腰', '方便大动作'];

const visualMap = {
  'pink-mint': 'linear-gradient(135deg, #fecdd3 0%, #fbcfe8 42%, #99f6e4 100%)',
  'mint-lemon': 'linear-gradient(135deg, #99f6e4 0%, #ecfccb 48%, #fde68a 100%)',
  'ice-lilac': 'linear-gradient(135deg, #dbeafe 0%, #ddd6fe 55%, #f5f3ff 100%)',
  'rose-black': 'linear-gradient(135deg, #fb7185 0%, #7f1d1d 48%, #111827 100%)',
  'cream-blue': 'linear-gradient(135deg, #fff7ed 0%, #bfdbfe 52%, #fef3c7 100%)',
  'black-silver': 'linear-gradient(135deg, #111827 0%, #64748b 50%, #e5e7eb 100%)',
  'blue-yellow': 'linear-gradient(135deg, #bfdbfe 0%, #38bdf8 46%, #fde68a 100%)',
  'silver-cyan': 'linear-gradient(135deg, #e5e7eb 0%, #a5f3fc 48%, #475569 100%)',
};

const lookConfigs = [
  {
    key: 'stage',
    title: '打歌服灵感版',
    label: '还原感最高',
    extraScenes: ['舞台'],
    extraStyles: ['甜酷'],
    tone: '把舞台关键词落到日常能穿的单品上，重点保留比例、亮点和气场。',
    reasonPrefix: '这套更贴近原舞台的记忆点，',
    photoTip: '适合用低机位半身到全身切换，卡点时让配饰和上衣细节进入画面。',
  },
  {
    key: 'roadshow',
    title: '普通人路演版',
    label: '稳、舒服、能跳',
    extraScenes: ['路演', '户外'],
    extraStyles: ['运动'],
    extraBody: ['方便大动作'],
    tone: '把安全感和活动量放在前面，适合户外、商场中庭或临时路演。',
    reasonPrefix: '这套更适合长时间跳和走位，',
    photoTip: '建议选干净背景，侧身起手和定点 Pose 都容易显腿长。',
  },
  {
    key: 'daily',
    title: '日常出片版',
    label: '好拍又不夸张',
    extraScenes: ['日常', '户外'],
    extraStyles: ['学院', '元气'],
    tone: '降低舞台浓度，保留风格氛围，拍视频和日常穿出门都自然。',
    reasonPrefix: '这套更像小红书出片穿搭，',
    photoTip: '适合用自然光，抓转身、抬手、回头，画面会更轻松。',
  },
];

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function intersects(left = [], right = []) {
  return left.filter((item) => right.includes(item));
}

function findDance(query) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  return danceStyles.find((dance) => {
    const names = [dance.danceName, ...(dance.aliases || [])];
    return names.some((name) => normalizeText(name) === normalized);
  });
}

function danceToInfo(dance) {
  return {
    source: 'match',
    danceName: dance.danceName,
    artist: dance.artist,
    danceType: dance.danceType,
    styleTags: dance.styleTags,
    sceneTags: dance.sceneTags,
    outfitKeywords: dance.outfitKeywords,
    stageOutfitSummary: dance.stageOutfitSummary,
    priceRange: '',
    bodyTags: [],
    freeText: '',
  };
}

function manualToInfo(form, fallbackDance) {
  const styleTags = unique([form.style]);
  const sceneTags = unique([form.scene]);
  const bodyTags = unique([form.body]);
  const outfitKeywords = unique([
    form.style,
    form.danceType,
    form.scene,
    ...String(form.freeText || '')
      .split(/[，,、\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  ]);

  return {
    source: fallbackDance ? 'adjusted' : 'manual',
    danceName: fallbackDance?.danceName || form.danceName || '自定义舞蹈',
    artist: fallbackDance?.artist || '手动补充',
    danceType: form.danceType,
    styleTags,
    sceneTags,
    outfitKeywords,
    stageOutfitSummary:
      form.freeText ||
      `${form.danceType} 舞蹈搭配 ${form.style} 风格，适合 ${form.scene} 场景，整体要兼顾出片和动作舒展。`,
    priceRange: form.budget,
    bodyTags,
    freeText: form.freeText,
  };
}


function getBudgetOrder(range) {
  if (range === '100以内') return ['100以内', '100-300', '300-500', '500+'];
  if (range === '100-300') return ['100-300', '100以内', '300-500', '500+'];
  if (range === '300-500') return ['300-500', '500+', '100-300', '100以内'];
  if (range === '500+') return ['500+', '300-500', '100-300', '100以内'];
  return [];
}

function scoreProduct(product, info) {
  const keywordScore = (info.outfitKeywords || []).reduce((sum, keyword) => {
    return product.name.includes(keyword) ? sum + 2 : sum;
  }, 0);

  return (
    intersects(product.styleTags, info.styleTags).length * 3 +
    intersects(product.sceneTags, info.sceneTags).length * 2 +
    (product.danceTags.includes(info.danceType) ? 2 : 0) +
    intersects(product.bodyTags, info.bodyTags).length * 2 +
    (info.priceRange && product.priceRange === info.priceRange ? 4 : 0) +
    keywordScore
  );
}

function pickProduct(category, info, usedIds, fallbackIndex) {
  const categoryProducts = products.filter((product) => product.category === category);

  const budgetOrder = getBudgetOrder(info.priceRange);
  const budgetPriority = new Map(budgetOrder.map((range, index) => [range, index]));
  const ranked = categoryProducts
    .map((product, index) => ({
      product,
      index,
      score: scoreProduct(product, info),
      budgetRank: budgetPriority.get(product.priceRange) ?? 99,
    }))
    .sort((a, b) => b.score - a.score || a.budgetRank - b.budgetRank || a.index - b.index);

  return (
    ranked.find((item) => !usedIds.has(item.product.id))?.product ||
    ranked[fallbackIndex % ranked.length]?.product ||
    categoryProducts[0]
  );
}

function buildLooks(info) {
  const usedIds = new Set();

  return lookConfigs.map((config, index) => {
    const lookInfo = {
      ...info,
      styleTags: unique([...(info.styleTags || []), ...(config.extraStyles || [])]),
      sceneTags: unique([...(info.sceneTags || []), ...(config.extraScenes || [])]),
      bodyTags: unique([...(info.bodyTags || []), ...(config.extraBody || [])]),
    };

    const top = pickProduct('top', lookInfo, usedIds, index);
    const bottom = pickProduct('bottom', lookInfo, usedIds, index);
    const shoes = pickProduct('shoes', lookInfo, usedIds, index);
    const accessory = pickProduct('accessory', lookInfo, usedIds, index);

    [top, bottom, shoes, accessory].forEach((product) => product && usedIds.add(product.id));

    const styleLine = unique([...lookInfo.styleTags, lookInfo.danceType]).join(' / ');
    return {
      ...config,
      styleLine,
      top,
      bottom,
      shoes,
      accessory,
      reason: `${config.reasonPrefix}${top.name}负责上半身记忆点，${bottom.name}拉出比例，${shoes.name}保证动作完成度。`,
    };
  });
}

function makeCopyText(look, info) {
  return `今天跳《${info.danceName}》想走${look.styleLine}路线，搭了【${look.title}】：
上衣：${look.top.name}
下装：${look.bottom.name}
鞋子：${look.shoes.name}
配饰：${look.accessory.name}
推荐理由：${look.reason}
拍摄建议：${look.photoTip}
#舞蹈穿搭 #打歌服灵感 #小红书穿搭 #跳舞视频`;
}

function makeEmptyForm(dance) {
  return {
    danceName: dance?.danceName || '',
    danceType: dance?.danceType || 'K-pop',
    style: dance?.styleTags?.[0] || '甜酷',
    scene: dance?.sceneTags?.[0] || '练舞房',
    budget: '100-300',
    body: '方便大动作',
    freeText: '',
  };
}

function App() {
  const [page, setPage] = useState('home');
  const [query, setQuery] = useState('');
  const [matchedDance, setMatchedDance] = useState(null);
  const [manualForm, setManualForm] = useState(makeEmptyForm());
  const [finalInfo, setFinalInfo] = useState(null);
  const [notice, setNotice] = useState('');

  const looks = useMemo(() => (finalInfo ? buildLooks(finalInfo) : []), [finalInfo]);

  function goInput() {
    setQuery('');
    setMatchedDance(null);
    setFinalInfo(null);
    setManualForm(makeEmptyForm());
    setPage('input');
  }

  function handleBack() {
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
    const dance = findDance(query);
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
      await navigator.clipboard.writeText(text);
      setNotice(`已复制「${look.title}」小红书文案`);
    } catch {
      setNotice('复制失败，可以手动选中文案复制');
    }
    window.setTimeout(() => setNotice(''), 1800);
  }

  return (
    <main className="min-h-screen px-4 py-5 text-ink sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-md flex-col">
        <TopBar page={page} onBack={handleBack} onHome={goInput} />

        {page === 'home' && <HomePage onStart={goInput} />}
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
          <ResultsPage info={finalInfo} looks={looks} onCopy={copyLook} onRestart={goInput} />
        )}
      </div>

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-20 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-full bg-ink px-4 py-3 text-center text-sm text-white shadow-card">
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

function HomePage({ onStart }) {
  return (
    <section className="flex flex-1 flex-col justify-center safe-bottom">
      <div className="mb-8">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-semibold text-rose shadow-card">
          <Sparkles size={16} />
          本地舞蹈穿搭灵感机
        </div>
        <h1 className="text-5xl font-black leading-tight text-ink sm:text-6xl">舞搭一下</h1>
        <p className="mt-5 max-w-xs text-lg leading-8 text-stone-600">
          输入你要跳的舞，生成你的出片穿搭
        </p>
      </div>

      <div className="relative overflow-hidden rounded-[2rem] bg-white p-5 shadow-soft">
        <div className="grid aspect-[5/4] place-items-center rounded-[1.5rem] product-visual" style={{ '--product-bg': visualMap['pink-mint'] }}>
          <div className="rounded-full bg-white/80 px-5 py-3 text-base font-bold text-ink shadow-card">
            今日适合跳出漂亮视频
          </div>
        </div>
      </div>

      <button
        className="mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-base font-bold text-white shadow-card"
        onClick={onStart}
      >
        <WandSparkles size={20} />
        开始搭配
      </button>
    </section>
  );
}

function InputPage({ query, setQuery, onSearch }) {
  return (
    <section className="flex flex-1 flex-col pt-8 safe-bottom">
      <PageTitle eyebrow="第一步" title="你今天要跳哪支舞？" subtitle="输入舞蹈名或歌曲名，我会从本地舞蹈库里识别风格。" />

      <div className="mt-7 rounded-[1.75rem] bg-white p-5 shadow-soft">
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
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-rose px-5 py-4 text-base font-bold text-white shadow-card disabled:cursor-not-allowed disabled:bg-stone-300"
          onClick={onSearch}
          disabled={!query.trim()}
        >
          <Search size={19} />
          识别舞蹈风格
        </button>
      </div>

      <div className="mt-6">
        <p className="mb-3 text-sm font-bold text-stone-500">可试试这些</p>
        <div className="flex flex-wrap gap-2">
          {danceStyles.slice(0, 6).map((dance) => (
            <button
              key={dance.id}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-card"
              onClick={() => setQuery(dance.danceName)}
            >
              {dance.danceName}
            </button>
          ))}
        </div>
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

function ResultsPage({ info, looks, onCopy, onRestart }) {
  return (
    <section className="pb-8">
      <PageTitle eyebrow="搭配完成" title={`《${info.danceName}》的 3 套出片 Look`} subtitle="每套都按风格、场景、预算和动作需求做了本地打分推荐。" />

      <div className="mt-5 flex flex-wrap gap-2">
        {[info.danceType, ...info.styleTags, ...info.sceneTags, ...info.bodyTags].filter(Boolean).map((tag) => (
          <span key={tag} className="rounded-full bg-white px-3 py-2 text-sm font-bold text-stone-600 shadow-card">
            {tag}
          </span>
        ))}
      </div>

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
    <article className="rounded-[1.75rem] bg-white p-5 shadow-soft">
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
        文案会包含《{info.danceName}》、单品名称、推荐理由和拍摄建议。
      </p>
    </article>
  );
}

function ProductRow({ label, product }) {
  return (
    <div className="flex items-center gap-3 border-t border-rose/10 pt-3 first:border-t-0 first:pt-0">
      <ProductVisual product={product} small />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-stone-400">{label}</p>
        <p className="truncate text-sm font-black text-ink">{product.name}</p>
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
      className={`grid shrink-0 place-items-center rounded-2xl product-visual ${small ? 'h-12 w-12' : 'h-20 w-20'}`}
      style={{ '--product-bg': visualMap[product.image] || visualMap['pink-mint'] }}
      aria-label={product.name}
    >
      <span className={`${small ? 'text-xs' : 'text-sm'} font-black text-white drop-shadow`}>
        {categoryName(product.category)}
      </span>
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
