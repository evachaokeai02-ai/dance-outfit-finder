import { lookConfigs, styleConflictMap } from '../config/recommendationConfig';

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

function stableHash(value) {
  return String(value || '').split('').reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) >>> 0;
  }, 2166136261);
}

export function findDance(query, danceStyles) {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  return danceStyles.find((dance) => {
    const names = [dance.danceName, ...(dance.aliases || [])];
    return names.some((name) => normalizeText(name) === normalized);
  });
}

function flattenProfileTags(dance, key) {
  return (dance.stageOutfitProfiles || []).flatMap((profile) => profile[key] || []);
}

export function danceToInfo(dance) {
  return {
    source: 'match',
    danceName: dance.danceName,
    artist: dance.artist,
    danceType: dance.danceType,
    styleTags: unique([...(dance.styleTags || []), ...flattenProfileTags(dance, 'styleTags')]),
    sceneTags: dance.sceneTags,
    outfitKeywords: unique([...(dance.outfitKeywords || []), ...flattenProfileTags(dance, 'outfitKeywords')]),
    avoidKeywords: dance.avoidKeywords || [],
    stageOutfitSummary: dance.stageOutfitSummary,
    stageOutfitProfiles: dance.stageOutfitProfiles || [],
    priceRange: '',
    bodyTags: [],
    freeText: '',
  };
}

function getAvoidKeywords(avoid) {
  const avoidMap = {
    不要太甜: ['甜美', '学院', '蝴蝶结'],
    不要太露: ['低腰', '露腰', '吊带'],
    不要学院: ['学院', '百褶裙', '针织开衫'],
    不要低腰: ['低腰'],
    不要紧身: ['紧身', '修身'],
    不要高跟: ['高跟', '高跟感'],
  };

  return avoidMap[avoid] || [];
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
    avoidKeywords: getAvoidKeywords(form.avoid),
    bodyTags,
    freeText: form.freeText,
  };
}

function getBudgetOrder(range) {
  if (range === '50-100') return ['100以内', '100-300', '300-500', '500+'];
  if (range === '100-200') return ['100-300', '100以内', '300-500', '500+'];
  if (range === '200-300') return ['100-300', '300-500', '100以内', '500+'];
  return ['100-300', '100以内', '300-500', '500+'];
}

function getProductTerms(product) {
  return [
    product.name,
    ...(product.styleTags || []),
    ...(product.sceneTags || []),
    ...(product.bodyTags || []),
    ...(product.danceTags || []),
    product.pdd?.salesTip,
  ].join(' ');
}

function getConflictTags(styleTags = []) {
  return unique(styleTags.flatMap((tag) => styleConflictMap[tag] || []));
}

function getCompatibleExtraStyles(baseStyles = [], extraStyles = [], avoidKeywords = []) {
  const baseConflicts = getConflictTags(baseStyles);
  return (extraStyles || []).filter((tag) => {
    const extraConflicts = styleConflictMap[tag] || [];
    return (
      !baseConflicts.includes(tag) &&
      !extraConflicts.some((conflict) => baseStyles.includes(conflict)) &&
      !avoidKeywords.includes(tag)
    );
  });
}

function getSignatureTerms(info) {
  return unique([
    info.rawQuery,
    info.danceName,
    info.artist,
    ...(info.outfitKeywords || []),
    ...(info.stageOutfitProfiles || []).flatMap((profile) => [
      profile.name,
      profile.summary,
      ...(profile.styleTags || []),
      ...(profile.outfitKeywords || []),
    ]),
  ]).filter((term) => String(term).length >= 2);
}


const productDisplayFallback = {
  top: '上衣',
  bottom: '下装',
  shoes: '鞋子',
  accessory: '配饰',
};

function compactDisplayText(value) {
  return String(value || '').trim().replace(/[\s｜|,，、/\\]+/g, '');
}

function getProductDisplayTitle(product) {
  const text = compactDisplayText(product?.displayTitle || productDisplayFallback[product?.category] || product?.name || '单品');
  return text.length > 12 ? text.slice(0, 12) : text;
}

