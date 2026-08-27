import { describe, expect, it } from "vitest"; import { NetworkMapper } from "../src/networks/NetworkMapper"; import { selectNetworks } from "../src/networks/NetworkSelectors";
import { ContainerMapper } from "../src/containers/ContainerMapper";
describe("network attachment addresses",()=>{
  const raw = { Id: "c1", Names: ["/web"], Image: "repo/app:1", ImageID: "sha256:aa", State: "running", Status: "Up", Created: 1, Ports: [], Mounts: [], NetworkSettings: { Networks: { homelab: { IPAddress: "172.18.0.5", GlobalIPv6Address: "fd00::5", MacAddress: "02:42:ac:12:00:05" } } } };
  it("keeps the address each container reports for a network", () => {
    const container = ContainerMapper.summary(raw, "host");
    expect(container.networks[0]).toMatchObject({ name: "homelab", ipAddress: "172.18.0.5", globalIPv6Address: "fd00::5", macAddress: "02:42:ac:12:00:05" });
  });
  it("falls back to that address because Docker's network list omits Containers", () => {
    const network = NetworkMapper.summary({ Id: "n1", Name: "homelab", Driver: "bridge", Containers: {} }, "host", [ContainerMapper.summary(raw, "host")]);
    expect(network.containersAttached).toBe(1);
    expect(network.containers[0]).toMatchObject({ name: "web", ipv4: "172.18.0.5", ipv6: "fd00::5" });
  });
});
describe("NetworkMapper",()=>{it("detects only Docker built-ins and maps IPAM",()=>{const n=NetworkMapper.summary({Id:"abc",Name:"bridge",Driver:"bridge",IPAM:{Config:[{Subnet:"172.1.0.0/16",Gateway:"172.1.0.1"}]},Containers:{c:{Name:"web",IPv4Address:"172.1.0.2/16"}}},"h");expect(n.builtIn).toBe(true);expect(n.containersAttached).toBe(1);expect(n.gateways).toEqual(["172.1.0.1"]);});it("derives attached containers from the container snapshot when network lists omit Containers",()=>{const n=NetworkMapper.summary({Id:"front",Name:"frontend"},"h",[{id:"container-id",shortId:"container-id",names:["web"],displayName:"web",image:"nginx",createdAt:"",createdTimestamp:0,state:"running",statusText:"Up",health:"healthy",ports:[],mounts:[],networks:[{name:"frontend"}],labels:{},hostProfileId:"h",mapperWarnings:[]}]);expect(n.containersAttached).toBe(1);expect(n.containers[0]).toMatchObject({id:"container-id",name:"web",state:"running",health:"healthy"});});it("filters IPv6, user-defined, and unused networks",()=>{const used=NetworkMapper.summary({Name:"custom",EnableIPv6:true,Containers:{web:{Name:"web"}}},"h");const unused=NetworkMapper.summary({Name:"empty"},"h");expect(selectNetworks([used],"","ipv6",null,null)).toHaveLength(1);expect(selectNetworks([used],"","user-defined",null,null)).toHaveLength(1);expect(selectNetworks([used,unused],"","unused",null,null)).toEqual([unused]);});});
