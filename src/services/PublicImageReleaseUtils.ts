export interface PublicImageReference { registry: string; repository: string; tag: string; }

export function parseImageReference(image: string): PublicImageReference | undefined {
  const value = image.trim();
  if (!value || value.includes("@")) return undefined;
  const slash = value.lastIndexOf("/");
  const colon = value.lastIndexOf(":");
  const tag = colon > slash ? value.slice(colon + 1) : "latest";
  const named = colon > slash ? value.slice(0, colon) : value;
  const segments = named.split("/");
  const hasRegistry = segments.length > 1 && (segments[0].includes(".") || segments[0].includes(":") || segments[0] === "localhost");
  const registry = hasRegistry ? segments.shift()! : "docker.io";
  const repository = segments.join("/");
  const normalizedRepository = registry === "docker.io" && !repository.includes("/") ? `library/${repository}` : repository;
  return normalizedRepository && tag ? { registry, repository: normalizedRepository, tag } : undefined;
}

/** Returns a newer major/minor release only; patch changes never produce an alert. */
export function newerMajorMinorRelease(currentTag: string, tags: string[]): string | undefined {
  const current = parseVersion(currentTag);
  if (!current) return undefined;
  const candidates = tags.map((tag) => parseVersion(tag)).filter((value): value is ParsedVersion => Boolean(value && value.suffix === current.suffix && (value.major > current.major || value.major === current.major && value.minor > current.minor)));
  candidates.sort((left, right) => right.major - left.major || right.minor - left.minor || right.patch - left.patch);
  const newest = candidates[0];
  return newest ? `${newest.major}.${newest.minor}` : undefined;
}

interface ParsedVersion { major: number; minor: number; patch: number; suffix: string; }
function parseVersion(tag: string): ParsedVersion | undefined { const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(-[a-z0-9][a-z0-9._-]*)?$/i.exec(tag); return match ? { major: Number(match[1]), minor: Number(match[2] ?? 0), patch: Number(match[3] ?? 0), suffix: match[4] ?? "" } : undefined; }
