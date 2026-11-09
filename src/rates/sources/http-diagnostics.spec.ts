import { describeHttpResponse, sanitizeBodySnippet } from './http-diagnostics';

describe('sanitizeBodySnippet', () => {
  it('truncates to ~500 characters', () => {
    const snippet = sanitizeBodySnippet('a '.repeat(1000));
    expect(snippet.length).toBeLessThanOrEqual(503);
    expect(snippet.endsWith('...')).toBe(true);
  });

  it('removes comments, script/style contents and collapses whitespace', () => {
    const snippet = sanitizeBodySnippet(
      '<!-- secret comment -->\n<html>\n  <script>var token="x";</script>  <body>hi</body>\n</html>',
    );
    expect(snippet).toBe('<html> <script/> <body>hi</body> </html>');
  });

  it('redacts emails, long tokens and control characters', () => {
    const snippet = sanitizeBodySnippet(
      `contact ops@example.com key=${'A1b2'.repeat(10)}\u0000\u0007 ok`,
    );
    expect(snippet).toContain('[email]');
    expect(snippet).toContain('[redacted]');
    expect(snippet).not.toContain('ops@example.com');
    expect(snippet).not.toContain('A1b2A1b2');
    expect(snippet).not.toMatch(/[\u0000-\u0008]/);
  });

  it('handles non-string bodies', () => {
    expect(sanitizeBodySnippet({ a: 1 })).toBe('{"a":1}');
    expect(sanitizeBodySnippet(undefined)).toBe('');
  });
});

describe('describeHttpResponse', () => {
  it('reports status, final url, content type, selected headers and body', () => {
    const diagnostics = describeHttpResponse({
      status: 403,
      statusText: 'Forbidden',
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        server: 'cloudflare',
        'cf-ray': 'abc123-AMS',
        'set-cookie': ['session=very-secret'],
      },
      data: '<html><head><title>Attention Required! | Cloudflare</title></head><body>Blocked</body></html>',
      config: { url: 'https://monierate.com/?base=USDT' } as any,
      request: { res: { responseUrl: 'https://monierate.com/cdn-cgi/block' } },
    });

    expect(diagnostics).toMatchObject({
      status: 403,
      statusText: 'Forbidden',
      finalUrl: 'https://monierate.com/cdn-cgi/block',
      contentType: 'text/html; charset=UTF-8',
      title: 'Attention Required! | Cloudflare',
      headers: { server: 'cloudflare', 'cf-ray': 'abc123-AMS' },
    });
    expect(diagnostics.headers).not.toHaveProperty('set-cookie');
    expect(diagnostics.bodySnippet).toContain('Blocked');
  });

  it('falls back to the request config url and unknown content type', () => {
    const diagnostics = describeHttpResponse({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: '',
      config: { url: 'https://example.com/x' } as any,
    });
    expect(diagnostics.finalUrl).toBe('https://example.com/x');
    expect(diagnostics.contentType).toBe('unknown');
    expect(diagnostics.title).toBeNull();
  });
});
