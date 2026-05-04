/**
 * build-pages.js
 * 
 * Convert JSON data → static HTML pages
 * 
 * Output:
 *   public/index.html              Home page
 *   public/library.html            Tất cả bài thơ
 *   public/poems/[slug].html       Mỗi bài thơ
 *   public/collections/[slug].html Mỗi tập thơ
 *   public/styles/shared.css       CSS dùng chung
 * 
 * Usage: npm run build (sau khi đã sync)
 */

import { readFile, writeFile, mkdir, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

const DATA_DIR = './data';
const PUBLIC_DIR = './public';
const STYLES_DIR = './styles';

// ============ HELPERS ============

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day} · ${month} · ${year}`;
}

async function ensureDir(path) {
  if (!existsSync(path)) {
    await mkdir(path, { recursive: true });
  }
}

async function loadJSON(filename) {
  const content = await readFile(join(DATA_DIR, filename), 'utf-8');
  return JSON.parse(content);
}

// ============ TEMPLATE COMPONENTS ============

function navTemplate() {
  return `
<nav class="nav" role="navigation" aria-label="Điều hướng chính">
  <div class="nav-container">
    <a href="/" class="nav-logo">Minh <strong>Đan</strong></a>
    <ul class="nav-links">
      <li><a href="/library.html">Thư viện</a></li>
      <li><a href="/#collections">Tập thơ</a></li>
      <li><a href="/#calendar">Lịch</a></li>
      <li><a href="/#about">Về tác giả</a></li>
    </ul>
  </div>
</nav>`;
}

function footerTemplate() {
  return `
<footer class="footer" role="contentinfo">
  <div class="footer-container">
    <p class="footer-brand-name">Minh Đan</p>
    <p class="footer-tag">Nhà thơ · Poet</p>
    <div class="footer-links">
      <a href="/library.html">Thư viện</a>
      <a href="/#subscribe">Đăng ký</a>
      <a href="/#contribute">Đóng góp</a>
      <a href="/#about">Về tác giả</a>
    </div>
    <p class="footer-copyright">© 2026 Minh Đan · Built with love & ink</p>
  </div>
</footer>`;
}

function htmlBase({ title, description, content, lang = 'vi' }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description || '')}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description || '')}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles/shared.css">
</head>
<body>
<a href="#main" class="skip-link">Bỏ qua đến nội dung chính</a>
${navTemplate()}
<main id="main">
${content}
</main>
${footerTemplate()}
</body>
</html>`;
}

// ============ PAGE BUILDERS ============

