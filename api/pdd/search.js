import { PddApiError, searchGoods } from '../_lib/pdd.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, error) {
  const statusCode = error instanceof PddApiError ? error.statusCode : 500;
  res.status(statusCode).json({
    error: error instanceof PddApiError ? error.code : 'internal-error',
    message: error.message,
    details: error instanceof PddApiError ? error.details : undefined,
  });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method-not-allowed', message: 'Use GET /api/pdd/search?keyword=xxx' });
    return;
  }

  try {
    const result = await searchGoods({
      keyword: req.query.keyword,
      page: req.query.page,
      pageSize: req.query.pageSize,
      sortType: req.query.sortType,
      withCoupon: req.query.withCoupon === 'true',
    });
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
}
