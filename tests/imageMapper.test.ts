import { describe, expect, it } from "vitest";
import { ImageMapper } from "../src/images/ImageMapper";
describe("ImageMapper", () => {
  it("maps tags, digests, usage and safe fallbacks", () => { const image = ImageMapper.summary({ Id: "sha256:abcdef0123456789", RepoTags: ["repo/app:2", "repo/app:latest"], RepoDigests: ["repo/app@sha256:dead"], Created: 10, Size: 1024, Containers: 2, Labels: { role: "web" }, Architecture: "amd64", Os: "linux" }, "host"); expect(image).toMatchObject({ repository: "repo/app", tag: "2", shortId: "abcdef012345", containersUsingImage: 2, dangling: false }); expect(image.repositoryTags).toHaveLength(2); expect(image.repositoryDigests).toHaveLength(1); });
  it("identifies dangling and malformed images safely", () => { const image = ImageMapper.summary({ Id: "id", RepoTags: ["<none>:<none>"], Created: "bad", Containers: -1 }, "host"); expect(image.dangling).toBe(true); expect(image.containersUsingImage).toBe(-1); expect(image.sizeBytes).toBe(0); expect(image.createdTimestamp).toBe(0); });
  it("derives usage from the host snapshot's containers instead of Docker's -1 placeholder", () => {
    const container = (id: string, imageId: string) => ({ id, shortId: id.slice(0, 12), names: [id], displayName: id, image: "repo/app:2", imageId, createdAt: "", createdTimestamp: 1, state: "running" as const, statusText: "Up", health: "none" as const, ports: [], mounts: [], networks: [], labels: {}, hostProfileId: "host", mapperWarnings: [] });
    const containers = [container("web", "sha256:abcdef0123456789"), container("worker", "abcdef0123456789"), container("other", "sha256:ffffffffffffffff")];
    const image = ImageMapper.summary({ Id: "sha256:abcdef0123456789", RepoTags: ["repo/app:2"], Created: 10, Size: 1024, Containers: -1 }, "host", containers);
    expect(image.containersUsingImage).toBe(2);
    expect(image.referencingContainers.map((reference) => reference.name)).toEqual(["web", "worker"]);
    const unused = ImageMapper.summary({ Id: "sha256:0123", RepoTags: ["repo/other:1"], Containers: -1 }, "host", containers);
    expect(unused.containersUsingImage).toBe(0);
    expect(unused.referencingContainers).toEqual([]);
  });
  it("maps inspect details with container references", () => { const detail = ImageMapper.details({ Id: "sha", Size: 99, Config: { Labels: { app: "x" } }, RepoTags: ["repo:tag"] }, [{ id: "c", name: "web", state: "running" }]); expect(detail.containersUsingImage[0].name).toBe("web"); expect(detail.labels.app).toBe("x"); });
});
