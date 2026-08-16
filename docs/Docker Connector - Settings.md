---
tags: [docker-connector, settings]
---

# Settings

Settings persist **Automatic refresh**, **Refresh interval**, and **Theme integration**. Container management is not a persisted setting: it is controlled by the synchronized header/card switches for an individual Online profile. Its authorization is profile-scoped, session-only, reset on restart/reload, and revoked if the profile ceases to be Online.

Settings changes use the plugin's live settings object and a serialized save chain so another settings save cannot write an older copied settings snapshot over a newer change.
