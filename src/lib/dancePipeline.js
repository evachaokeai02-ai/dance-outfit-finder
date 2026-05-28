import { unique } from './recommendationEngine';

const CACHE_KEY = 'dance-outfit-kpop-v1';

function makeSearchTokens(dance) {
  return unique([dance.danceName, ...(dance.aliases || []), dance.artist, ...(dance.styleTags || [])]);
}

export function normalizeDanceRecord(dance) {
  return {
    id: dance.id,
    danceName: dance.danceName,
    artist: dance.artist,
    danceType: dance.danceType,
    styleTags: dance.styleTags || [],
    sceneTags: dance.sceneTags || [],
    outfitKeywords: dance.outfitKeywords || [],
    stageOutfitSummary: dance.stageOutfitSummary || '',
    searchTokens: makeSearchTokens(dance),
  };
}

export function getKpopSuggestions(danceStyles, onlyKpop = true, limit = 8) {
  const cacheKey = `${CACHE_KEY}:${onlyKpop ? 'kpop' : 'all'}:${limit}`;

  if (typeof window !== 'undefined') {
    const cached = window.localStorage.getItem(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        window.localStorage.removeItem(cacheKey);
      }
    }
  }

  const source = onlyKpop
    ? danceStyles.filter((dance) => dance.danceType === 'K-pop' || dance.danceType === '女团')
    : danceStyles;

  const result = source.slice(0, limit).map(normalizeDanceRecord);

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(cacheKey, JSON.stringify(result));
  }

  return result;
}

export function getFallbackKpopKeywords() {
  return ['女团打歌服', 'Y2K甜酷', '练舞房显腿长'];
}
