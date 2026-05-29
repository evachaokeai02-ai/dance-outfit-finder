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

type MockProduct = {
  goodsId: string;
  goodsName: string;
  keyword: string;
  minGroupPrice: number;
  couponDiscount: number;
  salesTip: string;
  imageUrl: string;
  mallName: string;
  promotionRate: number;
};

const mockProducts = [
  {
    goodsId: 'mock-top-001',
    suffix: '短款上衣',
    minGroupPrice: 8900,
    couponDiscount: 1000,
    salesTip: '已拼1.2万件',
    imageUrl: 'https://placehold.co/600x600/fecdd3/881337?text=Top',
    mallName: 'Mock 女团穿搭店',
    promotionRate: 120,
  },
  {
    goodsId: 'mock-bottom-001',
    suffix: '高腰下装',
    minGroupPrice: 7900,
    couponDiscount: 800,
    salesTip: '已拼8600件',
    imageUrl: 'https://placehold.co/600x600/bfdbfe/1e3a8a?text=Bottom',
    mallName: 'Mock 舞蹈服饰馆',
    promotionRate: 100,
  },
  {
    goodsId: 'mock-shoes-001',
    suffix: '防滑舞蹈鞋',
    minGroupPrice: 12900,
    couponDiscount: 1500,
    salesTip: '已拼5300件',
    imageUrl: 'https://placehold.co/600x600/a5f3fc/164e63?text=Shoes',
    mallName: 'Mock 路演装备店',
    promotionRate: 90,
  },
];

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function getKeyword(req: VercelRequest) {
  const source = req.method === 'POST' ? req.body || {} : req.query || {};
  return normalizeText(source.keyword);
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
  return status.hasClientId && status.hasClientSecret;
}

function buildMockProducts(keyword: string): MockProduct[] {
  return mockProducts.map((product) => ({
    goodsId: product.goodsId,
    goodsName: `${keyword} ${product.suffix}`,
    keyword,
    minGroupPrice: product.minGroupPrice,
    couponDiscount: product.couponDiscount,
    salesTip: product.salesTip,
    imageUrl: product.imageUrl,
    mallName: product.mallName,
    promotionRate: product.promotionRate,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyword = getKeyword(req);
  if (!keyword) {
    return res.status(400).json({ error: 'keyword is required' });
  }

  const pddConfigured = hasPddEnv();

  return res.status(200).json({
    keyword,
    products: buildMockProducts(keyword),
    isMock: true,
    pddConfigured,
    message: pddConfigured
      ? 'PDD env vars detected, but live PDD search is not implemented yet.'
      : 'Missing PDD env vars, returning mock products.',
  });
}
