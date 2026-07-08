import { Action, ActionPanel, Color, Icon, List, showToast, Toast } from "@raycast/api";
import { getFavicon, useCachedPromise } from "@raycast/utils";
import { FeederAuthError, getFeeds, getPosts, getUnreadCounts, markFeedAsRead, setPostState } from "./api";
import { AuthErrorView } from "./auth-error-view";
import { FeederFeed, FeederPost } from "./types";

export default function Command() {
  const { data, isLoading, error, mutate } = useCachedPromise(async () => {
    const [feeds, unreads] = await Promise.all([getFeeds(), getUnreadCounts()]);
    return { feeds, unreads };
  });

  if (error instanceof FeederAuthError) {
    return <AuthErrorView />;
  }

  const unreadByFeed = new Map((data?.unreads ?? []).map((u) => [u.feed_id, u.unread]));

  async function markFeedRead(feed: FeederFeed) {
    try {
      await markFeedAsRead(feed.id);
      await mutate();
      await showToast({ style: Toast.Style.Success, title: `Marked "${feed.title}" as read` });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to mark feed as read", message: String(e) });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter feeds…">
      <List.EmptyView icon={Icon.Livestream} title="No feeds" description="Add a feed with the Add RSS Feed command." />
      {(data?.feeds ?? []).map((feed) => {
        const unread = unreadByFeed.get(feed.id) ?? 0;
        return (
          <List.Item
            key={feed.id}
            icon={getFavicon(feed.path, { fallback: Icon.Livestream })}
            title={feed.title}
            accessories={
              unread > 0 ? [{ tag: { value: `${unread}`, color: Color.Blue }, tooltip: "Unread posts" }] : []
            }
            actions={
              <ActionPanel>
                <Action.Push title="Show Posts" icon={Icon.List} target={<FeedPosts feed={feed} />} />
                <Action
                  title="Mark Feed as Read"
                  icon={Icon.CheckList}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                  onAction={() => markFeedRead(feed)}
                />
                <Action.CopyToClipboard
                  title="Copy Feed URL"
                  content={feed.path}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function FeedPosts({ feed }: { feed: FeederFeed }) {
  const { data: posts, isLoading, mutate } = useCachedPromise((feedId: number) => getPosts({ feedId }), [feed.id]);

  async function setRead(post: FeederPost, read: 0 | 1) {
    try {
      await mutate(setPostState(post.id, { is_read: read }), {
        optimisticUpdate: (current) => current?.map((p) => (p.id === post.id ? { ...p, is_read: read } : p)),
      });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to update read state", message: String(e) });
    }
  }

  async function toggleStar(post: FeederPost) {
    const starred = post.is_starred ? 0 : 1;
    try {
      await mutate(setPostState(post.id, { is_starred: starred }), {
        optimisticUpdate: (current) =>
          current?.map((p) => (p.id === post.id ? { ...p, is_starred: starred as 0 | 1 } : p)),
      });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to update star", message: String(e) });
    }
  }

  return (
    <List isLoading={isLoading} navigationTitle={feed.title} searchBarPlaceholder="Filter posts…">
      {(posts ?? []).map((post) => (
        <List.Item
          key={post.id}
          icon={post.is_read ? Icon.Circle : { source: Icon.CircleFilled, tintColor: Color.Blue }}
          title={post.title}
          accessories={[
            ...(post.is_starred ? [{ icon: Icon.Star }] : []),
            ...(Number.isFinite(post.published) ? [{ date: new Date(post.published * 1000) }] : []),
          ]}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser url={post.link} onOpen={() => setRead(post, 1)} />
              <Action
                title={post.is_read ? "Mark as Unread" : "Mark as Read"}
                icon={post.is_read ? Icon.Circle : Icon.Check}
                shortcut={{ modifiers: ["cmd"], key: "r" }}
                onAction={() => setRead(post, post.is_read ? 0 : 1)}
              />
              <Action
                title={post.is_starred ? "Unstar" : "Star"}
                icon={post.is_starred ? Icon.StarDisabled : Icon.Star}
                shortcut={{ modifiers: ["cmd"], key: "s" }}
                onAction={() => toggleStar(post)}
              />
              <Action.CopyToClipboard
                title="Copy Link"
                content={post.link}
                shortcut={{ modifiers: ["cmd"], key: "c" }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
