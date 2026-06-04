import { getPddEnvPresence, PddApiError, queryPidByDefaultName } from './_lib/pdd.js';

const PID_PREVIEW_LIMIT = 10;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getSafeEnvPresence() {
  const env = getPddEnvPresence();
  return {
    hasClientId: env.hasClientId,
    hasClientSecret: env.hasClientSecret,
  };
}

function sendError(res, error) {
  const statusCode = error instanceof PddApiError ? error.statusCode : 500;
  const env = getSafeEnvPresence();
  const details = error instanceof PddApiError && error.code !== 'missing-env' ? error.details : undefined;

  console.error('[pdd-pid-query] query failed', {
    hasClientId: env.hasClientId,
    hasClientSecret: env.hasClientSecret,
    error: error instanceof PddApiError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details,
  });

  res.status(statusCode).json({
    ok: false,
    error: error instanceof PddApiError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details,
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
    res.status(405).json({ error: 'method-not-allowed', message: 'Use POST /api/pdd-pid-query to query existing PDD PIDs.' });
    return;
  }

  const env = getSafeEnvPresence();

  try {
    const result = await queryPidByDefaultName();

    if (result.matchedPid) {
      console.info('[pdd-pid-query] matched pid', {
        hasClientId: env.hasClientId,
        hasClientSecret: env.hasClientSecret,
        pid_name: result.matchedPid.pid_name,
        p_id: result.matchedPid.p_id,
        create_time: result.matchedPid.create_time,
        status: result.matchedPid.status,
        total_count: result.total_count,
      });

      res.status(200).json({
        ok: true,
        found: true,
        p_id: result.matchedPid.p_id,
        pid_name: result.matchedPid.pid_name,
        create_time: result.matchedPid.create_time,
        status: result.matchedPid.status,
        total_count: result.total_count,
        env,
      });
      return;
    }

    const preview = result.pidList.slice(0, PID_PREVIEW_LIMIT).map((pid) => ({
      pid_name: pid.pid_name,
      p_id: pid.p_id,
    }));

    console.info('[pdd-pid-query] no matching pid found', {
      hasClientId: env.hasClientId,
      hasClientSecret: env.hasClientSecret,
      total_count: result.total_count,
      preview_count: preview.length,
    });

    res.status(200).json({
      ok: true,
      found: false,
      total_count: result.total_count,
      p_id_list: preview,
      env,
    });
  } catch (error) {
    sendError(res, error);
  }
}
