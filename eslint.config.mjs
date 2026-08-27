import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["main.js", "dist/**", "node_modules/**", "docs/**", "*.mjs"] },
  ...tseslint.configs.recommendedTypeChecked,
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
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
);
