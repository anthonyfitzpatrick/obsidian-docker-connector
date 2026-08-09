---
tags: [docker-connector, testing]
---

# Testing

Applications selector coverage verifies Compose-label-only grouping, deliberately different project/service/container/image fixtures, live-label cases whose service labels begin with the project name, standalone exclusion, replicas, missing-service handling without name guessing, one-off policy, conservative status derivation, update-status reuse, combined filters, sorting, and a 500-container/100-project snapshot.

Applications presentation regression checks cover semantic card sections, service-preview limiting, full-width/master/detail layout states, responsive toolbar breakpoints, wrapping service chips, inspector container/image row structure, pluralized metadata, responsive long-identifier handling, scroll reset on a changed application, and the shared active navigation state.

Automated coverage verifies password regression, profile migration, separated runtime credentials, Local Docker endpoints, Context snapshot mapping, Context lifecycle evaluation, Context execution routing, explicit SSH Context dial-stdio argument construction, Container management settings persistence boundaries, and lifecycle-action response handling. Context routing verifies that Unix sockets and Windows named pipes use the local transport without starting dial-stdio, SSH Contexts retain dial-stdio, and insecure or unknown endpoints remain blocked. The lifecycle suite verifies a full trusted container ID, the selected profile, explicit empty-response handling, and Docker's `204 No Content` response. Manual Obsidian validation remains required for modal interaction, real key selection, remote authentication, observing plugin-data writes, and a disposable-container Start action. See [[Docker Connector - Docker Context Execution]] and [[Docker Connector - Implementation Status]].

Deletion coverage verifies stable profile-ID removal, preservation of other profiles, serialized persistence failure rollback, runtime credential/cache/transport cleanup, active container-operation blocking, and accessible confirmation wording. It verifies plugin-only deletion and does not invoke Docker resource or Docker Context mutation routes.

Marketplace documentation is reviewed alongside the source: the README and [[User Guide]] must describe only implemented connection methods, preserve the desktop-only and Docker-privilege warnings, and never describe an automatic update, Compose mutation, credential persistence, or telemetry feature.

Update coverage verifies structured eligibility, normal tagged references including `ghost:5-alpine`, registry-path references, exact Compose-label blocking, active-action isolation, direct disabled reasons, and that the UI invokes the transaction-gated update service rather than a generic mutation route.

Availability coverage verifies current versus available image IDs, 24-hour stale timestamps, duplicate-check coalescing, host isolation, unsupported-container handling, no lifecycle operation during checks, trusted replacement status migration, the Image update state presentation, and Check now's typed per-container check. It also verifies that Update is exposed only for a confirmed available image.

Dashboard coverage verifies the Updates Available count, its additive one-click filter and removable filter chip, retained search/health/network/sort/density choices, selection reconciliation, and the no-updates empty state.
