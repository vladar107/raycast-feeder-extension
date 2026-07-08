import { Action, ActionPanel, Clipboard, Form, popToRoot, showToast, Toast } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { useState } from "react";
import { addFeed } from "./api";

function looksLikeUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Command() {
  const [urlError, setUrlError] = useState<string | undefined>();

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

    const toast = await showToast({ style: Toast.Style.Animated, title: "Subscribing…" });
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
      <Form.Description text="A page URL usually works too — Feeder discovers the RSS feed behind it." />
    </Form>
  );
}
