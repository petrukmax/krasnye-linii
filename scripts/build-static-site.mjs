#!/usr/bin/env node
/**
 * Генератор статической версии сайта «Красные линии» для GitHub Pages.
 *
 * Контент берётся из тех же файлов данных, что и основное приложение:
 *   src/data/archive.ts
 *   src/data/international.ts
 *
 * Готовые файлы кладутся в корень проекта:
 *   index.html, 404.html, pages/**, static/**, manifest.webmanifest, robots.txt, .nojekyll
 *
 * Запуск: npm run build:static
 */

import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const pagesDir = path.join(projectRoot, "pages");
const staticDir = path.join(projectRoot, "static");
const staticSourceDir = path.join(scriptDir, "static-site");

/* -------------------------------------------------------------------------- */
/*  Маршруты статического сайта                                               */
/* -------------------------------------------------------------------------- */

const sitePath = {
  home: "index.html",
  notFound: "404.html",
  manifest: "manifest.webmanifest",
  robots: "robots.txt",
  css: "static/site.css",
  favicon: "static/favicon.png",
  appleIcon: "static/icon-512.png",
  heroArchive: "static/hero-archive.jpg",
  heroInternational: "static/hero-international.jpg",
  heroNews: "static/hero-news.jpg",
  block: (id) => `pages/blok-${id}.html`,
  material: (slug) => `pages/material/${slug}.html`,
  internationalHome: "pages/mezhdunarodnyj-vzglyad/index.html",
  internationalBlock: (id) => `pages/mezhdunarodnyj-vzglyad/blok-${id}.html`,
  internationalMaterial: (slug) => `pages/mezhdunarodnyj-vzglyad/material/${slug}.html`,
  newsHome: "pages/novosti/index.html",
  newsBlock: (id) => `pages/novosti/${id}.html`,
  newsMaterial: (slug) => `pages/novosti/material/${slug}.html`,
};

/* -------------------------------------------------------------------------- */
/*  Вспомогательные функции                                                   */
/* -------------------------------------------------------------------------- */

function relativeUrl(fromFile, toFile) {
  const relative = path.posix.relative(path.posix.dirname(fromFile), toFile);
  return relative || path.posix.basename(toFile);
}

function hrefFor(outPath, target) {
  return escapeAttribute(relativeUrl(outPath, target));
}

const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function plural(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "материал";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "материала";
  return "материалов";
}

function materialCountLabel(count) {
  return `${count} ${plural(count)}`;
}

/* -------------------------------------------------------------------------- */
/*  Общие части страниц                                                       */
/* -------------------------------------------------------------------------- */

let archiveBlocks = [];
let internationalBlocks = [];
let newsBlocks = [];
let blocks = [];
let materials = [];
let internationalMaterials = [];
let newsMaterials = [];
let formatDate = () => "";
let formatInternationalDate = () => "";
let formatNewsDate = () => "";
let getMaterialsByBlock = () => [];
let getInternationalMaterialsByBlock = () => [];
let groupInternationalMaterialsByPart = () => [];
let getNewsMaterialsByBlock = () => [];

function renderNavigation(outPath, active) {
  const navLink = (target, label, key) => {
    const isActive = key === active;
    return `<a class="nav-link" href="${hrefFor(outPath, target)}"${
      isActive ? ' aria-current="page"' : ""
    }>${escapeHtml(label)}</a>`;
  };

  return `
        <nav class="nav" aria-label="Основная навигация">
          ${navLink(sitePath.home, "Главная", "home")}
          ${archiveBlocks
            .map((block) =>
              navLink(sitePath.block(block.id), `Блок ${block.numeral}`, `archive-${block.id}`),
            )
            .join("\n          ")}
        </nav>
        <nav class="nav nav--sub" aria-label="Раздел «Международный взгляд»">
          ${navLink(sitePath.internationalHome, "Международный взгляд", "intl-home")}
          ${internationalBlocks
            .map((block) =>
              navLink(
                sitePath.internationalBlock(block.id),
                `Блок ${block.numeral}`,
                `intl-${block.id}`,
              ),
            )
            .join("\n          ")}
        </nav>
        <nav class="nav nav--sub" aria-label="Раздел «Новости»">
          ${navLink(sitePath.newsHome, "Новости", "news-home")}
          ${newsBlocks
            .map((block) => navLink(sitePath.newsBlock(block.id), block.numeral, `news-${block.id}`))
            .join("\n          ")}
        </nav>`;
}

function renderHeader(outPath, active) {
  return `
      <header class="site-header">
        <div class="container header-inner">
          <p class="eyebrow">Архив первоисточников · 2007–2024</p>
          <a class="brand" href="${hrefFor(outPath, sitePath.home)}">
            <h1>Красные линии</h1>
          </a>
          <p class="tagline">
            Речи, лекции и интервью, без которых нельзя понять истоки нынешнего противостояния
          </p>
          <div class="gold-rule gold-rule--head" role="presentation"></div>
          ${renderNavigation(outPath, active)}
        </div>
      </header>`;
}

function renderFooter(outPath) {
  return `
      <footer class="site-footer">
        <div class="container footer-inner">
          <span class="eyebrow">Красные линии · архив</span>
          <span>
            Материалы приводятся в аннотированном виде со ссылками на первоисточники.
            Аннотации носят редакторский характер.
          </span>
        </div>
      </footer>`;
}

