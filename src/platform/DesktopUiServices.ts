import { DesktopFileDialog } from "../services/DesktopFileDialog";
import { loadPrivateKeyFile } from "../security/PrivateKeyFile";
import { defaultLocalEndpoint, discoverLocalDockerEndpoints } from "../connections/LocalEndpointDiscovery";
import { DockerContextDiscoveryService } from "../connections/DockerContextDiscovery";
import { createDockerTlsProfile, validateDockerTlsFiles } from "../security/TlsProfileValidation";
import { SshKeyGenerationService, type SshKeyGenerationStage } from "../security/SshKeyGenerationService";
import { resolvePublicKeyForPrivateKey } from "../security/SshPublicKeyResolver";

/** Desktop-only modal helpers loaded after the desktop capability gate. */
export const desktopUiServices = {
  defaultLocalEndpoint,
  discoverLocalDockerEndpoints,
  async choosePrivateKey(): Promise<string | undefined> { return new DesktopFileDialog().choosePrivateKey(); },
  async chooseFile(title: string): Promise<string | undefined> { return new DesktopFileDialog().chooseFile(title); },
  async generateSshKey(passphrase?: string, onStage?: (stage: SshKeyGenerationStage) => void) { return new SshKeyGenerationService().generate(passphrase, onStage); },
  resolvePublicKeyForPrivateKey,
  loadPrivateKeyFile,
  validateDockerTlsFiles,
  createDockerTlsProfile,
  async discoverContexts() { const discovery = new DockerContextDiscoveryService(); const resolution = await discovery.resolveCli(); return { resolution, contexts: await discovery.discover(resolution) }; }
};
