import { getPreferenceValues } from "@raycast/api";
import { FeederFeed, FeederPost, FeedsResponse, FeedUnreadCount, PostsResponse, UnreadCountsResponse } from "./types";

const BASE_URL = "https://feeder.co/1";

/** Thrown when feeder.co rejects the session cookie (expired or revoked). */
export class FeederAuthError extends Error {
  constructor() {
    super(
      "Feeder session expired. Re-copy the _feeder.co_session cookie from your browser into the extension preferences.",
    );
    this.name = "FeederAuthError";
  }
}

function cookieHeader(): string {
  const { sessionCookie } = getPreferenceValues<Preferences>();
  let value = sessionCookie.trim();
  try {
    // Browsers show the cookie either URL-encoded or decoded depending on where
    // it is copied from; decode-then-encode accepts both forms.
    value = encodeURIComponent(decodeURIComponent(value));
  } catch {
    // Malformed escape sequence — send the value as pasted.
  }
  return `_feeder.co_session=${value}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Cookie: cookieHeader(),
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (response.status === 401) {
    throw new FeederAuthError();
  }
  if (!response.ok) {
    throw new Error(`Feeder API error: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getUnreadCounts(): Promise<FeedUnreadCount[]> {
  const data = await request<UnreadCountsResponse>("/feeds/unread");
  // The endpoint returns {} for unreads when the account has no feeds.
  return Array.isArray(data.unreads) ? data.unreads : [];
}

export async function getFeeds(): Promise<FeederFeed[]> {
  const data = await request<FeedsResponse>("/feeds");
  return data.feeds ?? [];
}

export async function getUnreadPosts(): Promise<FeederPost[]> {
  const data = await request<PostsResponse>("/posts/unread");
  return data.posts ?? [];
}

export async function getPosts(
  options: { feedId?: number; limit?: number; offset?: number } = {},
): Promise<FeederPost[]> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 50));
  if (options.offset) params.set("offset", String(options.offset));
  if (options.feedId) params.set("feed_id", String(options.feedId));
  const data = await request<PostsResponse>(`/posts?${params}`);
  const posts = data.posts ?? [];
  // The feed_id query param is undocumented; filter client-side in case the server ignores it.
  return options.feedId ? posts.filter((post) => post.feed_id === options.feedId) : posts;
}

export async function setPostState(
  postId: string,
  state: { is_read?: 0 | 1; is_starred?: 0 | 1 },
): Promise<FeederPost> {
  const data = await request<{ post: FeederPost }>(`/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ post: state }),
  });
  return data.post;
}

export async function markFeedAsRead(feedId: number): Promise<void> {
  await request(`/feeds/${feedId}/mark-as-read`, { method: "POST" });
}

export async function markAllAsRead(): Promise<void> {
  await request("/feeds/mark-all-as-read", { method: "POST" });
}

export async function addFeed(url: string): Promise<FeederFeed> {
  const data = await request<{ feed: FeederFeed }>("/feeds", {
    method: "POST",
    body: JSON.stringify({ feed: { path: url } }),
  });
  // Validation errors come back inside the object (see API docs conventions).
  if (data.feed?.errors && Object.keys(data.feed.errors).length > 0) {
    const messages = Object.values(data.feed.errors).flat().join("; ");
    throw new Error(messages);
  }
  return data.feed;
}
