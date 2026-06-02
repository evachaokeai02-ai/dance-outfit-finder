import crypto from 'node:crypto';

const PDD_ENDPOINT = 'https://gw-api.pinduoduo.com/api/router';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 40;

export class PddApiError extends Error {
  constructor(message, { statusCode = 500, code = 'pdd-api-error', details } = {}) {
    super(message);
    this.name = 'PddApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function normalizeText(value) {
  return String(value || '').trim();
}

function requireEnv(name) {
  const value = normalizeText(process.env[name]);
  if (!value) {
    throw new PddApiError(`Missing required environment variable: ${name}`, {
      statusCode: 500,
      code: 'missing-env',
      details: { env: name },
    });
  }
  return value;
}

function compactObject(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

export function signPddPayload(payload, clientSecret) {
  const signingText = Object.keys(payload)
    .sort()
    .map((key) => `${key}${payload[key]}`)
    .join('');

  return crypto
    .createHash('md5')
    .update(`${clientSecret}${signingText}${clientSecret}`, 'utf8')
    .digest('hex')
    .toUpperCase();
}

export async function callPddApi(type, params = {}) {
  const clientId = requireEnv('PDD_CLIENT_ID');
  const clientSecret = requireEnv('PDD_CLIENT_SECRET');
  const payload = compactObject({
    type,
    client_id: clientId,
    timestamp: Math.floor(Date.now() / 1000),
    data_type: 'JSON',
    ...params,
  });
  const sign = signPddPayload(payload, clientSecret);
  const body = new URLSearchParams({
    ...Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, String(value)])),
    sign,
  });

  let response;
  let data;

  try {
    response = await fetch(PDD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
    });
    data = await response.json();
  } catch (error) {
    throw new PddApiError(`Failed to call PDD API ${type}: ${error.message}`, {
      statusCode: 502,
      code: 'pdd-network-error',
    });
  }

  if (!response.ok) {
    throw new PddApiError(`PDD API ${type} returned HTTP ${response.status}`, {
      statusCode: 502,
      code: 'pdd-http-error',
      details: { httpStatus: response.status, response: data },
    });
  }

  if (data?.error_response) {
    const error = data.error_response;
    throw new PddApiError(error.error_msg || `PDD API ${type} returned an error`, {
      statusCode: 502,
      code: 'pdd-business-error',
      details: {
        pddErrorCode: error.error_code,
        pddSubCode: error.sub_code,
        pddSubMessage: error.sub_msg,
        requestId: error.request_id,
      },
    });
  }

  return data;
}

function centsToYuan(value) {
  const cents = Number(value || 0);
  if (!Number.isFinite(cents) || cents <= 0) return 0;
  return Number((cents / 100).toFixed(2));
}

function getCouponDiscount(goods) {
  return Number(goods.coupon_discount || goods.coupon_price || 0) || 0;
}

