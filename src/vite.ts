import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import { preprocessFunctionDecorators } from "./preprocess";
import { canonicalFileName } from "./pathUtils";
import { createFunctionDecoratorTransformer, type HoistMode } from "./transformer";

interface Plugin {
  name: string;
  enforce?: "pre" | "post";
  config?: (...args: any[]) => any;
  configResolved?: (...args: any[]) => any;
  transform?: (...args: any[]) => any;
}

export interface FunctionDecoratorVitePluginOptions {
  include?: RegExp | ((id: string) => boolean);
  exclude?: RegExp | ((id: string) => boolean);
  hoistMode?: HoistMode;
  compilerOptions?: ts.CompilerOptions;
  sourceMap?: boolean;
}

const dummyProgram = ts.createProgram([], {
  target: ts.ScriptTarget.ESNext,
  jsx: ts.JsxEmit.Preserve
});

const legacyPackageName = "ts-function-decorator";
let legacyCheckDone = false;

function warnIfLegacyPackage(root: string): void {
  if (legacyCheckDone) {
    return;
  }
  legacyCheckDone = true;

  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return;
  }

  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return;
  }

  const sections = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ];

  for (const section of sections) {
    if (pkg?.[section]?.[legacyPackageName]) {
      console.warn(
        `[ts-fun-decorator] Detected legacy package "${legacyPackageName}" in ${section}. ` +
          `Please update dependencies and replace imports/tsconfig plugin name with "ts-fun-decorator".`
      );
      break;
    }
  }
}

export function functionDecoratorPlugin(
  options: FunctionDecoratorVitePluginOptions = {}
): Plugin {
  let resolvedRoot: string | undefined;

  return {
    name: "ts-fun-decorator",
    enforce: "pre",
    configResolved(config: { root?: string }) {
      resolvedRoot = config?.root;
      warnIfLegacyPackage(resolvedRoot ?? process.cwd());
    },
    config(_config: any, env?: { command?: string }) {
      if (env?.command && env.command !== "serve") {
        return;
      }

      return {
        optimizeDeps: {
          esbuildOptions: {
            plugins: [createOptimizeDepsPlugin()]
          }
        }
      };
    },
    transform(code: string, id: string) {
      if (!legacyCheckDone) {
        warnIfLegacyPackage(resolvedRoot ?? process.cwd());
      }

      if (id.startsWith("\0")) {
        return null;
      }

      const rawId = id.split("?")[0];
      const fsId = rawId.startsWith("/@fs/") ? rawId.slice(5) : rawId;
      const normalizedId = fsId.replace(/\\/g, "/");

      if (normalizedId.includes("/node_modules/")) return null;
      if (options.exclude && matchesFilter(options.exclude, normalizedId)) return null;
      if (options.include && !matchesFilter(options.include, normalizedId)) return null;
      if (!normalizedId.endsWith(".ts") && !normalizedId.endsWith(".tsx")) return null;
      if (normalizedId.endsWith(".d.ts")) return null;
      if (!code.includes("@")) return null;

      const isTsx = normalizedId.endsWith(".tsx");
      const result = preprocessFunctionDecorators(code, ts, {
        languageVariant: isTsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard
      });
      if (result.decorators.length === 0) return null;

      const decoratorsByFile = new Map<string, typeof result.decorators>();
      decoratorsByFile.set(canonicalFileName(fsId, ts), result.decorators);

      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        ...options.compilerOptions,
        jsx:
          options.compilerOptions?.jsx ??
          (isTsx ? ts.JsxEmit.Preserve : ts.JsxEmit.None),
        sourceMap: options.sourceMap ?? true
      };

      const transpiled = ts.transpileModule(result.text, {
        fileName: fsId,
        compilerOptions,
        transformers: {
          before: [
            createFunctionDecoratorTransformer(
              dummyProgram,
              { decoratorsByFile, hoistMode: options.hoistMode },
              ts
            )
          ]
        }
      });

      return {
        code: transpiled.outputText,
        map: transpiled.sourceMapText
          ? JSON.parse(transpiled.sourceMapText)
          : null
      };
    }
  };
}

export default functionDecoratorPlugin;

function matchesFilter(
  filter: RegExp | ((id: string) => boolean),
  id: string
): boolean {
  return filter instanceof RegExp ? filter.test(id) : filter(id);
}

function createOptimizeDepsPlugin(): {
  name: string;
  setup: (build: any) => void;
} {
  return {
    name: "ts-fun-decorator-optimize-deps",
    setup(build) {
      const filter = /\.(ts|tsx|mts|cts)$/;
      build.onLoad({ filter }, (args: { path: string }) => {
        const normalizedId = args.path.replace(/\\/g, "/");
        if (normalizedId.includes("/node_modules/")) {
          return null;
        }

        let code: string;
        try {
          code = fs.readFileSync(args.path, "utf8");
        } catch {
          return null;
        }

        if (!code.includes("@")) {
          return null;
        }

        const isTsx = normalizedId.endsWith(".tsx");
        const result = preprocessFunctionDecorators(code, ts, {
          languageVariant: isTsx ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard
        });
        if (result.decorators.length === 0) {
          return null;
        }

        return {
          contents: result.text,
          loader: isTsx ? "tsx" : "ts",
          resolveDir: path.dirname(args.path)
        };
      });
    }
  };
}
