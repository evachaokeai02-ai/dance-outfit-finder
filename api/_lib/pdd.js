import crypto from 'node:crypto';

const PDD_ENDPOINT = 'https://gw-api.pinduoduo.com/api/router';
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PID_NAME = 'dancecloset-main';
const PID_QUERY_PAGE = 1;
const PID_QUERY_PAGE_SIZE = 100;
const PID_QUERY_STATUS = 0;
const GOODS_SEARCH_TYPE = 'pdd.ddk.goods.search';
const GOODS_SEARCH_PID_FIELD = 'pid';
const GOODS_PROMOTION_TYPE = 'pdd.ddk.goods.promotion.url.generate';
const GOODS_PROMOTION_PID_FIELD = 'p_id';

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

function requirePddPid() {
  const pid = process.env.PDD_PID?.trim() || '';
  if (!pid) {
    throw new PddApiError('Missing required environment variable: PDD_PID', {
      statusCode: 500,
      code: 'missing-env',
      details: { env: 'PDD_PID' },
    });
  }
  return pid;
}

function compactObject(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function serializePddParamValue(value) {
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

function clampPageSize(value) {
  const numericValue = Number(value || DEFAULT_PAGE_SIZE);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(MAX_PAGE_SIZE, Math.max(DEFAULT_PAGE_SIZE, numericValue));
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
    ...Object.fromEntries(Object.entries(params).map(([key, value]) => [key, serializePddParamValue(value)])),
  });
  const sign = signPddPayload(payload, clientSecret);
  const body = new URLSearchParams({
    ...payload,
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
      details: { httpStatus: response.status, response: data, pddType: type, failingPddType: type },
    });
  }

  if (data?.error_response) {
    const error = data.error_response;
    throw new PddApiError(error.error_msg || `PDD API ${type} returned an error`, {
      statusCode: 502,
      code: 'pdd-business-error',
      details: {
        error_code: error.error_code,
        error_msg: error.error_msg,
        sub_code: error.sub_code,
        sub_msg: error.sub_msg,
        request_id: error.request_id,
        pddErrorCode: error.error_code,
        pddSubCode: error.sub_code,
        pddSubMessage: error.sub_msg,
        requestId: error.request_id,
        pddType: type,
        failingPddType: type,
      },
    });
  }

  return data;
}

function getPidGenerateResponse(data) {
  return data?.p_id_generate_response || data?.goods_pid_generate_response || {};
}

function normalizeGeneratedPid(data) {
  const response = getPidGenerateResponse(data);
  const pidList = response.p_id_list || response.pid_list || response.pIdList || [];
  const firstPid = Array.isArray(pidList) ? pidList[0] || {} : {};

  return {
    p_id: firstPid.p_id || firstPid.pId || '',
    pid_name: firstPid.pid_name || firstPid.pidName || firstPid.p_id_name || DEFAULT_PID_NAME,
    create_time: firstPid.create_time || firstPid.createTime || '',
    remain_pid_count: response.remain_pid_count ?? response.remainPidCount ?? null,
  };
}

function toPddErrorDetails(details = {}) {
  return compactObject({
    error_code: details.error_code ?? details.pddErrorCode,
    error_msg: details.error_msg,
    sub_code: details.sub_code ?? details.pddSubCode,
    sub_msg: details.sub_msg ?? details.pddSubMessage,
    request_id: details.request_id ?? details.requestId,
  });
}

function formatPromotionError(error, promotionParamsDebug = null) {
  if (!(error instanceof PddApiError)) {
    return compactObject({
      code: 'internal-error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {},
      promotionParamsDebug,
      pddDebug: promotionParamsDebug,
    });
  }

  const details = toPddErrorDetails(error.details);

  return compactObject({
    code: error.code,
    message: error.message,
    error_code: details.error_code,
    error_msg: details.error_msg ?? error.message,
    sub_code: details.sub_code,
    sub_msg: details.sub_msg,
    request_id: details.request_id,
    details,
    promotionParamsDebug,
    pddDebug: promotionParamsDebug,
  });
}

