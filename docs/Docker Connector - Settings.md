---
tags: [docker-connector, settings]
---

# Settings

[[Docker Connector - Container Management]] is disabled by default. The canonical persisted field is `containerManagementEnabled`.

Enabling Container management requires confirmation. The toggle is disabled while its save is in progress and the Settings tab shows an authoritative text status: Disabled, Saving, Enabled, or Save failed. Docker Connector shows success only after the Obsidian settings write resolves. If the write fails, it restores the prior runtime value and visual toggle, shows a bounded safe error, and does not notify open dashboard views of a successful change.

Settings changes use the plugin's live settings object and a serialized save chain so another settings save cannot write an older copied settings snapshot over a newer change. Enabling this setting performs no Docker mutation by itself.
