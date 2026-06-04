import { callPddApi, getPddEnvPresence, PddApiError, queryConfiguredPidInventory } from './_lib/pdd.js';

const ACTIONS = new Set(['authority-query', 'authority-url', 'pid-query']);

function normalizeText(value) {
  return String(value || '').trim();
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

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-admin-token');
}

function getHeader(req, name) {
  const headers = req.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getSafePidDiagnostics() {
  return getPddEnvPresence();
}

function assertAdminAuthorized(req) {
  const adminToken = normalizeText(process.env.ADMIN_TOKEN);
  if (!adminToken) return true;
  return normalizeText(getHeader(req, 'x-admin-token')) === adminToken;
}

function getDebugParams(body) {
  const params = body.params && typeof body.params === 'object' && !Array.isArray(body.params) ? body.params : {};
  const { custom_parameters, p_id, p_id_list, pid, ...safeParams } = params;
  return safeParams;
}

function getConfiguredPid() {
  return process.env.PDD_PID?.trim() || '';
}

function getAuthorityQueryParams(body) {
  const pid = getConfiguredPid();
  return {
    ...getDebugParams(body),
    pid: pid || undefined,
  };
}

function getAuthorityUrlParams(body) {
  const pid = getConfiguredPid();
  return {
    ...getDebugParams(body),
    p_id_list: pid ? [pid] : undefined,
    channel_type: 10,
    generate_we_app: true,
  };
}

function getActionConfig(action, body) {
  if (action === 'authority-query') {
    return {
      pddType: 'pdd.ddk.member.authority.query',
      params: getAuthorityQueryParams(body),
    };
  }

  if (action === 'authority-url') {
    return {
      pddType: 'pdd.ddk.rp.prom.url.generate',
      params: getAuthorityUrlParams(body),
    };
  }

  if (action === 'pid-query') {
    return {
      pddType: 'pdd.ddk.goods.pid.query',
      params: { page: 1, page_size: 100, status: 0 },
    };
  }

  return null;
}

function sendError(res, error, action) {
  const isPddError = error instanceof PddApiError;
  const statusCode = isPddError ? error.statusCode : 500;
  const env = getSafePidDiagnostics();

  console.error('[pdd-debug] action failed', {
    ...env,
  });

  res.status(statusCode).json({
    ok: false,
    action,
    error: isPddError ? error.code : 'internal-error',
    message: error instanceof Error ? error.message : 'Unknown error',
    details: isPddError ? error.details : undefined,
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
    res.status(405).json({
      error: 'method-not-allowed',
      message: 'Use POST /api/pdd-debug with body.action.',
    });
    return;
  }

  if (!assertAdminAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  const body = parseBody(req.body);
  const action = normalizeText(body.action);

  if (!ACTIONS.has(action)) {
    res.status(400).json({
      ok: false,
      error: 'invalid-action',
      message: 'action must be one of: authority-query, authority-url, pid-query',
    });
    return;
  }

  const config = getActionConfig(action, body);
  const env = getSafePidDiagnostics();

  try {
    const result = action === 'pid-query' ? await queryConfiguredPidInventory() : await callPddApi(config.pddType, config.params);

    console.info('[pdd-debug] action succeeded', {
      ...env,
    });

    if (action === 'pid-query') {
      res.status(200).json({
        ok: true,
        action,
        pddType: config.pddType,
        total_count: result.total_count,
        pidList: result.pidList,
        matchedByConfiguredPid: result.matchedByConfiguredPid,
        matchedByName: result.matchedByName,
        env,
      });
      return;
    }

    res.status(200).json({
      ok: true,
      action,
      pddType: config.pddType,
      data: result,
      env,
    });
  } catch (error) {
    sendError(res, error, action);
  }
}
