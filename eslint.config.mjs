// Minimal gate: catch undefined identifiers (the bug class that build checks miss).
export default [
  {
    files: ["app/page.js", "lib/*.js"],
    languageOptions: {
      ecmaVersion: "latest", sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { window: "readonly", document: "readonly", navigator: "readonly", localStorage: "readonly",
                 setTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly", clearTimeout: "readonly",
                 console: "readonly", URLSearchParams: "readonly", Buffer: "readonly", fetch: "readonly" },
    },
    rules: { "no-undef": "error" },
  },
];
