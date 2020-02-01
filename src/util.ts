/**
 * @since 3.0.0
 */
import { Eq } from 'fp-ts/lib/Eq'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import { Literal } from './Schemable'
import { Semigroup } from 'fp-ts/lib/Semigroup'

/**
 * @since 3.0.0
 * @internal
 */
export function isNonEmpty<A>(as: Array<A>): as is NonEmptyArray<A> {
  return as.length > 0
}

/**
 * @since 3.0.0
 * @internal
 */
export function hasOwnProperty<O extends object>(o: O, k: string): k is keyof O & string {
  return Object.prototype.hasOwnProperty.call(o, k)
}

/**
 * @since 3.0.0
 * @internal
 */
export function showLiteral<A extends Literal>(a: A): string {
  return a === undefined ? 'undefined' : JSON.stringify(a)
}

/**
 * @since 3.0.0
 * @internal
 */
export const strict: Eq<unknown> = {
  equals: (x, y) => x === y
}

/**
 * @since 3.0.0
 * @internal
 */
export const always: Eq<unknown> = {
  equals: () => true
}

/**
 * @since 3.0.0
 * @internal
 */
export function memoize<A>(f: () => A): () => A {
  let cache: A
  let isEmpty: boolean = true
  return () => {
    if (isEmpty) {
      cache = f()
      isEmpty = false
    }
    return cache
  }
}

function typeOf(x: unknown): string {
  return x === null ? 'null' : typeof x
}

/**
 * @since 3.0.0
 * @internal
 */
export const intersection: Semigroup<unknown> = {
  concat: (x, y) => {
    if (x !== undefined && y !== undefined) {
      const tx = typeOf(x)
      const ty = typeOf(y)
      if (tx === 'object' || ty === 'object') {
        return Object.assign({}, x, y)
      }
      return y
    }
  }
}