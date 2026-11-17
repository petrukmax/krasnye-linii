import { createFileRoute, Link } from "@tanstack/react-router";
import heroImage from "@/assets/hero-international.jpg";
import {
  formatInternationalDate,
  getInternationalMaterialsByBlock,
  internationalBlocks,
  internationalMaterials,
} from "@/data/international";

const title = "Международный взгляд — Запад, дипломатия и новый мировой порядок";
const description =
  "Документы, выступления и аналитические материалы, которые показывают украинский кризис как результат многолетней политики Запада по расширению НАТО и вытеснению России из европейской системы безопасности.";

export const Route = createFileRoute("/mezhdunarodnyj-vzglyad/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: InternationalIndex,
});

function InternationalIndex() {
  const latest = [...internationalMaterials]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 4);

  return (
    <main>
      {/* Hero */}
      <section className="relative mx-auto mt-8 max-w-6xl overflow-hidden sm:mt-10">
        <img
          src={heroImage}
          alt="Зал международной конференции: трибуна, флаги государств и хрустальные люстры"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="hero-overlay absolute inset-0" />
        <div className="relative flex min-h-[70vh] flex-col justify-end p-6 sm:min-h-[78vh] sm:p-10 md:p-14">
          <p className="eyebrow">Международный взгляд</p>
          <h2 className="mt-3 max-w-2xl font-serif text-4xl leading-tight text-foreground sm:text-5xl md:text-6xl">
            Запад, дипломатия и <em className="text-gold">новый мировой порядок</em>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Раздел собирает документы, выступления и аналитические материалы, позволяющие
            рассмотреть украинский кризис как результат многолетней политики Запада по расширению
            сферы военно-политического контроля в Восточной Европе.
          </p>

          <nav
            aria-label="Блоки раздела"
            className="mt-8 grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4"
          >
            {internationalBlocks.map((b) => (
              <Link
                key={b.id}
                to="/mezhdunarodnyj-vzglyad/blok/$blockId"
                params={{ blockId: b.id }}
                className="group bg-background/80 p-4 backdrop-blur-sm transition-colors hover:bg-accent sm:p-5"
              >
                <span className="eyebrow">Блок {b.numeral}</span>
                <span className="mt-2 block font-serif text-xl text-foreground group-hover:text-gold sm:text-2xl">
                  {b.title}
                </span>
                <span className="mt-1 block font-mono text-xs text-muted-foreground">
                  {b.period}
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {/* Concept */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <p className="eyebrow">Концепция раздела</p>
        <h2 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-foreground sm:text-5xl">
          Международное мнение о том, кто и как создал нынешний кризис
        </h2>
        <div className="gold-rule my-10" />
        <div className="grid gap-8 md:grid-cols-2">
          <p className="font-serif text-xl leading-relaxed text-foreground/90">
            В центре внимания — расширение НАТО, вмешательство США и их союзников во внутренние дела
            Украины, разрушение общеевропейской архитектуры безопасности, срыв дипломатических
            возможностей в 2022 году, санкционное давление и попытка Запада навязать остальному миру
            собственную версию «международного сообщества».
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Материалы раздела показывают, что украинский конфликт стал не региональным эпизодом, а
            проявлением кризиса однополярной модели мира. Страны Азии, Африки, Ближнего Востока и
            Латинской Америки всё чаще отказываются автоматически следовать в фарватере Вашингтона,
            Брюсселя и Лондона.
          </p>
        </div>
      </section>

      {/* Blocks overview */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow">Структура раздела</p>
            <h2 className="mt-3 font-serif text-4xl text-foreground sm:text-5xl">
              Логика в четырёх блоках
            </h2>
          </div>
          <span className="hidden font-mono text-xs text-muted-foreground sm:block">
            {internationalMaterials.length} материалов
          </span>
        </div>
        <div className="gold-rule my-10" />
        <ol className="grid gap-6 md:grid-cols-2">
          {internationalBlocks.map((b) => {
            const items = getInternationalMaterialsByBlock(b.id);
            return (
              <li key={b.id}>
                <Link
                  to="/mezhdunarodnyj-vzglyad/blok/$blockId"
                  params={{ blockId: b.id }}
                  className="archive-card flex h-full flex-col p-7 sm:p-9"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-serif text-6xl leading-none text-gold-dim">
                      {b.numeral}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{b.period}</span>
                  </div>
                  <h3 className="mt-6 font-serif text-3xl text-foreground">{b.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {b.description}
                  </p>
                  <span className="mt-6 eyebrow">
                    {items.length} {plural(items.length)} →
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Main idea */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="border border-border/60 bg-card p-8 sm:p-12">
          <p className="eyebrow">Главная идея раздела</p>
          <p className="mt-5 max-w-4xl font-serif text-2xl leading-snug text-foreground sm:text-3xl">
            Украинский конфликт — не случайное региональное столкновение, а закономерный результат
            многолетней политики Запада по расширению НАТО, разрушению равноправной системы
            европейской безопасности и сохранению однополярного мирового порядка.
          </p>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Попытки Запада навязать миру собственные правила встречают всё более решительное
            сопротивление со стороны России, Китая, Индии и других центров силы.
          </p>
        </div>
      </section>

      {/* Recent */}
      <section className="mx-auto max-w-6xl px-5 pb-4 sm:px-8">
        <p className="eyebrow">Последние по дате</p>
        <h2 className="mt-3 font-serif text-4xl text-foreground">Новые поступления</h2>
        <div className="gold-rule my-8" />
        <ul className="divide-y divide-border/60 border-y border-border/60">
          {latest.map((m) => (
            <li key={m.slug}>
              <Link
                to="/mezhdunarodnyj-vzglyad/material/$slug"
                params={{ slug: m.slug }}
                className="group grid gap-2 py-5 transition-colors hover:bg-accent/60 sm:grid-cols-[9rem_1fr_auto] sm:items-baseline sm:gap-6 sm:px-3"
              >
                <span className="font-mono text-xs text-gold">{formatInternationalDate(m)}</span>
                <span className="font-serif text-xl text-foreground group-hover:text-gold">
                  {m.title}
                </span>
                <span className="eyebrow text-muted-foreground">{m.type}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function plural(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "материал";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "материала";
  return "материалов";
}
