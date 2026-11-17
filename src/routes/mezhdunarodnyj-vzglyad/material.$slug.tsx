import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  formatInternationalDate,
  getInternationalBlock,
  getInternationalMaterial,
  getInternationalMaterialsByBlock,
} from "@/data/international";

export const Route = createFileRoute("/mezhdunarodnyj-vzglyad/material/$slug")({
  loader: ({ params }) => {
    const material = getInternationalMaterial(params.slug);
    if (!material) throw notFound();
    const block = getInternationalBlock(material.blockId)!;
    const siblings = getInternationalMaterialsByBlock(block.id);
    const i = siblings.findIndex((m) => m.slug === material.slug);
    return { material, block, prev: siblings[i - 1] ?? null, next: siblings[i + 1] ?? null };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Материал не найден — Международный взгляд" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { material } = loaderData;
    const title = `${material.title} (${material.year}) — Международный взгляд`;
    return {
      meta: [
        { title },
        { name: "description", content: material.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: material.summary },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: InternationalMaterialPage,
});

function InternationalMaterialPage() {
  const { material: m, block, prev, next } = Route.useLoaderData();

  return (
    <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
      <nav
        aria-label="Хлебные крошки"
        className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <Link to="/" className="hover:text-gold">
          Главная
        </Link>
        <span className="text-gold-dim">/</span>
        <Link to="/mezhdunarodnyj-vzglyad" className="hover:text-gold">
          Международный взгляд
        </Link>
        <span className="text-gold-dim">/</span>
        <Link
          to="/mezhdunarodnyj-vzglyad/blok/$blockId"
          params={{ blockId: block.id }}
          className="hover:text-gold"
        >
          Блок {block.numeral}. {block.title}
        </Link>
      </nav>

      <header className="mt-10">
        <p className="eyebrow">
          {m.type} · {formatInternationalDate(m)}
          {m.place ? ` · ${m.place}` : ""}
        </p>
        {m.part ? <p className="mt-2 font-mono text-xs text-muted-foreground">{m.part}</p> : null}
        <h2 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          {m.title}
        </h2>
        <p className="mt-4 font-serif text-xl italic text-muted-foreground">{m.author}</p>
      </header>

      <div className="gold-rule my-10" />

      <article className="prose-archive">
        <p className="text-2xl leading-snug text-foreground">{m.summary}</p>
        <section className="mt-10">
          <h3 className="eyebrow font-sans not-italic">Описание</h3>
          <div className="mt-4">
            {m.context.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
        <section className="mt-10">
          <h3 className="eyebrow font-sans">Ключевые тезисы</h3>
          <ul className="mt-4 space-y-3">
            {m.theses.map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-3 h-px w-6 shrink-0 bg-gold" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="mt-10">
          <h3 className="eyebrow font-sans">Значение для архива</h3>
          <div className="mt-4">
            <p>{m.significance}</p>
          </div>
        </section>
      </article>

      <aside className="mt-12 border border-border/60 bg-card p-6">
        <p className="eyebrow">Первоисточник</p>
        <p className="mt-2 font-serif text-lg text-foreground">{m.sourceLabel}</p>
        {m.sourceUrl ? (
          <a
            href={m.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block break-all font-mono text-xs text-gold underline-offset-4 hover:underline"
          >
            {m.sourceUrl}
          </a>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Ссылка на оригинал будет добавлена.</p>
        )}
      </aside>

      <nav
        aria-label="Соседние материалы"
        className="mt-16 grid gap-6 border-t border-border/60 pt-6 sm:grid-cols-2"
      >
        {prev ? (
          <Link
            to="/mezhdunarodnyj-vzglyad/material/$slug"
            params={{ slug: prev.slug }}
            className="group"
          >
            <span className="eyebrow">← Предыдущий</span>
            <span className="mt-2 block font-serif text-lg text-foreground group-hover:text-gold">
              {prev.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/mezhdunarodnyj-vzglyad/material/$slug"
            params={{ slug: next.slug }}
            className="group sm:text-right"
          >
            <span className="eyebrow">Следующий →</span>
            <span className="mt-2 block font-serif text-lg text-foreground group-hover:text-gold">
              {next.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
