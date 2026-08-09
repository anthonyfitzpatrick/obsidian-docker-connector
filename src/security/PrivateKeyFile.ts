import { constants } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { normalize, resolve } from "node:path";
import { utils } from "ssh2";
import { DockerConnectionError } from "../connections/DockerTransport";

/** Expands a user-provided private-key path without reading or modifying it. */
export function resolvePrivateKeyPath(input: string, home = homedir()): string {
  const path = input.trim();
  if (!path) throw new DockerConnectionError("SSH_PRIVATE_KEY_REQUIRED", "Choose a private key file.");
  const expanded = path === "~" ? home : path.startsWith("~/") || path.startsWith("~\\") ? `${home}${path.slice(1)}` : path;
  return normalize(resolve(expanded));
}

/** Loads and validates key material only for the active connection attempt. */
export async function loadPrivateKeyFile(input: string, passphrase: string | undefined): Promise<{ path: string; contents: Buffer }> {
  const path = resolvePrivateKeyPath(input);
  let file;
  try { file = await stat(path); }
  catch { throw new DockerConnectionError("SSH_PRIVATE_KEY_NOT_FOUND", "The selected private key file was not found."); }
  if (!file.isFile()) throw new DockerConnectionError("SSH_PRIVATE_KEY_NOT_A_FILE", "The selected private key path is not a file.");
  try { await access(path, constants.R_OK); }
  catch { throw new DockerConnectionError("SSH_PRIVATE_KEY_UNREADABLE", "The selected private key file cannot be read."); }
  let contents: Buffer;
  try { contents = await readFile(path); }
  catch { throw new DockerConnectionError("SSH_PRIVATE_KEY_UNREADABLE", "The selected private key file cannot be read."); }
  if (!contents.length) throw new DockerConnectionError("SSH_PRIVATE_KEY_EMPTY", "The selected private key file is empty.");
  const parsed = utils.parseKey(contents, passphrase);
  if (parsed instanceof Error) {
    contents.fill(0);
    throw mapKeyParseError(parsed.message, passphrase !== undefined);
  }
  return { path, contents };
}

export function mapKeyParseError(message: string, suppliedPassphrase: boolean): DockerConnectionError {
  if (/encrypted.*passphrase|passphrase.*required|no passphrase/i.test(message)) return new DockerConnectionError("SSH_PRIVATE_KEY_PASSPHRASE_REQUIRED", "The selected private key requires a passphrase.");
  if (suppliedPassphrase && /passphrase|decrypt|bad.*key/i.test(message)) return new DockerConnectionError("SSH_PRIVATE_KEY_PASSPHRASE_REJECTED", "The private-key passphrase was rejected.");
  if (/unsupported|not supported|format/i.test(message)) return new DockerConnectionError("SSH_PRIVATE_KEY_UNSUPPORTED_FORMAT", "The selected private key format is not supported by this SSH client.");
  return new DockerConnectionError("SSH_PRIVATE_KEY_PARSE_FAILED", "The selected private key could not be parsed.");
}
