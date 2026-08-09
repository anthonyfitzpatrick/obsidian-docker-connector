import { describe, expect, it } from "vitest";
import type { DockerConnectionType } from "../src/models/DockerConnectionProfile";
import { getDockerConnectionTypeDescription, getDockerConnectionTypeDisplayName, getDockerConnectionTypePresentation } from "../src/connections/DockerConnectionTypePresentation";

const expected: Array<[DockerConnectionType, string]> = [
  ["local", "Local Docker Socket"],
  ["docker-context", "Docker Context"],
  ["ssh", "Remote Docker via SSH"],
  ["docker-tls", "Remote Docker API (Mutual TLS)"]
];

describe("Docker connection type presentation", () => {
  it("maps every stable saved discriminator to its canonical display name", () => {
    expect(expected.map(([type]) => type)).toEqual(["local", "docker-context", "ssh", "docker-tls"]);
    expect(expected.map(([type]) => getDockerConnectionTypeDisplayName(type))).toEqual(expected.map(([, displayName]) => displayName));
  });

  it("provides non-empty accessible descriptions and compact connection information", () => {
    expected.forEach(([type]) => {
      const presentation = getDockerConnectionTypePresentation(type);
      expect(getDockerConnectionTypeDescription(type)).not.toHaveLength(0);
      expect(presentation.helper).not.toHaveLength(0);
      expect(presentation.authentication).not.toHaveLength(0);
      expect(presentation.apiExposure).not.toHaveLength(0);
      expect(presentation.recommendedFor).not.toHaveLength(0);
    });
  });
});
