import { Link } from "wouter";

interface AppCard {
  title: string;
  description: string;
  path: string;
  badge?: string;
  gradient: string;
  suits: string;
  dotColor: string;
}

const APPS: AppCard[] = [
  {
    title: "팟 분배 퀴즈",
    description: "텍사스 홀덤 쇼다운 시 팟이 어떻게 나뉘는지 맞춰 본다. 핸드 평가와 사이드 팟 계산 트레이닝.",
    path: "/pot-quiz",
    badge: "쇼다운 트레이너",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)",
    suits: "♠♣",
    dotColor: "#2563eb",
  },
  {
    title: "너트 핸드 맞추기",
    description: "보드가 주어졌을 때 가능한 최강 핸드(너트) 3개를 빠르게 찾는다.",
    path: "/nut-to-3",
    badge: "리딩 게임",
    gradient: "linear-gradient(135deg, #92400e 0%, #b45309 60%, #d97706 100%)",
    suits: "♦♥",
    dotColor: "#d97706",
  },
  {
    title: "홀덤 개념 퀴즈",
    description: "기본 룰부터 수학·실전 응용까지. 진행률은 로그인 시 클라우드 저장.",
    path: "/concept-quiz",
    badge: "이론",
    gradient: "linear-gradient(135deg, #065f46 0%, #047857 60%, #059669 100%)",
    suits: "♣♦",
    dotColor: "#059669",
  },
  {
    title: "헤즈업 트레이너",
    description: "AI 또는 친구와 1:1 대결. 매 핸드 GTO 점수와 약점 스팟을 분석한다.",
    path: "/heads-up",
    badge: "PWA · 오프라인",
    gradient: "linear-gradient(135deg, #1e293b 0%, #334155 60%, #475569 100%)",
    suits: "♥♠",
    dotColor: "#334155",
  },
];

const isDev = import.meta.env.DEV;

function AppPreviewCard({ app }: { app: AppCard }) {
  return (
    <Link
      href={app.path}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-zinc-300"
    >
      <div
        className="relative flex h-32 items-center justify-center overflow-hidden"
        style={{ background: app.gradient }}
      >
        <span
          aria-hidden
          className="select-none text-5xl font-bold leading-none opacity-25"
          style={{ color: "#ffffff", letterSpacing: "-0.02em" }}
        >
          {app.suits}
        </span>
        <span
          aria-hidden
          className="absolute bottom-2 right-3 select-none text-2xl opacity-15"
          style={{ color: "#ffffff" }}
        >
          {app.suits[1] ?? app.suits[0]}
        </span>
        {app.badge && (
          <span className="absolute top-2.5 right-2.5 rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
            {app.badge}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 p-4">
        <h2 className="text-base font-bold text-zinc-900">{app.title}</h2>
        <p className="text-xs leading-relaxed text-zinc-500">{app.description}</p>
        <p
          className="mt-1 text-xs font-semibold transition-colors group-hover:underline"
          style={{ color: "var(--color-mimic-red)" }}
        >
          들어가기 →
        </p>
      </div>
    </Link>
  );
}

export function Home() {
  const bestPotStreak = Math.max(
    ...(['easy', 'medium', 'hard'] as const).map((d) =>
      parseInt(localStorage.getItem(`pot-quiz:bestStreak_${d}`) ?? '0', 10)
    )
  );
  const bestPotScore = Math.max(
    ...(['easy', 'medium', 'hard'] as const).map((d) =>
      parseInt(localStorage.getItem(`pot-quiz:bestScore_${d}`) ?? '0', 10)
    )
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900">홀덤 허브</h1>
        <p className="mt-2 text-zinc-500">
          쇼다운 트레이너부터 GTO 분석까지, 홀덤 학습 도구를 한 곳에서.
        </p>
      </section>

      {/* Stats strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-900">
            {bestPotStreak > 0 ? bestPotStreak : "—"}
          </span>
          <span className="text-xs text-zinc-500">연속 정답 (팟 퀴즈)</span>
        </div>
        <div className="h-4 w-px bg-zinc-300" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-900">
            {bestPotScore > 0 ? bestPotScore.toLocaleString() : "—"}
          </span>
          <span className="text-xs text-zinc-500">최고 점수</span>
        </div>
        <div className="h-4 w-px bg-zinc-300" />
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-zinc-900">4</span>
          <span className="text-xs text-zinc-500">트레이너</span>
        </div>
      </div>

      {/* Dashboard layout: left quick-actions + right preview grid */}
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Left panel — quick-action list */}
        <aside className="flex flex-col gap-1 lg:w-64 lg:shrink-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            바로가기
          </p>
          {APPS.map((app) => (
            <Link
              key={app.path}
              href={app.path}
              className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-zinc-100"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: app.dotColor }}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-zinc-900 group-hover:text-zinc-800">
                  {app.title}
                </div>
                {app.badge && (
                  <div className="text-xs text-zinc-400">{app.badge}</div>
                )}
              </div>
              <span className="text-zinc-300 group-hover:text-zinc-500">›</span>
            </Link>
          ))}
        </aside>

        {/* Right panel — 2×2 app preview cards */}
        <section className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
          {APPS.map((app) => (
            <AppPreviewCard key={app.path} app={app} />
          ))}
        </section>
      </div>

      {isDev && (
        <section className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500">
          <span className="font-medium text-zinc-700">개발자 도구:</span>{" "}
          <Link href="/dev/cards" className="underline hover:text-zinc-900">
            /dev/cards
          </Link>{" "}
          — PlayingCard 컴포넌트 시각 검증 페이지
        </section>
      )}
    </div>
  );
}
