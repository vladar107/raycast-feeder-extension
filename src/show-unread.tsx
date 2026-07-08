import { Action, ActionPanel, Alert, confirmAlert, Icon, List, showToast, Toast } from "@raycast/api";
import { getFavicon, useCachedPromise } from "@raycast/utils";
import { FeederAuthError, getUnreadPosts, markAllAsRead, markFeedAsRead, setPostState } from "./api";
import { AuthErrorView } from "./auth-error-view";
import { PostDetail } from "./post-detail";
import { FeederPost } from "./types";

export default function Command() {
  const { data: posts, isLoading, error, mutate } = useCachedPromise(getUnreadPosts);

  if (error instanceof FeederAuthError) {
    return <AuthErrorView />;
  }

  // Group posts by feed, preserving the order they arrived in.
  const sections = new Map<string, FeederPost[]>();
  for (const post of posts ?? []) {
    const group = sections.get(post.feed_title) ?? [];
    group.push(post);
    sections.set(post.feed_title, group);
  }

  async function markAsRead(post: FeederPost) {
    try {
      await mutate(setPostState(post.id, { is_read: 1 }), {
        optimisticUpdate: (current) => current?.filter((p) => p.id !== post.id),
      });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to mark as read", message: String(e) });
    }
  }

  async function toggleStar(post: FeederPost) {
    const starred = post.is_starred ? 0 : 1;
    try {
      await mutate(setPostState(post.id, { is_starred: starred }), {
        optimisticUpdate: (current) => current?.map((p) => (p.id === post.id ? { ...p, is_starred: starred } : p)),
      });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to update star", message: String(e) });
    }
  }

  async function markFeedRead(post: FeederPost) {
    try {
      await mutate(markFeedAsRead(post.feed_id), {
        optimisticUpdate: (current) => current?.filter((p) => p.feed_id !== post.feed_id),
      });
      await showToast({ style: Toast.Style.Success, title: `Marked "${post.feed_title}" as read` });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to mark feed as read", message: String(e) });
    }
  }

  async function markEverythingRead() {
    const confirmed = await confirmAlert({
      title: "Mark all posts as read?",
      message: "Every unread post in your Feeder account will be marked as read.",
      primaryAction: { title: "Mark All as Read", style: Alert.ActionStyle.Destructive },
    });
    if (!confirmed) return;
    try {
      await mutate(markAllAsRead(), { optimisticUpdate: () => [] });
      await showToast({ style: Toast.Style.Success, title: "Marked all as read" });
    } catch (e) {
      await showToast({ style: Toast.Style.Failure, title: "Failed to mark all as read", message: String(e) });
    }
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Filter unread posts…">
      <List.EmptyView icon={Icon.CheckCircle} title="All caught up" description="No unread posts in Feeder." />
      {[...sections.entries()].map(([feedTitle, feedPosts]) => (
        <List.Section key={feedTitle} title={feedTitle} subtitle={`${feedPosts.length}`}>
          {feedPosts.map((post) => (
            <List.Item
              key={post.id}
              icon={getFavicon(post.feed_link, { fallback: Icon.Livestream })}
              title={post.title}
              accessories={[
                ...(post.is_starred ? [{ icon: Icon.Star }] : []),
                ...(Number.isFinite(post.published) ? [{ date: new Date(post.published * 1000) }] : []),
              ]}
              actions={
                <ActionPanel>
                  <ActionPanel.Section>
                    <Action.OpenInBrowser url={post.link} onOpen={() => markAsRead(post)} />
                    <Action.Push
                      title="Read in Raycast"
                      icon={Icon.AppWindowSidebarRight}
                      target={<PostDetail post={post} onRead={() => markAsRead(post)} />}
                    />
                    <Action
                      title="Mark as Read"
                      icon={Icon.Check}
                      shortcut={{ modifiers: ["cmd"], key: "r" }}
                      onAction={() => markAsRead(post)}
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
                  </ActionPanel.Section>
                  <ActionPanel.Section>
                    <Action
                      title="Mark Feed as Read"
                      icon={Icon.CheckList}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "enter" }}
                      onAction={() => markFeedRead(post)}
                    />
                    <Action
                      title="Mark All as Read"
                      icon={Icon.CheckCircle}
                      style={Action.Style.Destructive}
                      onAction={markEverythingRead}
                    />
                  </ActionPanel.Section>
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
