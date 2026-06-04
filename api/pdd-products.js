import { isPddConfigured, PddApiError, searchGoods, toRecommendationProduct } from './_lib/pdd.js';

const DEFAULT_PAGE_SIZE = 8;

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

function toFallbackProduct(query, index) {
  const categoryName = {
    top: '短款上衣',
    bottom: '高腰下装',
    shoes: '防滑舞蹈鞋',
    accessory: '舞台配饰',
  }[query.category] || '舞蹈单品';

  return {
    id: `pdd-fallback-${query.category}-${index}`,
    name: `${query.keyword} ${categoryName}`,
    title: `${query.keyword} ${categoryName}`,
    category: query.category,
    styleTags: query.styleTags || [],
    sceneTags: query.sceneTags || [],
    danceTags: query.danceTags || [],
    bodyTags: query.bodyTags || [],
    priceRange: '100-300',
    image: query.image || 'rose-black',
    imageUrl: '',
    link: '',
    jumpUrl: '',
    source: 'pdd-unavailable',
    linkStatus: 'failed',
    linkMessage: '链接生成失败/暂不可跳转',
    promotionError: '',
    pdd: {
      goodsId: '',
      goodsSign: '',
      thumbUrl: '',
      imageUrl: '',
      mallName: '',
    },
  };
}

async function searchOne(query) {
  try {
    const result = await searchGoods({
      keyword: query.keyword,
      page: query.page || 1,
      pageSize: query.pageSize || query.limit || DEFAULT_PAGE_SIZE,
      sortType: query.sortType || 0,
      withCoupon: query.withCoupon ?? false,
    });
    const products = result.products
      .slice(0, query.limit || 2)
      .map((product, index) => toRecommendationProduct(product, query, index));

    return { ...query, products };
  } catch (error) {
    return {
      ...query,
      products: [toFallbackProduct(query, 0)],
      error: error.message,
      errorCode: error instanceof PddApiError ? error.code : 'internal-error',
      details: error instanceof PddApiError ? error.details : undefined,
    };
  }
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
    const products = results.flatMap((item) => item.products || []);
    const failed = results.filter((item) => item.error);

    response.status(200).json({
      enabled: true,
      products,
      results,
      error: failed.length ? 'some-pdd-queries-failed' : '',
      message: failed.length ? 'Some PDD searches failed; affected product cards are not clickable until promotion links can be generated.' : '',
    });
  } catch (error) {
    response.status(500).json({ enabled: false, products: [], error: 'pdd-products-error', message: error.message });
  }
}