function scoreProduct(product, info) {
  const productTerms = getProductTerms(product);
  const keywordScore = (info.outfitKeywords || []).reduce((sum, keyword) => {
    return productTerms.includes(keyword) ? sum + 2 : sum;
  }, 0);
  const avoidPenalty = (info.avoidKeywords || []).reduce((sum, keyword) => {
    return productTerms.includes(keyword) ? sum + 6 : sum;
  }, 0);
  const conflictPenalty = intersects(product.styleTags, getConflictTags(info.styleTags)).length * 4;
  const signatureScore = getSignatureTerms(info).reduce((sum, term) => {
    return productTerms.includes(term) ? sum + 3 : sum;
  }, 0);

  return (
    intersects(product.styleTags, info.styleTags).length * 3 +
    intersects(product.sceneTags, info.sceneTags).length * 2 +
    ((product.danceTags || []).includes(info.danceType) ? 2 : 0) +
    intersects(product.bodyTags, info.bodyTags).length * 2 +
    (info.priceRange && product.priceRange === info.priceRange ? 4 : 0) +
    keywordScore +
    signatureScore -
    avoidPenalty -
    conflictPenalty
  );
}

function pickProduct(category, info, usedIds, fallbackIndex, products, lookKey) {
  const categoryProducts = products.filter((product) => product.category === category);
  if (!categoryProducts.length) return null;

  const budgetOrder = getBudgetOrder(info.priceRange);
  const budgetPriority = new Map(budgetOrder.map((range, index) => [range, index]));
  const seed = stableHash([info.rawQuery, info.danceName, info.artist, category, lookKey].filter(Boolean).join('|'));
  const ranked = categoryProducts
    .map((product, index) => ({
      product,
      index,
      score: scoreProduct(product, info),
      budgetRank: budgetPriority.get(product.priceRange) ?? 99,
      seededRank: stableHash(`${product.id}:${seed}`) % 1000,
    }))
    .sort((a, b) => b.score - a.score || a.budgetRank - b.budgetRank || b.seededRank - a.seededRank || a.index - b.index);

  return (
    ranked.find((item) => !usedIds.has(item.product.id))?.product ||
    ranked[(fallbackIndex + (seed % ranked.length)) % ranked.length]?.product ||
    categoryProducts[0]
  );
}

export function buildLooks(info, products) {
  const usedIds = new Set();

  return lookConfigs.map((config, index) => {
    const lookInfo = {
      ...info,
      styleTags: unique([
        ...(info.styleTags || []),
        ...getCompatibleExtraStyles(info.styleTags, config.extraStyles, info.avoidKeywords),
      ]),
      sceneTags: unique([...(info.sceneTags || []), ...(config.extraScenes || [])]),
      bodyTags: unique([...(info.bodyTags || []), ...(config.extraBody || [])]),
    };

    const top = pickProduct('top', lookInfo, usedIds, index, products, config.key);
    const bottom = pickProduct('bottom', lookInfo, usedIds, index, products, config.key);
    const shoes = pickProduct('shoes', lookInfo, usedIds, index, products, config.key);
    const accessory = pickProduct('accessory', lookInfo, usedIds, index, products, config.key);

    [top, bottom, shoes, accessory].forEach((product) => product && usedIds.add(product.id));

    const styleLine = unique([...lookInfo.styleTags, lookInfo.danceType]).join(' / ');
    return {
      ...config,
      styleLine,
      top,
      bottom,
      shoes,
      accessory,
      reason: `${config.reasonPrefix}${getProductDisplayTitle(top)}负责上半身记忆点，${getProductDisplayTitle(bottom)}拉出比例，${getProductDisplayTitle(shoes)}保证动作完成度。`,
    };
  });
}

export function makeCopyText(look, info) {
  return `今天跳《${info.danceName}》想走${look.styleLine}路线，搭了【${look.title}】：\n上衣：${getProductDisplayTitle(look.top)}\n下装：${getProductDisplayTitle(look.bottom)}\n鞋子：${getProductDisplayTitle(look.shoes)}\n配饰：${getProductDisplayTitle(look.accessory)}\n推荐理由：${look.reason}\n拍摄建议：${look.photoTip}\n#舞蹈穿搭 #打歌服灵感 #小红书穿搭 #跳舞视频`;
}

export function makeEmptyForm(dance) {
  return {
    danceName: dance?.danceName || '',
    danceType: dance?.danceType || 'K-pop',
    style: dance?.styleTags?.[0] || '甜酷',
    scene: dance?.sceneTags?.[0] || '练舞房',
    budget: '100-200',
    body: '方便大动作',
    avoid: '无特别避雷',
    freeText: '',
  };
}
