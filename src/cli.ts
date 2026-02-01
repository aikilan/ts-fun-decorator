#!/usr/bin/env node
import ts from "typescript";
import path from "path";
import { preprocessFunctionDecorators, DecoratorInfo } from "./preprocess";
import { canonicalFileName } from "./pathUtils";
import { createFunctionDecoratorTransformer, type HoistMode } from "./transformer";

const tscArgs = process.argv.slice(2);

const parsed = ts.parseCommandLine(tscArgs);
if (parsed.errors.length > 0) {
  reportDiagnostics(parsed.errors);
  process.exit(1);
}

let fileNames = parsed.fileNames;
let options = parsed.options;

const configPath = options.project
  ? path.resolve(options.project)
  : ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");

let hoistMode: HoistMode | undefined;

if (configPath) {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    reportDiagnostics([configFile.error]);
    process.exit(1);
  }

  hoistMode = readHoistModeFromConfig(configFile.config);

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
    options,
    configPath
  );

  if (parsedConfig.errors.length > 0) {
    reportDiagnostics(parsedConfig.errors);
    process.exit(1);
  }

  fileNames = parsedConfig.fileNames;
  options = parsedConfig.options;
} else if (fileNames.length === 0) {
  ts.sys.write("fn-tsc: Cannot find a tsconfig.json and no input files were provided.\n");
  process.exit(1);
}

const decoratorsByFile = new Map<string, DecoratorInfo[]>();
const host = ts.createCompilerHost(options);
const originalGetSourceFile = host.getSourceFile.bind(host);

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

host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
  const text = host.readFile
    ? host.readFile(fileName)
    : ts.sys.readFile(fileName);

  if (text === undefined) {
    return originalGetSourceFile(
      fileName,
      languageVersion,
      onError,
      shouldCreateNewSourceFile
    );
  }

  if (!shouldProcessFile(fileName) || !text.includes("@")) {
    return ts.createSourceFile(
      fileName,
      text,
      languageVersion,
      true,
      getScriptKindFromFileName(fileName)
    );
  }

  const result = preprocessFunctionDecorators(text, ts, {
    languageVariant: getLanguageVariantFromFileName(fileName)
  });
  if (result.decorators.length > 0) {
    decoratorsByFile.set(canonicalFileName(fileName, ts), result.decorators);
  }

  return ts.createSourceFile(
    fileName,
    result.text,
    languageVersion,
    true,
    getScriptKindFromFileName(fileName)
  );
};

const program = ts.createProgram(fileNames, options, host);
const emitResult = program.emit(undefined, undefined, undefined, undefined, {
  before: [
    createFunctionDecoratorTransformer(
      program,
      { decoratorsByFile, hoistMode },
      ts
    )
  ]
});

const diagnostics = ts
  .getPreEmitDiagnostics(program)
  .concat(emitResult.diagnostics);

reportDiagnostics(diagnostics);
process.exit(emitResult.emitSkipped ? 1 : 0);

function reportDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  if (diagnostics.length === 0) {
    return;
  }

  const host: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => ts.sys.newLine
  };

  ts.sys.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, host));
}

function getScriptKindFromFileName(fileName: string): ts.ScriptKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tsx")) {
    return ts.ScriptKind.TSX;
  }
  if (lower.endsWith(".ts") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return ts.ScriptKind.TS;
  }
  if (lower.endsWith(".jsx")) {
    return ts.ScriptKind.JSX;
  }
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return ts.ScriptKind.JS;
  }
  if (lower.endsWith(".json")) {
    return ts.ScriptKind.JSON;
  }
  return ts.ScriptKind.Unknown;
}

function getLanguageVariantFromFileName(fileName: string): ts.LanguageVariant {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx")) {
    return ts.LanguageVariant.JSX;
  }
  return ts.LanguageVariant.Standard;
}

function readHoistModeFromConfig(config: unknown): HoistMode | undefined {
  if (!config || typeof config !== "object") {
    return undefined;
  }

  const record = config as Record<string, unknown>;
  const direct = record["ts-fun-decorator"];
  const legacyFunction = record["ts-function-decorator"];
  const legacy = record.functionDecorator;
  const section =
    direct && typeof direct === "object"
      ? (direct as Record<string, unknown>)
      : legacyFunction && typeof legacyFunction === "object"
      ? (legacyFunction as Record<string, unknown>)
      : legacy && typeof legacy === "object"
      ? (legacy as Record<string, unknown>)
      : undefined;

  if (!section) {
    return undefined;
  }

  const value = section.hoistMode;
  if (value === "lazy" || value === "eager") {
    return value;
  }
  return undefined;
}
