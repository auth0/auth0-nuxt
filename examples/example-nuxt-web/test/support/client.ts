/** A minimal browser: it keeps cookies between requests and never follows redirects, so tests can inspect each hop. */
export class Client {
  private readonly cookies = new Map<string, string>();

  constructor(private readonly origin: string) {}

  async get(path: string): Promise<Response> {
    const cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    const response = await fetch(new URL(path, this.origin), { redirect: 'manual', headers: { cookie } });
    this.store(response);
    return response;
  }

  /**
   * Logs in the way a browser would: start at the login route, let the user approve at Auth0 (which redirects back
   * with a code, and with the state when the SDK sent one), then call the callback.
   */
  async login(returnTo?: string): Promise<{ authorize: URL; callback: Response }> {
    const start = await this.get(returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login');
    const authorize = new URL(start.headers.get('location')!);

    const callback = new URL('/auth/callback', this.origin);
    callback.searchParams.set('code', 'test-code');
    const state = authorize.searchParams.get('state');
    if (state) callback.searchParams.set('state', state);

    return { authorize, callback: await this.get(callback.pathname + callback.search) };
  }

  private store(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      const expired = attributes.some(
        (attribute) =>
          /^max-age=0$/i.test(attribute) ||
          (/^expires=/i.test(attribute) && Date.parse(attribute.slice('expires='.length)) <= Date.now()),
      );
      if (expired || value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}
