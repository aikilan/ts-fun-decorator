export type AnyFn = (...args: any[]) => any;

export type DecoratedFunction<T extends AnyFn, R> = T &
  ((this: ThisParameterType<T>, ...args: Parameters<T>) => R);

export type Decorated<T extends AnyFn, R> = DecoratedFunction<T, R>;

export type Decorator<T extends AnyFn, R = ReturnType<T>> = (
  fn: T
) => DecoratedFunction<T, R>;

export type AsyncDecorator<T extends AnyFn, R = Awaited<ReturnType<T>>> = Decorator<
  T,
  Promise<R>
>;

export type DecoratorFactory<
  Args extends any[] = any[],
  T extends AnyFn = AnyFn,
  R = ReturnType<T>
> = (...args: Args) => Decorator<T, R>;

export type NextFn<T extends AnyFn> = {
  (): ReturnType<T>;
  (...args: Parameters<T>): ReturnType<T>;
  withArgs: (...args: Parameters<T>) => ReturnType<T>;
  withThis: (thisArg: ThisParameterType<T>, ...args: Parameters<T>) => ReturnType<T>;
};

export type AsyncNextFn<T extends AnyFn> = {
  (): Promise<Awaited<ReturnType<T>>>;
  (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>>;
  withArgs: (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
  withThis: (thisArg: ThisParameterType<T>, ...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>>;
};

export interface DecoratorContext<T extends AnyFn> {
  name: string;
  args: Parameters<T>;
  thisArg: ThisParameterType<T>;
  original: T;
  callOriginal: (...args: Parameters<T>) => ReturnType<T>;
}

export type DecoratorHandler<T extends AnyFn, R> = (
  next: NextFn<T>,
  ctx: DecoratorContext<T>
) => R;

export type AsyncDecoratorHandler<T extends AnyFn, R> = (
  next: AsyncNextFn<T>,
  ctx: DecoratorContext<T>
) => Promise<R>;

export function createDecorator(
  handler: <T extends AnyFn>(
    next: NextFn<T>,
    ctx: DecoratorContext<T>
  ) => ReturnType<T>
): <T extends AnyFn>(fn: T) => DecoratedFunction<T, ReturnType<T>>;
export function createDecorator<T extends AnyFn, R = ReturnType<T>>(
  handler: DecoratorHandler<T, R>
): Decorator<T, R>;
export function createDecorator<T extends AnyFn, R = ReturnType<T>>(
  handler: DecoratorHandler<T, R>
) {
  return (fn: T): DecoratedFunction<T, R> => {
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
      const baseCall = (
        boundThis: ThisParameterType<T>,
        boundArgs: Parameters<T>
      ) => fn.apply(boundThis, boundArgs);

      const next: NextFn<T> = ((...nextArgs: Parameters<T>) => {
        const finalArgs = nextArgs.length ? nextArgs : args;
        return baseCall(this, finalArgs);
      }) as NextFn<T>;

      next.withArgs = (...nextArgs: Parameters<T>) => baseCall(this, nextArgs);
      next.withThis = (
        thisArg: ThisParameterType<T>,
        ...nextArgs: Parameters<T>
      ) => {
        const finalArgs = nextArgs.length ? nextArgs : args;
        return baseCall(thisArg, finalArgs);
      };

      const ctx: DecoratorContext<T> = {
        name: fn.name || "anonymous",
        args,
        thisArg: this,
        original: fn,
        callOriginal: (...nextArgs: Parameters<T>) => {
          const finalArgs = nextArgs.length ? nextArgs : args;
          return baseCall(this, finalArgs);
        }
      };

      return handler(next, ctx);
    } as DecoratedFunction<T, R>;
  };
}

export function createAsyncDecorator(
  handler: <T extends AnyFn>(
    next: AsyncNextFn<T>,
    ctx: DecoratorContext<T>
  ) => Promise<Awaited<ReturnType<T>>>
): <T extends AnyFn>(fn: T) => DecoratedFunction<T, Promise<Awaited<ReturnType<T>>>>;
export function createAsyncDecorator<
  T extends AnyFn,
  R = Awaited<ReturnType<T>>
>(handler: AsyncDecoratorHandler<T, R>): AsyncDecorator<T, R>;
export function createAsyncDecorator<
  T extends AnyFn,
  R = Awaited<ReturnType<T>>
>(handler: AsyncDecoratorHandler<T, R>) {
  return (fn: T): DecoratedFunction<T, Promise<R>> => {
    return function (this: ThisParameterType<T>, ...args: Parameters<T>) {
      const safeAsync = <V>(call: () => V): Promise<Awaited<V>> => {
        try {
          return Promise.resolve(call());
        } catch (error) {
          return Promise.reject(error);
        }
      };

      const baseCall = (
        boundThis: ThisParameterType<T>,
        boundArgs: Parameters<T>
      ) => fn.apply(boundThis, boundArgs);

      const next: AsyncNextFn<T> = ((...nextArgs: Parameters<T>) => {
        const finalArgs = nextArgs.length ? nextArgs : args;
        return safeAsync(() => baseCall(this, finalArgs));
      }) as AsyncNextFn<T>;

      next.withArgs = (...nextArgs: Parameters<T>) =>
        safeAsync(() => baseCall(this, nextArgs));
      next.withThis = (
        thisArg: ThisParameterType<T>,
        ...nextArgs: Parameters<T>
      ) => {
        const finalArgs = nextArgs.length ? nextArgs : args;
        return safeAsync(() => baseCall(thisArg, finalArgs));
      };

      const ctx: DecoratorContext<T> = {
        name: fn.name || "anonymous",
        args,
        thisArg: this,
        original: fn,
        callOriginal: (...nextArgs: Parameters<T>) => {
          const finalArgs = nextArgs.length ? nextArgs : args;
          return baseCall(this, finalArgs);
        }
      };

      return safeAsync(() => handler(next, ctx)) as Promise<R>;
    } as DecoratedFunction<T, Promise<R>>;
  };
}

export const mapReturn = <T extends AnyFn, R>(
  mapper: (value: ReturnType<T>, ctx: DecoratorContext<T>) => R
) => createDecorator<T, R>((next, ctx) => mapper(next(), ctx));

export const mapReturnAsync = <T extends AnyFn, R>(
  mapper: (value: Awaited<ReturnType<T>>, ctx: DecoratorContext<T>) => R | Promise<R>
) =>
  createAsyncDecorator<T, R>(async (next, ctx) => {
    const value = await next();
    return mapper(value, ctx);
  });
