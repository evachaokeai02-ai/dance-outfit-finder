import { getProductsHandlerDebug, isPddConfigured, PddApiError, searchGoods, toRecommendationProduct } from '../lib/pdd.js';

const DEFAULT_PAGE_SIZE = 8;

const CATEGORY_FALLBACK_QUERIES = {
  top: ['女团短上衣', '修身短上衣', '运动背心'],
  bottom: ['百褶短裙', '黑色短裙', '低腰短裤'],
  shoes: ['跳舞鞋', '厚底小白鞋', '运动鞋'],
  accessory: ['腰带', '金属腰链', '发饰'],
};

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function normalizePddError(error) {
  if (!error) return null;

  const details = error instanceof PddApiError ? error.details || {} : {};
  const pddDebug = details.pddDebug || details.promotionParamsDebug || null;

  return {
    message: error.message || 'Unknown error',
    code: error instanceof PddApiError ? error.code : 'internal-error',
    details: error instanceof PddApiError ? details : undefined,
    pddDebug,
    promotionParamsDebug: details.promotionParamsDebug || null,
    failingPddType: details.failingPddType || pddDebug?.failingPddType || details.pddType || '',
    failingStage: details.failingStage || pddDebug?.failingStage || '',
  };
}

function sanitizePddError(pddError) {
  if (!pddError) return null;
  const details = pddError.details || {};
  const subCode = pddError.sub_code || details.sub_code || details.pddSubCode;
  const subMsg = pddError.sub_msg || details.sub_msg || details.pddSubMessage;

  if (!subCode && !subMsg && !pddError.code && !pddError.message) return null;

  return {
    code: pddError.code || '',
    message: pddError.message || '',
    sub_code: subCode || '',
    sub_msg: subMsg || '',
  };
}

function hasImage(product) {
  return Boolean(product?.imageUrl || product?.pdd?.imageUrl || product?.pdd?.thumbUrl);
}

function hasJumpUrl(product) {
  return Boolean(product?.jumpUrl || product?.link);
}

function withDiagnostics(product, { goodsListCount = 0, fallbackReason = '', pddError = null } = {}) {
  return {
    ...product,
    imageUrlHasValue: hasImage(product),
    jumpUrlHasValue: hasJumpUrl(product),
    fallbackReason,
    goodsListCount,
    pddError: sanitizePddError(pddError),
  };
}

function getPddDebugFromError(pddError) {
  return pddError?.pddDebug || pddError?.promotionParamsDebug || pddError?.details?.pddDebug || pddError?.details?.promotionParamsDebug || null;
}

function getFailingPddType(pddError, fallbackDebug = null) {
  return pddError?.failingPddType || pddError?.details?.failingPddType || fallbackDebug?.failingPddType || '';
}

function getFailingStage(pddError, fallbackDebug = null) {
  return pddError?.failingStage || pddError?.details?.failingStage || fallbackDebug?.failingStage || '';
}

