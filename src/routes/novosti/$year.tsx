import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  formatNewsDate,
  getNewsBlock,
  getNewsMaterialsByBlock,
  newsBlocks,
} from "@/data/news";

export const Route = createFileRoute("/novosti/$year")({
  loader: ({ params }) => {
    const block = getNewsBlock(params.year);
    if (!block) throw notFound();
    return { block, items: getNewsMaterialsByBlock(block.id) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Год не найден — Новости" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { block } = loaderData;
    const title = `Новости ${block.numeral}. ${block.title} — Красные линии`;
    return {
      meta: [
        { title },
        { name: "description", content: block.description },
        { property: "og:title", content: title },
        { property: "og:description", content: block.description },
      ],
    };
  },
  component: NewsBlockPage,
});

function NewsBlockPage() {
  const { block, items } = Route.useLoaderData();
  const idx = newsBlocks.findIndex((b) => b.id === block.id);
  const prev = newsBlocks[idx - 1];
  const next = newsBlocks[idx + 1];

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
      <nav
        aria-label="Хлебные крошки"
        className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <Link to="/" className="hover:text-gold">
          Главная
        </Link>
        <span className="text-gold-dim">/</span>
        <Link to="/novosti" className="hover:text-gold">
          Новости
        </Link>
      </nav>

      <header className="mt-10 grid gap-8 md:grid-cols-[auto_1fr] md:items-end">
        <span className="font-serif text-5xl leading-none text-gold-dim sm:text-6xl">
          {block.numeral}
        </span>
        <div>
          <p className="eyebrow">Новости · {block.period}</p>
          <h2 className="mt-3 font-serif text-5xl text-foreground sm:text-6xl">{block.title}</h2>
          <p className="mt-4 max-w-2xl font-serif text-lg italic leading-relaxed text-muted-foreground">
            {block.description}
          </p>
        </div>
      </header>

      <div className="gold-rule my-12" />

      <ol className="relative mt-6 space-y-4 border-l border-border/60 pl-6 sm:pl-10">
        {items.map((m) => (
          <li key={m.slug} className="relative">
            <span className="absolute -left-[1.6rem] top-8 h-2 w-2 rounded-full bg-gold sm:-left-[2.6rem]" />
            <Link
              to="/novosti/material/$slug"
              params={{ slug: m.slug }}
              className="archive-card p-6 sm:p-8"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span className="font-mono text-xs text-gold">{formatNewsDate(m)}</span>
                <span className="eyebrow text-muted-foreground">
                  {m.type}
                  {m.place ? ` · ${m.place}` : ""}
                </span>
              </div>
              <h3 className="mt-3 font-serif text-2xl leading-snug text-foreground sm:text-3xl">
                {m.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{m.author}</p>
              <p className="mt-4 text-sm leading-relaxed text-foreground/80">{m.summary}</p>
            </Link>
          </li>
        ))}
      </ol>

      <nav
        aria-label="Соседние годы"
        className="mt-16 flex justify-between gap-6 border-t border-border/60 pt-6"
      >
        {prev ? (
          <Link to="/novosti/$year" params={{ year: prev.id }} className="nav-link">
            ← {prev.numeral}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to="/novosti/$year" params={{ year: next.id }} className="nav-link">
            {next.numeral} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </main>
  );
}
