---
tags: [docker-connector, containers]
---

# Containers View

[[Docker Connector - Applications View]] does not replace this inventory: standalone containers remain here, and selecting an application container routes back to this existing detail inspector.

The container detail panel presents state-specific lifecycle controls when [[Docker Connector - Container Management]] is enabled. It uses a responsive two-column action grid that reduces to one column in a narrow detail panel.

Action progress appears beneath the controls. If Docker rejects an action, the selected container details remain open and a bounded safe failure panel provides the action, safe explanation, error code, optional HTTP status, retry, and diagnostics. A failed request does not erase the action grid.

The Image update section separates transaction eligibility from image availability. It offers **Check now** for a single non-disruptive image check, shows checking/current/error/unsupported states accessibly, and enables Update only when a newer image is confirmed. A current image hides Update, preventing repeated recreates of the same image. If it is unavailable, the panel displays the specific safe reason, such as Docker Compose management or an image reference that cannot safely be pulled. Update still begins the existing confirmed transactional workflow; it does not issue a generic mutation request.

The **Updates Available** summary card counts only containers whose image-status state is `available`. Selecting it applies an additive one-click filter while preserving search, health, network, sorting, and density choices. The active **Updates available ×** chip removes only that filter. Counts refresh with the existing image-status events; when no matching containers remain, the view offers **Show all containers**.
