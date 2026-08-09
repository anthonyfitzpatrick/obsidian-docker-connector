---
tags: [docker-connector, local-docker]
---

# Local Endpoint Resolution

Unix endpoints are normalized, inspected with `lstat`, and resolved through symbolic links before transport use. Broken links, loops, and non-socket targets are reported safely. The configured path is retained; reports omit full local paths by default. Live macOS/Linux and Windows validation remains an outstanding manual gate.
