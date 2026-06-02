import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const danceStyles = JSON.parse(readFileSync(join(__dirname, '..', 'src', 'data', 'danceStyles.json'), 'utf8'));

const STYLE_RULES = [
  { keys: ['jennie', 'like jennie', '辣', '辣妹'], tags: ['辣妹', '强势', '甜辣'], keywords: ['短款上衣', '高腰下装', '红色发带', '舞台感'] },
  { keys: ['aespa', 'drama', '黑', '暗黑'], tags: ['暗黑', '未来感', '强势'], keywords: ['黑银', '金属配饰', '短外套', '厚底鞋'] },
  { keys: ['newjeans', 'super shy', '元气', '运动'], tags: ['元气', '运动', '学院'], keywords: ['运动背心', '工装短裤', '棒球帽', '清爽'] },
  { keys: ['who is she', 'kiss of life', '成熟', '妈咪'], tags: ['性感', '妈咪', '辣妹'], keywords: ['修身短上衣', '黑色', '皮裙', '金属腰链'] },
  { keys: ['甜酷', '可爱'], tags: ['甜酷', '元气'], keywords: ['短裙套装', '彩色发夹', '短款上衣'] },
];


const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const OPENAI_SEARCH_DOMAINS = [
  'xiaohongshu.com',
  'douyin.com',
  'bilibili.com',
  'weibo.com',
  'youtube.com',
];

function safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function toArray(value) {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : [];
}

function normalizeProfile(profile, rawQuery) {
  return {
    source: 'model-profile',
    profileSource: profile.profileSource || 'openai-web-search',
    rawQuery,
    danceName: normalizeText(profile.danceName) || rawQuery,
    artist: normalizeText(profile.artist) || '平台搜索归纳',
    danceType: normalizeText(profile.danceType) || 'K-pop',
    styleTags: unique(toArray(profile.styleTags)).slice(0, 6),
    sceneTags: unique(toArray(profile.sceneTags)).slice(0, 5),
    outfitKeywords: unique(toArray(profile.outfitKeywords)).slice(0, 14),
    avoidKeywords: unique(toArray(profile.avoidKeywords)).slice(0, 8),
    stageOutfitSummary:
      normalizeText(profile.stageOutfitSummary) ||
      `已根据「${rawQuery}」的平台打歌服 / 舞台服信息生成穿搭标签。`,
    stageOutfitProfiles: Array.isArray(profile.stageOutfitProfiles)
      ? profile.stageOutfitProfiles
          .map((item) => ({
            name: normalizeText(item.name),
            summary: normalizeText(item.summary),
            styleTags: unique(toArray(item.styleTags)).slice(0, 4),
            outfitKeywords: unique(toArray(item.outfitKeywords)).slice(0, 6),
          }))
          .filter((item) => item.name || item.summary)
      : [],
    priceRange: normalizeText(profile.priceRange),
    bodyTags: unique(toArray(profile.bodyTags)).slice(0, 5),
    freeText: normalizeText(profile.freeText),
    stageResearchSources: Array.isArray(profile.stageResearchSources)
      ? profile.stageResearchSources
          .map((source) => ({
            platform: normalizeText(source.platform),
            title: normalizeText(source.title),
            url: normalizeText(source.url),
          }))
          .filter((source) => source.title || source.url)
          .slice(0, 8)
      : [],
  };
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;
  return (data.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || '')
    .join('\n')
    .trim();
}

async function buildOpenAiProfile(query) {
  if (!process.env.OPENAI_API_KEY) return null;

  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
      reasoning: { effort: 'low' },
      tools: [
        {
          type: 'web_search',
          filters: { allowed_domains: OPENAI_SEARCH_DOMAINS },
        },
      ],
      tool_choice: 'auto',
      include: ['web_search_call.action.sources'],
      input: `你是女团/K-pop舞蹈穿搭研究助手。请根据用户输入的歌曲或舞蹈名「${query}」，优先搜索小红书、抖音、B站、微博、YouTube 等平台的舞台/打歌服/MV/cover服装信息，提炼普通人可购买可跳舞的搭配标签。只输出严格 JSON，不要 Markdown。JSON 字段：danceName, artist, danceType, styleTags, sceneTags, outfitKeywords, avoidKeywords, stageOutfitSummary, stageOutfitProfiles, bodyTags, freeText, stageResearchSources。stageOutfitProfiles 至少给 2 个参考层级，每个包含 name, summary, styleTags, outfitKeywords。stageResearchSources 包含 platform, title, url。要求关键词具体到颜色、版型、材质、单品，例如 黑银、皮革短外套、工装短裙、厚底短靴、金属腰链。`,
    }),
  });

  if (!response.ok) {
    throw new Error(`openai-${response.status}`);
  }

  const data = await response.json();
  const parsed = safeJsonParse(extractResponseText(data));
  if (!parsed) throw new Error('openai-json-parse-failed');

  return {
    profile: normalizeProfile(parsed, query),
    confidence: 0.88,
    needsReview: false,
    matchType: 'openai-web-search',
    matchedDanceId: '',
    openAiResponseId: data.id,
  };
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

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

