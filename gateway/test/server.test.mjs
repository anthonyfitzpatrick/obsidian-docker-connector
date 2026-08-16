import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createGateway, dockerPath } from "../server.mjs";

test("gateway accepts only authenticated fixed GET routes", async () => {
  const token = "a".repeat(48); const server = createGateway({ token, dockerRequest: async (path) => ({ status: 200, body: JSON.stringify({ path }) }) }); server.listen(); await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${url}/v1/info`)).status, 401);
  assert.deepEqual(await (await fetch(`${url}/v1/containers/abc_123`, { headers: { Authorization: `Bearer ${token}` } })).json(), { path: "/containers/abc_123/json" });
  assert.equal((await fetch(`${url}/v1/proxy`, { headers: { Authorization: `Bearer ${token}` } })).status, 404);
  assert.equal((await fetch(`${url}/v1/info`, { method: "POST", headers: { Authorization: `Bearer ${token}` } })).status, 405);
  await new Promise((resolve) => server.close(resolve));
});
test("gateway rejects unsafe identifiers", () => { assert.equal(dockerPath("/v1/containers/%2Fetc"), undefined); });