function normalizePublicUrl(value) {
  const url = normalizeText(value);
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`;
  return url;
}

function getFirstImage(goods) {
  return normalizePublicUrl(
    goods.goods_thumbnail_url ||
      goods.goods_image_url ||
      goods.hd_thumb_url ||
      goods.image_url ||
      (Array.isArray(goods.goods_gallery_urls) ? goods.goods_gallery_urls[0] : '')
  );
}

function getPromotionUrl(data) {
  const item = data?.goods_promotion_url_generate_response?.goods_promotion_url_list?.[0] || {};
  return normalizePublicUrl(item.mobile_short_url || item.short_url || item.mobile_url || item.url || item.we_app_web_view_url);
}

function toPublicProduct(goods, promotionLink = '') {
  const minPrice = Number(goods.min_group_price || goods.min_normal_price || 0);
  const couponDiscount = getCouponDiscount(goods);
  const couponPrice = minPrice > 0 ? Math.max(minPrice - couponDiscount, 0) : 0;

  return {
    goodsId: String(goods.goods_id || ''),
    goodsSign: goods.goods_sign || '',
    goodsName: goods.goods_name || '',
    goodsImage: getFirstImage(goods),
    price: centsToYuan(minPrice),
    couponPrice: centsToYuan(couponPrice || minPrice),
    mallName: goods.mall_name || '',
    promotionLink,
  };
}

export async function generatePromotionLink({ goodsId, goodsSign }) {
  const pId = requireEnv('PDD_PID');
  const normalizedGoodsId = normalizeText(goodsId);
  const normalizedGoodsSign = normalizeText(goodsSign);

  if (!normalizedGoodsId && !normalizedGoodsSign) {
    throw new PddApiError('goodsId or goodsSign is required', {
      statusCode: 400,
      code: 'missing-goods-id',
    });
  }

  const params = {
    p_id: pId,
    generate_short_url: true,
    generate_we_app: true,
  };

  if (normalizedGoodsSign) {
    params.goods_sign_list = JSON.stringify([normalizedGoodsSign]);
  } else {
    params.goods_id_list = JSON.stringify([Number(normalizedGoodsId)]);
  }

  const data = await callPddApi('pdd.ddk.goods.promotion.url.generate', params);
  const promotionLink = getPromotionUrl(data);

  if (!promotionLink) {
    throw new PddApiError('PDD promotion API did not return a promotion link', {
      statusCode: 502,
      code: 'missing-promotion-link',
      details: { goodsId: normalizedGoodsId, goodsSign: normalizedGoodsSign },
    });
  }

  return { goodsId: normalizedGoodsId, goodsSign: normalizedGoodsSign, promotionLink };
}

export async function searchGoods({ keyword, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE, sortType = 0, withCoupon = false }) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    throw new PddApiError('keyword is required', { statusCode: 400, code: 'missing-keyword' });
  }

  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safePageSize = Math.min(Math.max(Number(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const data = await callPddApi('pdd.ddk.goods.search', {
    keyword: normalizedKeyword,
    page: safePage,
    page_size: safePageSize,
    sort_type: Number(sortType) || 0,
    with_coupon: Boolean(withCoupon),
  });
  const goodsList = data?.goods_search_response?.goods_list || [];
  const products = await Promise.all(
    goodsList.map(async (goods) => {
      try {
        const promotion = await generatePromotionLink({ goodsId: goods.goods_id, goodsSign: goods.goods_sign });
        return toPublicProduct(goods, promotion.promotionLink);
      } catch {
        return toPublicProduct(goods, goods.goods_url || goods.mall_coupon_url || '');
      }
    })
  );

  return {
    keyword: normalizedKeyword,
    page: safePage,
    pageSize: safePageSize,
    total: Number(data?.goods_search_response?.total_count || products.length),
    products,
  };
}

export function toRecommendationProduct(product, query, index = 0) {
  const priceInCents = Math.round(Number(product.couponPrice || product.price || 0) * 100);
  return {
    id: `pdd-${query.category}-${product.goodsSign || product.goodsId || index}`,
    name: product.goodsName || query.keyword,
    category: query.category,
    styleTags: query.styleTags || [],
    sceneTags: query.sceneTags || [],
    danceTags: query.danceTags || [],
    bodyTags: query.bodyTags || [],
    priceRange: priceInCents && priceInCents <= 10000 ? '100以内' : priceInCents && priceInCents <= 30000 ? '100-300' : '300-500',
    image: query.image || 'rose-black',
    link: normalizePublicUrl(product.promotionLink),
    source: 'pdd',
    pdd: {
      goodsId: product.goodsId,
      goodsSign: product.goodsSign,
      minGroupPrice: Math.round(Number(product.price || 0) * 100),
      couponPrice: Math.round(Number(product.couponPrice || 0) * 100),
      thumbUrl: product.goodsImage,
      mallName: product.mallName,
    },
  };
}

export function isPddConfigured() {
  return Boolean(process.env.PDD_CLIENT_ID && process.env.PDD_CLIENT_SECRET && process.env.PDD_PID);
}
