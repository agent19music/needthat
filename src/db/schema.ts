import { sql } from 'drizzle-orm'

export {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from './auth-schema.ts'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}

export const lists = sqliteTable(
  'lists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    name: text('name').notNull().default('Wishlist'),
    ...timestamps,
  },
  (table) => [index('lists_user_id_idx').on(table.userId)],
)

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('categories_list_id_idx').on(table.listId)],
)

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  brand: text('brand'),
  createdAt: timestamps.createdAt,
})

export const variants = sqliteTable(
  'variants',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('variants_product_id_idx').on(table.productId)],
)

export const listItems = sqliteTable(
  'list_items',
  {
    id: text('id').primaryKey(),
    listId: text('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    clientId: text('client_id'),
    categoryId: text('category_id'),
    title: text('title').notNull(),
    brand: text('brand'),
    notes: text('notes'),
    imageUrl: text('image_url'),
    preferences: text('preferences'),
    status: text('status', {
      enum: ['wanted', 'purchased', 'unresolved'],
    })
      .notNull()
      .default('wanted'),
    productId: text('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    variantId: text('variant_id').references(() => variants.id, {
      onDelete: 'set null',
    }),
    selectedImageId: text('selected_image_id'),
    sourceUrl: text('source_url'),
    ...timestamps,
  },
  (table) => [
    index('list_items_list_id_idx').on(table.listId),
    uniqueIndex('list_items_list_client_id_idx').on(table.listId, table.clientId),
  ],
)

export const attributes = sqliteTable(
  'attributes',
  {
    id: text('id').primaryKey(),
    ownerType: text('owner_type', {
      enum: ['product', 'variant', 'item'],
    }).notNull(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull(),
    value: text('value').notNull(),
    source: text('source', {
      enum: ['inferred', 'source', 'user'],
    }).notNull(),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    uniqueIndex('attributes_owner_name_source_idx').on(
      table.ownerType,
      table.ownerId,
      table.name,
      table.source,
    ),
  ],
)

export const offers = sqliteTable(
  'offers',
  {
    id: text('id').primaryKey(),
    variantId: text('variant_id').references(() => variants.id, {
      onDelete: 'cascade',
    }),
    itemId: text('item_id').references(() => listItems.id, {
      onDelete: 'cascade',
    }),
    sourceName: text('source_name'),
    url: text('url'),
    currency: text('currency'),
    priceAmount: integer('price_amount'),
    availability: text('availability'),
    sku: text('sku'),
    gtin: text('gtin'),
    styleCode: text('style_code'),
    provider: text('provider'),
    providerId: text('provider_id'),
    observedAt: integer('observed_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('offers_variant_id_idx').on(table.variantId),
    index('offers_item_id_idx').on(table.itemId),
  ],
)

export const images = sqliteTable(
  'images',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').references(() => listItems.id, {
      onDelete: 'cascade',
    }),
    variantId: text('variant_id').references(() => variants.id, {
      onDelete: 'set null',
    }),
    r2Key: text('r2_key'),
    sourcePageUrl: text('source_page_url'),
    sourceImageUrl: text('source_image_url'),
    contentType: text('content_type'),
    byteSize: integer('byte_size'),
    role: text('role', { enum: ['original', 'processed'] }).notNull(),
    derivedFromId: text('derived_from_id'),
    createdAt: timestamps.createdAt,
  },
  (table) => [index('images_item_id_idx').on(table.itemId)],
)

export const lookupCache = sqliteTable(
  'lookup_cache',
  {
    id: text('id').primaryKey(),
    cacheKey: text('cache_key').notNull(),
    query: text('query').notNull(),
    locale: text('locale').notNull(),
    provider: text('provider').notNull(),
    responseJson: text('response_json').notNull(),
    createdAt: timestamps.createdAt,
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [uniqueIndex('lookup_cache_key_idx').on(table.cacheKey)],
)

export const providerUsage = sqliteTable(
  'provider_usage',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    operation: text('operation').notNull(),
    subjectKey: text('subject_key').notNull(),
    cacheHit: integer('cache_hit', { mode: 'boolean' }).notNull().default(false),
    createdAt: timestamps.createdAt,
  },
  (table) => [
    index('provider_usage_subject_created_idx').on(
      table.subjectKey,
      table.createdAt,
    ),
  ],
)