function getPddPidDiagnostics() {
  const pid = normalizeText(process.env.PDD_PID);
  const duoId = normalizeText(process.env.PDD_DUO_ID || process.env.PDD_DUO_ID_VALUE);
  const pidPrefix = pid.split('_')[0] || '';

  return {
    hasPid: Boolean(pid),
    pidPrefixMatchesDuoId: Boolean(pid && duoId && pidPrefix === duoId),
    pidHasUnderscore: pid.includes('_'),
    pidLength: pid.length,
  };
}

export function getPddEnvPresence() {
  return getPddPidDiagnostics();
}

function getPddCustomParameters() {
  return normalizeText(process.env.PDD_CUSTOM_PARAMETERS) || undefined;
}

function getPddDebug({
  pddType = '',
  failingPddType = '',
  failingStage = '',
  pidFieldNameUsed = '',
  goodsParamFieldUsed = '',
  searchParamFieldsUsed = [],
  goodsId = '',
  goodsSign = '',
} = {}) {
  const pidDiagnostics = getPddPidDiagnostics();
  const customParameters = getPddCustomParameters();

  return {
    pddType,
    failingPddType: failingPddType || pddType,
    failingStage,
    hasPid: pidDiagnostics.hasPid,
    pidLength: pidDiagnostics.pidLength,
    pidHasUnderscore: pidDiagnostics.pidHasUnderscore,
    pidPrefixMatchesDuoId: pidDiagnostics.pidPrefixMatchesDuoId,
    pidFieldNameUsed,
    hasCustomParameters: Boolean(customParameters),
    goodsParamFieldUsed,
    searchParamFieldsUsed,
    hasGoodsSign: Boolean(normalizeText(goodsSign)),
    hasGoodsId: Boolean(normalizeText(goodsId)),
  };
}

function getPromotionParamsDebug({ goodsId = '', goodsSign = '', goodsParamFieldUsed = '', failingStage = 'promotion-url-generate' } = {}) {
  return {
    promotionType: GOODS_PROMOTION_TYPE,
    ...getPddDebug({
      pddType: GOODS_PROMOTION_TYPE,
      failingStage,
      pidFieldNameUsed: GOODS_PROMOTION_PID_FIELD,
      goodsParamFieldUsed,
      goodsId,
      goodsSign,
    }),
  };
}


function getGoodsSearchDebug({ searchParamFieldsUsed = [] } = {}) {
  return getPddDebug({
    pddType: GOODS_SEARCH_TYPE,
    failingStage: 'goods-search',
    pidFieldNameUsed: GOODS_SEARCH_PID_FIELD,
    searchParamFieldsUsed,
  });
}

export function getProductsHandlerDebug() {
  return getPddDebug({
    pddType: 'products-handler',
    failingPddType: 'products-handler',
    failingStage: 'products-handler',
  });
}

function getAuthorityQueryParams() {
  const customParameters = getPddCustomParameters();

  return compactObject({
    pid: requirePddPid(),
    custom_parameters: customParameters,
  });
}

function getAuthorityUrlParams() {
  const customParameters = getPddCustomParameters();
  const pid = requirePddPid();

  return compactObject({
    p_id_list: [pid],
    custom_parameters: customParameters,
    channel_type: 10,
    generate_we_app: true,
  });
}

function getAuthorityUrlResponse(data) {
  return (
    data?.rp_promotion_url_generate_response ||
    data?.rp_prom_url_generate_response ||
    data?.promotion_url_generate_response ||
    data?.url_generate_response ||
    {}
  );
}

function getFirstAuthorityUrlItem(data) {
  const response = getAuthorityUrlResponse(data);
  const urlList =
    response.url_list ||
    response.resource_url_list ||
    response.rp_url_list ||
    response.goods_promotion_url_list ||
    [];

  if (Array.isArray(urlList) && urlList.length) {
    return urlList[0] || {};
  }

  return response;
}

