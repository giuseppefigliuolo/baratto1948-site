/** Base path with a trailing slash ('/' at a domain root, '/<repo>/' on github.io). */
export const basePath = import.meta.env.BASE_URL.replace(/\/?$/, '/');

/** Absolute URL of the site home, base path included. */
export const rootUrl = (site: URL) => new URL(basePath, site).href;

/** Site-internal link that respects the base path: url('/giacca'), url('/#fodere'). */
export const url = (path: string) => basePath + path.replace(/^\//, '');
