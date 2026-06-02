const DEFAULT_ENDPOINT = "https://api-v2.voicemonkey.io/trigger";

exports.handler = async (event) => {
  const headers = {
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.queryStringParameters?.health === "1") {
    return json(
      200,
      {
        ok: true,
        tokenConfigured: Boolean(process.env.VOICEMONKEY_TOKEN),
        endpointConfigured: Boolean(process.env.VOICEMONKEY_ENDPOINT),
      },
      headers,
    );
  }

  const command = getCommand(event);
  if (!command) {
    return json(400, { ok: false, error: "Missing VoiceMonkey command." }, headers);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(command)) {
    return json(400, { ok: false, error: "Invalid VoiceMonkey command." }, headers);
  }

  const token = process.env.VOICEMONKEY_TOKEN;
  if (!token) {
    return json(500, { ok: false, error: "VoiceMonkey token is not configured." }, headers);
  }

  const endpoint = process.env.VOICEMONKEY_ENDPOINT || DEFAULT_ENDPOINT;
  const url = new URL(endpoint);
  url.searchParams.set("token", token);
  url.searchParams.set("device", command);

  if (event.queryStringParameters?.dryRun === "1") {
    return json(
      200,
      {
        ok: true,
        dryRun: true,
        command,
        endpoint,
        tokenConfigured: true,
      },
      headers,
    );
  }

  try {
    const response = await fetch(url.toString(), { method: "GET" });
    return json(
      response.ok ? 200 : 502,
      {
        ok: response.ok,
        command,
        status: response.status,
      },
      headers,
    );
  } catch (error) {
    return json(
      502,
      {
        ok: false,
        command,
        error: error instanceof Error ? error.message : "VoiceMonkey request failed.",
      },
      headers,
    );
  }
};

function getCommand(event) {
  const queryCommand =
    event.queryStringParameters?.device ?? event.queryStringParameters?.command;
  if (queryCommand) return String(queryCommand).trim();

  if (!event.body) return "";

  try {
    const payload = JSON.parse(event.body);
    return String(payload.command ?? payload.device ?? "").trim();
  } catch {
    return "";
  }
}

function json(statusCode, body, headers) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}
