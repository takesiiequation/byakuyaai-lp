const DEFAULT_SITE_URL = 'https://byakuyaai.com';

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? DEFAULT_SITE_URL;
  return raw.replace(/\/+$/, '');
}

export const SITE_URL = resolveSiteUrl();

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${SITE_URL}${normalizedPath}`;
}
