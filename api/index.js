// Vercel serverless function: central API endpoint for the frontend
// - Adds CORS headers so the browser can call it directly
// - Forwards the request body to the configured Apps Script (or other target)
// - Use environment variable APPS_SCRIPT_URL to set the real target in production
// - Updated for new deployment

// This file is CommonJS so Vercel will pick it up as a Serverless Function.

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  try {
    // Parse body: prefer req.body (if parsed by platform), otherwise read raw body
    let payload;
    if (req.body && Object.keys(req.body).length) {
      payload = typeof req.body === 'string' ? safeJsonParse(req.body) : req.body;
    } else {
      payload = await getRawBody(req);
    }

    // Validate payload (frontend must send at least { path: '...' })
    if (!payload || typeof payload !== 'object' || !payload.path) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: false, error: 'Request body must be JSON and include a "path" property' }));
    }

    // Usar la variable de entorno APPS_SCRIPT_URL (o alias VERCEL_APPS_SCRIPT_URL) para resolver el backend real
    const target = (process.env.APPS_SCRIPT_URL || process.env.VERCEL_APPS_SCRIPT_URL || '').trim();
    
    if (!target) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({
        success: false,
        error: 'APPS_SCRIPT_URL not configured in environment',
        hint: 'Define APPS_SCRIPT_URL (por ejemplo en .env.local) para apuntar al Apps Script o backend real.'
      }));
    }

    // Forward to target (server-to-server)
    const forwardResp = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await forwardResp.text();
    res.statusCode = forwardResp.status || 200;
    // Try to return well-formed JSON when possible
    try {
      const parsed = text ? JSON.parse(text) : {};
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(parsed));
    } catch (e) {
      // Not JSON; return as text with diagnostic wrapper
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: forwardResp.ok, status: forwardResp.status, body: text }));
    }
  } catch (err) {
    console.error('API proxy error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: String(err) }));
  }
};

// Helper: read raw body if req.body not parsed (used in some runtimes)
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(data ? safeJsonParse(data) : {});
      } catch (e) {
        // If parsing fails, resolve raw text
        resolve(data);
      }
    });
    req.on('error', reject);
  });
}

function safeJsonParse(value) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch (err) {
    return value;
  }
}


