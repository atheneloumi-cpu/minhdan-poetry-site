/**
 * sync-notion.js
 * 
 * Fetch toàn bộ dữ liệu từ Notion và lưu thành JSON files.
 * Chỉ fetch những bài có "Công khai web / Public" = true.
 * 
 * Usage: npm run sync
 */

import { Client } from '@notionhq/client';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config();

// ============ SETUP ============
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const DATA_DIR = './data';
const DBS = {
  poems: process.env.NOTION_POEMS_DB_ID,
  collections: process.env.NOTION_COLLECTIONS_DB_ID,
  series: process.env.NOTION_SERIES_DB_ID,
  author: process.env.NOTION_AUTHOR_DB_ID,
};

// ============ HELPERS ============

/**
 * Slugify: chuyển tiếng Việt có dấu thành slug URL-safe
 * VD: "Chiều cuối năm" → "chieu-cuoi-nam"
 */
function slugify(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Extract plain text từ Notion rich text array
 */
function getText(richText) {
  if (!Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text || '').join('');
}

/**
 * Get title từ Notion property
 */
function getTitle(prop) {
  if (!prop || !prop.title) return '';
  return getText(prop.title);
}

/**
 * Get rich_text property
 */
function getRichText(prop) {
  if (!prop || !prop.rich_text) return '';
  return getText(prop.rich_text);
}

/**
 * Get select property
 */
function getSelect(prop) {
  return prop?.select?.name || null;
}

/**
 * Get multi_select property
 */
function getMultiSelect(prop) {
  return prop?.multi_select?.map(s => s.name) || [];
}

/**
 * Get date property
 */
function getDate(prop) {
  return prop?.date?.start || null;
}

/**
 * Get number property
 */
function getNumber(prop) {
  return prop?.number ?? null;
}

/**
 * Get checkbox property
 */
function getCheckbox(prop) {
  return prop?.checkbox || false;
}

/**
 * Get URL property
 */
function getURL(prop) {
  return prop?.url || null;
}

/**
 * Get relation IDs
 */
function getRelation(prop) {
  return prop?.relation?.map(r => r.id) || [];
}

/**
 * Query toàn bộ database (tự động pagination)
 */
async function queryAllPages(databaseId, filter = undefined) {
  const results = [];
  let cursor = undefined;

  do {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      filter,
      page_size: 100,
    });

    results.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return results;
}

/**
 * Lấy nội dung blocks của một page (cho bài thơ)
 */
async function getPageBlocks(pageId) {
  const blocks = [];
  let cursor = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  // Convert blocks to plain text (giữ line breaks)
  return blocks
    .filter(b => b.type === 'paragraph')
    .map(b => getText(b.paragraph.rich_text))
    .join('\n');
}

// ============ TRANSFORMERS ============

function transformPoem(page) {
  const props = page.properties;
  return {
    id: page.id,
    title: getTitle(props['Title']),
    titleEn: getRichText(props['Title (EN)']),
    slug: getRichText(props['Slug']) || slugify(getTitle(props['Title'])),
    poemId: props['Poem ID']?.unique_id
      ? `${props['Poem ID'].unique_id.prefix}-${props['Poem ID'].unique_id.number}`
      : null,
    collections: getRelation(props['Collection']),
    genre: getSelect(props['Genre']),
    date: getDate(props['Date']),
    publishDate: null,
    themes: getMultiSelect(props['Theme']),
    tags: getMultiSelect(props['Tags']),
    language: getSelect(props['Language']),
    status: getSelect(props['Status']),
    isPublic: getCheckbox(props['Public']),
    isFeatured: getCheckbox(props['Featured']),
    isPremium: false,
    featuredOrder: null,
    excerpt: getRichText(props['Excerpt']),
    excerptEn: getRichText(props['Excerpt (EN)']),
    lineCount: getNumber(props['Line Count']),
    likes: getNumber(props['Likes']) || 0,
    views: 0,
    authorNotes: getRichText(props['Author Notes']),
    inspiration: '',
    audioUrl: null,
    videoUrl: null,
    translationStatus: null,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
    body: '', // Sẽ fetch sau
  };
}

