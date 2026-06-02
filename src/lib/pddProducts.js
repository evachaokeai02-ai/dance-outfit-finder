const categorySearchTerms = {
  top: '短上衣 上衣 外套',
  bottom: '短裙 短裤 裤裙',
  shoes: '跳舞鞋 短靴 运动鞋',
  accessory: '腰链 腰带 配饰',
};

function pickLeadKeyword(info) {
  const stageProfileTerms = (info.stageOutfitProfiles || []).flatMap((profile) => [
    profile.name,
    ...(profile.styleTags || []),
    ...(profile.outfitKeywords || []),
  ]);
  const sourcePlatforms = (info.stageResearchSources || []).map((source) => source.platform).filter(Boolean);

  return [
    info.rawQuery,
    info.danceName,
    info.artist,
    ...(info.outfitKeywords || []).slice(0, 7),
    ...stageProfileTerms.slice(0, 6),
    ...(info.styleTags || []).slice(0, 3),
    ...sourcePlatforms.slice(0, 2),
    '打歌服 同款 平替 cover',
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildPddQueries(info) {
  const baseKeyword = pickLeadKeyword(info);

  return Object.entries(categorySearchTerms).map(([category, terms]) => ({
    category,
    keyword: `${baseKeyword} ${terms}`,
    styleTags: info.styleTags || [],
    sceneTags: info.sceneTags || [],
    danceTags: [info.danceType].filter(Boolean),
    bodyTags: info.bodyTags || [],
    image: info.styleTags?.includes('红黑') || info.outfitKeywords?.includes('红色') ? 'rose-black' : undefined,
    limit: 2,
  }));
}

export async function fetchPddProducts(info) {
  const response = await fetch('/api/pdd-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries: buildPddQueries(info) }),
  });

  if (!response.ok) throw new Error(`pdd-products-${response.status}`);
  return response.json();
}
