import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createDockerTlsProfile, validateDockerTlsFiles, validateDockerTlsHost, validateDockerTlsPort, validateDockerTlsServerName } from "../src/security/TlsProfileValidation";
import { RuntimeCredentialStore } from "../src/security/RuntimeCredentialStore";
import { DockerConnectionFactory } from "../src/connections/DockerConnectionFactory";
import { DockerMutualTlsTransport } from "../src/connections/DockerMutualTlsTransport";
import { createDesktopTransport } from "../src/connections/DesktopTransportFactory";

const caCertificate = `-----BEGIN CERTIFICATE-----
MIIDJzCCAg+gAwIBAgIUDOsN6V/WBxAIDCC9CjbPtuzf0A0wDQYJKoZIhvcNAQEL
BQAwIzEhMB8GA1UEAwwYRG9ja2VyIENvbm5lY3RvciBUZXN0IENBMB4XDTI2MDgy
NTE4NTQzMloXDTM2MDgyMjE4NTQzMlowIzEhMB8GA1UEAwwYRG9ja2VyIENvbm5l
Y3RvciBUZXN0IENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEApZb7
uXmklTgypZLt+IP2z3wmRZ6kh0Ebqvue7K2USCHWfNgaXEyvKRAeZeOpq8ZErV4O
TuMozQ6GT9xTif3dJiTAgdo3pnuDP0J4UuSymJbaNm7ocMYGGcxSerQWsknbb7te
ZiWBCJgKsY8DWdROqFdj2gJTwBhfV6fRwK/VonYUjNEbfb1h4JjjP83DMY/B+WvM
nQODGPYhqbTBthsiWOXUls+mBgkzh8Org/TkBZfOXbouk1m6Mlg6SPo3ePAF4qap
pRwIQSUSGhbrzZjb4roMiKfd2dlOTKm6e5OpY3w0CZcVqwJhOyC1cSwuBlo+wtHf
VCHhP36jHmzfCxxg8wIDAQABo1MwUTAdBgNVHQ4EFgQU1GRPb/N2ks2luKvb0Bbe
3l9nhCEwHwYDVR0jBBgwFoAU1GRPb/N2ks2luKvb0Bbe3l9nhCEwDwYDVR0TAQH/
BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAopJHQ4Tkwfmi9lpw0hLGaVIUOKqD
YCHMqDcJu5RUH7tWO3+Y3nrnruweBgnUdtXMYfwe74QvoJPNpZPDeC2vebbGPYy/
pFWyLw04+ud5wxgvhfekUg+LxiUzV5sfoeSsc8wzog/B0ttgz2zGBmEJYIhmosRj
dR5wxitK6N8bl9MQ/h3fA1PastxOimBTt46JIuX/p4OYh2CO6ltjIEVt2bFww6xc
jZGIL4VMAwEBafPT1irWCytGWQkJgALMVI1XpIXa3H3gEoWosMXQ7ZMPjlR6zZXv
XSs6bWArPniv7Fgq8DQZR/kx7nMO1fDBZeNjaxtDVwbZmDR30o/2EFybGQ==
-----END CERTIFICATE-----`;
const clientCertificate = `-----BEGIN CERTIFICATE-----
MIIDGjCCAgKgAwIBAgIUEf9dMh8uKYWXtNMtmuSTLVWToq8wDQYJKoZIhvcNAQEL
BQAwIzEhMB8GA1UEAwwYRG9ja2VyIENvbm5lY3RvciBUZXN0IENBMB4XDTI2MDgy
NTE4NTQzMloXDTM2MDgyMjE4NTQzMlowJzElMCMGA1UEAwwcRG9ja2VyIENvbm5l
Y3RvciBUZXN0IENsaWVudDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
APNBfYsQcmzNJgV5MxR+JQfc3Oza4nQarYwXTUL67sX15uQGINQekTqJBKM3X/Wu
1uTPYBSCwGPWMarN1PDYfDX6fCjdBNkOEqdC14FweBqJCixIoi2OGqSW1GGZT5pZ
9iusGFZ2l3yFOfnKtJsmodJh5NIncx33Ol80m7ZxbE9RXCdOr6nUYjvfP9nh1DCO
BNDIM0E5cnI/EW0BOyR8d4zftxw1ET9GhEROxi19/m00n7MeVCuqs/vncsFY/pmX
jnSv8PpY8ccXstDxN1JKd/lhM8UvvGse5vydM9IIVz9QdbaakMdBPwdFnOyVgLph
8AfjQZplzJF/T87dJJTD4AUCAwEAAaNCMEAwHQYDVR0OBBYEFEMRT9PC0PTVmpSh
Vg4YqCdmZaimMB8GA1UdIwQYMBaAFNRkT2/zdpLNpbir29AW3t5fZ4QhMA0GCSqG
SIb3DQEBCwUAA4IBAQCOyXYrIDhqIN7neOW4Wo/+OiuCT+mZEEcgdr+LPVLEM2AT
sqNzbVAgabW9pPscnvhh+KwPaw02LtysaETEFEAFPcn3DCbQof90+jINMXe1PLtW
ZIe9Z7I9YNk/zgWdnCnQcD0ecwxLuzrWOYp1TFYlza7BoMJBnE8sDhDQ1TiWZqP3
3GPjw3o320wQjMtPeyfL6cb3wZzpWtiE+1iZvWvn9AeYvuWtrfbbaLZkjya7PRJp
NxmxU2t1ChKMP1oMgaNPxHECANQvfsvPt7Hrbr4vwtoJ3iiisX3kEB7V/IQzaipy
O5jjwI0DfQDp+QoPVsVpxgMby4A8e+U0sfvFvpCX
-----END CERTIFICATE-----`;
const clientKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDzQX2LEHJszSYF
eTMUfiUH3Nzs2uJ0Gq2MF01C+u7F9ebkBiDUHpE6iQSjN1/1rtbkz2AUgsBj1jGq
zdTw2Hw1+nwo3QTZDhKnQteBcHgaiQosSKItjhqkltRhmU+aWfYrrBhWdpd8hTn5
yrSbJqHSYeTSJ3Md9zpfNJu2cWxPUVwnTq+p1GI73z/Z4dQwjgTQyDNBOXJyPxFt
ATskfHeM37ccNRE/RoRETsYtff5tNJ+zHlQrqrP753LBWP6Zl450r/D6WPHHF7LQ
8TdSSnf5YTPFL7xrHub8nTPSCFc/UHW2mpDHQT8HRZzslYC6YfAH40GaZcyRf0/O
3SSUw+AFAgMBAAECggEACfroRha8QXwZNz6sIQcb4qEZH06YdxL97WV3WGwn9IJz
B2y8JBFgLy3RihckUYjroCLLjYvfwNJxrzd93ECSUaFscdcl8vg01umGVfUuhRT7
3RB0NuvbNy18NGGwQzDo4w0CFdBy+DtIqaSIMsvFXKnpIJ+/UiQ2hnluE6O+23Il
z6/R/uXHnPqLTrrEd+Z80TeC1mDgLnoWjYhzXf4qVUYdo9uPSxM2Igvqpugfbq3Y
SuVAVkIIFoQRxk44aXht7rJsdrZuqi3O27NF2PE0A4wQ6SDKj8CWZXZFcvgsBQQJ
+dGLa0WSNrC9oVX0OcptPMWojWPfhvy/W777Fj+E8QKBgQD6XVPBVRP+enHxSBKP
meb5OChtCZvdqZx5nA1Nu3x90CNltNaxqZkYQ3nVc3C6ZrTn92bm8DoOwzcPfSG1
da6SpIH9G+mDiklLQt5LhQ0y+wzL1Ohkl0c0WeKSvG91J/c1ZyfEvWTqMPslq5aN
H4oy2qDd9Oaz707OvHyMANGp1wKBgQD4uzNdDH1Z+NL2s/a5GYg0hsUD4rc8CKDl
PSE82VqVjcYEvlBweLlD5Tdb2sSvAL2p89uG8ozop2wJno0sOdesmw5/wdM7TJqp
+2Z7bwiy6InBjPI3jojjVxtjzbFaZkC+uXGJY993FnKTY/8bioTPAAtsHZKVgUJB
pzcLF+zhgwKBgCp3Ifms4JNNWX4/Z0aMKC0lZVX5R0K1viCyY19H6bm9UAO0RKYl
yh3fdA7MYdZ8DTs7L20EWhSe7/vkkY8hwtaEqLexwE3basslMGdGzhJTmrwIBNLr
BdzPUirpY05P1RJtyMUKCs/eNvsQu5x8OQifJKIBJBBpCsjuF4H3sZhJAoGAJE1G
INV60g/T0nfPkZJdY7UrufZz4cosmWiDmlrqspsfhH+2Q8QK3hLtMnXKcPQ9ujlC
F/78e9Q7m2fNmN/UT3fN9O14A9aZWCe9/FPnRB1WRa5ph5xA9FU5RSa3NMdpuaxd
Gr091yaqkEJu8DkWSxPpltz2EOXtoqFiEjdqtjsCgYBgHguGPXZTx7A5j6i6NJ2D
eKPS8/0Y+ES6vwKCkmXD2qgkA4zzV9ifo6Qgd4KEiMwJYIg/VbHS+HNbWmF/TKwJ
tFPM91MrK4qDJXdk2TtZG+ckRid4qhv22JqqU84atR1LYdtEsCOoATdDSE7BWmaN
8/DZq1iQAJ7Q+OvkbP2SBQ==
-----END PRIVATE KEY-----`;
const otherKey = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDygJFH34qo/teA
kEGS4afIJanFIgm9+H/yeUDSmlOqtBfg/iff1NO72DSb3d1eOTE7ri3vjPalhVkt
5++4cWaq96ThZm3YqIbj6v3gxoRkdbIrTiwJhBPQrW4L9PlAUnzpWu6CUiPuG8G0
jZRxfD0bnCmus78fPUvXNn8mxFuy8I4Hz4NY2ToUI7J7NU/AayTv5xRgjjlOLSDw
30p0t2HYgNF+h6z90KX0UqE2YJIYUTrp/UDf+VNOa6/FAg65fkU7WuN9jAACmVmo
fqEjsO1Flycb5h8ytp4PzKZj3iDhqPPR152KBbdUK3AuD+mLy3tj5gs8UJ6nSi4C
dGF0qmPXAgMBAAECggEABddoUyg6BC10riQgxZOp9v2b7qO4mFrkD3MxnIvFzYGJ
Ebe4PiwM7aQc9aQ3240vzRWPsGA05h0liMri0Lk/6okMmmFdRAV15QeZa1CyNQ6g
vBT7T+oJOtLyqQG9qfmoCKGoHSYyt17zy5BILcj7BS890czX+GisQFg6YooDAMxp
SL1V1Lj69fYBCgRXGIrlurQ5thlbiBaKhADXP/YrevudvDnaLemJVtsmi2XjZch0
wJ6qCowrd3YW2y+xVI2im9BY1Zof3OU2b23YN7MeKhlM4Uoz05GbeknC2LJI4Vzv
kpkeKDbsjrB8l5I6TCJleYvvkSamMRnOqhYtwR78AQKBgQD9N099YhErj21I2lIS
ZLRRysvydmaqPnDyty67zroqjM2AKYDDuu843Y+mxFVcUyd/1cFfpkgKF3FcI1sC
Y54vXIcgp1w6ZdTCA67EhVZp9vvmDRcldBCWNsGaMQtKcuRVj1ejeOKdXO3ugCaq
wF8z1B8+WP+k7vTMSMHJWHs6mwKBgQD1Kxozd9bPjhHRaKn6Z3/A8Hb0/0dLXhoH
U4YVb+vLACvZku6FaFUByDIaP5hg2bovOplJPr1IoD0xseNJ6szDCnS8rsmyT9Y2
5B4weeu5YUmwo0gXgvTjUwEiSVfFaKK8mwleLNqLN7g3uViChQpJ8wHc7Y0wrfSO
ESDj5joBdQKBgQDmFITg2+PYHdniMaYTWnfSPh/0rwr4NAZzNGl9cwkLsqbjhlKf
BtNpa0Ck+o7JdjFU4ch0feXFbamuW93NHPFV/ZA25ntSAMdChxAdNz7ex/H5Bfn7
KSwNIbHmxhuJST4aVEYAns3iyNbVOJJp4qRetqaxAzM/DXVXzeBvcDuAcwKBgHHE
yqfPmLNALiyK8TXuCW6zJ8CRJbhntpRnwfT4tubA8ZhJgr4NqETnbbiYglGPN8Lq
4m8G2jd1hHAnKF4Iw3ROydU1FwvT2IgoW4oLScQAzX1WiAHBF3rV7dTHTB+jasEz
AKnfDptEBAx3ygbnTdr7FYY8BiTs1GuIr0aSc6BxAoGBAKX0pTpgx8K/kZMCumod
PTNaV6lEWbU/k4G3gvOq3lRZk8kQlW8nuVBrFKyfYrKkJt8CypsGhdl0ZFNqzxYv
N9aV5owttJC33RfXuZHBA9YiyGmp0oDnJbGB/ZmU8V9b8Zh1oGevL7eu3dO1Vvhp
uV9RvzrDH9LGs+J06G8UnxYn
-----END PRIVATE KEY-----`;

