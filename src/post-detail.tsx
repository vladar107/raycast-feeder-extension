import { Action, ActionPanel, Detail } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { useEffect, useRef } from "react";
import { getPostContent } from "./api";
import { FeederPost } from "./types";

/** Reads a post inside Raycast; marks it as read in Feeder on open. */
export function PostDetail({ post, onRead }: { post: FeederPost; onRead?: () => void }) {
  const markedRead = useRef(false);

  useEffect(() => {
    if (!markedRead.current) {
      markedRead.current = true;
      onRead?.();
    }
  }, [onRead]);

  const { data: markdown, isLoading } = usePromise(
    async (postId: string) => {
      const html = await getPostContent(postId);
      const body = html
        ? NodeHtmlMarkdown.translate(html)
        : "*Couldn't load the post content — open it in the browser instead.*";
      return `# ${post.title}\n\n${body}`;
    },
    [post.id],
  );

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown ?? `# ${post.title}`}
      navigationTitle={post.feed_title}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Feed" text={post.feed_title} />
          {Number.isFinite(post.published) && (
            <Detail.Metadata.Label title="Published" text={new Date(post.published * 1000).toLocaleString()} />
          )}
          {(post.extra?.categories?.length ?? 0) > 0 && (
            <Detail.Metadata.TagList title="Categories">
              {post.extra?.categories
                ?.slice(0, 8)
                .map((category) => <Detail.Metadata.TagList.Item key={category} text={category} />)}
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.Link title="Link" target={post.link} text="Open original" />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={post.link} />
          <Action.CopyToClipboard title="Copy Link" content={post.link} shortcut={{ modifiers: ["cmd"], key: "c" }} />
        </ActionPanel>
      }
    />
  );
}
