/**
 * Runtime-only credential store.
 *
 * Passwords, SSH private-key passphrases, and TLS client-key passphrases are
 * intentionally excluded from DockerConnectorSettings and are never passed to
 * saveData. They exist only for the current Electron process and are cleared
 * when a profile disconnects or the plugin unloads. Certificate and private-key
 * file contents are likewise read only by their transports and never persisted.
 *
 * Documentation: Docker Connector - Credential Security.md
 */
export class RuntimeCredentialStore {
  private readonly passwords = new Map<string, string>();
  private readonly privateKeyPassphrases = new Map<string, string>();
  private readonly tlsClientKeyPassphrases = new Map<string, string>();
  private readonly gatewayTokens = new Map<string, string>();

  setPassword(profileId: string, password: string): void {
    if (password.length === 0) {
      this.clearPassword(profileId);
      return;
    }
    this.passwords.set(profileId, password);
  }

  getPassword(profileId: string): string | undefined { return this.passwords.get(profileId); }
  hasPassword(profileId: string): boolean { return this.passwords.has(profileId); }
  clearPassword(profileId: string): void { this.passwords.delete(profileId); }
  setPrivateKeyPassphrase(profileId: string, passphrase: string): void { this.privateKeyPassphrases.set(profileId, passphrase); }
  getPrivateKeyPassphrase(profileId: string): string | undefined { return this.privateKeyPassphrases.get(profileId); }
  hasPrivateKeyPassphrase(profileId: string): boolean { return this.privateKeyPassphrases.has(profileId); }
  clearPrivateKeyPassphrase(profileId: string): void { this.privateKeyPassphrases.delete(profileId); }
  setTlsClientKeyPassphrase(profileId: string, passphrase: string): void { this.tlsClientKeyPassphrases.set(profileId, passphrase); }
  getTlsClientKeyPassphrase(profileId: string): string | undefined { return this.tlsClientKeyPassphrases.get(profileId); }
  clearTlsClientKeyPassphrase(profileId: string): void { this.tlsClientKeyPassphrases.delete(profileId); }
  setGatewayToken(profileId: string, token: string): void { if (token) this.gatewayTokens.set(profileId, token); else this.gatewayTokens.delete(profileId); }
  getGatewayToken(profileId: string): string | undefined { return this.gatewayTokens.get(profileId); }
  clearProfile(profileId: string): void { this.clearPassword(profileId); this.clearPrivateKeyPassphrase(profileId); this.clearTlsClientKeyPassphrase(profileId); this.gatewayTokens.delete(profileId); }
  clearAll(): void { this.passwords.clear(); this.privateKeyPassphrases.clear(); this.tlsClientKeyPassphrases.clear(); this.gatewayTokens.clear(); }
}