function normalizeAuthorityWeAppInfo(info) {
  if (!info || typeof info !== 'object') return null;

  return {
    ...info,
    page_path: info.page_path || info.pagePath || '',
  };
}

function normalizeAuthorityUrlResponse(data) {
  const item = getFirstAuthorityUrlItem(data);
  const weAppInfo = normalizeAuthorityWeAppInfo(item.we_app_info || item.weAppInfo || null);

  return {
    url: normalizePublicUrl(item.url || item.rp_url || ''),
    mobile_url: normalizePublicUrl(item.mobile_url || item.mobileUrl || ''),
    schema_url: normalizePublicUrl(item.schema_url || item.schemaUrl || ''),
    short_url: normalizePublicUrl(item.short_url || item.shortUrl || ''),
    we_app_info: weAppInfo,
    page_path: weAppInfo?.page_path || '',
    raw_response: data,
  };
}

export async function queryMemberAuthority() {
  const data = await callPddApi('pdd.ddk.member.authority.query', getAuthorityQueryParams());

  return {
    raw_response: data,
  };
}

export async function generateAuthorityUrl() {
  const data = await callPddApi('pdd.ddk.rp.prom.url.generate', getAuthorityUrlParams());

  return normalizeAuthorityUrlResponse(data);
}


function getPidQueryResponse(data) {
  return data?.p_id_query_response || data?.goods_pid_query_response || {};
}

function normalizeQueriedPid(item = {}) {
  return {
    p_id: item.p_id || item.pId || '',
    pid_name: item.pid_name || item.pidName || item.p_id_name || '',
    create_time: item.create_time || item.createTime || '',
    status: item.status ?? null,
  };
}

export async function queryPidByDefaultName() {
  const data = await callPddApi('pdd.ddk.goods.pid.query', {
    page: PID_QUERY_PAGE,
    page_size: PID_QUERY_PAGE_SIZE,
    status: PID_QUERY_STATUS,
  });
  const response = getPidQueryResponse(data);
  const pidList = Array.isArray(response.p_id_list) ? response.p_id_list : [];
  const normalizedPidList = pidList.map(normalizeQueriedPid);
  const matchedPid = normalizedPidList.find((pid) => pid.pid_name === DEFAULT_PID_NAME) || null;

  return {
    matchedPid,
    pidList: normalizedPidList,
    total_count: Number(response.total_count ?? response.totalCount ?? normalizedPidList.length),
  };
}

export async function queryConfiguredPidInventory() {
  const configuredPid = requirePddPid();
  const data = await callPddApi('pdd.ddk.goods.pid.query', {
    page: PID_QUERY_PAGE,
    page_size: PID_QUERY_PAGE_SIZE,
    status: PID_QUERY_STATUS,
  });
  const response = getPidQueryResponse(data);
  const rawPidList = Array.isArray(response.p_id_list)
    ? response.p_id_list
    : Array.isArray(response.pid_list)
      ? response.pid_list
      : [];
  const normalizedPidList = rawPidList.map(normalizeQueriedPid);

  return {
    total_count: Number(response.total_count ?? response.totalCount ?? normalizedPidList.length),
    pidList: normalizedPidList.slice(0, 20),
    matchedByConfiguredPid: normalizedPidList.some((pid) => pid.p_id === configuredPid),
    matchedByName: normalizedPidList.some((pid) => pid.pid_name === DEFAULT_PID_NAME),
  };
}

export async function generatePid() {
  const params = {
    number: 1,
    p_id_name_list: JSON.stringify([DEFAULT_PID_NAME]),
  };
  const data = await callPddApi('pdd.ddk.goods.pid.generate', params);
  const pid = normalizeGeneratedPid(data);

  if (!pid.p_id) {
    throw new PddApiError('PDD PID API did not return a p_id', {
      statusCode: 502,
      code: 'missing-pdd-pid',
      details: { response: getPidGenerateResponse(data) },
    });
  }

  return pid;
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
    goods.goods_image_url ||
      goods.goods_thumbnail_url ||
      (Array.isArray(goods.goods_gallery_urls) ? goods.goods_gallery_urls[0] : '') ||
      goods.hd_thumb_url ||
      goods.image_url ||
      ''
  );
}

