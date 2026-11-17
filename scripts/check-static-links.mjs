#!/usr/bin/env node
/**
 * Проверка внутренних ссылок статической версии сайта.
 *
 * Запуск: npm run check:static
 *
 * Скрипт проверяет index.html, 404.html и все страницы в pages/:
 *  - все относительные href/src указывают на существующие файлы;
 *  - нет ссылок от корня сайта (/...), которые ломаются на GitHub Pages
 *    при размещении в подпапке https://user.github.io/repo/.
 */

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function collectHtml(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectHtml(fullPath, files);
    } else if (entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

function isExternal(value) {
  return /^(?:https?:|mailto:|tel:|javascript:|data:|#)/i.test(value);
}

const files = [
  path.join(projectRoot, "index.html"),
  path.join(projectRoot, "404.html"),
  ...(await collectHtml(path.join(projectRoot, "pages"))),
];

const broken = [];
const absolute = [];
let checked = 0;

for (const file of files) {
  const html = await readFile(file, "utf8");

  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (isExternal(value)) continue;

    if (value.startsWith("/")) {
      absolute.push({ file, value });
      continue;
    }

    const clean = value.split("#")[0].split("?")[0];
    if (!clean) continue;

    checked += 1;
    const target = path.resolve(path.dirname(file), decodeURIComponent(clean));

    try {
      await access(target);
    } catch {
      broken.push({ file, value, target });
    }
  }
}

const relative = (file) => path.relative(projectRoot, file);

console.log(`Проверено HTML-файлов: ${files.length}`);
console.log(`Проверено относительных ссылок: ${checked}`);

if (absolute.length > 0) {
  console.error(`\nСсылки от корня сайта (нежелательны для GitHub Pages): ${absolute.length}`);
  for (const item of absolute) {
    console.error(`  ${relative(item.file)}: ${item.value}`);
  }
}

if (broken.length > 0) {
  console.error(`\nБитые ссылки: ${broken.length}`);
  for (const item of broken) {
    console.error(`  ${relative(item.file)}: ${item.value} → ${relative(item.target)}`);
  }
}

if (absolute.length > 0 || broken.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Внутренние ссылки в порядке.");
}
