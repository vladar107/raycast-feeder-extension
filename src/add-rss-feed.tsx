import { Action, ActionPanel, Clipboard, Form, List, popToRoot, showToast, Toast, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { addFeed } from "./api";
import { FeedCandidate, resolveFeed } from "./resolve-feed";

function looksLikeUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function subscribe(url: string, toast: Toast): Promise<void> {
  toast.style = Toast.Style.Animated;
  toast.title = "Subscribing…";
  try {
    const feed = await addFeed(url);
    toast.style = Toast.Style.Success;
    toast.title = "Subscribed";
    toast.message = feed?.title ?? url;
    await popToRoot();
  } catch (e) {
    toast.style = Toast.Style.Failure;
    toast.title = "Failed to subscribe";
    toast.message = e instanceof Error ? e.message : String(e);
  }
}

/** Shown when a URL resolves to several feeds (e.g. a Substack author with multiple publications). */
function FeedPicker({ candidates }: { candidates: FeedCandidate[] }) {
  return (
    <List searchBarPlaceholder="Pick a feed to subscribe to">
      {candidates.map((candidate) => (
        <List.Item
          key={candidate.url}
          title={candidate.title ?? candidate.url}
          subtitle={candidate.title ? candidate.url : undefined}
          actions={
            <ActionPanel>
              <Action
                title="Subscribe"
                onAction={async () => {
                  const toast = await showToast({ style: Toast.Style.Animated, title: "Subscribing…" });
                  await subscribe(candidate.url, toast);
                }}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default function Command() {
  const [urlError, setUrlError] = useState<string | undefined>();
  const { push } = useNavigation();

  // Prefill from the clipboard when it contains a URL.
  const { data: clipboardUrl, isLoading } = usePromise(async () => {
    const text = (await Clipboard.readText()) ?? "";
    return looksLikeUrl(text) ? text.trim() : "";
  });

  async function handleSubmit(values: { url: string }) {
    const url = values.url.trim();
    if (!looksLikeUrl(url)) {
      setUrlError("Enter a valid http(s) URL");
      return;
    }

    const toast = await showToast({ style: Toast.Style.Animated, title: "Looking for the feed…" });
    const candidates = await resolveFeed(url);
    if (candidates.length > 1) {
      await toast.hide();
      push(<FeedPicker candidates={candidates} />);
      return;
    }
    // Resolution is best-effort: with no candidate, let Feeder discover the feed itself.
    await subscribe(candidates[0]?.url ?? url, toast);
  }

  if (isLoading) {
    return <Form isLoading />;
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Subscribe" onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField
        id="url"
        title="Feed URL"
        placeholder="https://example.com/rss.xml"
        defaultValue={clipboardUrl}
        error={urlError}
        onChange={() => setUrlError(undefined)}
        autoFocus
      />
      <Form.Description text="Feed, post or profile URL — post pages and Substack profiles are resolved to their RSS feed automatically." />
    </Form>
  );
}
