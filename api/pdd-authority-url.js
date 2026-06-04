import { generateAuthorityUrl, getPddEnvPresence, PddApiError } from './_lib/pdd.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function toErrorPayload(error) {
  const isPddError = error instanceof PddApiError;
  const details = isPddError ? error.details || {} : {};

  return {
    ok: false,
    error: isPddError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    url: '',
    mobile_url: '',
    schema_url: '',
    short_url: '',
    we_app_info: null,
    error_code: details.error_code,
    error_msg: details.error_msg,
    sub_code: details.sub_code,
    sub_msg: details.sub_msg,
    request_id: details.request_id,
    env: getPddEnvPresence(),
  };
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'method-not-allowed', message: 'Use POST /api/pdd-authority-url.' });
    return;
  }

  const env = getPddEnvPresence();

  try {
    const result = await generateAuthorityUrl();
    res.status(200).json({
      ok: true,
      ...result,
      error_code: null,
      error_msg: null,
      sub_code: null,
      sub_msg: null,
      request_id: null,
      env,
    });
  } catch (error) {
    const statusCode = error instanceof PddApiError ? error.statusCode : 500;
    res.status(statusCode).json(toErrorPayload(error));
  }
}
