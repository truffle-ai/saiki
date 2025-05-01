import { ZodObject, ZodType } from 'zod';

// New utility type for compile-time checking of Zod schemas against TypeScript interfaces
// This enables us to tightly couple zod schemas with the typescript interfaces we use in our codebase.
// This is useful for ensuring that the zod schemas are always in sync with the interfaces, and for providing
// better type safety when using the schemas.
// We need to ensure that we update usages of this type whenever we update the interfaces it is based on.
export type SchemaFromInterface<T> = ZodObject<{
  [K in keyof Partial<T>]: K extends keyof T ? ZodType<T[K]> : never;
}>; 