function getPromotionItem(data) {
  return data?.goods_promotion_url_generate_response?.goods_promotion_url_list?.[0] || {};
}

function normalizeWeAppInfo(item) {
  const info = item.we_app_info || item.weAppInfo || null;
  if (!info || typeof info !== 'object') return null;

  return {
    appId: info.app_id || info.appId || '',
    pagePath: info.page_path || info.pagePath || '',
    userName: info.user_name || info.userName || '',
    weAppIconUrl: normalizePublicUrl(info.we_app_icon_url || info.weAppIconUrl || ''),
    bannerUrl: normalizePublicUrl(info.banner_url || info.bannerUrl || ''),
    desc: info.desc || '',
    sourceDisplayName: info.source_display_name || info.sourceDisplayName || '',
  };
}

function toPromotionUrls(data) {
  const item = getPromotionItem(data);
  const mobileShortUrl = normalizePublicUrl(item.mobile_short_url);
  const shortUrl = normalizePublicUrl(item.short_url);
  const mobileUrl = normalizePublicUrl(item.mobile_url);
  const url = normalizePublicUrl(item.url);
  const weAppWebViewUrl = normalizePublicUrl(item.we_app_web_view_url);
  const promotionUrl = mobileShortUrl || shortUrl || mobileUrl || url || weAppWebViewUrl;

  return {
    promotionUrl,
    mobileUrl,
    shortUrl: mobileShortUrl || shortUrl,
    url,
    weAppWebViewUrl,
    weAppInfo: normalizeWeAppInfo(item),
  };
}

function toPublicProduct(goods, promotion = {}) {
  const minPrice = Number(goods.min_group_price || goods.min_normal_price || 0);
  const couponDiscount = getCouponDiscount(goods);
  const couponPrice = minPrice > 0 ? Math.max(minPrice - couponDiscount, 0) : 0;

  return {
    goodsId: String(goods.goods_id || ''),
    goodsSign: goods.goods_sign || '',
    goodsName: goods.goods_name || '',
    goods_id: String(goods.goods_id || ''),
    goods_sign: goods.goods_sign || '',
    goods_name: goods.goods_name || '',
    goods_image_url: normalizePublicUrl(goods.goods_image_url || ''),
    goods_thumbnail_url: normalizePublicUrl(goods.goods_thumbnail_url || ''),
    goods_gallery_urls: Array.isArray(goods.goods_gallery_urls) ? goods.goods_gallery_urls.map(normalizePublicUrl).filter(Boolean) : [],
    goodsImage: getFirstImage(goods),
    imageUrl: getFirstImage(goods),
    price: centsToYuan(minPrice),
    couponPrice: centsToYuan(couponPrice || minPrice),
    mallName: goods.mall_name || '',
    promotionLink: promotion.promotionUrl || '',
    promotionUrl: promotion.promotionUrl || '',
    jumpUrl: promotion.promotionUrl || '',
    mobileUrl: promotion.mobileUrl || '',
    shortUrl: promotion.shortUrl || '',
    url: promotion.url || '',
    weAppWebViewUrl: promotion.weAppWebViewUrl || '',
    weAppInfo: promotion.weAppInfo || null,
    promotionError: promotion.error || '',
    promotionParamsDebug: promotion.promotionParamsDebug || null,
    pddDebug: promotion.pddDebug || promotion.promotionParamsDebug || null,
  };
}