function transformCollection(page) {
  const props = page.properties;
  return {
    id: page.id,
    title: getTitle(props['Title']),
    titleEn: getRichText(props['Title (EN)']),
    slug: getRichText(props['Slug']) || slugify(getTitle(props['Title'])),
    description: getRichText(props['Description']),
    descriptionEn: getRichText(props['Description (EN)']),
    foreword: '',
    year: getNumber(props['Year']),
    poemCount: getNumber(props['Poem Count']) || 0,
    themes: getMultiSelect(props['Theme']),
    status: null,
    isPublic: getCheckbox(props['Public']),
    isPremium: false,
    price: null,
    buyLink: null,
    displayOrder: null,
    coverUrl: page.properties['Cover']?.files?.[0]?.file?.url
      || page.properties['Cover']?.files?.[0]?.external?.url
      || null,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

function transformAuthor(page) {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props['Name']),
    penName: getRichText(props['Bút danh / Pen Name']),
    role: getSelect(props['Role']),
    bioVi: getRichText(props['Bio (VI)']),
    bioEn: getRichText(props['Bio (EN)']),
    portraitUrl: props['Portrait']?.files?.[0]?.file?.url
      || props['Portrait']?.files?.[0]?.external?.url
      || null,
    email: props['Email']?.email || null,
    website: getURL(props['Website']),
    facebook: getURL(props['Facebook']),
    instagram: getURL(props['Instagram']),
    youtube: getURL(props['YouTube']),
    spotify: getURL(props['Spotify']),
    location: getRichText(props['Location']),
    achievements: getRichText(props['Achievements']),
    isPublic: getCheckbox(props['Public']),
    order: getNumber(props['Order']),
  };
}

// ============ MAIN SYNC FUNCTIONS ============

async function syncPoems() {
  console.log('🌿 Syncing poems...');
  const pages = await queryAllPages(DBS.poems);

  console.log(`  Found ${pages.length} poems`);

  const poems = [];
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const poem = transformPoem(page);

    // Fetch nội dung bài thơ
    try {
      poem.body = await getPageBlocks(page.id);
    } catch (err) {
      console.warn(`  ⚠️  Failed to fetch body for: ${poem.title}`);
      poem.body = poem.excerpt || '';
    }

    poems.push(poem);

    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${pages.length}`);
    }
  }

  await writeFile(
    join(DATA_DIR, 'poems.json'),
    JSON.stringify(poems, null, 2),
    'utf-8'
  );
  console.log(`  ✅ Saved ${poems.length} poems\n`);
  return poems;
}

async function syncCollections() {
  console.log('📚 Syncing collections...');
  const pages = await queryAllPages(DBS.collections);

  console.log(`  Found ${pages.length} collections`);
  const collections = pages.map(transformCollection);

  await writeFile(
    join(DATA_DIR, 'collections.json'),
    JSON.stringify(collections, null, 2),
    'utf-8'
  );
  console.log(`  ✅ Saved ${collections.length} collections\n`);
  return collections;
}

async function syncAuthor() {
  console.log('👤 Syncing author profile...');
  const pages = await queryAllPages(DBS.author);

  const authors = pages.map(transformAuthor);

  await writeFile(
    join(DATA_DIR, 'author.json'),
    JSON.stringify(authors, null, 2),
    'utf-8'
  );
  console.log(`  ✅ Saved ${authors.length} author profiles\n`);
  return authors;
}

// ============ ENTRY POINT ============

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Minh Đan Poetry — Notion Sync');
  console.log('═══════════════════════════════════════\n');

  if (!process.env.NOTION_TOKEN) {
    console.error('❌ NOTION_TOKEN not found in .env');
    process.exit(1);
  }

  // Tạo data directory nếu chưa có
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }

  const startTime = Date.now();

  try {
    const [poems, collections, authors] = await Promise.all([
      syncPoems(),
      syncCollections(),
      syncAuthor(),
    ]);

    // Build index/manifest cho frontend dễ truy cập
    const manifest = {
      generatedAt: new Date().toISOString(),
      counts: {
        poems: poems.length,
        collections: collections.length,
        authors: authors.length,
      },
      poemsBySlug: Object.fromEntries(poems.map(p => [p.slug, p.id])),
      collectionsBySlug: Object.fromEntries(collections.map(c => [c.slug, c.id])),
      featured: poems.filter(p => p.isFeatured).map(p => p.id),
    };

    await writeFile(
      join(DATA_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('═══════════════════════════════════════');
    console.log(`  ✅ Sync completed in ${duration}s`);
    console.log(`  📊 Poems: ${poems.length}`);
    console.log(`  📚 Collections: ${collections.length}`);
    console.log(`  👤 Authors: ${authors.length}`);
    console.log('═══════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Sync failed:', error.message);
    if (error.code === 'unauthorized') {
      console.error('   → Check NOTION_TOKEN and integration permissions.');
    }
    process.exit(1);
  }
}

main();