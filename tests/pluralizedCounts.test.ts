import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { pluralize } from "../src/ui/pluralize";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("inventory counts", () => {
  it("uses the singular noun for exactly one item", () => {
    expect(pluralize(1, "container")).toBe("1 container");
    expect(pluralize(0, "container")).toBe("0 containers");
    expect(pluralize(2, "container")).toBe("2 containers");
    expect(pluralize(1, "entry", "entries")).toBe("1 entry");
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
  });

  it("routes every inventory count through the shared helper", () => {
    for (const path of ["src/containers/ContainersTab.ts", "src/images/ImagesTab.ts", "src/volumes/VolumesTab.ts", "src/networks/NetworksTab.ts", "src/applications/ApplicationsTab.ts"]) {
      const tab = source(path);
      expect(tab, path).toContain('from "../ui/pluralize"');
      expect(tab, path).not.toMatch(/\$\{[^}]*\} (?:containers|restarts|volumes|images|networks|applications)`/);
      expect(tab, path).not.toContain("function pluralize(");
    }
  });
});