function buildPoemPage(poem, collections, allPoems) {
  const collection = collections.find(c => poem.collections.includes(c.id));

  // Find prev/next poem in same collection
  const collectionPoems = allPoems
    .filter(p => p.collections.includes(collection?.id))
    .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
  const currentIndex = collectionPoems.findIndex(p => p.id === poem.id);
  const prevPoem = currentIndex > 0 ? collectionPoems[currentIndex - 1] : null;
  const nextPoem = currentIndex < collectionPoems.length - 1 ? collectionPoems[currentIndex + 1] : null;

  const collectionLink = collection
    ? `<a href="/collections/${collection.slug}.html">${escapeHtml(collection.title)}</a>`
    : '';

  const tags = poem.tags.map(t => `<a href="/library.html?tag=${encodeURIComponent(t)}" class="poem-tag">${escapeHtml(t)}</a>`).join(' ');
  const themes = poem.themes.map(t => `<a href="/library.html?theme=${encodeURIComponent(t)}" class="poem-tag">${escapeHtml(t)}</a>`).join(' ');

  const bodyEnSection = poem.excerptEn && poem.titleEn
    ? `
    <div class="poem-divider">· · ·</div>
    <h2 style="text-align:center; font-family:'Playfair Display'; font-style:italic; font-size:1.3rem; color:var(--muted); margin-bottom:2rem;">${escapeHtml(poem.titleEn)}</h2>
    <div class="poem-body-en">${escapeHtml(poem.excerptEn || '')}</div>`
    : '';

  const authorNotesSection = poem.authorNotes
    ? `<div class="poem-author-notes">
        <strong>Ghi chú của tác giả:</strong><br>
        ${escapeHtml(poem.authorNotes)}
      </div>`
    : '';

  const content = `
<article class="poem-page">
  <div class="poem-meta-top">
    ${collectionLink ? `Trong tập: ${collectionLink}` : ''}
  </div>
  
  <h1 class="poem-title">${escapeHtml(poem.title)}</h1>
  ${poem.titleEn ? `<p class="poem-title-en">${escapeHtml(poem.titleEn)}</p>` : ''}
  
  <div class="poem-body">${escapeHtml(poem.body || poem.excerpt || '')}</div>
  
  ${bodyEnSection}
  
  <div class="poem-meta-bottom">
    <div class="poem-meta-row">
      ${poem.genre ? `<span class="poem-tag">${escapeHtml(poem.genre)}</span>` : ''}
      ${themes}
      ${tags}
    </div>
    <p>
      ${poem.date ? `Sáng tác ngày ${formatDate(poem.date)}` : ''}
      ${poem.lineCount ? ` · ${poem.lineCount} dòng` : ''}
    </p>
  </div>
  
  ${authorNotesSection}
  
  <nav class="poem-nav" aria-label="Điều hướng giữa các bài thơ">
    ${prevPoem ? `
      <a href="/poems/${prevPoem.slug}.html" class="poem-nav-prev">
        <span class="poem-nav-label">← Bài trước</span>
        ${escapeHtml(prevPoem.title)}
      </a>` : '<span></span>'}
    ${nextPoem ? `
      <a href="/poems/${nextPoem.slug}.html" class="poem-nav-next">
        <span class="poem-nav-label">Bài sau →</span>
        ${escapeHtml(nextPoem.title)}
      </a>` : '<span></span>'}
  </nav>
</article>`;

  return htmlBase({
    title: `${poem.title} · Minh Đan`,
    description: poem.excerpt || `Bài thơ "${poem.title}" của Minh Đan`,
    content,
  });
}

function buildCollectionPage(collection, poems) {
  const collectionPoems = poems
    .filter(p => p.collections.includes(collection.id))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const poemCards = collectionPoems.map(p => `
    <a href="/poems/${p.slug}.html" class="poem-card">
      ${p.genre ? `<p class="poem-card-tag">${escapeHtml(p.genre)} · ${p.date ? new Date(p.date).getFullYear() : ''}</p>` : ''}
      <h3 class="poem-card-title">${escapeHtml(p.title)}</h3>
      ${p.excerpt ? `<p class="poem-card-excerpt">${escapeHtml(p.excerpt.substring(0, 120))}${p.excerpt.length > 120 ? '…' : ''}</p>` : ''}
      <div class="poem-card-meta">
        <span>${formatDate(p.date)}</span>
        <span>→</span>
      </div>
    </a>
  `).join('');

  const content = `
<section class="collection-hero" aria-label="Giới thiệu tập thơ">
  <div class="collection-hero-watermark" aria-hidden="true">${escapeHtml(collection.title.split(' ')[0] || '')}</div>
  <div class="collection-hero-content">
    <p class="collection-hero-eyebrow">Tập thơ · Collection</p>
    <h1 class="collection-hero-title">${escapeHtml(collection.title)}</h1>
    ${collection.titleEn ? `<p class="collection-hero-titleen">${escapeHtml(collection.titleEn)}</p>` : ''}
    <div class="collection-hero-meta">
      ${collection.year ? `<span>${collection.year}</span>` : ''}
      ${collection.poemCount ? `<span>${collection.poemCount} bài</span>` : ''}
      ${collection.themes?.length ? `<span>${escapeHtml(collection.themes.slice(0, 2).join(' · '))}</span>` : ''}
    </div>
  </div>
</section>

<section class="collection-body">
  ${collection.description ? `<p class="collection-description">${escapeHtml(collection.description)}</p>` : ''}
  ${collection.foreword ? `
    <div class="collection-foreword">
      <h3>Lời giới thiệu · Foreword</h3>
      <p>${escapeHtml(collection.foreword)}</p>
    </div>` : ''}
</section>

<section class="library-page" style="padding-top:0;">
  <h2 style="font-family:'Playfair Display';font-size:1.5rem;font-style:italic;color:var(--brown-800);text-align:center;margin-bottom:2rem;">Các bài thơ trong tập</h2>
  <div class="poems-grid">
    ${poemCards || '<p style="text-align:center;color:var(--muted);">Chưa có bài thơ nào.</p>'}
  </div>
</section>`;

  return htmlBase({
    title: `${collection.title} · Minh Đan`,
    description: collection.description || `Tập thơ "${collection.title}" của Minh Đan`,
    content,
  });
}

