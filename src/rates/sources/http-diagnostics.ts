import type { AxiosResponse } from 'axios';

const BODY_SNIPPET_LENGTH = 500;

/**
 * Response headers that help tell a normal page from a bot-block / challenge
 * page. Cookies and auth-related headers are deliberately excluded.
 */
const DIAGNOSTIC_HEADERS = [
  'server',
  'date',
  'content-encoding',
  'content-length',
  'location',
  'retry-after',
  'cf-ray',
  'cf-mitigated',
  'cf-cache-status',
  'x-robots-tag',
  'via',
  'age',
];

export interface HttpResponseDiagnostics {
  status: number;
  statusText: string;
  finalUrl: string;
  contentType: string;
  headers: Record<string, string>;
  bodyLength: number;
  title: string | null;
  bodySnippet: string;
}

/**
 * Makes a response body safe and compact enough to put in a log line:
 * drops comments, script/style contents and control characters, redacts
 * emails and long token-like strings, collapses whitespace and truncates.
 */
export function sanitizeBodySnippet(
  body: unknown,
  maxLength = BODY_SNIPPET_LENGTH,
): string {
  const text = toText(body)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, '<$1/>')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\b(?:Bearer\s+)?[A-Za-z0-9_\-+/=]{32,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function toText(body: unknown): string {
  if (typeof body === 'string') return body;
  if (body === undefined || body === null) return '';
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function extractTitle(body: string): string | null {
  const match = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  return sanitizeBodySnippet(match[1], 120) || null;
}

function headerValue(headers: unknown, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers as { get?: (n: string) => unknown } & Record<string, any>;
  const raw = typeof h.get === 'function' ? h.get(name) : h[name];
  if (raw === undefined || raw === null) return undefined;
  return Array.isArray(raw) ? raw.join(', ') : String(raw);
}

/**
 * Summarises an HTTP response for logging when it did not contain what we
 * expected (status, final URL after redirects, content type, a few headers and
 * the start of the sanitized body).
 */
export function describeHttpResponse(
  response: Pick<AxiosResponse, 'status' | 'statusText' | 'headers' | 'data'> &
    Partial<Pick<AxiosResponse, 'config' | 'request'>>,
): HttpResponseDiagnostics {
  const body = toText(response.data);

  const headers: Record<string, string> = {};
  for (const name of DIAGNOSTIC_HEADERS) {
    const value = headerValue(response.headers, name);
    if (value !== undefined) headers[name] = value.slice(0, 200);
  }

  const finalUrl =
    (response.request as any)?.res?.responseUrl ||
    (response.request as any)?.responseURL ||
    response.config?.url ||
    'unknown';

  return {
    status: response.status,
    statusText: response.statusText,
    finalUrl,
    contentType: headerValue(response.headers, 'content-type') ?? 'unknown',
    headers,
    bodyLength: body.length,
    title: extractTitle(body),
    bodySnippet: sanitizeBodySnippet(body),
  };
}

/**
 * Builds a diagnostics summary from an axios error (when the server answered
 * with a non-2xx status) or returns null for errors without a response.
 */
export function describeAxiosError(error: any): HttpResponseDiagnostics | null {
  if (error?.response) {
    return describeHttpResponse(error.response);
  }
  return null;
}
