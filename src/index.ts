import type ts from "typescript/lib/tsserverlibrary";
import { preprocessFunctionDecorators, DecoratorInfo } from "./preprocess";
import { canonicalFileName } from "./pathUtils";

const pluginFactory: ts.server.PluginModuleFactory = (modules) => {
  const ts = modules.typescript;

  function shouldProcessFile(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    if (
      lower.endsWith(".d.ts") ||
      lower.endsWith(".d.mts") ||
      lower.endsWith(".d.cts")
    ) {
      return false;
    }

    return (
      lower.endsWith(".ts") ||
      lower.endsWith(".tsx") ||
      lower.endsWith(".mts") ||
      lower.endsWith(".cts")
    );
  }

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const host = info.languageServiceHost;
    const originalGetScriptSnapshot = host.getScriptSnapshot?.bind(host);
    const decoratorRangesByFile = new Map<string, DecoratorInfo[]>();

    if (originalGetScriptSnapshot) {
      host.getScriptSnapshot = (fileName: string) => {
        const snapshot = originalGetScriptSnapshot(fileName);
        if (!snapshot || !shouldProcessFile(fileName)) {
          return snapshot;
        }

        const text = snapshot.getText(0, snapshot.getLength());
        if (!text.includes("@")) {
          return snapshot;
        }

        const result = preprocessFunctionDecorators(text, ts, {
          languageVariant: getLanguageVariantFromFileName(fileName, ts)
        });
        if (result.decorators.length === 0) {
          decoratorRangesByFile.delete(canonicalFileName(fileName, ts));
          return snapshot;
        }

        decoratorRangesByFile.set(
          canonicalFileName(fileName, ts),
          result.decorators
        );
        return ts.ScriptSnapshot.fromString(result.text);
      };
    }

    const languageService = info.languageService;
    const proxy: ts.LanguageService = Object.create(null);
    for (const key of Object.keys(languageService) as Array<keyof ts.LanguageService>) {
      const serviceItem = languageService[key];
      if (typeof serviceItem === "function") {
        (proxy as any)[key] = (...args: any[]) => (serviceItem as any).apply(languageService, args);
      } else {
        (proxy as any)[key] = serviceItem;
      }
    }

    const filterDiagnostics = <T extends ts.Diagnostic>(
      diagnostics: readonly T[],
      fileName?: string
    ): T[] => {
      if (!fileName) {
        return diagnostics.slice();
      }
      const ranges = decoratorRangesByFile.get(canonicalFileName(fileName, ts));
      if (!ranges || ranges.length === 0) {
        return diagnostics.slice();
      }
      return diagnostics.filter((diag) => {
        if (diag.code !== 1206) {
          return true;
        }
        if (typeof diag.start !== "number") {
          return true;
        }
        return !ranges.some((range) => diag.start! >= range.pos && diag.start! < range.end);
      });
    };

    proxy.getSyntacticDiagnostics = (fileName) =>
      filterDiagnostics(languageService.getSyntacticDiagnostics(fileName), fileName);
    proxy.getSemanticDiagnostics = (fileName) =>
      filterDiagnostics(languageService.getSemanticDiagnostics(fileName), fileName);
    proxy.getSuggestionDiagnostics = (fileName) =>
      filterDiagnostics(languageService.getSuggestionDiagnostics(fileName), fileName);

    return proxy;
  }

  return { create };
};

export = pluginFactory;

function getLanguageVariantFromFileName(
  fileName: string,
  tsImpl: typeof ts
): ts.LanguageVariant {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
    return tsImpl.LanguageVariant.JSX;
  }
  return tsImpl.LanguageVariant.Standard;
}