function buildLibraryPage(poems, collections) {
  const sortedPoems = [...poems].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  const poemCards = sortedPoems.map(p => {
    const collection = collections.find(c => p.collections.includes(c.id));
    return `
    <a href="/poems/${p.slug}.html" class="poem-card">
      ${p.genre ? `<p class="poem-card-tag">${escapeHtml(p.genre)}${collection ? ' · ' + escapeHtml(collection.title) : ''}</p>` : ''}
      <h3 class="poem-card-title">${escapeHtml(p.title)}</h3>
      ${p.excerpt ? `<p class="poem-card-excerpt">${escapeHtml(p.excerpt.substring(0, 120))}${p.excerpt.length > 120 ? '…' : ''}</p>` : ''}
      <div class="poem-card-meta">
        <span>${formatDate(p.date)}</span>
        <span>→</span>
      </div>
    </a>
  `;
  }).join('');

  // Genre filters
  const genres = [...new Set(poems.map(p => p.genre).filter(Boolean))];
  const filterPills = `
    <a href="/library.html" class="filter-pill active">Tất cả · ${poems.length}</a>
    ${genres.map(g => `<a href="/library.html?genre=${encodeURIComponent(g)}" class="filter-pill">${escapeHtml(g)}</a>`).join('')}
  `;

  const content = `
<section class="library-page">
  <header class="library-header">
    <h1 class="library-title">Thư <em>viện</em></h1>
    <p class="library-subtitle">${poems.length} bài thơ · ${collections.length} tập</p>
  </header>
  
  <div class="library-filters" role="group" aria-label="Lọc theo thể loại">
    ${filterPills}
  </div>
  
  <div class="poems-grid">
    ${poemCards}
  </div>
</section>`;

  return htmlBase({
    title: 'Thư viện · Minh Đan',
    description: `Tất cả ${poems.length} bài thơ của Minh Đan, được phân loại theo thể loại và tập.`,
    content,
  });
}

