# ts-function-decorator

TypeScript plugin to allow decorator syntax on free functions (Python-style), compiled into runtime wrapper calls.

Decorators are treated as runtime wrappers that can change function behavior.

## Quickstart

1) Editor plugin (tsserver)

Add to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "ts-function-decorator" }]
  }
}
```

2) Build (CLI)

```bash
npm run build
node dist/cli.js -p tsconfig.json
```

Or, when installed as a dependency:

```bash
npx fn-tsc -p tsconfig.json
```

3) Vite (dev/build)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { functionDecoratorPlugin } from "ts-fun-decorator/vite";

export default defineConfig({
  plugins: [functionDecoratorPlugin(), react()]
});
```

4) Example project

A ready-to-run Vite + React + TSX example lives at:

```
examples/react-vite
```

Run it:

```bash
cd examples/react-vite
npm install
npm run dev
```

## Example

Basic decorator usage:

```ts
@log
@memoize(100)
export function add(a: number, b: number) {
  return a + b;
}

@once
const init = () => {
  // ...
};
```

Emits (conceptually):

```ts
export function add(a, b) { /* wrapper */ }
// wrapper lazily initializes: __decorated_add = log(memoize(100)(function (a, b) { return a + b; }));
const init = once(() => { /* ... */ });
```

Runtime helper API (strong typing, with args/this, return mapping, async chain):

```ts
import {
  createDecorator,
  createAsyncDecorator,
  mapReturn,
  mapReturnAsync,
  type DecoratorContext
} from "ts-fun-decorator/runtime";

const log = createDecorator((next, ctx) => {
  console.log("[log]", ctx.name, ctx.args);
  const result = next();
  console.log("[log] =>", result);
  return result;
});

const forceArgs = createDecorator<(a: number, b: number) => number>((next) =>
  next.withArgs(2, 3)
);

const doubleReturn = mapReturn<(value: number) => number, number>((value) => value * 2);

const asyncPlusTen = createAsyncDecorator<
  (a: number, b: number) => Promise<number>,
  number
>(async (next) => {
  const result = await next();
  return result + 10;
});
```

## API docs

### Runtime helpers (`ts-fun-decorator/runtime`)

- `createDecorator(handler)`:
  - `handler(next, ctx) => R`
  - `next()` calls original function
  - `next.withArgs(...)` calls original with new args
  - `next.withThis(thisArg, ...args)` calls original with new this/args
- `createAsyncDecorator(handler)`:
  - `handler(next, ctx) => Promise<R>`
  - `await next()` for async chains
- `mapReturn(mapper)`:
  - maps the original return value
- `mapReturnAsync(mapper)`:
  - maps an awaited return value
- `DecoratorContext<T>`:
  - `{ name, args, thisArg, original, callOriginal }`

### Vite plugin (`ts-fun-decorator/vite`)

```ts
functionDecoratorPlugin({
  include?: RegExp | ((id: string) => boolean),
  exclude?: RegExp | ((id: string) => boolean),
  hoistMode?: "lazy" | "eager",
  compilerOptions?: ts.CompilerOptions,
  sourceMap?: boolean
})
```

### CLI config (`fn-tsc`)

Add to `tsconfig.json`:

```json
{
  "ts-fun-decorator": {
    "hoistMode": "eager"
  }
}
```

### Hoist mode

- `"lazy"` (default): preserves call-before-declaration behavior.
- `"eager"`: initializes the decorator wrapper immediately; call-before-declaration is not preserved.

### Supported targets

- `@decorator` above function declarations.
- `@decorator` above variable statements with a single declaration whose initializer is an arrow/function expression.

### Limitations / Notes

- Function declarations keep hoisting with lazy mode.
- One declaration per decorated `const/let/var` statement.
- Decorators should be written on their own line immediately above the function/variable.
- Decorator expressions are parsed as-is; `@dec` and `@dec(...)` are supported.
- This does not validate purity or side effects; it only rewrites syntax.
- JSX warning: in TSX, only line-start `@` (after whitespace) is treated as a decorator. If your JSX text literally starts with `@`, wrap it like `{"@"}` or prefix it with other text to avoid being masked.

## Project structure

- `src/preprocess.ts`: scans and masks function decorators.
- `src/index.ts`: tsserver plugin entry.
- `src/transformer.ts`: emit-time wrapper transformation.
- `src/cli.ts`: build wrapper that preprocesses before TypeScript parses.
