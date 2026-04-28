import { Link } from "wouter";

interface AppCard {
  title: string;
  description: string;
  path: string;
  badge?: string;
}

const APPS: AppCard[] = [
  {
    title: "팟 분배 퀴즈",
    description: "텍사스 홀덤 쇼다운 시 팟이 어떻게 나뉘는지 맞춰 본다. 핸드 평가와 사이드 팟 계산 트레이닝.",
    path: "/pot-quiz",
    badge: "쇼다운 트레이너",
  },
  {
    title: "너트 핸드 맞추기",
    description: "보드가 주어졌을 때 가능한 최강 핸드(너트) 3개를 빠르게 찾는다.",
    path: "/nut-to-3",
    badge: "리딩 게임",
  },
  {
    title: "홀덤 개념 퀴즈",
    description: "기본 룰부터 수학·실전 응용까지. 진행률은 로그인 시 클라우드 저장.",
    path: "/concept-quiz",
    badge: "이론",
  },
  {
    title: "헤즈업 트레이너",
    description: "AI 또는 친구와 1:1 대결. 매 핸드 GTO 점수와 약점 스팟을 분석한다.",
    path: "/heads-up",
    badge: "PWA · 오프라인",
  },
];

const isDev = import.meta.env.DEV;

export function Home() {
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">홀덤 허브</h1>
        <p className="mt-2 text-zinc-600">
          쇼다운 트레이너부터 GTO 분석까지, 홀덤 학습 도구를 한 곳에서.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {APPS.map((app) => (
          <Link
            key={app.path}
            href={app.path}
            className="group block rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-[color:var(--color-mimic-red)]/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold text-zinc-900">{app.title}</h2>
              {app.badge && (
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                  {app.badge}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-600">{app.description}</p>
            <p
              className="mt-4 text-sm font-medium transition-colors"
              style={{ color: "var(--color-mimic-red)" }}
            >
              들어가기 →
            </p>
          </Link>
        ))}
      </section>

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