function buildHomePage(poems, collections, authors) {
  const featured = poems
    .filter(p => p.isFeatured)
    .sort((a, b) => (a.featuredOrder || 999) - (b.featuredOrder || 999))
    .slice(0, 4);

  const latestCollections = [...collections]
    .filter(c => c.isPublic)
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 3);

  const author = authors[0];
  const poemOfDay = featured[0] || poems[0];

  const featuredCards = featured.map(p => `
    <a href="/poems/${p.slug}.html" class="poem-card">
      ${p.genre ? `<p class="poem-card-tag">${escapeHtml(p.genre)} · ${p.date ? new Date(p.date).getFullYear() : ''}</p>` : ''}
      <h3 class="poem-card-title">${escapeHtml(p.title)}</h3>
      ${p.excerpt ? `<p class="poem-card-excerpt">${escapeHtml(p.excerpt.substring(0, 100))}…</p>` : ''}
      <div class="poem-card-meta">
        <span>${formatDate(p.date)}</span>
        <span>→</span>
      </div>
    </a>
  `).join('');

  const collectionCards = latestCollections.map(c => `
    <a href="/collections/${c.slug}.html" class="poem-card" style="display:block;">
      <p class="poem-card-tag">${c.year || ''} · ${c.poemCount || 0} bài</p>
      <h3 class="poem-card-title">${escapeHtml(c.title)}</h3>
      ${c.titleEn ? `<p style="font-size:0.85rem; color:var(--muted); font-style:italic; margin-bottom:0.5rem;">${escapeHtml(c.titleEn)}</p>` : ''}
      ${c.description ? `<p class="poem-card-excerpt">${escapeHtml(c.description.substring(0, 100))}…</p>` : ''}
    </a>
  `).join('');

  const content = `
<section style="min-height:80vh; display:flex; flex-direction:column; justify-content:center; align-items:center; padding:6rem 2rem; text-align:center; background:radial-gradient(ellipse at top, var(--brown-100) 0%, transparent 60%), var(--cream-50); position:relative; overflow:hidden;">
  <span style="position:absolute; font-family:'Playfair Display'; font-style:italic; font-size:clamp(200px, 35vw, 480px); color:var(--brown-200); opacity:0.35; top:50%; left:50%; transform:translate(-50%, -50%); pointer-events:none;" aria-hidden="true">thơ</span>
  
  <div style="position:relative; max-width:720px;">
    <p style="font-size:0.8rem; letter-spacing:0.3em; text-transform:uppercase; color:var(--brown-700); margin-bottom:1.5rem;">Nhà thơ · Poet · Vietnam</p>
    <h1 style="font-family:'Playfair Display'; font-size:clamp(3rem, 8vw, 5.5rem); font-weight:400; line-height:1.05; color:var(--brown-900); margin-bottom:0.5rem;">Minh <em style="color:var(--brown-700);">Đan</em></h1>
    <p style="font-style:italic; color:var(--muted); margin:0.5rem 0 2.5rem;">Thi tập song ngữ Việt – Anh<br>A Bilingual Poetry Archive</p>
    <p style="font-family:'Playfair Display'; font-style:italic; font-size:clamp(1.1rem, 2.5vw, 1.4rem); color:var(--brown-800); line-height:1.7; max-width:600px; margin:0 auto 2rem;">"Mỗi bài thơ là một hơi thở để lại trên trang giấy."</p>
    <div style="display:flex; justify-content:center; gap:3.5rem; margin-top:3rem; flex-wrap:wrap;">
      <div><span style="font-family:'Playfair Display'; font-size:2.25rem; color:var(--brown-800); display:block;">${poems.length}</span><span style="font-size:0.7rem; letter-spacing:0.15em; text-transform:uppercase; color:var(--brown-700);">Bài thơ</span></div>
      <div><span style="font-family:'Playfair Display'; font-size:2.25rem; color:var(--brown-800); display:block;">${collections.length}</span><span style="font-size:0.7rem; letter-spacing:0.15em; text-transform:uppercase; color:var(--brown-700);">Tập thơ</span></div>
    </div>
  </div>
</section>

${poemOfDay ? `
<section style="background:var(--beige); padding:5rem 2rem; text-align:center;">
  <p style="font-size:0.75rem; letter-spacing:0.25em; text-transform:uppercase; color:var(--brown-600); margin-bottom:1.5rem;">Bài thơ hôm nay · Poem of the Day</p>
  <h2 style="font-family:'Playfair Display'; font-style:italic; font-size:clamp(1.75rem, 4vw, 2.25rem); color:var(--brown-900); margin-bottom:1.5rem;">${escapeHtml(poemOfDay.title)}</h2>
  <div style="font-size:1.15rem; color:var(--brown-800); line-height:2.2; font-style:italic; max-width:540px; margin:0 auto 1.5rem; white-space:pre-line;">${escapeHtml(poemOfDay.body || poemOfDay.excerpt || '')}</div>
  <a href="/poems/${poemOfDay.slug}.html" style="color:var(--brown-700); font-size:0.9rem; text-decoration:none;">Đọc đầy đủ →</a>
