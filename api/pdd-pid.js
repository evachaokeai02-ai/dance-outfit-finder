import { generatePid, getPddEnvPresence, PddApiError } from './_lib/pdd.js';

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendError(res, error) {
  const statusCode = error instanceof PddApiError ? error.statusCode : 500;
  const env = getPddEnvPresence();

  console.error('[pdd-pid] generate failed', {
    hasClientId: env.hasClientId,
    hasClientSecret: env.hasClientSecret,
    pddPid: env.pddPid,
    error: error instanceof PddApiError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error instanceof PddApiError ? error.details : undefined,
  });

  res.status(statusCode).json({
    ok: false,
    error: error instanceof PddApiError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details: error instanceof PddApiError ? error.details : undefined,
    env: {
      hasClientId: env.hasClientId,
      hasClientSecret: env.hasClientSecret,
      pddPid: env.pddPid,
    },
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
    res.status(405).json({ error: 'method-not-allowed', message: 'Use POST /api/pdd-pid to generate one PDD PID.' });
    return;
  }

  const env = getPddEnvPresence();

  try {
    const pid = await generatePid();

    console.info('[pdd-pid] generated', {
      hasClientId: env.hasClientId,
      hasClientSecret: env.hasClientSecret,
      pddPid: env.pddPid,
      p_id: pid.p_id,
      pid_name: pid.pid_name,
      create_time: pid.create_time,
      remain_pid_count: pid.remain_pid_count,
    });

    res.status(200).json({
      ok: true,
      p_id: pid.p_id,
      pid_name: pid.pid_name,
      create_time: pid.create_time,
      remain_pid_count: pid.remain_pid_count,
      env: {
        hasClientId: env.hasClientId,
        hasClientSecret: env.hasClientSecret,
        pddPid: env.pddPid,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
}
