import { PddApiError, generatePromotionLink } from '../lib/pdd.js';

type VercelRequest = {
  method?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (statusCode: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
};

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getSource(req: VercelRequest) {
  return req.method === 'POST' ? req.body || {} : req.query || {};
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function sendError(res: VercelResponse, error: unknown) {
  const isPddError = error instanceof PddApiError;
  const statusCode = isPddError ? error.statusCode : 500;
  res.status(statusCode).json({
    error: isPddError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details: isPddError ? error.details : undefined,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'method-not-allowed', message: 'Use GET/POST /api/pdd-link?goodsId=xxx' });
  }

  const source = getSource(req);
  const goodsId = normalizeText(source.goodsId);
  const goodsSign = normalizeText(source.goodsSign);

  try {
    const result = await generatePromotionLink({ goodsId, goodsSign });
    return res.status(200).json({ ...result, link: result.promotionUrl, isMock: false });
  } catch (error) {
    return sendError(res, error);
  }
}