function toFallbackProduct(query, index, pddError = null, fallbackDebug = null, fallbackReason = '') {
  const categoryName = {
    top: '短款上衣',
    bottom: '高腰下装',
    shoes: '防滑舞蹈鞋',
    accessory: '舞台配饰',
  }[query.category] || '舞蹈单品';
  const displayTitle = {
    top: '上衣',
    bottom: '下装',
    shoes: '鞋子',
    accessory: '配饰',
  }[query.category] || '单品';
  const displayTags = [...new Set([...(query.styleTags || []), ...(query.sceneTags || []), ...(query.danceTags || [])]
    .map((tag) => String(tag || '').trim().replace(/[\s｜|,，、/\\]+/g, ''))
    .filter((tag) => tag.length >= 2 && tag.length <= 5))]
    .slice(0, 3);

  const pddDebug = getPddDebugFromError(pddError) || fallbackDebug || getProductsHandlerDebug() || {};
  const failingPddType = getFailingPddType(pddError, pddDebug);
  const failingStage = getFailingStage(pddError, pddDebug);
  const queryAttempts = Array.isArray(query.queryAttempts) && query.queryAttempts.length ? query.queryAttempts : [query.keyword];
  const product = {
    id: `pdd-fallback-${query.category}-${index}`,
    name: `${query.keyword} ${categoryName}`,
    title: `${query.keyword} ${categoryName}`,
    displayTitle,
    displayTags,
    rawKeyword: query.rawKeyword || query.keyword,
    searchQuery: query.rawKeyword || query.keyword,
    queryUsed: query.keyword,
    queryAttempts,
    category: query.category,
    styleTags: query.styleTags || [],
    sceneTags: query.sceneTags || [],
    danceTags: query.danceTags || [],
    bodyTags: query.bodyTags || [],
    priceRange: '100-300',
    priceLabel: '',
    image: query.image || 'rose-black',
    imageUrl: '',
    link: '',
    jumpUrl: '',
    source: 'pdd-unavailable',
    linkStatus: 'failed',
    linkMessage: pddError?.message || '链接生成失败/暂不可跳转',
    promotionError: sanitizePddError(pddError) || '',
    promotionParamsDebug: pddDebug?.promotionType ? pddDebug : null,
    pddDebug,
    failingPddType,
    failingStage,
    hasPid: pddDebug.hasPid,
    pidLength: pddDebug.pidLength,
    pidHasUnderscore: pddDebug.pidHasUnderscore,
    pidPrefixMatchesDuoId: pddDebug.pidPrefixMatchesDuoId,
    hasCustomParameters: pddDebug.hasCustomParameters,
    pidFieldNameUsed: pddDebug.pidFieldNameUsed,
    goodsParamFieldUsed: pddDebug.goodsParamFieldUsed,
    pdd: {
      goodsId: '',
      goodsSign: '',
      thumbUrl: '',
      imageUrl: '',
      mallName: '',
      fullGoodsName: `${query.keyword} ${categoryName}`,
      rawKeyword: query.rawKeyword || query.keyword,
      searchQuery: query.rawKeyword || query.keyword,
      queryUsed: query.keyword,
      queryAttempts,
      pddDebug,
      promotionParamsDebug: pddDebug?.promotionType ? pddDebug : null,
    },
  };

  return withDiagnostics(product, {
    goodsListCount: query.goodsListCount || 0,
    fallbackReason: fallbackReason || query.fallbackReason || 'pdd-category-fallback',
    pddError,
  });
}

function firstPddError(results) {
  return results.find((item) => item.pddError)?.pddError || null;
}

function fallbackPddError(results) {
  const firstError = firstPddError(results);
  if (firstError) return firstError;

  const pddDebug = results.find((item) => item.pddDebug)?.pddDebug || null;

  return {
    code: 'empty-goods-list',
    message: 'PDD search succeeded but goods_list was empty or image-less for every query.',
    details: {
      emptyQueries: results
        .filter((item) => item.goodsListEmpty || item.fallbackReason === 'all-goods-missing-image')
        .map((item) => ({ keyword: item.keyword, category: item.category })),
      pddDebug,
      failingPddType: pddDebug?.failingPddType || 'pdd.ddk.goods.search',
      failingStage: 'goods-search',
    },
    pddDebug,
    failingPddType: pddDebug?.failingPddType || 'pdd.ddk.goods.search',
    failingStage: 'goods-search',
  };
}

function getDisplayLimit(limit) {
  return Math.max(1, Number(limit) || 2);
}

function normalizeQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function buildQueryAttempts(query) {
  const attempts = [normalizeQuery(query.keyword)];
  const fallbacks = [
    ...(Array.isArray(query.fallbackQueries) ? query.fallbackQueries : []),
    ...(CATEGORY_FALLBACK_QUERIES[query.category] || []),
  ];

  fallbacks.map(normalizeQuery).filter(Boolean).forEach((fallbackQuery) => attempts.push(fallbackQuery));
  return [...new Set(attempts.filter(Boolean))];
}

