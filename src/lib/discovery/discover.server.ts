import { env } from 'cloudflare:workers'
import { and, eq, gte, sql } from 'drizzle-orm'
import * as Sentry from '@sentry/tanstackstart-react'

import { getDb } from '#/db/index'
import { lookupCache, providerUsage } from '#/db/schema'

import { normalizeQuery, toCandidates } from './candidates.ts'
import type { ProductCandidate } from './candidates.ts'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const FALLBACK_COUNTRY = 'us'

export type DiscoveryResult = {
  ok: true
  candidates: Array<ProductCandidate>
  note: string | null
} | {
  ok: false
  message: string
}

export function discoverProducts(query: string): Promise<DiscoveryResult> {
  return Sentry.startSpan(
    { name: 'Searching product listings' },
    async (): Promise<DiscoveryResult> => {
    const country = countryCode(env.SEARCH_COUNTRY)
    const language = countryCode(env.SEARCH_LANGUAGE)
    const normalized = normalizeQuery(query)

    try {
      const primary = await searchMarket(normalized, country, language)
      if (!primary.ok) return primary
      if (primary.candidates.length > 0 || country === FALLBACK_COUNTRY) {
        return { ok: true, candidates: primary.candidates, note: null }
      }

      const fallback = await searchMarket(normalized, FALLBACK_COUNTRY, language)
      if (!fallback.ok) return fallback
      return {
        ok: true,
        candidates: fallback.candidates,
        note:
          fallback.candidates.length === 0
            ? null
            : `No listings came back for ${country.toUpperCase()}. These are US matches, and they do not mean the item is available locally.`,
      }
    } catch (error) {
      Sentry.captureException(error)
      return {
        ok: false,
        message: 'Search failed. Your description is still here.',
      }
    }
  })
}

async function searchMarket(
  query: string,
  country: string,
  language: string,
): Promise<DiscoveryResult> {
  const cached = await readCache(query, country, language)
  if (cached) return { ok: true, candidates: cached, note: null }

  const limit = await assertWithinLimit()
  if (!limit.ok) return limit

  const response = await fetch('https://google.serper.dev/shopping', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': env.SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: query,
      gl: country,
      hl: language,
      num: 10,
    }),
    signal: AbortSignal.timeout(8000),
  })

  if (response.status === 401 || response.status === 403) {
    return { ok: false, message: 'Search is not configured yet.' }
  }
  if (response.status === 429) {
    return {
      ok: false,
      message: 'Search credits are used up. You can still save this by hand.',
    }
  }
  if (!response.ok) {
    return {
      ok: false,
      message: 'Search failed. Your description is still here.',
    }
  }

  const payload: unknown = await response.json()
  const shopping =
    payload && typeof payload === 'object' && 'shopping' in payload
      ? payload.shopping
      : []
  const candidates = toCandidates(shopping)

  try {
    await recordUsage()
    await writeCache(query, country, language, shopping)
  } catch (error) {
    Sentry.captureException(error)
  }

  return { ok: true, candidates, note: null }
}

async function assertWithinLimit(): Promise<DiscoveryResult | { ok: true }> {
  if (!env.SERPER_API_KEY) {
    return { ok: false, message: 'Search is not configured yet.' }
  }

  const limit = Number(env.DAILY_PROVIDER_CALL_LIMIT)
  if (!Number.isFinite(limit) || limit < 1) {
    return {
      ok: false,
      message: 'Search is paused. You can still save this by hand.',
    }
  }

  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const row = await getDb()
    .select({ value: sql<number>`count(*)` })
    .from(providerUsage)
    .where(
      and(
        eq(providerUsage.provider, 'serper'),
        eq(providerUsage.cacheHit, false),
        gte(providerUsage.createdAt, start),
      ),
    )
    .get()
  const count = Number(row?.value ?? 0)
  if (count >= limit) {
    return {
      ok: false,
      message:
        'The daily search limit is reached. You can still save this by hand.',
    }
  }

  return { ok: true }
}

async function readCache(query: string, country: string, language: string) {
  const row = await getDb()
    .select()
    .from(lookupCache)
    .where(eq(lookupCache.cacheKey, cacheKey(query, country, language)))
    .get()
  if (!row) return null
  if (timestamp(row.expiresAt) <= Date.now()) return null

  try {
    return toCandidates(JSON.parse(row.responseJson))
  } catch {
    return null
  }
}

async function writeCache(
  query: string,
  country: string,
  language: string,
  shopping: unknown,
) {
  const now = new Date()
  const key = cacheKey(query, country, language)
  await getDb()
    .insert(lookupCache)
    .values({
      id: crypto.randomUUID(),
      cacheKey: key,
      query,
      locale: `${country}-${language}`,
      provider: 'serper',
      responseJson: JSON.stringify(shopping),
      expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
    })
    .onConflictDoUpdate({
      target: lookupCache.cacheKey,
      set: {
        query,
        responseJson: JSON.stringify(shopping),
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
    })
}

async function recordUsage() {
  await getDb()
    .insert(providerUsage)
    .values({
      id: crypto.randomUUID(),
      provider: 'serper',
      operation: 'shopping',
      subjectKey: 'anonymous',
      cacheHit: false,
    })
}

function cacheKey(query: string, country: string, language: string) {
  return `serper:shopping:${country}-${language}:${query}`
}

function countryCode(value: string) {
  return /^[a-z]{2}$/i.test(value) ? value.toLowerCase() : FALLBACK_COUNTRY
}

function timestamp(value: Date | number) {
  return value instanceof Date ? value.getTime() : value * 1000
}
