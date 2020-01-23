/**
 * FAQ
 * - is it possible to provide a custom message?
 *   - yes, use `withMessage`
 * - how to change a field? (for example snake case to camel case)
 *   - mapping
 *
 * Open problems:
 * - is it possible to optimize unions (sum types)?
 *
 * Open questions:
 * - is it possible to define a Semigroup for DecodeError?
 * - is it possible to handle `enum`s?
 * - is it possible to define a Decoder which fails with additional fields?
 * - is it possible to get only the first error?
 * - readonly?
 *
 * @since 3.0.0
 */
import * as E from 'fp-ts/lib/Either'
import { flow, Refinement } from 'fp-ts/lib/function'
import { NonEmptyArray } from 'fp-ts/lib/NonEmptyArray'
import * as DE from './DecodeError'
import * as G from './Guard'

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export interface Decoder<A> {
  readonly decode: (u: unknown) => E.Either<DE.DecodeError, A>
}

/**
 * @since 3.0.0
 */
export type Decoding<D> = D extends Decoder<infer A> ? A : never

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export function fromRefinement<A>(refinement: Refinement<unknown, A>, expected: string): Decoder<A> {
  return {
    decode: E.fromPredicate(refinement, u => DE.leaf(expected, u))
  }
}

/**
 * @since 3.0.0
 */
export function literal<A extends string | number | boolean>(a: A): Decoder<A> {
  return fromRefinement(G.literal(a).is, JSON.stringify(a))
}

/**
 * @since 3.0.0
 */
export function keyof<A>(keys: Record<keyof A, unknown>): Decoder<keyof A> {
  return fromRefinement(
    G.keyof(keys).is,
    Object.keys(keys)
      .map(k => JSON.stringify(k))
      .join(' | ')
  )
}

// -------------------------------------------------------------------------------------
// primitives
// -------------------------------------------------------------------------------------

/**
 * @since 3.0.0
 */
export const string: Decoder<string> = fromRefinement(G.string.is, 'string')

/**
 * @since 3.0.0
 */
export const number: Decoder<number> = fromRefinement(G.number.is, 'number')

/**
 * @since 3.0.0
 */
export const boolean: Decoder<boolean> = fromRefinement(G.boolean.is, 'boolean')

const _undefined: Decoder<undefined> = fromRefinement(G.undefined.is, 'undefined')

const _null: Decoder<null> = fromRefinement(G.null.is, 'null')

export {
  /**
   * @since 3.0.0
   */
  _undefined as undefined,
  /**
   * @since 3.0.0
   */
  _null as null
}

/**
 * @since 3.0.0
 */
export const UnknownArray: Decoder<Array<unknown>> = fromRefinement(G.UnknownArray.is, 'Array<unknown>')

/**
 * @since 3.0.0
 */
export const UnknownRecord: Decoder<Record<string, unknown>> = fromRefinement(
  G.UnknownRecord.is,
  'Record<string, unknown>'
)

/**
 * @since 3.0.0
 */
export interface IntBrand {
  readonly Int: unique symbol
}

/**
 * @since 3.0.0
 */
export type Int = number & IntBrand

/**
 * @since 3.0.0
 */
export const Int: Decoder<Int> = refinement(number, (n: number): n is Int => Number.isInteger(n), 'Int')

// -------------------------------------------------------------------------------------
// combinators
// -------------------------------------------------------------------------------------

function mapLeft<A>(decoder: Decoder<A>, f: (e: DE.DecodeError) => DE.DecodeError): Decoder<A> {
  return {
    decode: flow(decoder.decode, E.mapLeft(f))
  }
}

/**
 * @since 3.0.0
 */
export function withExpected<A>(decoder: Decoder<A>, expected: string): Decoder<A> {
  return mapLeft(decoder, e => ({ ...e, expected }))
}

/**
 * @since 3.0.0
 */
export function refinement<A, B extends A>(
  decoder: Decoder<A>,
  refinement: Refinement<A, B>,
  expected: string
): Decoder<B> {
  const fromPredicate = E.fromPredicate(refinement, a => DE.leaf(expected, a))
  return {
    decode: u => {
      const e = decoder.decode(u)
      return E.isLeft(e) ? e : fromPredicate(e.right)
    }
  }
}

function isNonEmpty<A>(as: Array<A>): as is NonEmptyArray<A> {
  return as.length > 0
}

/**
 * @since 3.0.0
 */
export function type<A>(decoders: { [K in keyof A]: Decoder<A[K]> }): Decoder<A> {
  return {
    decode: u => {
      const e = UnknownRecord.decode(u)
      if (E.isLeft(e)) {
        return e
      } else {
        const r = e.right
        let a: A = {} as any
        const es: Array<[string, DE.DecodeError]> = []
        for (const k in decoders) {
          const e = decoders[k].decode(r[k])
          if (E.isLeft(e)) {
            es.push([k, e.left])
          } else {
            a[k] = e.right
          }
        }
        return isNonEmpty(es) ? E.left(DE.labeled('type', u, es)) : E.right(a)
      }
    }
  }
}

/**
 * @since 3.0.0
 */
