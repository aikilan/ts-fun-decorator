import type ts from "typescript";
import tsModule from "typescript";
import { canonicalFileName } from "./pathUtils";
import { DecoratorInfo } from "./preprocess";

export interface TransformOptions {
  decoratorsByFile?: Map<string, DecoratorInfo[]>;
  hoistMode?: HoistMode;
}

export type HoistMode = "lazy" | "eager";

export function createFunctionDecoratorTransformer(
  program: ts.Program,
  options: TransformOptions = {},
  tsImpl: typeof ts = tsModule
): ts.TransformerFactory<ts.SourceFile> {
  return (context) => {
    const hoistMode: HoistMode = options.hoistMode ?? "lazy";
    const decoratorCache = new Map<string, ts.Expression>();

    const resetNodePositions = (node: ts.Node, tsLocal: typeof ts): void => {
      tsLocal.setTextRange(node, { pos: -1, end: -1 });
      tsLocal.forEachChild(node, (child) => resetNodePositions(child, tsLocal));
    };

    const parseDecoratorExpression = (exprText: string): ts.Expression => {
      const cached = decoratorCache.get(exprText);
      if (cached) {
        return cached;
      }

      const source = tsImpl.createSourceFile(
        "decorator.ts",
        `const __d = ${exprText};`,
        tsImpl.ScriptTarget.Latest,
        true,
        tsImpl.ScriptKind.TS
      );
      const statement = source.statements[0];
      if (statement && tsImpl.isVariableStatement(statement)) {
        const decl = statement.declarationList.declarations[0];
        if (decl && decl.initializer) {
          resetNodePositions(decl.initializer, tsImpl);
          decoratorCache.set(exprText, decl.initializer);
          return decl.initializer;
        }
      }

      const fallback = tsImpl.factory.createIdentifier(exprText);
      decoratorCache.set(exprText, fallback);
      return fallback;
    };

    const applyDecorators = (
      base: ts.Expression,
      decorators: DecoratorInfo[]
    ): ts.Expression => {
      let expr = base;
      for (let i = decorators.length - 1; i >= 0; i--) {
        const decoratorExpr = parseDecoratorExpression(decorators[i].exprText);
        expr = tsImpl.factory.createCallExpression(decoratorExpr, undefined, [expr]);
      }
      return expr;
    };

    return (sourceFile) => {
      const decorators = options.decoratorsByFile?.get(
        canonicalFileName(sourceFile.fileName, tsImpl)
      );
      if (!decorators || decorators.length === 0) {
        return sourceFile;
      }

      const getDecoratorsForNode = (node: ts.Node): DecoratorInfo[] => {
        const start = node.getFullStart();
        const end = node.getStart(sourceFile, false);
        const matches: DecoratorInfo[] = [];
        for (const decorator of decorators) {
          if (decorator.pos >= start && decorator.pos < end) {
            matches.push(decorator);
          }
        }
        return matches;
      };

      const filterAsyncModifier = (
        modifiers: ts.NodeArray<ts.ModifierLike> | undefined
      ): ts.Modifier[] | undefined => {
        if (!modifiers || modifiers.length === 0) {
          return undefined;
        }
        const asyncModifier = modifiers.find(
          (modifier) => modifier.kind === tsImpl.SyntaxKind.AsyncKeyword
        );
        return asyncModifier ? [asyncModifier] : undefined;
      };

      const transformFunctionDeclaration = (
        node: ts.FunctionDeclaration,
        decoratorList: DecoratorInfo[]
      ): ts.Statement[] => {
        if (!node.body) {
          return [node];
        }

        const updated = tsImpl.visitEachChild(node, visitor, context) as ts.FunctionDeclaration;
        if (!updated.body) {
          return [updated];
        }

        const nameText = updated.name?.text ?? "default";
        const cacheId = tsImpl.factory.createUniqueName(`__decorated_${nameText}_`);
        const cacheDecl = tsImpl.factory.createVariableStatement(
          undefined,
          tsImpl.factory.createVariableDeclarationList(
            [
              tsImpl.factory.createVariableDeclaration(
                cacheId,
                undefined,
                undefined,
                undefined
              )
            ],
            tsImpl.NodeFlags.None
          )
        );

        const cloneNode =
          (tsImpl.factory as { cloneNode?: (node: ts.Node) => ts.Node }).cloneNode ??
          ((node: ts.Node) => node);

        const clonedTypeParams = updated.typeParameters
          ? tsImpl.factory.createNodeArray(
              updated.typeParameters.map((tp) =>
                cloneNode(tp) as ts.TypeParameterDeclaration
              )
            )
          : undefined;
        const clonedParams = tsImpl.factory.createNodeArray(
          updated.parameters.map((param) => cloneNode(param) as ts.ParameterDeclaration)
        );

        const originalExpr = tsImpl.factory.createFunctionExpression(
          filterAsyncModifier(updated.modifiers),
          updated.asteriskToken,
          undefined,
          clonedTypeParams,
          clonedParams,
          updated.type ? (cloneNode(updated.type) as ts.TypeNode) : undefined,
          updated.body
        );

        const decoratedExpr = applyDecorators(originalExpr, decoratorList);
        const assignExpr = tsImpl.factory.createBinaryExpression(
          cacheId,
          tsImpl.SyntaxKind.EqualsToken,
          decoratedExpr
        );
        const initStatement = tsImpl.factory.createExpressionStatement(assignExpr);

        const returnStatement = tsImpl.factory.createReturnStatement(
          tsImpl.factory.createCallExpression(
            tsImpl.factory.createPropertyAccessExpression(cacheId, "apply"),
            undefined,
            [tsImpl.factory.createThis(), tsImpl.factory.createIdentifier("arguments")]
          )
        );

        const wrapperStatements: ts.Statement[] = [];
        if (hoistMode === "lazy") {
          const guard = tsImpl.factory.createBinaryExpression(
            cacheId,
            tsImpl.SyntaxKind.EqualsEqualsEqualsToken,
            tsImpl.factory.createVoidZero()
          );
          const ifStatement = tsImpl.factory.createIfStatement(
            guard,
            tsImpl.factory.createBlock([initStatement], true),
            undefined
          );
          wrapperStatements.push(ifStatement);
        }

        wrapperStatements.push(returnStatement);

        const wrapperBody = tsImpl.factory.createBlock(wrapperStatements, true);

        const wrapper = tsImpl.factory.updateFunctionDeclaration(
          updated,
          updated.modifiers,
          updated.asteriskToken,
          updated.name,
          updated.typeParameters,
          updated.parameters,
          updated.type,
          wrapperBody
        );

        if (hoistMode === "eager") {
          return [cacheDecl, initStatement, wrapper];
        }

        return [cacheDecl, wrapper];
      };

      const visitor: ts.Visitor = (node) => {
        if (tsImpl.isFunctionDeclaration(node)) {
          const decoratorList = getDecoratorsForNode(node);
          if (decoratorList.length > 0) {
            return transformFunctionDeclaration(node, decoratorList);
          }
          return tsImpl.visitEachChild(node, visitor, context);
        }

        if (tsImpl.isVariableStatement(node)) {
          const decoratorList = getDecoratorsForNode(node);
          if (decoratorList.length > 0) {
            const updated = tsImpl.visitEachChild(node, visitor, context) as ts.VariableStatement;
            const declList = updated.declarationList;
            if (declList.declarations.length !== 1) {
              return updated;
            }
            const decl = declList.declarations[0];
            const initializer = decl.initializer;
            if (
              !initializer ||
              (!tsImpl.isArrowFunction(initializer) && !tsImpl.isFunctionExpression(initializer))
            ) {
              return updated;
            }

            const decoratedInitializer = applyDecorators(initializer, decoratorList);
            const newDecl = tsImpl.factory.updateVariableDeclaration(
              decl,
              decl.name,
              decl.exclamationToken,
              decl.type,
              decoratedInitializer
            );
            const newDeclList = tsImpl.factory.updateVariableDeclarationList(
              declList,
              [newDecl]
            );
            return tsImpl.factory.updateVariableStatement(
              updated,
              updated.modifiers,
              newDeclList
            );
          }

          return tsImpl.visitEachChild(node, visitor, context);
        }

        return tsImpl.visitEachChild(node, visitor, context);
      };

      const transformedStatements: ts.Statement[] = [];
      for (const statement of sourceFile.statements) {
        if (tsImpl.isFunctionDeclaration(statement)) {
          const decoratorList = getDecoratorsForNode(statement);
          if (decoratorList.length > 0) {
            const result = transformFunctionDeclaration(statement, decoratorList);
            transformedStatements.push(...result);
            continue;
          }
        }

        transformedStatements.push(
          tsImpl.visitNode(statement, visitor) as ts.Statement
        );
      }

      return tsImpl.factory.updateSourceFile(sourceFile, transformedStatements);
    };
  };
}
