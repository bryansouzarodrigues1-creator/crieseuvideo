/**
 * Metadata-only preflight. Does NOT call generateContent, countTokens,
 * or any billable inference endpoint. It fails closed if the owner's
 * dedicated Gemini API key is invalid or lacks access to the intended model.
 */
const model = process.env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
const key = process.env.FREEFORM_3D_GEMINI_API_KEY;
if (!key) {
  console.error('PRECHECK_BLOCKED: dedicated Gemini API secret is missing.');
  process.exit(2);
}
if (!/^(gemini-3\.6-flash|gemini-3\.5-flash-lite)$/.test(model)) {
  console.error('PRECHECK_BLOCKED: unexpected model identifier.');
  process.exit(2);
}
const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model;
try {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'x-goog-api-key': key },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    // Never log the API's returned body: it might include untrusted data.
    console.error(JSON.stringify({
      preflight: 'BLOCKED',
      httpStatus: response.status,
      reason: 'Invalid credentials, unavailable model, or missing API access.',
      inferenceCalls: 0,
    }));
    process.exit(3);
  }
  const info = await response.json() as {
    name?: string;
    supportedGenerationMethods?: string[];
  };
  if (info.name !== 'models/' + model ||
      !info.supportedGenerationMethods?.includes('generateContent')) {
    console.error(JSON.stringify({
      preflight: 'BLOCKED',
      reason: 'Model metadata does not match requested generative method.',
      inferenceCalls: 0,
    }));
    process.exit(3);
  }
  console.log(JSON.stringify({
    preflight: 'PASS', model: info.name,
    method: 'generateContent', inferenceCalls: 0,
  }));
} catch {
  console.error('PRECHECK_BLOCKED: model metadata could not be verified; no inference call sent.');
  process.exit(3);
}