function normalizeText(value) {
  return String(value || '').trim();
}

function compactText(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, '');
}

function unique(items) {
  return [...new Set((items || []).map((item) => normalizeText(item)).filter(Boolean))];
}

function flattenProfileTags(dance, key) {
  return (dance.stageOutfitProfiles || []).flatMap((profile) => profile[key] || []);
}

function makeSearchTokens(dance) {
  return [dance.danceName, ...(dance.aliases || []), dance.artist].filter(Boolean).map(compactText);
}

function findDance(query) {
  const compactQuery = compactText(query);
  if (!compactQuery) return null;

  return danceStyles.find((dance) => makeSearchTokens(dance).some((token) => token === compactQuery));
}

function danceToProfile(dance, rawQuery) {
  return {
    source: 'model-profile',
    profileSource: 'known-dance',
    rawQuery,
    danceName: dance.danceName,
    artist: dance.artist,
    danceType: dance.danceType,
    styleTags: unique([...(dance.styleTags || []), ...flattenProfileTags(dance, 'styleTags')]),
    sceneTags: unique(dance.sceneTags || []),
    outfitKeywords: unique([...(dance.outfitKeywords || []), ...flattenProfileTags(dance, 'outfitKeywords')]),
    avoidKeywords: unique(dance.avoidKeywords || []),
    stageOutfitSummary: dance.stageOutfitSummary || `${dance.danceName} 的舞蹈穿搭方向已根据曲库标签生成。`,
    stageOutfitProfiles: dance.stageOutfitProfiles || [],
    priceRange: '',
    bodyTags: [],
    freeText: '',
  };
}

function inferByRules(query) {
  const normalized = normalizeText(query);
  const compactQuery = compactText(query);
  const matchedRules = STYLE_RULES.filter((rule) => rule.keys.some((key) => compactQuery.includes(compactText(key))));
  const styleTags = unique(matchedRules.flatMap((rule) => rule.tags));
  const outfitKeywords = unique(matchedRules.flatMap((rule) => rule.keywords));

  return {
    source: 'model-profile',
    profileSource: 'rule-generated',
    rawQuery: normalized,
    danceName: normalized || '自定义舞蹈',
    artist: 'AI 标签生成',
    danceType: compactQuery.includes('jazz') ? 'Jazz' : compactQuery.includes('hiphop') || compactQuery.includes('hip-hop') ? 'Urban' : 'K-pop',
    styleTags: styleTags.length ? styleTags.slice(0, 4) : ['甜酷', '运动'],
    sceneTags: compactQuery.includes('拍') || compactQuery.includes('视频') ? ['拍视频', '练舞房'] : ['练舞房', '舞台'],
    outfitKeywords: outfitKeywords.length ? outfitKeywords.slice(0, 8) : ['短款上衣', '高腰下装', '防滑舞蹈鞋', '配饰亮点'],
    avoidKeywords: compactQuery.includes('不要太甜') || compactQuery.includes('不甜') ? ['甜美', '学院', '蝴蝶结'] : [],
    stageOutfitSummary: `根据「${normalized || '自定义舞蹈'}」生成初始标签；置信度不足时建议先微调标签再生成。`,
    stageOutfitProfiles: [],
    priceRange: '',
    bodyTags: compactQuery.includes('不露腰') ? ['不露腰'] : compactQuery.includes('显腿') ? ['显腿长'] : [],
    freeText: '',
  };
}

async function buildProfile(query) {
  const normalized = normalizeText(query);

  try {
    const openAiResult = await buildOpenAiProfile(normalized);
    if (openAiResult) return openAiResult;
  } catch (error) {
    // Keep the product usable when live model search is unavailable.
  }

  const dance = findDance(normalized);

  if (dance) {
    return {
      profile: danceToProfile(dance, normalized),
      confidence: 0.94,
      needsReview: false,
      matchType: 'exact-dance',
      matchedDanceId: dance.id,
    };
  }

  const profile = inferByRules(normalized);
  const hasSpecificRule = STYLE_RULES.some((rule) => rule.keys.some((key) => compactText(normalized).includes(compactText(key))));

  return {
    profile,
    confidence: hasSpecificRule ? 0.72 : 0.48,
    needsReview: true,
    matchType: hasSpecificRule ? 'style-rule' : 'fallback-rule',
    matchedDanceId: '',
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!['GET', 'POST'].includes(req.method || '')) {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  const source = req.method === 'POST' ? parseBody(req.body) : req.query || {};
  const query = normalizeText(source.query || source.danceName);

  if (!query) {
    res.status(400).json({ error: 'query-is-required' });
    return;
  }

  const result = await buildProfile(query);
  res.status(200).json({
    ...result,
    isMock: result.matchType !== 'openai-web-search',
    modelProvider: process.env.OPENAI_API_KEY ? 'openai-ready' : 'local-rule-fallback',
    message: process.env.OPENAI_API_KEY
      ? 'OpenAI env detected; this endpoint attempts live platform web search before falling back to local structured tags.'
      : 'Missing model env, returning local structured profile fallback.',
  });
}