const validation = { caCertificateFingerprint: "ca", clientCertificateFingerprint: "client", clientCertificateSubject: "CN=client", clientCertificateIssuer: "CN=ca", clientCertificateValidFrom: "2026-01-01T00:00:00.000Z", clientCertificateValidTo: "2027-01-01T00:00:00.000Z" };
describe("Docker mutual-TLS profiles", () => {
  it("validates DNS, IPv4, IPv6, ports, and server names without accepting URL syntax", () => {
    expect(validateDockerTlsHost("docker.example.com")).toBe("docker.example.com"); expect(validateDockerTlsHost("192.0.2.10")).toBe("192.0.2.10"); expect(validateDockerTlsHost("2001:db8::10")).toBe("2001:db8::10");
    ["https://docker.example.com", "tcp://docker.example.com:2376", "user:pass@host", "/docker.sock"].forEach((value) => expect(() => validateDockerTlsHost(value)).toThrow());
    expect(validateDockerTlsPort(2376)).toBe(2376); expect(() => validateDockerTlsPort(0)).toThrow(); expect(() => validateDockerTlsServerName("https://host")).toThrow();
  });
  it("maps only safe TLS profile fields and preserves no certificate contents or passphrase", () => {
    const profile = createDockerTlsProfile({ id: "tls", name: "TLS", host: "docker.example.com", port: 2376, serverName: "docker.example.com", caCertificatePath: "/tmp/ca.pem", clientCertificatePath: "/tmp/client.pem", clientKeyPath: "/tmp/key.pem", validation, now: "2026-08-05T00:00:00.000Z" });
    expect(profile.connectionType).toBe("docker-tls"); const serialized = JSON.stringify(profile); ["BEGIN CERTIFICATE", "PRIVATE KEY", "passphrase", "password"].forEach((secret) => expect(serialized).not.toContain(secret));
  });
  it("keeps TLS client-key passphrases separate and runtime-only", () => { const store = new RuntimeCredentialStore(); store.setTlsClientKeyPassphrase("tls", "secret"); expect(store.getTlsClientKeyPassphrase("tls")).toBe("secret"); expect(JSON.stringify(store)).not.toContain("secret"); store.clearProfile("tls"); expect(store.getTlsClientKeyPassphrase("tls")).toBeUndefined(); });
  it("routes TLS profiles to the dedicated verified HTTPS transport", () => { const profile = createDockerTlsProfile({ id: "tls", name: "TLS", host: "docker.example.com", port: 2376, serverName: "docker.example.com", caCertificatePath: "/tmp/ca.pem", clientCertificatePath: "/tmp/client.pem", clientKeyPath: "/tmp/key.pem", validation, now: "2026-08-05T00:00:00.000Z" }); expect(new DockerConnectionFactory(() => ({ createDesktopTransport })).create(profile)).toBeInstanceOf(DockerMutualTlsTransport); });
  it("accepts a matching PEM certificate/key pair and rejects a different private key", async () => {
    const directory = await mkdtemp(join(tmpdir(), "docker-connector-tls-"));
    const caPath = join(directory, "ca.pem"), certificatePath = join(directory, "client.pem"), keyPath = join(directory, "client-key.pem"), otherKeyPath = join(directory, "other-key.pem");
    try {
      await Promise.all([writeFile(caPath, caCertificate), writeFile(certificatePath, clientCertificate), writeFile(keyPath, clientKey), writeFile(otherKeyPath, otherKey)]);
      await expect(validateDockerTlsFiles({ caCertificatePath: caPath, clientCertificatePath: certificatePath, clientKeyPath: keyPath })).resolves.toMatchObject({ clientCertificateSubject: "CN=Docker Connector Test Client" });
      await expect(validateDockerTlsFiles({ caCertificatePath: caPath, clientCertificatePath: certificatePath, clientKeyPath: otherKeyPath })).rejects.toMatchObject({ code: "DOCKER_TLS_CERT_KEY_MISMATCH", message: "The selected client certificate and private key do not form a matching pair." });
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
