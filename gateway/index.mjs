import http from "node:http";
import { createGateway } from "./server.mjs";

const token = process.env.GATEWAY_TOKEN;
const socketPath = process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";
const dockerRequest = (path) => new Promise((resolve, reject) => {
  const request = http.request({ socketPath, path, method: "GET", timeout: 10_000 }, (response) => { const chunks = []; response.on("data", (chunk) => chunks.push(chunk)); response.on("end", () => resolve({ status: response.statusCode ?? 502, body: Buffer.concat(chunks).toString("utf8"), contentType: response.headers["content-type"] })); });
  request.on("error", reject); request.on("timeout", () => request.destroy(new Error("timeout"))); request.end();
});
const server = createGateway({ token, dockerRequest });
server.listen(Number(process.env.PORT ?? 8787), "0.0.0.0");
