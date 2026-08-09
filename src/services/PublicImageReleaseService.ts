import { requestUrl } from "obsidian";
import { newerMajorMinorRelease, parseImageReference, type PublicImageReference } from "./PublicImageReleaseUtils";

export interface PublicImageRelease { state: "update-available" | "current" | "unavailable"; currentVersion?: string; availableVersion?: string; checkedAt: string; }

/** Performs bounded anonymous tag checks for major/minor release advisories. */
export class PublicImageReleaseService {
  private readonly cache = new Map<string, { expiresAt: number; value: PublicImageRelease }>();

  async check(image: string): Promise<PublicImageRelease> {
    const cached = this.get(image); if (cached) return cached;
    const reference = parseImageReference(image); const checkedAt = new Date().toISOString();
    if (!reference) return this.store(image, { state: "unavailable", checkedAt });
    try {
      const availableVersion = newerMajorMinorRelease(reference.tag, await this.fetchTags(reference));
      return this.store(image, availableVersion ? { state: "update-available", currentVersion: majorMinor(reference.tag), availableVersion, checkedAt } : { state: "current", currentVersion: majorMinor(reference.tag), checkedAt });
    } catch { return this.store(image, { state: "unavailable", checkedAt }); }
  }

  get(image: string): PublicImageRelease | undefined { const cached = this.cache.get(image); if (!cached) return undefined; if (cached.expiresAt <= Date.now()) { this.cache.delete(image); return undefined; } return cached.value; }
  clear(): void { this.cache.clear(); }

  private store(image: string, value: PublicImageRelease): PublicImageRelease { this.cache.set(image, { expiresAt: Date.now() + 15 * 60_000, value }); return value; }
  private async fetchTags(reference: PublicImageReference): Promise<string[]> {
    const endpoint = reference.registry === "docker.io" ? "https://registry-1.docker.io" : `https://${reference.registry}`;
    const url = `${endpoint}/v2/${encodePath(reference.repository)}/tags/list?n=1000`;
    let response = await requestUrl({ url, method: "GET", throw: false });
    if (response.status === 401) {
      const token = await this.bearerToken(response.headers["www-authenticate"] ?? response.headers["WWW-Authenticate"]);
      if (!token) throw new Error("Anonymous registry access was not granted.");
      response = await requestUrl({ url, method: "GET", headers: { Authorization: `Bearer ${token}` }, throw: false });
    }
    const tags = response.status === 200 && response.json && typeof response.json === "object" ? (response.json as { tags?: unknown }).tags : undefined;
    if (!Array.isArray(tags)) throw new Error("Registry tags were unavailable.");
    return tags.filter((tag): tag is string => typeof tag === "string");
  }
  private async bearerToken(challenge: string | undefined): Promise<string | undefined> {
    if (!challenge?.toLowerCase().startsWith("bearer ")) return undefined;
    const values = Object.fromEntries([...challenge.matchAll(/([a-z]+)="([^"]+)"/gi)].map((match) => [match[1], match[2]]));
    if (!values.realm) return undefined;
    const url = new URL(values.realm); if (values.service) url.searchParams.set("service", values.service); if (values.scope) url.searchParams.set("scope", values.scope);
    const response = await requestUrl({ url: url.toString(), method: "GET", throw: false }); const payload = response.json as { token?: unknown; access_token?: unknown } | undefined;
    return response.status === 200 && payload ? typeof payload.token === "string" ? payload.token : typeof payload.access_token === "string" ? payload.access_token : undefined : undefined;
  }
}

function encodePath(value: string): string { return value.split("/").map(encodeURIComponent).join("/"); }
function majorMinor(tag: string): string | undefined { const match = /^v?(\d+)(?:\.(\d+))?/.exec(tag); return match ? `${match[1]}.${match[2] ?? "0"}` : undefined; }