</section>` : ''}

<section class="library-page" style="padding-top:5rem;">
  <header class="library-header">
    <p style="font-size:0.75rem; letter-spacing:0.25em; text-transform:uppercase; color:var(--brown-700); margin-bottom:1rem;">Tập thơ mới nhất · Latest Collections</p>
    <h2 class="library-title"><em>Những tập</em> gần đây</h2>
  </header>
  <div class="poems-grid">
    ${collectionCards}
  </div>
</section>

${featured.length ? `
<section class="library-page">
  <header class="library-header">
    <p style="font-size:0.75rem; letter-spacing:0.25em; text-transform:uppercase; color:var(--brown-700); margin-bottom:1rem;">Bài nổi bật · Featured</p>
    <h2 class="library-title"><em>Những bài</em> đáng đọc</h2>
  </header>
  <div class="poems-grid">
    ${featuredCards}
  </div>
  <div style="text-align:center; margin-top:3rem;">
    <a href="/library.html" style="display:inline-block; padding:0.85rem 2rem; border-radius:32px; border:1.5px solid var(--brown-600); color:var(--brown-800); text-decoration:none;">Xem tất cả →</a>
  </div>
</section>` : ''}`;

  return htmlBase({
    title: 'Minh Đan · Thi Tập / Poetry Archive',
    description: `Không gian thơ song ngữ Việt-Anh của Minh Đan, ${poems.length} bài thơ qua ${collections.length} tập.`,
    content,
  });
}

// ============ MAIN ============

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  Minh Đan Poetry — Build Pages');
  console.log('═══════════════════════════════════════\n');

  const startTime = Date.now();

  // Load data
  console.log('📥 Loading JSON data...');
  const poems = await loadJSON('poems.json');
  const collections = await loadJSON('collections.json');
  const authors = await loadJSON('author.json');
  console.log(`  Loaded ${poems.length} poems, ${collections.length} collections\n`);

  // Setup output directory
  await ensureDir(PUBLIC_DIR);
  await ensureDir(join(PUBLIC_DIR, 'poems'));
  await ensureDir(join(PUBLIC_DIR, 'collections'));
  await ensureDir(join(PUBLIC_DIR, 'styles'));

  // Copy CSS
  console.log('🎨 Copying styles...');
  await copyFile(
    join(STYLES_DIR, 'shared.css'),
    join(PUBLIC_DIR, 'styles', 'shared.css')
  );
  console.log('  ✅ shared.css\n');

  // Build home
  console.log('🏠 Building home page...');
  const homeHtml = buildHomePage(poems, collections, authors);
  await writeFile(join(PUBLIC_DIR, 'index.html'), homeHtml, 'utf-8');
  console.log('  ✅ index.html\n');

  // Build library
  console.log('📚 Building library page...');
  const libraryHtml = buildLibraryPage(poems, collections);
  await writeFile(join(PUBLIC_DIR, 'library.html'), libraryHtml, 'utf-8');
  console.log('  ✅ library.html\n');

  // Build poem pages
  console.log('📝 Building poem pages...');
  for (const poem of poems) {
    const html = buildPoemPage(poem, collections, poems);
    await writeFile(join(PUBLIC_DIR, 'poems', `${poem.slug}.html`), html, 'utf-8');
  }
  console.log(`  ✅ ${poems.length} poem pages\n`);

  // Build collection pages
  console.log('📖 Building collection pages...');
  for (const collection of collections) {
    const html = buildCollectionPage(collection, poems);
    await writeFile(join(PUBLIC_DIR, 'collections', `${collection.slug}.html`), html, 'utf-8');
  }
  console.log(`  ✅ ${collections.length} collection pages\n`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalPages = 2 + poems.length + collections.length;
  console.log('═══════════════════════════════════════');
  console.log(`  ✅ Built ${totalPages} pages in ${duration}s`);
  console.log(`  📁 Output: ./public/`);
  console.log(`  💡 Run "npm run dev" to preview`);
  console.log('═══════════════════════════════════════\n');
}

main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});