export async function generatePromotionLink({ goodsId, goodsSign }) {
  const pId = requirePddPid();
  const normalizedGoodsId = normalizeText(goodsId);
  const normalizedGoodsSign = normalizeText(goodsSign);
  const customParameters = getPddCustomParameters();

  if (!normalizedGoodsId && !normalizedGoodsSign) {
    throw new PddApiError('goodsId or goodsSign is required', {
      statusCode: 400,
      code: 'missing-goods-id',
    });
  }

  const goodsParamFieldUsed = normalizedGoodsSign ? 'goods_sign_list' : 'goods_id_list';
  const promotionParamsDebug = getPromotionParamsDebug({
    goodsId: normalizedGoodsId,
    goodsSign: normalizedGoodsSign,
    goodsParamFieldUsed,
  });
  const params = {
    [GOODS_PROMOTION_PID_FIELD]: pId,
  };

  if (customParameters) {
    params.custom_parameters = customParameters;
  }

  if (normalizedGoodsSign) {
    params.goods_sign_list = [normalizedGoodsSign];
  } else {
    params.goods_id_list = [Number(normalizedGoodsId)];
  }

  let data;
  try {
    data = await callPddApi(GOODS_PROMOTION_TYPE, params);
  } catch (error) {
    if (error instanceof PddApiError) {
      error.details = {
        ...(error.details || {}),
        failingStage: 'promotion-url-generate',
        pddDebug: promotionParamsDebug,
        promotionParamsDebug,
      };
    }
    throw error;
  }

  const promotion = toPromotionUrls(data);

  if (!promotion.promotionUrl) {
    throw new PddApiError('PDD promotion API did not return a promotion link', {
      statusCode: 502,
      code: 'missing-promotion-link',
      details: { promotionParamsDebug },
    });
  }

  return {
    goodsId: normalizedGoodsId,
    goodsSign: normalizedGoodsSign,
    promotionLink: promotion.promotionUrl,
    promotionUrl: promotion.promotionUrl,
    mobileUrl: promotion.mobileUrl,
    shortUrl: promotion.shortUrl,
    url: promotion.url,
    weAppWebViewUrl: promotion.weAppWebViewUrl,
    weAppInfo: promotion.weAppInfo,
    promotionParamsDebug,
    pddDebug: promotionParamsDebug,
  };
}

export async function searchGoods({ keyword, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE, sortType = 0, withCoupon = false }) {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    throw new PddApiError('keyword is required', { statusCode: 400, code: 'missing-keyword' });
  }

  const safePage = Math.max(Number(page) || DEFAULT_PAGE, 1);
  const safePageSize = clampPageSize(pageSize);
  const customParameters = getPddCustomParameters();
  const params = {
    keyword: normalizedKeyword,
    page: safePage,
    page_size: safePageSize,
    sort_type: Number(sortType) || 0,
    with_coupon: Boolean(withCoupon),
    [GOODS_SEARCH_PID_FIELD]: requirePddPid(),
  };

  if (customParameters) {
    params.custom_parameters = customParameters;
  }

  const searchParamsDebug = getGoodsSearchDebug({
    searchParamFieldsUsed: Object.keys(params),
  });
  let data;

  try {
    data = await callPddApi(GOODS_SEARCH_TYPE, params);
  } catch (error) {
    if (error instanceof PddApiError) {
      error.details = {
        ...(error.details || {}),
        pddType: error.details?.pddType || GOODS_SEARCH_TYPE,
        failingPddType: error.details?.failingPddType || GOODS_SEARCH_TYPE,
        failingStage: 'goods-search',
        pddDebug: searchParamsDebug,
      };
    }
    throw error;
  }
  const goodsList = data?.goods_search_response?.goods_list || [];
  const products = await Promise.all(
    goodsList.map(async (goods) => {
      try {
        const promotion = await generatePromotionLink({ goodsId: goods.goods_id, goodsSign: goods.goods_sign });
        return toPublicProduct(goods, promotion);
      } catch (error) {
        const promotionParamsDebug = error instanceof PddApiError ? error.details?.promotionParamsDebug : null;
        const promotionError = formatPromotionError(error, promotionParamsDebug);
        console.error('[pdd-promotion] url generate failed', {
          ...getPddPidDiagnostics(),
        });
        return toPublicProduct(goods, {
          error: promotionError,
          promotionParamsDebug,
        });
      }
    })
  );

  return {
    keyword: normalizedKeyword,
    page: safePage,
    pageSize: safePageSize,
    total: Number(data?.goods_search_response?.total_count || products.length),
    products,
    pddDebug: searchParamsDebug,
  };
}

