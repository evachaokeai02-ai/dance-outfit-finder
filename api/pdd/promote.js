import { PddApiError, generatePromotionLink } from '../_lib/pdd.js';

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
    res.status(405).json({ error: 'method-not-allowed', message: 'Use GET /api/pdd/promote?goodsId=xxx' });
    return;
  }

  try {
    const result = await generatePromotionLink({ goodsId: req.query.goodsId, goodsSign: req.query.goodsSign });
    res.status(200).json(result);
  } catch (error) {
    sendError(res, error);
  }
}
