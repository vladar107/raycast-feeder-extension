import { Action, ActionPanel, Icon, List, openExtensionPreferences } from "@raycast/api";

/** Shown when the Feeder session cookie is rejected (expired or revoked). */
export function AuthErrorView() {
  return (
    <List>
      <List.EmptyView
        icon={Icon.Key}
        title="Feeder session expired"
        description="Log in at feeder.co, copy the _feeder.co_session cookie from DevTools → Application → Cookies, and paste it into the extension preferences."
        actions={
          <ActionPanel>
            <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
            <Action.OpenInBrowser title="Open Feeder.co" url="https://feeder.co/login" />
          </ActionPanel>
        }
      />
    </List>
  );
}
