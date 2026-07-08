/**
 * Types for the feeder.co REST API (https://github.com/feederco/feeder-api).
 * Property naming is inconsistent for legacy reasons, so fields observed in
 * real responses are typed and everything else is left open.
 */

export interface FeederPost {
  id: string;
  feed_id: number;
  title: string;
  feed_title: string;
  feed_link: string;
  link: string;
  is_read: 0 | 1;
  is_starred: 0 | 1;
  /** Unix timestamp in seconds */
  published: number;
  extra?: {
    categories?: string[];
  };
}

export interface FeederFeed {
  id: number;
  title: string;
  /** URL of the RSS/Atom feed itself */
  path: string;
  num_posts?: number;
  errors?: Record<string, string[]>;
}

export interface FeedUnreadCount {
  feed_id: number;
  unread: number;
  last_updated: string;
  is_error: boolean;
}

export interface PostsResponse {
  posts: FeederPost[];
}

export interface FeedsResponse {
  feeds: FeederFeed[];
}

export interface UnreadCountsResponse {
  unreads: FeedUnreadCount[];
}
