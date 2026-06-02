export const PROFILE_DIRECT_CONFIDENCE = 0.8;

export async function fetchOutfitProfile(query) {
  const response = await fetch('/api/outfit-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) throw new Error(`outfit-profile-${response.status}`);
  return response.json();
}

function avoidKeywordsToOption(keywords = []) {
  if (keywords.some((keyword) => ['甜美', '学院', '蝴蝶结'].includes(keyword))) return '不要太甜';
  if (keywords.some((keyword) => ['露腰', '吊带'].includes(keyword))) return '不要太露';
  if (keywords.includes('低腰')) return '不要低腰';
  if (keywords.some((keyword) => ['紧身', '修身'].includes(keyword))) return '不要紧身';
  if (keywords.some((keyword) => ['高跟', '高跟感'].includes(keyword))) return '不要高跟';
  return '无特别避雷';
}

export function profileToManualForm(profile) {
  return {
    danceName: profile.danceName || profile.rawQuery || '自定义舞蹈',
    danceType: profile.danceType || 'K-pop',
    style: profile.styleTags?.[0] || '甜酷',
    scene: profile.sceneTags?.[0] || '练舞房',
    budget: profile.priceRange || '100-200',
    body: profile.bodyTags?.[0] || '方便大动作',
    avoid: avoidKeywordsToOption(profile.avoidKeywords),
    freeText: profile.freeText || profile.stageOutfitSummary || '',
  };
}

export async function logOutfitEvent(event) {
  const response = await fetch('/api/outfit-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });

  if (!response.ok) throw new Error(`outfit-events-${response.status}`);
  return response.json();
}