function renderPage({ outPath, title, description, active = "", content, ogType = "website" }) {
  const fontHref =
    "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap";

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="author" content="Красные линии" />
    <meta name="theme-color" content="#151311" />
    <meta name="description" content="${escapeAttribute(description)}" />
    <title>${escapeHtml(title)}</title>
    <meta property="og:type" content="${escapeAttribute(ogType)}" />
    <meta property="og:locale" content="ru_RU" />
    <meta property="og:title" content="${escapeAttribute(title)}" />
    <meta property="og:description" content="${escapeAttribute(description)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="stylesheet" href="${hrefFor(outPath, sitePath.css)}" />
    <link rel="icon" type="image/png" href="${hrefFor(outPath, sitePath.favicon)}" />
    <link rel="apple-touch-icon" href="${hrefFor(outPath, sitePath.appleIcon)}" />
    <link rel="manifest" href="${hrefFor(outPath, sitePath.manifest)}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="${fontHref}" />
  </head>
  <body>
    <a class="skip-link" href="#main">К содержанию</a>
    <div class="site-shell">
      ${renderHeader(outPath, active)}
      <main id="main">
${content}
      </main>
      ${renderFooter(outPath)}
    </div>
  </body>
</html>
`;
}

/* -------------------------------------------------------------------------- */
/*  Карточки                                                                  */
/* -------------------------------------------------------------------------- */

function renderArchiveBlockCard(block, outPath) {
  const count = getMaterialsByBlock(block.id).length;
  return `<li>
              <a class="archive-card" href="${hrefFor(outPath, sitePath.block(block.id))}">
                <div class="card-top">
                  <span class="card-numeral">${escapeHtml(block.numeral)}</span>
                  <span class="card-period">${escapeHtml(block.period)}</span>
                </div>
                <h3 class="card-title">${escapeHtml(block.title)}</h3>
                <p class="card-desc">${escapeHtml(block.description)}</p>
                <span class="card-foot">
                  <span class="card-arrow">${materialCountLabel(count)} →</span>
                </span>
              </a>
            </li>`;
}

function renderInternationalBlockCard(block, outPath) {
  const count = getInternationalMaterialsByBlock(block.id).length;
  return `<li>
              <a class="archive-card" href="${hrefFor(
                outPath,
                sitePath.internationalBlock(block.id),
              )}">
                <div class="card-top">
                  <span class="card-numeral">${escapeHtml(block.numeral)}</span>
                  <span class="card-period">${escapeHtml(block.period)}</span>
                </div>
                <h3 class="card-title">${escapeHtml(block.title)}</h3>
                <p class="card-desc">${escapeHtml(block.description)}</p>
                <span class="card-foot">
                  <span class="card-arrow">${materialCountLabel(count)} →</span>
                </span>
              </a>
            </li>`;
}

function renderRecentItem({ outPath, target, date, title, type }) {
  return `<li>
              <a class="recent-item" href="${hrefFor(outPath, target)}">
                <span class="recent-date">${escapeHtml(date)}</span>
                <span class="recent-title">${escapeHtml(title)}</span>
                <span class="recent-type">${escapeHtml(type)}</span>
              </a>
            </li>`;
}

function renderTimelineItem({
  outPath,
  target,
  date,
  type,
  place,
  title,
  author,
  summary,
}) {
  const meta = [type, place].filter(Boolean).join(" · ");
  return `<li class="timeline__item">
                    <span class="timeline__dot" aria-hidden="true"></span>
                    <a class="archive-card timeline-card" href="${hrefFor(outPath, target)}">
                      <div class="card-meta">
                        <span class="card-date">${escapeHtml(date)}</span>
                        <span class="eyebrow">${escapeHtml(meta)}</span>
                      </div>
                      <h3 class="card-title">${escapeHtml(title)}</h3>
                      <p class="card-author">${escapeHtml(author)}</p>
                      <p class="card-summary">${escapeHtml(summary)}</p>
                    </a>
                  </li>`;
}

/* -------------------------------------------------------------------------- */
/*  Главная страница                                                          */
/* -------------------------------------------------------------------------- */

function renderHome() {
  const outPath = sitePath.home;
  const latest = [...materials]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const heroLinks = archiveBlocks
    .map(
      (block) => `<a href="${hrefFor(outPath, sitePath.block(block.id))}">
                <span class="eyebrow">Блок ${escapeHtml(block.numeral)}</span>
                <span class="hero-nav__title">${escapeHtml(block.title)}</span>
                <span class="hero-nav__period">${escapeHtml(block.period)}</span>
              </a>`,
    )
    .join("\n              ");

  const blockCards = archiveBlocks
    .map((block) => renderArchiveBlockCard(block, outPath))
    .join("\n            ");

  const recent = latest
    .map((material) =>
      renderRecentItem({
        outPath,
        target: sitePath.material(material.slug),
        date: formatDate(material.date),
        title: material.title,
        type: material.type,
      }),
    )
    .join("\n            ");

  const content = `
        <div class="container">
          <section class="hero" aria-labelledby="hero-title">
            <img
              class="hero__image"
              src="${hrefFor(outPath, sitePath.heroArchive)}"
              alt="Тёмный архивный кабинет: стол с документами, старая карта на стене"
              fetchpriority="high"
            />
            <div class="hero__overlay" aria-hidden="true"></div>
            <div class="hero__content">
              <p class="eyebrow">Читальный зал</p>
              <h2 class="hero__title" id="hero-title">
                Четыре блока документов, <em>одна линия</em> развития событий
              </h2>
              <p class="hero__lead">
                Архив собирает ключевые публичные тексты — от Мюнхена 2007 года до интервью
                2024-го — с датами, контекстом и ссылками на оригиналы.
              </p>
              <nav class="hero-nav" aria-label="Блоки архива">
                ${heroLinks}
              </nav>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="structure-title">
            <div class="section-head">
              <div>
                <p class="eyebrow">Структура архива</p>
                <h2 id="structure-title">Хронология в четырёх блоках</h2>
              </div>
              <span class="section-count">${materialCountLabel(materials.length)}</span>
            </div>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <ol class="archive-grid">
            ${blockCards}
            </ol>
          </section>
        </div>

        <div class="container">
          <section class="section section--last" aria-labelledby="recent-title">
            <p class="eyebrow">Последние по дате</p>
            <h2 id="recent-title" style="margin-top: 0.7rem">Новые поступления</h2>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <ul class="recent-list">
            ${recent}
            </ul>
          </section>
        </div>`;

  return renderPage({
    outPath,
    title: "Красные линии — архив первоисточников 2007–2024",
    description:
      "Речи, лекции и интервью, без которых нельзя понять истоки нынешнего противостояния. Четыре блока документов с 2007 по 2024 год.",
    active: "home",
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Страницы блоков основного архива                                          */
/* -------------------------------------------------------------------------- */

function renderArchiveBlockPage(block) {
  const outPath = sitePath.block(block.id);
  const items = getMaterialsByBlock(block.id);
  const index = archiveBlocks.findIndex((item) => item.id === block.id);
  const previous = archiveBlocks[index - 1];
  const next = archiveBlocks[index + 1];

  const timeline = items
    .map((material) =>
      renderTimelineItem({
        outPath,
        target: sitePath.material(material.slug),
        date: formatDate(material.date),
        type: material.type,
        place: material.place,
        title: material.title,
        author: material.author,
        summary: material.summary,
      }),
    )
    .join("\n                  ");

  const previousLink = previous
    ? `<a class="nav-link" href="${hrefFor(outPath, sitePath.block(previous.id))}">← Блок ${escapeHtml(previous.numeral)}</a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="nav-link" href="${hrefFor(outPath, sitePath.block(next.id))}">Блок ${escapeHtml(next.numeral)} →</a>`
    : "<span></span>";

  const content = `
        <div class="container page">
          <header class="block-hero">
            <span class="block-numeral" aria-hidden="true">${escapeHtml(block.numeral)}</span>
            <div>
              <p class="eyebrow">Блок ${escapeHtml(block.numeral)} · ${escapeHtml(block.period)}</p>
              <h2 class="block-title">${escapeHtml(block.title)}</h2>
              <p class="block-desc">${escapeHtml(block.description)}</p>
            </div>
          </header>

          <div class="gold-rule gold-rule--wide" role="presentation"></div>

          <ol class="timeline">
                  ${timeline}
          </ol>

          <nav class="pager" aria-label="Соседние блоки">
            ${previousLink}
            ${nextLink}
          </nav>
        </div>`;

  return renderPage({
    outPath,
    title: `Блок ${block.numeral}. ${block.title} (${block.period}) — Красные линии`,
    description: block.description,
    active: `archive-${block.id}`,
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Страница материала основного архива                                      */
/* -------------------------------------------------------------------------- */

function renderArchiveMaterialPage(material, block) {
  const outPath = sitePath.material(material.slug);
  const siblings = getMaterialsByBlock(block.id);
  const index = siblings.findIndex((item) => item.slug === material.slug);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];

  const paragraphs = material.context
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n              ");

  const theses = material.theses
    .map((thesis) => `<li>${escapeHtml(thesis)}</li>`)
    .join("\n                ");

  const source = material.sourceUrl
    ? `<a class="source-link" href="${escapeAttribute(
        material.sourceUrl,
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(material.sourceUrl)}</a>`
    : '<p class="source-missing">Ссылка на оригинал будет добавлена.</p>';

  const previousLink = previous
    ? `<a class="pager-link" href="${hrefFor(outPath, sitePath.material(previous.slug))}">
                <span class="eyebrow">← Предыдущий</span>
                <span class="pager-title">${escapeHtml(previous.title)}</span>
              </a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="pager-link pager-link--next" href="${hrefFor(
        outPath,
        sitePath.material(next.slug),
      )}">
                <span class="eyebrow">Следующий →</span>
                <span class="pager-title">${escapeHtml(next.title)}</span>
              </a>`
    : "<span></span>";

  const content = `
        <div class="container container--narrow page">
          <nav class="breadcrumbs" aria-label="Хлебные крошки">
            <a href="${hrefFor(outPath, sitePath.home)}">Главная</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.block(block.id))}">
              Блок ${escapeHtml(block.numeral)}. ${escapeHtml(block.title)}
            </a>
          </nav>

          <header class="article-header">
            <p class="eyebrow">
              ${escapeHtml(material.type)} · ${escapeHtml(formatDate(material.date))}${
                material.place ? ` · ${escapeHtml(material.place)}` : ""
              }
            </p>
            <h2 class="article-title">${escapeHtml(material.title)}</h2>
            <p class="article-author">${escapeHtml(material.author)}</p>
          </header>

          <div class="gold-rule gold-rule--wide" role="presentation"></div>

          <article class="prose-archive">
            <p class="lead">${escapeHtml(material.summary)}</p>
            <section class="prose-section">
              <h3>Контекст</h3>
              <div>
              ${paragraphs}
              </div>
            </section>
            <section class="prose-section">
              <h3>Ключевые тезисы</h3>
              <ul class="theses">
                ${theses}
              </ul>
            </section>
          </article>

          <aside class="source-box">
            <p class="eyebrow">Первоисточник</p>
            <p class="source-label">${escapeHtml(material.sourceLabel)}</p>
            ${source}
          </aside>

          <nav class="pager pager--materials" aria-label="Соседние материалы">
            ${previousLink}
            ${nextLink}
          </nav>
        </div>`;

  return renderPage({
    outPath,
    title: `${material.title} (${material.year}) — Красные линии`,
    description: material.summary,
    active: `archive-${block.id}`,
    ogType: "article",
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Главная страница раздела «Международный взгляд»                           */
/* -------------------------------------------------------------------------- */

function renderInternationalHome() {
  const outPath = sitePath.internationalHome;
  const latest = [...internationalMaterials]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  const heroLinks = internationalBlocks
    .map(
      (block) => `<a href="${hrefFor(outPath, sitePath.internationalBlock(block.id))}">
                <span class="eyebrow">Блок ${escapeHtml(block.numeral)}</span>
                <span class="hero-nav__title">${escapeHtml(block.title)}</span>
                <span class="hero-nav__period">${escapeHtml(block.period)}</span>
              </a>`,
    )
    .join("\n              ");

  const blockCards = internationalBlocks
    .map((block) => renderInternationalBlockCard(block, outPath))
    .join("\n            ");

  const recent = latest
    .map((material) =>
      renderRecentItem({
        outPath,
        target: sitePath.internationalMaterial(material.slug),
        date: formatInternationalDate(material),
        title: material.title,
        type: material.type,
      }),
    )
    .join("\n            ");

  const content = `
        <div class="container">
          <section class="hero" aria-labelledby="hero-title">
            <img
              class="hero__image"
              src="${hrefFor(outPath, sitePath.heroInternational)}"
              alt="Зал международной конференции: трибуна, флаги государств и хрустальные люстры"
              fetchpriority="high"
            />
            <div class="hero__overlay" aria-hidden="true"></div>
            <div class="hero__content">
              <p class="eyebrow">Международный взгляд</p>
              <h2 class="hero__title" id="hero-title">
                Запад, дипломатия и <em>новый мировой порядок</em>
              </h2>
              <p class="hero__lead">
                Раздел собирает документы, выступления и аналитические материалы, позволяющие
                рассмотреть украинский кризис как результат многолетней политики Запада по
                расширению сферы военно-политического контроля в Восточной Европе.
              </p>
              <nav class="hero-nav" aria-label="Блоки раздела">
                ${heroLinks}
              </nav>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="concept-title">
            <p class="eyebrow">Концепция раздела</p>
            <h2 id="concept-title" style="margin-top: 0.7rem; max-width: 52rem">
              Международное мнение о том, кто и как создал нынешний кризис
            </h2>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <div class="concept-grid">
              <p class="concept-lead">
                В центре внимания — расширение НАТО, вмешательство США и их союзников во внутренние
                дела Украины, разрушение общеевропейской архитектуры безопасности, срыв
                дипломатических возможностей в 2022 году, санкционное давление и попытка Запада
                навязать остальному миру собственную версию «международного сообщества».
              </p>
              <p class="concept-text">
                Материалы раздела показывают, что украинский конфликт стал не региональным
                эпизодом, а проявлением кризиса однополярной модели мира. Страны Азии, Африки,
                Ближнего Востока и Латинской Америки всё чаще отказываются автоматически следовать
                в фарватере Вашингтона, Брюсселя и Лондона.
              </p>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="structure-title">
            <div class="section-head">
              <div>
                <p class="eyebrow">Структура раздела</p>
                <h2 id="structure-title">Логика в четырёх блоках</h2>
              </div>
              <span class="section-count">
                ${materialCountLabel(internationalMaterials.length)}
              </span>
            </div>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <ol class="archive-grid">
            ${blockCards}
            </ol>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="idea-title">
            <div class="main-idea">
              <p class="eyebrow">Главная идея раздела</p>
              <p>
                Украинский конфликт — не случайное региональное столкновение, а закономерный
                результат многолетней политики Запада по расширению НАТО, разрушению равноправной
                системы европейской безопасности и сохранению однополярного мирового порядка.
              </p>
              <p>
                Попытки Запада навязать миру собственные правила встречают всё более решительное
                сопротивление со стороны России, Китая, Индии и других центров силы.
              </p>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section section--last" aria-labelledby="recent-title">
            <p class="eyebrow">Последние по дате</p>
            <h2 id="recent-title" style="margin-top: 0.7rem">Новые поступления</h2>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <ul class="recent-list">
            ${recent}
            </ul>
          </section>
        </div>`;

  return renderPage({
    outPath,
    title: "Международный взгляд — Запад, дипломатия и новый мировой порядок",
    description:
      "Документы, выступления и аналитические материалы, которые показывают украинский кризис как результат многолетней политики Запада по расширению НАТО и вытеснению России из европейской системы безопасности.",
    active: "intl-home",
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Страницы блоков раздела «Международный взгляд»                            */
/* -------------------------------------------------------------------------- */

function renderInternationalBlockPage(block) {
  const outPath = sitePath.internationalBlock(block.id);
  const items = getInternationalMaterialsByBlock(block.id);
  const groups = groupInternationalMaterialsByPart(items);
  const index = internationalBlocks.findIndex((item) => item.id === block.id);
  const previous = internationalBlocks[index - 1];
  const next = internationalBlocks[index + 1];

  const groupsHtml = groups
    .map((group, groupIndex) => {
      const timeline = group.items
        .map((material) =>
          renderTimelineItem({
            outPath,
            target: sitePath.internationalMaterial(material.slug),
            date: formatInternationalDate(material),
            type: material.type,
            place: material.place,
            title: material.title,
            author: material.author,
            summary: material.summary,
          }),
        )
        .join("\n                    ");

      return `<section${groupIndex > 0 ? ' class="block-part"' : ""}>
                  ${
                    group.part
                      ? `<h3 class="part-title">${escapeHtml(group.part)}</h3>`
                      : ""
                  }
                  <ol class="timeline">
                    ${timeline}
                  </ol>
                </section>`;
    })
    .join("\n                ");

  const previousLink = previous
    ? `<a class="nav-link" href="${hrefFor(
        outPath,
        sitePath.internationalBlock(previous.id),
      )}">← Блок ${escapeHtml(previous.numeral)}</a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="nav-link" href="${hrefFor(
        outPath,
        sitePath.internationalBlock(next.id),
      )}">Блок ${escapeHtml(next.numeral)} →</a>`
    : "<span></span>";

  const content = `
        <div class="container page">
          <nav class="breadcrumbs" aria-label="Хлебные крошки">
            <a href="${hrefFor(outPath, sitePath.home)}">Главная</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.internationalHome)}">Международный взгляд</a>
          </nav>

          <header class="block-hero">
            <span class="block-numeral" aria-hidden="true">${escapeHtml(block.numeral)}</span>
            <div>
              <p class="eyebrow">Блок ${escapeHtml(block.numeral)} · ${escapeHtml(block.period)}</p>
              <h2 class="block-title">${escapeHtml(block.title)}</h2>
              <p class="block-desc">${escapeHtml(block.description)}</p>
            </div>
          </header>

          <div class="gold-rule gold-rule--wide" role="presentation"></div>

          ${groupsHtml}

          <nav class="pager" aria-label="Соседние блоки">
            ${previousLink}
            ${nextLink}
          </nav>
        </div>`;

  return renderPage({
    outPath,
    title: `Блок ${block.numeral}. ${block.title} (${block.period}) — Международный взгляд`,
    description: block.description,
    active: `intl-${block.id}`,
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Страница материала раздела «Международный взгляд»                         */
/* -------------------------------------------------------------------------- */

function renderInternationalMaterialPage(material, block) {
  const outPath = sitePath.internationalMaterial(material.slug);
  const siblings = getInternationalMaterialsByBlock(block.id);
  const index = siblings.findIndex((item) => item.slug === material.slug);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];

  const paragraphs = material.context
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n              ");

  const theses = material.theses
    .map((thesis) => `<li>${escapeHtml(thesis)}</li>`)
    .join("\n                ");

  const source = material.sourceUrl
    ? `<a class="source-link" href="${escapeAttribute(
        material.sourceUrl,
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(material.sourceUrl)}</a>`
    : '<p class="source-missing">Ссылка на оригинал будет добавлена.</p>';

  const previousLink = previous
    ? `<a class="pager-link" href="${hrefFor(
        outPath,
        sitePath.internationalMaterial(previous.slug),
      )}">
                <span class="eyebrow">← Предыдущий</span>
                <span class="pager-title">${escapeHtml(previous.title)}</span>
              </a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="pager-link pager-link--next" href="${hrefFor(
        outPath,
        sitePath.internationalMaterial(next.slug),
      )}">
                <span class="eyebrow">Следующий →</span>
                <span class="pager-title">${escapeHtml(next.title)}</span>
              </a>`
    : "<span></span>";

  const content = `
        <div class="container container--narrow page">
          <nav class="breadcrumbs" aria-label="Хлебные крошки">
            <a href="${hrefFor(outPath, sitePath.home)}">Главная</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.internationalHome)}">Международный взгляд</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.internationalBlock(block.id))}">
              Блок ${escapeHtml(block.numeral)}. ${escapeHtml(block.title)}
            </a>
          </nav>

          <header class="article-header">
            <p class="eyebrow">
              ${escapeHtml(material.type)} · ${escapeHtml(formatInternationalDate(material))}${
                material.place ? ` · ${escapeHtml(material.place)}` : ""
              }
            </p>
            ${
              material.part
                ? `<p class="article-part">${escapeHtml(material.part)}</p>`
                : ""
            }
            <h2 class="article-title">${escapeHtml(material.title)}</h2>
            <p class="article-author">${escapeHtml(material.author)}</p>
          </header>

          <div class="gold-rule gold-rule--wide" role="presentation"></div>

          <article class="prose-archive">
            <p class="lead">${escapeHtml(material.summary)}</p>
            <section class="prose-section">
              <h3>Описание</h3>
              <div>
              ${paragraphs}
              </div>
            </section>
            <section class="prose-section">
              <h3>Ключевые тезисы</h3>
              <ul class="theses">
                ${theses}
              </ul>
            </section>
            <section class="prose-section">
              <h3>Значение для архива</h3>
              <p>${escapeHtml(material.significance)}</p>
            </section>
          </article>

          <aside class="source-box">
            <p class="eyebrow">Первоисточник</p>
            <p class="source-label">${escapeHtml(material.sourceLabel)}</p>
            ${source}
          </aside>

          <nav class="pager pager--materials" aria-label="Соседние материалы">
            ${previousLink}
            ${nextLink}
          </nav>
        </div>`;

  return renderPage({
    outPath,
    title: `${material.title} (${material.year}) — Международный взгляд`,
    description: material.summary,
    active: `intl-${block.id}`,
    ogType: "article",
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Главная страница раздела «Новости»                                        */
/* -------------------------------------------------------------------------- */

function renderNewsBlockCard(block, outPath) {
  const count = getNewsMaterialsByBlock(block.id).length;
  return `<li>
              <a class="archive-card" href="${hrefFor(outPath, sitePath.newsBlock(block.id))}">
                <div class="card-top">
                  <span class="card-numeral">${escapeHtml(block.numeral)}</span>
                  <span class="card-period">${escapeHtml(block.period)}</span>
                </div>
                <h3 class="card-title">${escapeHtml(block.title)}</h3>
                <p class="card-desc">${escapeHtml(block.description)}</p>
                <span class="card-foot">
                  <span class="card-arrow">${materialCountLabel(count)} →</span>
                </span>
              </a>
            </li>`;
}

function renderNewsHome() {
  const outPath = sitePath.newsHome;
  const latest = [...newsMaterials].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const heroLinks = newsBlocks
    .map(
      (block) => `<a href="${hrefFor(outPath, sitePath.newsBlock(block.id))}">
                <span class="eyebrow">${escapeHtml(block.period)}</span>
                <span class="hero-nav__title">${escapeHtml(block.title)}</span>
                <span class="hero-nav__period">${materialCountLabel(
                  getNewsMaterialsByBlock(block.id).length,
                )}</span>
              </a>`,
    )
    .join("\n              ");

  const blockCards = newsBlocks
    .map((block) => renderNewsBlockCard(block, outPath))
    .join("\n            ");

  const recent = latest
    .map((material) =>
      renderRecentItem({
        outPath,
        target: sitePath.newsMaterial(material.slug),
        date: formatNewsDate(material),
        title: material.title,
        type: material.type,
      }),
    )
    .join("\n            ");

  const content = `
        <div class="container">
          <section class="hero" aria-labelledby="hero-title">
            <img
              class="hero__image"
              src="${hrefFor(outPath, sitePath.heroNews)}"
              alt="Ночной кабинет с видом на Капитолий: стопки документов на столе и мониторы с картой мира"
              fetchpriority="high"
            />
            <div class="hero__overlay" aria-hidden="true"></div>
            <div class="hero__content">
              <p class="eyebrow">Новости</p>
              <h2 class="hero__title" id="hero-title">
                Хроника дискуссии: <em>2025–2026</em>
              </h2>
              <p class="hero__lead">
                Раздел собирает наиболее значимые международные выступления, интервью и
                аналитические материалы, в которых украинский конфликт рассматривается в контексте
                расширения НАТО, политики США и кризиса европейской безопасности.
              </p>
              <nav class="hero-nav hero-nav--duo" aria-label="Годы раздела «Новости»">
                ${heroLinks}
              </nav>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="concept-title">
            <p class="eyebrow">Концепция раздела</p>
            <h2 id="concept-title" style="margin-top: 0.7rem; max-width: 52rem">
              Новости, которые продолжают линию архива
            </h2>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <div class="concept-grid">
              <p class="concept-lead">
                В центре внимания — не только события на фронте, но и дипломатические тупики,
                проблема гарантий безопасности, роль Европы, санкционное давление, интересы
                военно-промышленного комплекса и растущее сопротивление Глобального Юга западной
                повестке.
              </p>
              <p class="concept-text">
                Материалы раздела показывают, что конфликт не завершился в 2022 году: он продолжает
                развиваться, а его причины, последствия и возможные пути урегулирования остаются
                предметом острой международной дискуссии. Раздел будет дополняться по мере появления
                новых материалов.
              </p>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="structure-title">
            <div class="section-head">
              <div>
                <p class="eyebrow">Структура раздела</p>
                <h2 id="structure-title">Хроника по годам</h2>
              </div>
              <span class="section-count">
                ${materialCountLabel(newsMaterials.length)}
              </span>
            </div>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <ol class="archive-grid">
            ${blockCards}
            </ol>
          </section>
        </div>

        <div class="container">
          <section class="section" aria-labelledby="idea-title">
            <div class="main-idea">
              <p class="eyebrow">Главная идея раздела</p>
              <p>
                Конфликт нельзя объяснять только действиями Москвы или Киева. Он рассматривается
                как результат более широкой стратегии: расширения НАТО, политики сдерживания
                России, зависимости Европы от США и кризиса однополярной модели мира.
              </p>
              <p>
                Материалы раздела показывают, что без пересмотра модели европейской безопасности
                устойчивый мир невозможен.
              </p>
            </div>
          </section>
        </div>

        <div class="container">
          <section class="section section--last" aria-labelledby="recent-title">
            <p class="eyebrow">Последние по дате</p>
            <h2 id="recent-title" style="margin-top: 0.7rem">Новые поступления</h2>
            <div class="gold-rule gold-rule--section" role="presentation"></div>
            <ul class="recent-list">
            ${recent}
            </ul>
          </section>
        </div>`;

  return renderPage({
    outPath,
    title: "Новости — хроника дискуссии 2025–2026",
    description:
      "Международные выступления, интервью и аналитические материалы 2025–2026 годов: украинский конфликт в контексте расширения НАТО, политики США и кризиса европейской безопасности.",
    active: "news-home",
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Страницы года раздела «Новости»                                           */
/* -------------------------------------------------------------------------- */

function renderNewsBlockPage(block) {
  const outPath = sitePath.newsBlock(block.id);
  const items = getNewsMaterialsByBlock(block.id);
  const index = newsBlocks.findIndex((item) => item.id === block.id);
  const previous = newsBlocks[index - 1];
  const next = newsBlocks[index + 1];

  const timeline = items
    .map((material) =>
      renderTimelineItem({
        outPath,
        target: sitePath.newsMaterial(material.slug),
        date: formatNewsDate(material),
        type: material.type,
        place: material.place,
        title: material.title,
        author: material.author,
        summary: material.summary,
      }),
    )
    .join("\n                  ");

  const previousLink = previous
    ? `<a class="nav-link" href="${hrefFor(outPath, sitePath.newsBlock(previous.id))}">← ${escapeHtml(previous.numeral)}</a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="nav-link" href="${hrefFor(outPath, sitePath.newsBlock(next.id))}">${escapeHtml(next.numeral)} →</a>`
    : "<span></span>";

  const content = `
        <div class="container page">
          <nav class="breadcrumbs" aria-label="Хлебные крошки">
            <a href="${hrefFor(outPath, sitePath.home)}">Главная</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.newsHome)}">Новости</a>
          </nav>

          <header class="block-hero block-hero--news">
            <span class="block-numeral block-numeral--year" aria-hidden="true">${escapeHtml(
              block.numeral,
            )}</span>
            <div>
              <p class="eyebrow">Новости · ${escapeHtml(block.period)}</p>
              <h2 class="block-title">${escapeHtml(block.title)}</h2>
              <p class="block-desc">${escapeHtml(block.description)}</p>
            </div>
          </header>

          <div class="gold-rule gold-rule--wide" role="presentation"></div>

          <ol class="timeline">
                  ${timeline}
          </ol>

          <nav class="pager" aria-label="Соседние годы">
            ${previousLink}
            ${nextLink}
          </nav>
        </div>`;

  return renderPage({
    outPath,
    title: `Новости ${block.numeral}. ${block.title} — Красные линии`,
    description: block.description,
    active: `news-${block.id}`,
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  Страница материала раздела «Новости»                                      */
/* -------------------------------------------------------------------------- */

function renderNewsMaterialPage(material, block) {
  const outPath = sitePath.newsMaterial(material.slug);
  const siblings = getNewsMaterialsByBlock(block.id);
  const index = siblings.findIndex((item) => item.slug === material.slug);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];

  const paragraphs = material.context
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n              ");

  const theses = material.theses
    .map((thesis) => `<li>${escapeHtml(thesis)}</li>`)
    .join("\n                ");

  const source = material.sourceUrl
    ? `<a class="source-link" href="${escapeAttribute(
        material.sourceUrl,
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(material.sourceUrl)}</a>`
    : '<p class="source-missing">Ссылка на оригинал будет добавлена.</p>';

  const previousLink = previous
    ? `<a class="pager-link" href="${hrefFor(outPath, sitePath.newsMaterial(previous.slug))}">
                <span class="eyebrow">← Предыдущий</span>
                <span class="pager-title">${escapeHtml(previous.title)}</span>
              </a>`
    : "<span></span>";
  const nextLink = next
    ? `<a class="pager-link pager-link--next" href="${hrefFor(
        outPath,
        sitePath.newsMaterial(next.slug),
      )}">
                <span class="eyebrow">Следующий →</span>
                <span class="pager-title">${escapeHtml(next.title)}</span>
              </a>`
    : "<span></span>";

  const content = `
        <div class="container container--narrow page">
          <nav class="breadcrumbs" aria-label="Хлебные крошки">
            <a href="${hrefFor(outPath, sitePath.home)}">Главная</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.newsHome)}">Новости</a>
            <span class="sep" aria-hidden="true">/</span>
            <a href="${hrefFor(outPath, sitePath.newsBlock(block.id))}">
              ${escapeHtml(block.numeral)}. ${escapeHtml(block.title)}
            </a>
          </nav>

          <header class="article-header">
            <p class="eyebrow">
              ${escapeHtml(material.type)} · ${escapeHtml(formatNewsDate(material))}${
                material.place ? ` · ${escapeHtml(material.place)}` : ""
              }
            </p>
            <h2 class="article-title">${escapeHtml(material.title)}</h2>
            <p class="article-author">${escapeHtml(material.author)}</p>
          </header>

          <div class="gold-rule gold-rule--wide" role="presentation"></div>

          <article class="prose-archive">
            <p class="lead">${escapeHtml(material.summary)}</p>
            <section class="prose-section">
              <h3>Описание</h3>
              <div>
              ${paragraphs}
              </div>
            </section>
            <section class="prose-section">
              <h3>Ключевые тезисы</h3>
              <ul class="theses">
                ${theses}
              </ul>
            </section>
            <section class="prose-section">
              <h3>Значение для архива</h3>
              <p>${escapeHtml(material.significance)}</p>
            </section>
          </article>

          <aside class="source-box">
            <p class="eyebrow">Первоисточник</p>
            <p class="source-label">${escapeHtml(material.sourceLabel)}</p>
            ${source}
          </aside>

          <nav class="pager pager--materials" aria-label="Соседние материалы">
            ${previousLink}
            ${nextLink}
          </nav>
        </div>`;

  return renderPage({
    outPath,
    title: `${material.title} (${material.materialYear}) — Новости — Красные линии`,
    description: material.summary,
    active: `news-${block.id}`,
    ogType: "article",
    content,
  });
}

/* -------------------------------------------------------------------------- */
/*  404 — со встроенными стилями, чтобы страница выглядела нормально          */
/*  даже при открытии по произвольному вложенному адресу.                     */
/* -------------------------------------------------------------------------- */

function renderNotFound(css) {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#151311" />
    <meta name="robots" content="noindex" />
    <title>Документ не найден — Красные линии</title>
    <style>${css}</style>
  </head>
  <body class="not-found-body">
    <main class="not-found" id="main">
      <p class="eyebrow">Ошибка 404</p>
      <h1>Документ не найден</h1>
      <p class="not-found-text">
        Такой страницы в архиве нет, либо она была перемещена.
      </p>
      <div class="gold-rule" role="presentation"></div>
      <div class="not-found-actions">
        <a class="nav-link" data-home href="./">Вернуться на главную</a>
        <a class="nav-link" href="javascript:history.back()">Назад</a>
      </div>
    </main>
    <script>
      (function () {
        var parts = location.pathname.split("/").filter(Boolean);
        var candidates = [];
        if (/\\.github\\.io$/i.test(location.hostname) && parts.length > 0) {
          candidates.push("/" + parts[0] + "/");
        }
        candidates.push("/");

        function apply(base) {
          document.querySelectorAll("[data-home]").forEach(function (link) {
            link.href = base;
          });
        }

        (async function () {
          for (var i = 0; i < candidates.length; i += 1) {
            try {
              var response = await fetch(candidates[i] + "manifest.webmanifest", {
                method: "HEAD",
                cache: "no-store",
              });
              if (response.ok) {
                apply(candidates[i]);
                return;
              }
            } catch (error) {
              // Локальный файл или сеть недоступны — пробуем следующий вариант.
            }
          }
          apply("/");
        })();
      })();
    </script>
  </body>
</html>
`;
}

/* -------------------------------------------------------------------------- */
/*  Манифест и служебные файлы                                                */
/* -------------------------------------------------------------------------- */

function renderManifest() {
  return `${JSON.stringify(
    {
      name: "Красные линии — архив первоисточников 2007–2024",
      short_name: "Красные линии",
      description:
        "Речи, лекции и интервью, без которых нельзя понять истоки нынешнего противостояния.",
      lang: "ru",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#151311",
      theme_color: "#151311",
      icons: [
        {
          src: "static/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any",
        },
        {
          src: "static/icon-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

/* -------------------------------------------------------------------------- */
/*  Основной процесс                                                          */
/* -------------------------------------------------------------------------- */

async function loadContent() {
  const vite = await createServer({
    root: projectRoot,
    configFile: false,
    logLevel: "error",
    appType: "custom",
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });

  try {
    const archive = await vite.ssrLoadModule("/src/data/archive.ts");
    const international = await vite.ssrLoadModule("/src/data/international.ts");
    const news = await vite.ssrLoadModule("/src/data/news.ts");
    return { archive, international, news };
  } finally {
    await vite.close();
  }
}

async function writeFileAt(relativePath, contents) {
  const target = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, "utf8");
}

async function build() {
  const { archive, international, news } = await loadContent();

  blocks = archive.blocks;
  archiveBlocks = archive.blocks;
  materials = archive.materials;
  formatDate = archive.formatDate;
  getMaterialsByBlock = archive.getMaterialsByBlock;

  internationalBlocks = international.internationalBlocks;
  internationalMaterials = international.internationalMaterials;
  formatInternationalDate = international.formatInternationalDate;
  getInternationalMaterialsByBlock = international.getInternationalMaterialsByBlock;
  groupInternationalMaterialsByPart = international.groupInternationalMaterialsByPart;

  newsBlocks = news.newsBlocks;
  newsMaterials = news.newsMaterials;
  formatNewsDate = news.formatNewsDate;
  getNewsMaterialsByBlock = news.getNewsMaterialsByBlock;

  await rm(pagesDir, { recursive: true, force: true });
  await mkdir(pagesDir, { recursive: true });
  await mkdir(staticDir, { recursive: true });

  const css = await readFile(path.join(staticSourceDir, "site.css"), "utf8");

  // Статические ресурсы.
  await writeFileAt(sitePath.css, css);
  await copyFile(
    path.join(projectRoot, "src", "assets", "hero-archive.jpg"),
    path.join(projectRoot, sitePath.heroArchive),
  );
  await copyFile(
    path.join(projectRoot, "src", "assets", "hero-international.jpg"),
    path.join(projectRoot, sitePath.heroInternational),
  );
  await copyFile(
    path.join(projectRoot, "img", "07.jpg"),
    path.join(projectRoot, sitePath.heroNews),
  );
  await copyFile(
    path.join(projectRoot, "public", "favicon.png"),
    path.join(projectRoot, sitePath.favicon),
  );
  await copyFile(
    path.join(projectRoot, "public", "icons", "icon-512.png"),
    path.join(projectRoot, sitePath.appleIcon),
  );

  // Служебные файлы GitHub Pages.
  await writeFileAt(sitePath.manifest, renderManifest());
  await writeFileAt(
    sitePath.robots,
    "User-agent: *\nAllow: /\n",
  );
  await writeFileAt(".nojekyll", "");

  // Страницы.
  await writeFileAt(sitePath.home, renderHome());
  await writeFileAt(sitePath.notFound, renderNotFound(css));

  for (const block of blocks) {
    await writeFileAt(sitePath.block(block.id), renderArchiveBlockPage(block));
  }

  for (const material of materials) {
    const block = blocks.find((item) => item.id === material.blockId);
    if (!block) {
      throw new Error(
        `Для материала «${material.slug}» не найден блок «${material.blockId}».`,
      );
    }
    await writeFileAt(
      sitePath.material(material.slug),
      renderArchiveMaterialPage(material, block),
    );
  }

  await writeFileAt(sitePath.internationalHome, renderInternationalHome());

  for (const block of internationalBlocks) {
    await writeFileAt(
      sitePath.internationalBlock(block.id),
      renderInternationalBlockPage(block),
    );
  }

  for (const material of internationalMaterials) {
    const block = internationalBlocks.find((item) => item.id === material.blockId);
    if (!block) {
      throw new Error(
        `Для материала «${material.slug}» не найден блок «${material.blockId}».`,
      );
    }
    await writeFileAt(
      sitePath.internationalMaterial(material.slug),
      renderInternationalMaterialPage(material, block),
    );
  }

  await writeFileAt(sitePath.newsHome, renderNewsHome());

  for (const block of newsBlocks) {
    await writeFileAt(sitePath.newsBlock(block.id), renderNewsBlockPage(block));
  }

  for (const material of newsMaterials) {
    const block = newsBlocks.find((item) => item.id === material.year);
    if (!block) {
      throw new Error(`Для материала «${material.slug}» не найден год «${material.year}».`);
    }
    await writeFileAt(
      sitePath.newsMaterial(material.slug),
      renderNewsMaterialPage(material, block),
    );
  }

  const archivePages = blocks.length + materials.length;
  const internationalPages = internationalBlocks.length + internationalMaterials.length;
  const newsPages = newsBlocks.length + newsMaterials.length;

  console.log("Статический сайт собран:");
  console.log(`  index.html — главная`);
  console.log(`  pages/ — ${archivePages + internationalPages + newsPages + 1} страниц`);
  console.log(`  static/ — стили и изображения`);
  console.log(
    `  всего материалов: ${materials.length + internationalMaterials.length + newsMaterials.length}`,
  );
  console.log("Запуск: npm run build:static");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
