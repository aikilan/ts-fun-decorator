import type ts from "typescript";
import tsModule from "typescript";

export interface DecoratorInfo {
  pos: number;
  end: number;
  exprText: string;
}

export interface PreprocessResult {
  text: string;
  decorators: DecoratorInfo[];
}

export interface PreprocessOptions {
  languageVariant?: ts.LanguageVariant;
}

export function preprocessFunctionDecorators(
  text: string,
  tsImpl: typeof ts = tsModule,
  options: PreprocessOptions = {}
): PreprocessResult {
  const decorators: DecoratorInfo[] = [];
  const languageVariant =
    options.languageVariant ?? tsImpl.LanguageVariant.Standard;
  const atPositions = scanAtTokenPositions(text, tsImpl, languageVariant);
  let nextStart = 0;

  for (let index = 0; index < atPositions.length; index++) {
    const pos = atPositions[index];
    if (pos < nextStart) {
      continue;
    }
    if (!isLineStart(text, pos)) {
      continue;
    }

    const group = scanDecoratorGroup(text, pos, tsImpl, languageVariant);
    if (group.appliesToFunction) {
      decorators.push(...group.decorators);
    }

    nextStart = Math.max(pos + 1, group.afterPos);
  }

  if (decorators.length === 0) {
    return { text, decorators };
  }

  const chars = text.split("");
  for (const decorator of decorators) {
    const end = Math.min(decorator.end, chars.length);
    for (let i = decorator.pos; i < end; i++) {
      const ch = chars[i];
      if (ch !== "\n" && ch !== "\r") {
        chars[i] = " ";
      }
    }
  }

  return { text: chars.join(""), decorators };
}

interface DecoratorGroup {
  decorators: DecoratorInfo[];
  afterPos: number;
  appliesToFunction: boolean;
}

function scanDecoratorGroup(
  text: string,
  atPos: number,
  tsImpl: typeof ts,
  languageVariant: ts.LanguageVariant
): DecoratorGroup {
  const decorators: DecoratorInfo[] = [];
  let currentPos = atPos;
  let afterPos = atPos + 1;

  while (true) {
    const info = scanDecoratorExpression(
      text,
      currentPos,
      tsImpl,
      languageVariant
    );
    if (info.exprText.length > 0) {
      decorators.push(info);
      afterPos = info.end;
    } else {
      afterPos = Math.max(afterPos, info.end);
    }

    const nextToken = peekTokenAt(text, afterPos, tsImpl, languageVariant);
    if (nextToken.kind === tsImpl.SyntaxKind.AtToken) {
      currentPos = nextToken.pos;
      continue;
    }

    break;
  }

  const appliesToFunction =
    decorators.length > 0 &&
    looksLikeFunctionTarget(text, afterPos, tsImpl, languageVariant);

  return {
    decorators,
    afterPos,
    appliesToFunction
  };
}

interface TokenInfo {
  kind: ts.SyntaxKind;
  pos: number;
}

function peekTokenAt(
  text: string,
  pos: number,
  tsImpl: typeof ts,
  languageVariant: ts.LanguageVariant
): TokenInfo {
  const scanner = tsImpl.createScanner(
    tsImpl.ScriptTarget.Latest,
    true,
    languageVariant,
    text
  );
  scanner.setTextPos(pos);
  const kind = scanner.scan();
  return { kind, pos: scanner.getTokenPos() };
}

function scanDecoratorExpression(
  text: string,
  atPos: number,
  tsImpl: typeof ts,
  languageVariant: ts.LanguageVariant
): DecoratorInfo {
  const scanner = tsImpl.createScanner(
    tsImpl.ScriptTarget.Latest,
    true,
    languageVariant,
    text
  );

  scanner.setTextPos(atPos + 1);
  let token = scanner.scan();
  if (token === tsImpl.SyntaxKind.EndOfFileToken) {
    return { pos: atPos, end: atPos + 1, exprText: "" };
  }

  const exprStart = scanner.getTokenPos();
  let lastTokenEnd = scanner.getTextPos();

  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;

  updateDepth(token, tsImpl, (deltaParen, deltaBracket, deltaBrace) => {
    depthParen += deltaParen;
    depthBracket += deltaBracket;
    depthBrace += deltaBrace;
  });

  while (true) {
    const next = scanner.scan();
    if (next === tsImpl.SyntaxKind.EndOfFileToken) {
      break;
    }

    if (depthParen === 0 && depthBracket === 0 && depthBrace === 0) {
      if (scanner.hasPrecedingLineBreak()) {
        break;
      }

      if (isTerminatorToken(next, tsImpl)) {
        break;
      }
    }

    updateDepth(next, tsImpl, (deltaParen, deltaBracket, deltaBrace) => {
      depthParen += deltaParen;
      depthBracket += deltaBracket;
      depthBrace += deltaBrace;
    });

    lastTokenEnd = scanner.getTextPos();
  }

  const exprText = text.slice(exprStart, lastTokenEnd).trim();
  return { pos: atPos, end: lastTokenEnd, exprText };
}

