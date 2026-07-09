/**
 * Best-effort client-side feed resolution. Feeder discovers feeds behind page
 * URLs on its own, but pages without a feed <link> tag (e.g. Substack profile
 * pages) trigger its paid "custom RSS" builder instead. Resolving locally
 * turns such links into real feed URLs before they are sent to the API.
 */

export interface FeedCandidate {
  url: string;
  title?: string;
}

const FETCH_TIMEOUT_MS = 10_000;

interface FetchedPage {
  finalUrl: string;
  contentType: string;
  body: string;
}

async function fetchPage(url: string): Promise<FetchedPage | undefined> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!response.ok) return undefined;
    return {
      finalUrl: response.url || url,
      contentType: response.headers.get("content-type") ?? "",
      body: await response.text(),
    };
  } catch {
    return undefined;
  }
}

/** True when the document itself is already an RSS/Atom feed. */
function isFeedDocument(contentType: string, body: string): boolean {
  if (/(rss|atom)\+xml/i.test(contentType)) return true;
  const head = body.slice(0, 1000).trimStart();
  if (head.startsWith("<?xml")) return /<(rss|feed|rdf:RDF)[\s>]/.test(head);
  return /^<(rss|feed)[\s>]/.test(head);
}

function attribute(tag: string, name: string): string | undefined {
  // Require a leading space/quote so e.g. data-href does not match as href.
  const match = tag.match(new RegExp(`[\\s"']${name}\\s*=\\s*("[^"]*"|'[^']*')`, "i"));
  return match ? match[1].slice(1, -1) : undefined;
}

/** Standard autodiscovery: <link rel="alternate" type="application/rss+xml" href="..."> in the page head. */
function discoverFeedLinks(body: string, baseUrl: string): FeedCandidate[] {
  const candidates: FeedCandidate[] = [];
  for (const tag of body.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attribute(tag, "rel");
    const type = attribute(tag, "type");
    const href = attribute(tag, "href");
    if (!rel || !type || !href) continue;
    if (!/\balternate\b/i.test(rel) || !/application\/(rss|atom)\+xml/i.test(type)) continue;
    try {
      candidates.push({ url: new URL(href, baseUrl).toString(), title: attribute(tag, "title") });
    } catch {
      // Malformed href — skip this tag.
    }
  }
  return candidates;
}

/**
 * For a Substack profile URL returns its root form (https://substack.com/@user).
 * Sub-pages like /@user/posts embed "profile": null, so the root page — the
 * only variant that carries the publication list — must be fetched instead.
 */
function substackProfileRoot(url: string): string | undefined {
  try {
    const { hostname, pathname } = new URL(url);
    if (!/(^|\.)substack\.com$/i.test(hostname)) return undefined;
    const handle = pathname.match(/^\/(@[^/]+)/);
    return handle ? `https://substack.com/${handle[1]}` : undefined;
  } catch {
    return undefined;
  }
}

interface SubstackPublication {
  name?: string;
  subdomain?: string;
  custom_domain?: string | null;
}

interface SubstackPreloads {
  profile?: { publicationUsers?: { publication?: SubstackPublication }[] };
}

/**
 * Substack profile pages (substack.com/@user) carry no feed <link> tag, but
 * embed the publications the user writes in a window._preloads JSON blob.
 */
function substackProfilePublications(body: string): FeedCandidate[] {
  const match = body.match(/window\._preloads\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/);
  if (!match) return [];
  try {
    const preloads = JSON.parse(JSON.parse(match[1]) as string) as SubstackPreloads;
    const candidates: FeedCandidate[] = [];
    for (const { publication } of preloads.profile?.publicationUsers ?? []) {
      const host =
        publication?.custom_domain ?? (publication?.subdomain ? `${publication.subdomain}.substack.com` : undefined);
      if (host) candidates.push({ url: `https://${host}/feed`, title: publication?.name });
    }
    return candidates;
  } catch {
    return [];
  }
}

function dedupeByUrl(candidates: FeedCandidate[]): FeedCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => !seen.has(candidate.url) && seen.add(candidate.url));
}

/**
 * Resolves a pasted URL to concrete feed URLs. Returns an empty array when
 * nothing could be resolved (network error, no feed markers on the page) —
 * the caller should then fall back to submitting the URL as-is.
 */
export async function resolveFeed(inputUrl: string): Promise<FeedCandidate[]> {
  const page = await fetchPage(inputUrl);
  if (!page) return [];
  if (isFeedDocument(page.contentType, page.body)) return [{ url: page.finalUrl }];
  const profileRoot = substackProfileRoot(page.finalUrl);
  if (profileRoot) {
    const profileBody = profileRoot === page.finalUrl ? page.body : ((await fetchPage(profileRoot))?.body ?? "");
    const publications = substackProfilePublications(profileBody);
    if (publications.length > 0) return dedupeByUrl(publications);
  }
  return dedupeByUrl(discoverFeedLinks(page.body, page.finalUrl));
}