export function toRecommendationProduct(product, query, index = 0) {
  const priceInCents = Math.round(Number(product.couponPrice || product.price || 0) * 100);
  return {
    id: `pdd-${query.category}-${product.goodsSign || product.goodsId || index}`,
    name: product.goodsName || query.keyword,
    title: product.goodsName || query.keyword,
    category: query.category,
    styleTags: query.styleTags || [],
    sceneTags: query.sceneTags || [],
    danceTags: query.danceTags || [],
    bodyTags: query.bodyTags || [],
    priceRange: priceInCents && priceInCents <= 10000 ? '100以内' : priceInCents && priceInCents <= 30000 ? '100-300' : '300-500',
    image: query.image || 'rose-black',
    imageUrl: product.imageUrl || product.goodsImage || '',
    link: normalizePublicUrl(product.promotionLink),
    jumpUrl: normalizePublicUrl(product.jumpUrl || product.promotionLink),
    source: 'pdd',
    linkStatus: product.promotionLink ? 'ready' : 'failed',
    linkMessage: product.promotionLink
      ? ''
      : product.promotionError?.details?.sub_msg ||
        product.promotionError?.sub_msg ||
        product.promotionError?.details?.error_msg ||
        product.promotionError?.error_msg ||
        product.promotionError?.message ||
        '链接生成失败/暂不可跳转',
    promotionError: product.promotionError || '',
    promotionParamsDebug: product.promotionParamsDebug || product.promotionError?.promotionParamsDebug || null,
    pddDebug: product.pddDebug || product.promotionParamsDebug || product.promotionError?.pddDebug || product.promotionError?.promotionParamsDebug || null,
    failingPddType: product.promotionError?.pddDebug?.failingPddType || product.promotionError?.promotionParamsDebug?.failingPddType || '',
    failingStage: product.promotionError?.pddDebug?.failingStage || product.promotionError?.promotionParamsDebug?.failingStage || '',
    pdd: {
      goodsId: product.goodsId,
      goodsSign: product.goodsSign,
      minGroupPrice: Math.round(Number(product.price || 0) * 100),
      couponPrice: Math.round(Number(product.couponPrice || 0) * 100),
      thumbUrl: product.imageUrl || product.goodsImage,
      imageUrl: product.imageUrl || product.goodsImage,
      mallName: product.mallName,
      goods_image_url: product.goods_image_url || '',
      goods_thumbnail_url: product.goods_thumbnail_url || '',
      goods_gallery_urls: product.goods_gallery_urls || [],
      promotionUrl: normalizePublicUrl(product.promotionUrl || product.promotionLink),
      mobileUrl: normalizePublicUrl(product.mobileUrl),
      shortUrl: normalizePublicUrl(product.shortUrl),
      url: normalizePublicUrl(product.url),
      weAppWebViewUrl: normalizePublicUrl(product.weAppWebViewUrl),
      weAppInfo: product.weAppInfo || null,
      promotionError: product.promotionError || '',
      promotionParamsDebug: product.promotionParamsDebug || product.promotionError?.promotionParamsDebug || null,
      pddDebug: product.pddDebug || product.promotionParamsDebug || product.promotionError?.pddDebug || product.promotionError?.promotionParamsDebug || null,
    },
  };
}

export function isPddConfigured() {
  return Boolean(
    normalizeText(process.env.PDD_CLIENT_ID) &&
      normalizeText(process.env.PDD_CLIENT_SECRET) &&
      normalizeText(process.env.PDD_PID)
  );
}
