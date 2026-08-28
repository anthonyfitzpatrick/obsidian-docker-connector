import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["main.js", "dist/**", "node_modules/**", "docs/**", "*.mjs", "*.mts", "tools/**"] },
  ...tseslint.configs.recommendedTypeChecked,
  // The same rules the Obsidian plugin check runs, so its findings
  // surface here and in CI rather than after a release.
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // A leading underscore marks a binding that exists to be discarded: an
      // interface parameter this implementation ignores, or a destructured
      // field pulled out only so the rest spread omits it.
      // Every async method here returns a Promise to satisfy a contract: a
      // DockerTransport method, an Obsidian ItemView hook, or a callback whose
      // caller awaits it. Dropping async to please the rule would turn a
      // rejection into a synchronous throw, which is the worse behaviour.
      "@typescript-eslint/require-await": "off",
      // "Docker" is a product name, not a capitalisation slip. The four
      // connection methods and the two SSH authentication types are this
      // plugin's own proper names: they appear in the README, the User Guide,
      // the reference docs, the connection cards and the screenshots, so they
      // keep their casing and sentence case applies to the rest of the string.
      "obsidianmd/ui/sentence-case": ["warn", {
        brands: ["Docker", "Docker Connector", "Docker Context", "Docker Engine", "Docker Hub", "Obsidian", "Windows", "Linux", "macOS", "Unix",
          "Local Docker Socket", "Remote Docker via SSH", "Remote Docker API (Mutual TLS)"],
        acronyms: ["SSH", "TLS", "API", "CLI", "URL", "ID", "IPv4", "IPv6", "TCP", "HTTP", "CA", "OS"],
      }],
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
);
