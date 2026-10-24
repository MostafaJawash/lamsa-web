import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Modules that must never reach the browser. `server-only` already fails the build
 * when one of them is imported from a client component; this rule catches it earlier,
 * in the editor. ESLint cannot follow the client boundary through imports, so it only
 * checks files that start with "use client" themselves. Type-only imports are allowed.
 */
const SERVER_ONLY_IMPORTS = [
  /^server-only$/,
  /^next\/headers$/,
  /^@\/lib\/api(\/|$)/,
  /^@\/lib\/auth(\/|$)/,
  /^@\/lib\/env$/,
  // `actions.ts` ("use server") is meant to be imported by client components; queries are not.
  /^@\/features\/[^/]+\/queries$/,
];

/** @type {import("eslint").Rule.RuleModule} */
const noServerImportsInClient = {
  meta: {
    type: "problem",
    docs: { description: 'Forbid server-only modules in "use client" files' },
    messages: {
      forbidden:
        '"{{source}}" is server-only and cannot be imported from a "use client" file. Call it from a server component, server action or route handler instead.',
    },
    schema: [],
  },
  create(context) {
    const body = context.sourceCode.ast.body;
    const isClient = body.some(
      (node) =>
        node.type === "ExpressionStatement" && node.directive === "use client",
    );
    if (!isClient) return {};
    const check = (node) => {
      if (node.importKind === "type" || node.exportKind === "type") return;
      const source = node.source && node.source.value;
      if (
        typeof source === "string" &&
        SERVER_ONLY_IMPORTS.some((re) => re.test(source))
      ) {
        context.report({ node, messageId: "forbidden", data: { source } });
      }
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      lamsa: {
        rules: { "no-server-imports-in-client": noServerImportsInClient },
      },
    },
    rules: {
      "lamsa/no-server-imports-in-client": "error",
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated / reports
    "src/lib/api/schema.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
