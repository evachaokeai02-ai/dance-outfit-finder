function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

async function storeWithSupabase(event) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_OUTFIT_EVENTS_TABLE || 'outfit_events';

  if (!url || !key) return { stored: false, storage: 'not-configured' };

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      event_type: event.eventType || 'outfit_generated',
      raw_query: event.rawQuery || event.profile?.rawQuery || '',
      generated_profile: event.profile || {},
      products: event.products || [],
      selected_looks: event.looks || [],
      metadata: event.metadata || {},
    }),
  });

  if (!response.ok) {
    return { stored: false, storage: 'supabase', error: `supabase-${response.status}` };
  }

  return { stored: true, storage: 'supabase' };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method-not-allowed' });
    return;
  }

  try {
    const event = parseBody(req.body);
    const result = await storeWithSupabase(event);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ stored: false, error: error.message });
  }
}
