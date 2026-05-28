import { lookConfigs } from '../config/recommendationConfig';

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function unique(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function intersects(left = [], right = []) {
  return left.filter((item) => right.includes(item));
}

export function findDance(query, danceStyles) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  return danceStyles.find((dance) => {
    const names = [dance.danceName, ...(dance.aliases || [])];
    return names.some((name) => normalizeText(name) === normalized);
  });
}

export function danceToInfo(dance) {
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

export function manualToInfo(form, fallbackDance) {
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

function pickProduct(category, info, usedIds, fallbackIndex, products) {
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

export function buildLooks(info, products) {
  const usedIds = new Set();

  return lookConfigs.map((config, index) => {
    const lookInfo = {
      ...info,
      styleTags: unique([...(info.styleTags || []), ...(config.extraStyles || [])]),
      sceneTags: unique([...(info.sceneTags || []), ...(config.extraScenes || [])]),
      bodyTags: unique([...(info.bodyTags || []), ...(config.extraBody || [])]),
    };

    const top = pickProduct('top', lookInfo, usedIds, index, products);
    const bottom = pickProduct('bottom', lookInfo, usedIds, index, products);
    const shoes = pickProduct('shoes', lookInfo, usedIds, index, products);
    const accessory = pickProduct('accessory', lookInfo, usedIds, index, products);

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

export function makeCopyText(look, info) {
  return `今天跳《${info.danceName}》想走${look.styleLine}路线，搭了【${look.title}】：\n上衣：${look.top.name}\n下装：${look.bottom.name}\n鞋子：${look.shoes.name}\n配饰：${look.accessory.name}\n推荐理由：${look.reason}\n拍摄建议：${look.photoTip}\n#舞蹈穿搭 #打歌服灵感 #小红书穿搭 #跳舞视频`;
}

export function makeEmptyForm(dance) {
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
