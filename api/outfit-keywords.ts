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

type KeywordInput = {
  danceName?: string;
  style?: string;
  color?: string;
  scene?: string;
  body?: string;
  budget?: string;
};

type ApiResponse = {
  keywords: string[];
  normalized: KeywordInput;
  isMock: boolean;
};

const baseTerms = ['舞蹈服', '女团穿搭', '练舞服'];
const styleMap: Record<string, string[]> = {
  甜酷: ['甜酷短上衣', '女团打歌服', '短裙套装'],
  辣妹: ['辣妹吊带', '高腰短裤', '夜景舞台穿搭'],
  清冷: ['清冷感上衣', '银色配饰', '修身长袖'],
  运动: ['运动背心', '工装短裤', '防滑运动鞋'],
  Y2K: ['Y2K短上衣', '金属感配饰', '低腰工装'],
  学院: ['学院百褶裙', '针织开衫', '元气女团穿搭'],
  暗黑: ['暗黑辣妹穿搭', '黑色短外套', '皮革舞台风'],
  元气: ['元气甜妹穿搭', '彩色发夹', '百褶裙'],
  性感: ['修身吊带', '显腰舞蹈服', '舞台辣妹穿搭'],
  甜辣: ['甜辣女团穿搭', '短款上衣', '高腰短裙'],
  妈咪: ['妈咪风穿搭', '成熟辣妹套装', '舞台气场穿搭'],
};
const sceneMap: Record<string, string[]> = {
  练舞房: ['练舞房穿搭', '舒适弹力', '方便大动作'],
  户外: ['户外路演穿搭', '显腿长', '耐脏好跳'],
  舞台: ['舞台打歌服', '亮片上衣', '上镜穿搭'],
  路演: ['路演舞蹈服', '防滑鞋', '不走光穿搭'],
  夜景: ['夜景拍摄穿搭', '黑色银色', '反光配饰'],
};
const bodyMap: Record<string, string[]> = {
  显腿长: ['高腰短裤', '厚底鞋', '短裙显腿长'],
  显腰: ['短款上衣', '收腰上衣', '高腰下装'],
  遮胯: ['A字短裙', '宽松卫衣', '工装半裙'],
  不露腰: ['修身长袖', '短外套', '高腰长裤'],
  方便大动作: ['弹力面料', '防走光短裤', '防滑舞蹈鞋'],
};

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function getInput(req: VercelRequest): KeywordInput {
  const source = req.method === 'POST' ? req.body || {} : req.query || {};
  return {
    danceName: normalizeText(source.danceName),
    style: normalizeText(source.style),
    color: normalizeText(source.color),
    scene: normalizeText(source.scene),
    body: normalizeText(source.body),
    budget: normalizeText(source.budget),
  };
}

function buildKeywords(input: KeywordInput) {
  const keywords = [
    ...baseTerms,
    input.danceName ? `${input.danceName} 舞蹈穿搭` : '',
    input.danceName && input.style ? `${input.danceName} ${input.style} 穿搭` : '',
    input.style ? `${input.style} 舞蹈服` : '',
    input.color ? `${input.color} 舞蹈服` : '',
    input.color && input.style ? `${input.color} ${input.style} 穿搭` : '',
    input.scene ? `${input.scene} 舞蹈穿搭` : '',
    input.budget ? `${input.budget} 舞蹈服` : '',
    ...(input.style ? styleMap[input.style] || [] : []),
    ...(input.scene ? sceneMap[input.scene] || [] : []),
    ...(input.body ? bodyMap[input.body] || [] : []),
  ];

  return unique(keywords).slice(0, 16);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const normalized = getInput(req);
  const response: ApiResponse = {
    keywords: buildKeywords(normalized),
    normalized,
    isMock: true,
  };

  return res.status(200).json(response);
}
