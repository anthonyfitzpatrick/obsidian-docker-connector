import { describe, expect, it } from "vitest";
import { ContainerMapper } from "../src/containers/ContainerMapper";

describe("ContainerMapper", () => {
  const raw = { Id: "a".repeat(64), Names: ["/web", "/web-alias"], Image: "nginx:latest", ImageID: "sha256:image", State: "running", Status: "Up 2 minutes (healthy)", Created: 1_700_000_000, Ports: [{ PrivatePort: 80, PublicPort: 8080, Type: "tcp", IP: "0.0.0.0" }, { PrivatePort: 80, PublicPort: 8080, Type: "tcp", IP: "0.0.0.0" }, { PrivatePort: 53, Type: "udp" }], Mounts: [{ Type: "bind", Source: "/srv/web", Destination: "/usr/share/nginx/html", RW: true }], Labels: { "com.example.role": "frontend" }, NetworkSettings: { Networks: { frontend: {} } } };
  it("normalizes Docker container summaries without leaking raw payload assumptions", () => {
    const container = ContainerMapper.summary(raw, "host-1");
    expect(container).toMatchObject({ displayName: "web", shortId: "a".repeat(12), state: "running", health: "healthy", hostProfileId: "host-1" });
    expect(container.names).toEqual(["web", "web-alias"]); expect(container.ports).toHaveLength(2); expect(container.networks).toEqual([{ name: "frontend" }]);
  });
  it("keeps Docker names, image references, and Compose labels as distinct fields", () => {
    const container = ContainerMapper.summary({ Id: "id", Names: ["/customer-website-web-1"], Image: "nginx:1.27", State: "running", Status: "Up", Created: 1, Labels: { "com.docker.compose.project": "customer-website", "com.docker.compose.service": "frontend", "com.docker.compose.container-number": "1" } }, "host");
    expect(container).toMatchObject({ displayName: "customer-website-web-1", image: "nginx:1.27", compose: { project: "customer-website", service: "frontend", containerNumber: 1 } });
    expect(container.compose?.service).not.toBe(container.displayName);
  });
  it("uses safe fallbacks for missing or unexpected values", () => {
    const container = ContainerMapper.summary({ Id: "id", State: "future-state", Created: "bad" }, "host");
    expect(container.displayName).toBe("Unnamed container"); expect(container.image).toBe("Unknown image"); expect(container.state).toBe("unknown"); expect(container.createdTimestamp).toBe(0);
  });
  it("retains only environment variable names in details", () => {
    const details = ContainerMapper.details({ Id: "id", Name: "/web", Config: { Image: "nginx", Env: ["DATABASE_URL=postgres://secret", "LOG_LEVEL=debug", "FLAG"] }, State: { Status: "running" } });
    expect(details.environmentVariableNames).toEqual(["DATABASE_URL", "LOG_LEVEL", "FLAG"]);
    expect(JSON.stringify(details)).not.toContain("postgres://secret"); expect(JSON.stringify(details)).not.toContain("LOG_LEVEL=debug");
  });
  it("maps inspect mounts, ports, networks, and bounded health output", () => {
    const details = ContainerMapper.details({ Id: "id", Name: "/web", Config: { Image: "nginx", ExposedPorts: { "80/tcp": {} } }, State: { Status: "running", Health: { Status: "healthy", Log: [{ ExitCode: 0, Output: "ok" }] } }, Mounts: [{ Type: "volume", Name: "data", Destination: "/data", RW: false }], NetworkSettings: { Ports: { "80/tcp": [{ HostIp: "::", HostPort: "8080" }] }, Networks: { frontend: { IPAddress: "172.20.0.2", Aliases: ["web"] } } } });
    expect(details.mounts[0]).toMatchObject({ name: "data", readOnly: true }); expect(details.portBindings[0].bindings[0]).toMatchObject({ hostPort: "8080" }); expect(details.networks[0]).toMatchObject({ name: "frontend", ipAddress: "172.20.0.2" }); expect(details.state.health?.status).toBe("healthy");
  });
});
