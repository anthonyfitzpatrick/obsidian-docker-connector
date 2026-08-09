---
tags: [docker-connector, dashboard, containers]
---

# Docker Connector Dashboard

The dashboard includes a read-only [[Docker Connector - Applications View]] between Overview and Containers. It derives projects only from Docker Compose labels and does not expose Compose operations.

Applications uses the existing active navigation treatment and responsive dashboard primitives. Its summary filters, cards, and detail inspector are keyboard-accessible and preserve the visual hierarchy used by [[Docker Connector - Containers View]].

The Containers dashboard includes an **Updates Available** summary card. It reports only containers with a confirmed newer image and can be selected to show only those containers. Selecting it again removes that one filter without changing the current search, health, network, sort, or density choices.

The count updates as the existing image-update status changes, including manual or scheduled checks and successful replacement containers becoming current. It does not install updates automatically. See [[Docker Connector - Container Update Availability]] and [[Docker Connector - Containers View]].
