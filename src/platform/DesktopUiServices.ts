import { DesktopFileDialog } from "../services/DesktopFileDialog";
import { loadPrivateKeyFile } from "../security/PrivateKeyFile";
import { defaultLocalEndpoint, discoverLocalDockerEndpoints } from "../connections/LocalEndpointDiscovery";
import { DockerContextDiscoveryService } from "../connections/DockerContextDiscovery";
import { createDockerTlsProfile, validateDockerTlsFiles } from "../security/TlsProfileValidation";

/** Desktop-only modal helpers. This module is emitted as desktop-ui.js. */
export const desktopUiServices = {
  defaultLocalEndpoint,
  discoverLocalDockerEndpoints,
  async choosePrivateKey(): Promise<string | undefined> { return new DesktopFileDialog().choosePrivateKey(); },
  async chooseFile(title: string): Promise<string | undefined> { return new DesktopFileDialog().chooseFile(title); },
  loadPrivateKeyFile,
  validateDockerTlsFiles,
  createDockerTlsProfile,
  async discoverContexts() { const discovery = new DockerContextDiscoveryService(); const resolution = await discovery.resolveCli(); return { resolution, contexts: await discovery.discover(resolution) }; }
};
