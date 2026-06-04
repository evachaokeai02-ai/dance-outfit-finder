import { PddApiError, getPddEnvPresence, queryMemberAuthority } from './_lib/pdd.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function safeEnvPresence() {
  const env = getPddEnvPresence();
  return {
    hasClientId: env.hasClientId,
    hasClientSecret: env.hasClientSecret,
    hasPid: env.hasPid,
    hasCustomParameters: env.hasCustomParameters,
  };
}

function publicPddError(error) {
  const details = error instanceof PddApiError ? error.details || {} : {};
  return {
    error: error instanceof PddApiError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    error_code: details.error_code ?? details.pddErrorCode ?? null,
    error_msg: details.error_msg ?? null,
    sub_code: details.sub_code ?? details.pddSubCode ?? null,
    sub_msg: details.sub_msg ?? details.pddSubMessage ?? null,
    request_id: details.request_id ?? details.requestId ?? '',
  };
}

function sendError(res, error) {
  const statusCode = error instanceof PddApiError ? error.statusCode : 500;
  const env = safeEnvPresence();

  console.error('[pdd-authority-query]', env);

  res.status(statusCode).json({
    ok: false,
    ...publicPddError(error),
    env,
  });
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method-not-allowed', message: 'Use POST /api/pdd-authority-query.' });
    return;
  }

  const env = safeEnvPresence();

  try {
    const result = await queryMemberAuthority();

    console.info('[pdd-authority-query]', env);

    res.status(200).json({
      ok: true,
      bind: result.bind,
      request_id: result.request_id,
      error_code: null,
      error_msg: null,
      sub_code: null,
      sub_msg: null,
      env,
    });
  } catch (error) {
    sendError(res, error);
  }
}
