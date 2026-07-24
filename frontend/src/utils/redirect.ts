const FALLBACK_REDIRECT = "/";

export function sanitizeInternalRedirect(value: string | null | undefined) {
  if (!value) {
    return FALLBACK_REDIRECT;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return FALLBACK_REDIRECT;
  }

  try {
    const url = new URL(trimmed, window.location.origin);

    if (url.origin !== window.location.origin) {
      return FALLBACK_REDIRECT;
    }

    return `${url.pathname}${url.search}${url.hash}` || FALLBACK_REDIRECT;
  } catch {
    return FALLBACK_REDIRECT;
  }
}