export function partial<A>(decoders: { [K in keyof A]: Decoder<A[K]> }): Decoder<Partial<A>> {
  return {
    decode: u => {
      const e = UnknownRecord.decode(u)
      if (E.isLeft(e)) {
        return e
      } else {
        const r = e.right
        let a: Partial<A> = {}
        const es: Array<[string, DE.DecodeError]> = []
        for (const k in decoders) {
          if (r[k] !== undefined) {
            const e = decoders[k].decode(r[k])
            if (E.isLeft(e)) {
              es.push([k, e.left])
            } else {
              a[k] = e.right
            }
          }
        }
        return isNonEmpty(es) ? E.left(DE.labeled('partial', u, es)) : E.right(a)
      }
    }
  }
}

/**
 * @since 3.0.0
 */
export function record<A>(decoder: Decoder<A>): Decoder<Record<string, A>> {
  return {
    decode: u => {
      const e = UnknownRecord.decode(u)
      if (E.isLeft(e)) {
        return e
      } else {
        const r = e.right
        let a: Record<string, A> = {}
        const es: Array<[string, DE.DecodeError]> = []
        for (const k in r) {
          const e = decoder.decode(r[k])
          if (E.isLeft(e)) {
            es.push([k, e.left])
          } else {
            a[k] = e.right
          }
        }
        return isNonEmpty(es) ? E.left(DE.labeled('record', u, es)) : E.right(a)
      }
    }
  }
}

/**
 * @since 3.0.0
 */
export function array<A>(decoder: Decoder<A>): Decoder<Array<A>> {
  return {
    decode: u => {
      const e = UnknownArray.decode(u)
      if (E.isLeft(e)) {
        return e
      } else {
        const us = e.right
        const len = us.length
        const a: Array<A> = new Array(len)
        const es: Array<[number, DE.DecodeError]> = []
        for (let i = 0; i < len; i++) {
          const e = decoder.decode(us[i])
          if (E.isLeft(e)) {
            es.push([i, e.left])
          } else {
            a[i] = e.right
          }
        }
        return isNonEmpty(es) ? E.left(DE.indexed('array', u, es)) : E.right(a)
      }
    }
  }
}

/**
 * @since 3.0.0
 */
export function tuple<A extends [unknown, unknown, ...Array<unknown>]>(
  decoders: { [K in keyof A]: Decoder<A[K]> }
): Decoder<A> {
  return {
    decode: u => {
      const e = UnknownArray.decode(u)
      if (E.isLeft(e)) {
        return e
      } else {
        const us = e.right
        const len = decoders.length
        const a: A = new Array(len) as any
        const es: Array<[number, DE.DecodeError]> = []
        for (let i = 0; i < len; i++) {
          const e = decoders[i].decode(us[i])
          if (E.isLeft(e)) {
            es.push([i, e.left])
          } else {
            a[i] = e.right
          }
        }
        return isNonEmpty(es) ? E.left(DE.indexed('tuple', u, es)) : E.right(a)
      }
    }
  }
}

/**
 * @since 3.0.0
 */
export function intersection<A, B, C, D, E>(
  decoders: [Decoder<A>, Decoder<B>, Decoder<C>, Decoder<D>, Decoder<E>]
): Decoder<A & B & C & D & E>
export function intersection<A, B, C, D>(
  decoders: [Decoder<A>, Decoder<B>, Decoder<C>, Decoder<D>]
): Decoder<A & B & C & D>
export function intersection<A, B, C>(decoders: [Decoder<A>, Decoder<B>, Decoder<C>]): Decoder<A & B & C>
export function intersection<A, B>(decoders: [Decoder<A>, Decoder<B>]): Decoder<A & B>
export function intersection(decoders: Array<Decoder<unknown>>): Decoder<unknown> {
  return {
    decode: u => {
      const len = decoders.length
      if (len === 0) {
        return E.right(u)
      }
      const as: Array<unknown> = []
      const es: Array<DE.DecodeError> = []
      for (let i = 0; i < len; i++) {
        const e = decoders[i].decode(u)
        if (E.isLeft(e)) {
          es.push(e.left)
        } else {
          as[i] = e.right
        }
      }
      const a: unknown = as.some(a => Object.prototype.toString.call(a) !== '[object Object]')
        ? as[as.length - 1]
        : Object.assign({}, ...as)
      return isNonEmpty(es) ? E.left(DE.and('intersection', u, es)) : E.right(a)
    }
  }
}

/**
 * @since 3.0.0
 */
export function union<A extends [unknown, unknown, ...Array<unknown>]>(
  decoders: { [K in keyof A]: Decoder<A[K]> }
): Decoder<A[number]> {
  return {
    decode: u => {
      const es: Array<DE.DecodeError> = []
      for (let i = 0; i < decoders.length; i++) {
        const e = decoders[i].decode(u)
        if (E.isLeft(e)) {
          es.push(e.left)
        } else {
          return e
        }
      }
      return E.left(isNonEmpty(es) ? DE.or('union', u, es) : DE.leaf('empty union', u))
    }
  }
}

/**
 * @since 3.0.0
 */
export function lazy<A>(f: () => Decoder<A>): Decoder<A> {
  let memoized: Decoder<A>
  function getMemoized(): Decoder<A> {
    if (!memoized) {
      memoized = f()
    }
    return memoized
  }
  return {
    decode: u => getMemoized().decode(u)
  }
}
