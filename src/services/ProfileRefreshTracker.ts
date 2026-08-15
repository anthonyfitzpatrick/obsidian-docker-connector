/**
 * Gives every profile refresh attempt a monotonically increasing token.
 *
 * A profile ID remains stable when its connection details are edited, so an
 * ID-exists check alone cannot prevent a response from the old connection
 * from replacing newer state. Callers begin a token before asynchronous work
 * and publish only while it is still current.
 */
export class ProfileRefreshTracker {
  private nextToken = 0;
  private readonly currentTokens = new Map<string, number>();

  begin(profileId: string): number {
    const token = ++this.nextToken;
    this.currentTokens.set(profileId, token);
    return token;
  }

  isCurrent(profileId: string, token: number): boolean {
    return this.currentTokens.get(profileId) === token;
  }

  /** Invalidates any in-flight operation without retaining deleted state. */
  clear(profileId: string): void {
    this.currentTokens.delete(profileId);
  }
}
