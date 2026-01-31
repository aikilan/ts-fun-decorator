import type ts from "typescript";
import tsModule from "typescript";
import path from "path";

export function canonicalFileName(
  fileName: string,
  tsImpl: typeof ts = tsModule
): string {
  const resolved = tsImpl.sys.resolvePath
    ? tsImpl.sys.resolvePath(fileName)
    : path.resolve(fileName);
  const normalized = resolved.replace(/\\/g, "/");

  return tsImpl.sys.useCaseSensitiveFileNames
    ? normalized
    : normalized.toLowerCase();
}