function updateDepth(
  token: ts.SyntaxKind,
  tsImpl: typeof ts,
  update: (deltaParen: number, deltaBracket: number, deltaBrace: number) => void
): void {
  switch (token) {
    case tsImpl.SyntaxKind.OpenParenToken:
      update(1, 0, 0);
      break;
    case tsImpl.SyntaxKind.CloseParenToken:
      update(-1, 0, 0);
      break;
    case tsImpl.SyntaxKind.OpenBracketToken:
      update(0, 1, 0);
      break;
    case tsImpl.SyntaxKind.CloseBracketToken:
      update(0, -1, 0);
      break;
    case tsImpl.SyntaxKind.OpenBraceToken:
      update(0, 0, 1);
      break;
    case tsImpl.SyntaxKind.CloseBraceToken:
      update(0, 0, -1);
      break;
    default:
      break;
  }
}

function isTerminatorToken(token: ts.SyntaxKind, tsImpl: typeof ts): boolean {
  switch (token) {
    case tsImpl.SyntaxKind.ExportKeyword:
    case tsImpl.SyntaxKind.DefaultKeyword:
    case tsImpl.SyntaxKind.DeclareKeyword:
    case tsImpl.SyntaxKind.FunctionKeyword:
    case tsImpl.SyntaxKind.ClassKeyword:
    case tsImpl.SyntaxKind.InterfaceKeyword:
    case tsImpl.SyntaxKind.TypeKeyword:
    case tsImpl.SyntaxKind.EnumKeyword:
    case tsImpl.SyntaxKind.ConstKeyword:
    case tsImpl.SyntaxKind.LetKeyword:
    case tsImpl.SyntaxKind.VarKeyword:
      return true;
    default:
      return false;
  }
}

function looksLikeFunctionTarget(
  text: string,
  pos: number,
  tsImpl: typeof ts,
  languageVariant: ts.LanguageVariant
): boolean {
  const scanner = tsImpl.createScanner(
    tsImpl.ScriptTarget.Latest,
    true,
    languageVariant,
    text
  );
  scanner.setTextPos(pos);

  let token = scanner.scan();
  let sawModifier = true;

  while (sawModifier) {
    sawModifier = false;
    switch (token) {
      case tsImpl.SyntaxKind.ExportKeyword:
      case tsImpl.SyntaxKind.DefaultKeyword:
      case tsImpl.SyntaxKind.DeclareKeyword:
        token = scanner.scan();
        sawModifier = true;
        break;
      case tsImpl.SyntaxKind.AsyncKeyword:
        token = scanner.scan();
        sawModifier = true;
        break;
      default:
        break;
    }
  }

  return (
    token === tsImpl.SyntaxKind.FunctionKeyword ||
    token === tsImpl.SyntaxKind.ConstKeyword ||
    token === tsImpl.SyntaxKind.LetKeyword ||
    token === tsImpl.SyntaxKind.VarKeyword
  );
}

function scanAtTokenPositions(
  text: string,
  tsImpl: typeof ts,
  languageVariant: ts.LanguageVariant
): number[] {
  const scanner = tsImpl.createScanner(
    tsImpl.ScriptTarget.Latest,
    true,
    languageVariant,
    text
  );

  const positions: number[] = [];
  let token = scanner.scan();
  let inTemplate = false;

  while (token !== tsImpl.SyntaxKind.EndOfFileToken) {
    if (token === tsImpl.SyntaxKind.AtToken) {
      positions.push(scanner.getTokenPos());
    }

    switch (token) {
      case tsImpl.SyntaxKind.NoSubstitutionTemplateLiteral:
      case tsImpl.SyntaxKind.TemplateTail:
        inTemplate = false;
        break;
      case tsImpl.SyntaxKind.TemplateHead:
      case tsImpl.SyntaxKind.TemplateMiddle:
        inTemplate = true;
        break;
      case tsImpl.SyntaxKind.CloseBraceToken:
        if (inTemplate) {
          token = scanner.reScanTemplateToken(false);
          continue;
        }
        break;
      default:
        break;
    }

    token = scanner.scan();
  }
  return positions;
}

function isLineStart(text: string, pos: number): boolean {
  let index = pos - 1;
  while (index >= 0) {
    const ch = text[index];
    if (ch === "\n" || ch === "\r") {
      return true;
    }
    if (ch !== " " && ch !== "\t") {
      return false;
    }
    index -= 1;
  }
  return true;
}
