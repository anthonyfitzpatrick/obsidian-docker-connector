import type { DockerConnectionType } from "../models/DockerConnectionProfile";

export interface DockerConnectionTypePresentation {
  displayName: string;
  description: string;
  helper: string;
  badge: string;
  authentication: string;
  apiExposure: string;
  recommendedFor: string;
}

const PRESENTATION: Record<DockerConnectionType, DockerConnectionTypePresentation> = {
  local: {
    displayName: "Local Docker Socket",
    description: "Connect directly to Docker running on this computer using the local Docker socket or Windows named pipe.",
    helper: "Best for Docker Desktop or a local Docker Engine. Docker Connector automatically discovers common local endpoints.",
    badge: "Local",
    authentication: "Local Docker permissions",
    apiExposure: "Not applicable",
    recommendedFor: "Docker Desktop or a local Docker Engine"
  },
  "docker-context": {
    displayName: "Docker Context",
    description: "Connect using an existing Docker CLI context configured on this computer.",
    helper: "Docker Connector uses the selected context without changing your active Docker context.",
    badge: "Docker CLI",
    authentication: "Context-defined",
    apiExposure: "Defined by the selected Docker Context",
    recommendedFor: "Existing Docker CLI configurations"
  },
  ssh: {
    displayName: "Remote Docker via SSH",
    description: "Connect securely to a remote Docker host over SSH using a password or private key.",
    helper: "Docker Connector runs Docker's secure dial-stdio transport through the SSH session. The remote Docker API is not exposed directly to the network.",
    badge: "Recommended remote",
    authentication: "Password or private key",
    apiExposure: "None required",
    recommendedFor: "Most remote Docker hosts"
  },
  "docker-tls": {
    displayName: "Remote Docker API (Mutual TLS)",
    description: "Connect directly to a remote Docker Engine HTTPS endpoint protected by mutual TLS.",
    helper: "Requires a trusted CA certificate, client certificate and client private key. Both Docker Connector and the Docker server authenticate each other.",
    badge: "Advanced",
    authentication: "Client certificate",
    apiExposure: "Required",
    recommendedFor: "Advanced or centrally managed Docker environments"
  },
  gateway: {
    displayName: "Docker Connector Gateway",
    description: "Connect securely to a Docker Connector Gateway over HTTPS.",
    helper: "Recommended for iPhone, iPad and other environments where direct Docker transports are unavailable.",
    badge: "Mobile ready",
    authentication: "Session-only bearer token",
    apiExposure: "Approved read-only gateway API only",
    recommendedFor: "Mobile, tablet and private-network access"
  }
};

/** Canonical user-facing terminology for the stable saved connection type values. */
export function getDockerConnectionTypePresentation(type: DockerConnectionType): DockerConnectionTypePresentation {
  return PRESENTATION[type];
}

export function getDockerConnectionTypeDisplayName(type: DockerConnectionType): string {
  return getDockerConnectionTypePresentation(type).displayName;
}

export function getDockerConnectionTypeDescription(type: DockerConnectionType): string {
  return getDockerConnectionTypePresentation(type).description;
}

export function getDockerConnectionTypeShortDescription(type: DockerConnectionType): string {
  return getDockerConnectionTypePresentation(type).helper;
}
