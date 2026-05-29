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

declare const process: { env: Record<string, string | undefined> };

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function getGoodsId(req: VercelRequest) {
  const source = req.method === 'POST' ? req.body || {} : req.query || {};
  return normalizeText(source.goodsId);
}

function getPddEnvStatus() {
  return {
    hasClientId: Boolean(process.env.PDD_CLIENT_ID),
    hasClientSecret: Boolean(process.env.PDD_CLIENT_SECRET),
    hasAccessToken: Boolean(process.env.PDD_ACCESS_TOKEN),
  };
}

function hasPddEnv() {
  const status = getPddEnvStatus();
  return status.hasClientId && status.hasClientSecret && status.hasAccessToken;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const goodsId = getGoodsId(req);
  if (!goodsId) {
    return res.status(400).json({ error: 'goodsId is required' });
  }

  const pddConfigured = hasPddEnv();
  const encodedGoodsId = encodeURIComponent(goodsId);

  return res.status(200).json({
    goodsId,
    link: `https://mobile.yangkeduo.com/goods.html?goods_id=${encodedGoodsId}&mock=1`,
    isMock: true,
    pddConfigured,
    message: pddConfigured
      ? 'PDD env vars detected, but live promotion link generation is not implemented yet.'
      : 'Missing PDD env vars, returning a mock PDD-style goods link.',
  });
}