async function searchOne(query) {
  const queryAttempts = buildQueryAttempts(query);
  const attemptSummaries = [];
  let lastPddError = null;
  let lastPddDebug = null;
  let totalGoodsListCount = 0;
  let hadSuccessfulSearch = false;

  for (const [attemptIndex, keyword] of queryAttempts.entries()) {
    try {
      const result = await searchGoods({
        keyword,
        page: query.page || 1,
        pageSize: query.pageSize || query.limit || DEFAULT_PAGE_SIZE,
        sortType: query.sortType || 0,
        withCoupon: query.withCoupon ?? false,
      });
      const goodsListCount = result.goodsListCount ?? result.products.length;
      hadSuccessfulSearch = true;
      totalGoodsListCount += goodsListCount;
      lastPddDebug = result.pddDebug || lastPddDebug;

      const recommendationProducts = result.products.map((product, index) =>
        toRecommendationProduct(product, { ...query, keyword }, index)
      );
      const productsWithImages = recommendationProducts.filter(hasImage);
      const skippedImageCount = recommendationProducts.length - productsWithImages.length;
      const fallbackReason = attemptIndex > 0
        ? 'category-query-fallback-used'
        : skippedImageCount > 0
          ? 'skipped-products-without-image'
          : '';
      const products = productsWithImages
        .slice(0, getDisplayLimit(query.limit))
        .map((product) => withDiagnostics({
          ...product,
          queryAttempts,
          pdd: product.pdd ? { ...product.pdd, queryAttempts } : product.pdd,
        }, { goodsListCount, fallbackReason }));

      attemptSummaries.push({
        keyword,
        category: query.category,
        goodsListCount,
        imageCandidateCount: productsWithImages.length,
        skippedImageCount,
        pddError: null,
      });

      if (products.length) {
        return {
          ...query,
          keyword,
          rawKeyword: query.keyword,
          queryUsed: keyword,
          queryAttempts,
          products,
          pddError: null,
          pddDebug: result.pddDebug || null,
          goodsListEmpty: result.products.length === 0,
          goodsListCount,
          attemptSummaries,
          fallbackReason,
        };
      }
    } catch (error) {
      const pddError = normalizePddError(error);
      lastPddError = pddError;
      attemptSummaries.push({
        keyword,
        category: query.category,
        goodsListCount: 0,
        imageCandidateCount: 0,
        skippedImageCount: 0,
        pddError: sanitizePddError(pddError),
        error: pddError.message,
        errorCode: pddError.code,
      });
    }
  }

  const fallbackReason = !hadSuccessfulSearch && lastPddError
    ? 'all-query-attempts-failed'
    : totalGoodsListCount > 0
      ? 'all-goods-missing-image'
      : 'pdd-goods-list-empty';

  return {
    ...query,
    rawKeyword: query.keyword,
    queryUsed: queryAttempts[queryAttempts.length - 1] || query.keyword,
    queryAttempts,
    products: [],
    pddError: lastPddError,
    error: lastPddError?.message || '',
    errorCode: lastPddError?.code || '',
    details: lastPddError?.details,
    pddDebug: lastPddDebug,
    goodsListEmpty: totalGoodsListCount === 0,
    goodsListCount: totalGoodsListCount,
    attemptSummaries,
    fallbackReason,
  };
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  try {
    const parsedBody = parseBody(request.body);
    const queries = Array.isArray(parsedBody.queries) ? parsedBody.queries.slice(0, 8) : [];

    if (!queries.length) {
      response.status(400).json({ error: 'missing-queries' });
      return;
    }

    if (!isPddConfigured()) {
      response.status(200).json({
        enabled: false,
        products: [],
        error: 'missing-pdd-env',
        message: 'Configure PDD_CLIENT_ID, PDD_CLIENT_SECRET, and PDD_PID on the server to enable live PDD products.',
      });
      return;
    }

    const results = await Promise.all(queries.map(searchOne));
    const fallbackDebug = results.find((item) => item.pddDebug)?.pddDebug || getProductsHandlerDebug();
    const products = results.flatMap((item, index) => {
      if (item.products?.length) return item.products;
      return [toFallbackProduct(item, index, item.pddError, fallbackDebug, item.fallbackReason)];
    });
    const failed = results.filter((item) => item.error);
    const fallbackOnlyResults = results.filter((item) => !item.products?.length);
    const pddError = fallbackOnlyResults.length ? fallbackPddError(fallbackOnlyResults) : null;
    const fallbackReason = fallbackOnlyResults.length
      ? failed.length === results.length
        ? 'all-pdd-searches-failed'
        : 'some-categories-fallback'
      : '';
    const failingPddType = fallbackReason ? getFailingPddType(pddError, fallbackDebug) : '';
    const failingStage = fallbackReason ? getFailingStage(pddError, fallbackDebug) : '';

    response.status(200).json({
      enabled: true,
      products,
      results,
      fallbackReason,
      pddError: fallbackReason ? pddError : null,
      pddDebug: fallbackReason ? fallbackDebug : null,
      failingPddType,
      failingStage,
      error: failed.length ? 'some-pdd-queries-failed' : '',
      message: failed.length ? 'Some PDD searches failed; category fallbacks are returned only for categories without an imageable PDD product.' : '',
    });
  } catch (error) {
    const pddError = normalizePddError(error);
    response.status(500).json({
      enabled: false,
      products: [],
      fallbackReason: 'pdd-products-handler-error',
      pddError,
      pddDebug: getPddDebugFromError(pddError) || getProductsHandlerDebug(),
      failingPddType: pddError?.failingPddType || 'products-handler',
      failingStage: pddError?.failingStage || 'products-handler',
      error: 'pdd-products-error',
      message: error.message,
    });
  }
}
