import crypto from 'node:crypto';

const PDD_ENDPOINT = 'https://gw-api.pinduoduo.com/api/router';
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

function signPayload(payload, clientSecret) {
  const base = Object.keys(payload)
    .sort()
    .map((key) => `${key}${payload[key]}`)
    .join('');

  return crypto
    .createHash('md5')
    .update(`${clientSecret}${base}${clientSecret}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

async function callPdd(type, params = {}) {
  const clientId = process.env.PDD_CLIENT_ID;
  const clientSecret = process.env.PDD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { enabled: false, error: 'missing-pdd-env' };
  }

  const payload = {
    client_id: clientId,
    data_type: 'JSON',
    timestamp: Math.floor(Date.now() / 1000),
    type,
    ...params,
  };

  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value)])),
    sign: signPayload(payload, clientSecret),
  });

  const response = await fetch(PDD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body,
  });

  const data = await response.json();

  if (!response.ok || data.error_response) {
    return {
      enabled: true,
      error: data.error_response?.error_msg || `pdd-http-${response.status}`,
      raw: data.error_response,
    };
  }

  return { enabled: true, data };
}

function getPromotionUrl(promotionData) {
  const item = promotionData?.goods_promotion_url_generate_response?.goods_promotion_url_list?.[0];
  return item?.mobile_short_url || item?.short_url || item?.mobile_url || item?.url || '';
}

async function getGoodsLink(goods) {
  const pid = process.env.PDD_PID;
  const goodsSign = goods.goods_sign;

  if (!pid || !goodsSign) return goods.goods_url || goods.mall_coupon_url || '';

  const promotion = await callPdd('pdd.ddk.goods.promotion.url.generate', {
    p_id: pid,
    goods_sign_list: JSON.stringify([goodsSign]),
  });

  if (promotion.error || !promotion.data) return goods.goods_url || goods.mall_coupon_url || '';
  return getPromotionUrl(promotion.data) || goods.goods_url || goods.mall_coupon_url || '';
}

function fallbackSearchUrl(keyword) {
  return `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(keyword)}`;
}

function toProduct(goods, query, index, link) {
  const price = Number(goods.min_group_price || goods.min_normal_price || 0);

  return {
    id: `pdd-${query.category}-${goods.goods_sign || goods.goods_id || index}`,
    name: goods.goods_name || query.keyword,
    category: query.category,
    styleTags: query.styleTags || [],
    sceneTags: query.sceneTags || [],
    danceTags: query.danceTags || [],
    bodyTags: query.bodyTags || [],
    priceRange: price && price <= 10000 ? '100以内' : price && price <= 30000 ? '100-300' : '300-500',
    image: query.image || 'rose-black',
    link: link || fallbackSearchUrl(query.keyword),
    source: 'pdd',
    pdd: {
      goodsSign: goods.goods_sign,
      goodsId: goods.goods_id,
      salesTip: goods.sales_tip || '',
      minGroupPrice: price,
      thumbUrl: goods.goods_thumbnail_url || goods.goods_image_url || '',
    },
  };
}

async function searchOne(query) {
  const result = await callPdd('pdd.ddk.goods.search', {
    keyword: query.keyword,
    page: query.page || 1,
    page_size: query.pageSize || DEFAULT_PAGE_SIZE,
    sort_type: query.sortType || 0,
    with_coupon: query.withCoupon ?? false,
  });

  if (result.error || !result.data) return { ...query, products: [], error: result.error };

  const goodsList = result.data.goods_search_response?.goods_list || [];
  const limited = goodsList.slice(0, query.limit || 2);
  const products = await Promise.all(
    limited.map(async (goods, index) => toProduct(goods, query, index, await getGoodsLink(goods)))
  );

  return { ...query, products };
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

    if (!process.env.PDD_CLIENT_ID || !process.env.PDD_CLIENT_SECRET) {
      response.status(200).json({ enabled: false, products: [], error: 'missing-pdd-env' });
      return;
    }

    const results = await Promise.all(queries.map(searchOne));
    const products = results.flatMap((item) => item.products || []);

    response.status(200).json({ enabled: true, products, results });
  } catch (error) {
    response.status(500).json({ enabled: false, products: [], error: error.message });
  }
}
