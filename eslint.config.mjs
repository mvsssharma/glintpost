import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Allow unused parameters that start with _ (e.g. useFormState callbacks)
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build artifacts of scripts/build-widgets.mjs. The `widgets/` sources are
    // linted instead; the bundled output is not editable by hand and its shape
    // is esbuild's (e.g. the es2017 target downlevels `catch {}` to an unused
    // `catch (e) {}`, which would otherwise warn on every build).
    "public/announcement-widget.js",
    "public/changelog-widget.js",
    "public/glintpost-targeting.js",
  ]),
]);

export default eslintConfig;
