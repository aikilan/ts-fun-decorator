import {
  createAsyncDecorator,
  createDecorator,
  mapReturn,
  mapReturnAsync
} from "ts-fun-decorator/runtime";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const forceArgs = createDecorator<(a: number, b: number) => number>((next) =>
  next.withArgs(2, 3)
);

@forceArgs
export function add(a: number, b: number) {
  return a + b;
}

export const doubleReturn = mapReturn<(value: number) => number, number>((value) =>
  value * 2
);

@doubleReturn
export function identity(value: number) {
  return value;
}

export const asyncPlusTen = createAsyncDecorator<
  (a: number, b: number) => Promise<number>,
  number
>(async (next) => {
  await delay(10);
  const result = await next();
  return result + 10;
});

@asyncPlusTen
export async function addAsync(a: number, b: number) {
  return a + b;
}

export const labelAsync = mapReturnAsync<
  () => Promise<number>,
  string
>((value) => `value:${value}`);

@labelAsync
export async function fetchValue() {
  await delay(5);
  return 3;
}

export const bindThis = createDecorator<(this: { prefix: string }, name: string) => string>(
  (next) => next.withThis({ prefix: "Hello" }, "World")
);

@bindThis
export function greet(this: { prefix: string }, name: string) {
  return `${this.prefix} ${name}`;
}

export async function runDecoratorTests() {
  const withArgsResult = add(100, 200);
  const returnResult = identity(5);
  const asyncResult = await addAsync(1, 2);
  const asyncReturnResult = await fetchValue();
  const withThisResult = greet.call({ prefix: "Ignored" }, "Ignored");

  return {
    withArgsResult,
    returnResult,
    asyncResult,
    asyncReturnResult,
    withThisResult
  };
}
