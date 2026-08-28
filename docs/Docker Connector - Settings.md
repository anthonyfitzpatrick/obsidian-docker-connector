---
tags: [docker-connector, settings]
---

# Settings

Settings persist **Automatic refresh**, **Refresh interval**, and **Theme integration**. Container management is not a persisted setting: it is controlled by the Connections-card switch for an individual Online profile. Its authorization is profile-scoped, session-only, reset on restart/reload, and revoked if the profile ceases to be Online.

The tab is declarative. `getSettingDefinitions()` returns the three controls and one render item for the About block, and Obsidian renders the tab and indexes it for settings search from that array. There is no `display()` override: from Obsidian 1.13 a tab that supplies definitions has `display()` bypassed, so anything rendered there would not appear. `getControlValue` and `setControlValue` read and write the live settings object, rejecting a refresh interval below one minute and rebuilding the background timer when either refresh setting changes.

Settings changes use the plugin's live settings object and a serialized save chain so another settings save cannot write an older copied settings snapshot over a newer change.
