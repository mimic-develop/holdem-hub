import { Link } from 'react-router-dom';
import { APP_VERSION } from '../utils/version';

const OSS_LICENSES: { name: string; license: string }[] = [
  { name: 'React', license: 'MIT' },
  { name: 'Vite', license: 'MIT' },
  { name: 'Tailwind CSS', license: 'MIT' },
  { name: 'Zustand', license: 'MIT' },
  { name: 'Framer Motion', license: 'MIT' },
  { name: 'PeerJS', license: 'MIT' },
  { name: 'idb', license: 'ISC' },
  { name: 'React Router', license: 'MIT' },
  { name: 'Pretendard (글꼴)', license: 'OFL-1.1' },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
        <h1 className="text-base font-bold text-primary">앱 정보</h1>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4 text-sm leading-relaxed text-foreground">
        <Section title="헤즈업 솔로">
          <p>
            1:1 노리밋 텍사스 홀덤 연습 웹앱입니다. 혼자 AI 봇과 연습하거나, P2P
            (WebRTC) 로 친구와 직접 연결해 매치를 즐길 수 있습니다. 자체 서버는
            없고, 모든 핸드 기록은 브라우저(IndexedDB)에 로컬 저장됩니다.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            버전 {APP_VERSION}
          </p>
        </Section>

        <Section title="GTO 평가 방식">
          <p>
            핸드 종료 직후 휴리스틱 평가가 백그라운드로 실행되어 0~100 점수와
            액션별 코멘터리를 제공합니다. 정식 솔버는 아니며, 명백한 실수
            (밸류 미스, 무근거 블러프, 사이즈 미스, 레인지 오독)를 잡아내는
            보조 학습 도구입니다.
          </p>
          <ul className="mt-3 space-y-1 text-xs text-foreground">
            <li>
              <strong className="text-primary">프리플랍</strong>: HU 100bb 6개
              스팟별 차트 (SB 오픈 / BB 오픈 대응 / 림프 / 3벳·4벳·5벳)에서
              플레이한 액션의 빈도를 점수화.
            </li>
            <li>
              <strong className="text-primary">포스트플랍</strong>: 상대 액션
              패턴으로 레인지를 추정 (top 5/15/60% 또는 random) → Monte Carlo
              에쿼티 계산 → 팟오즈/핸드 강도와 결합해 권장 액션 도출 → 사용자
              선택과 비교해 점수.
            </li>
            <li>
              <strong className="text-primary">실수 분류</strong>: VALUE_MISS,
              BLUFF_TOO_OFTEN, SIZE_MISS, RANGE_MISREAD 4 유형.
            </li>
          </ul>
        </Section>

        <Section title="개인정보">
          <p>
            모든 데이터(핸드 기록, 설정, 닉네임)는 사용자 브라우저에만 저장됩니다.
            앱은 어떤 분석 도구나 외부 서버에도 데이터를 전송하지 않습니다.
            친구 매치 시에도 PeerJS의 시그널링 서버를 거쳐 양 브라우저가 직접
            연결되며 게임 데이터는 P2P로만 흐릅니다.
          </p>
        </Section>

        <Section title="오픈소스 라이선스">
          <ul className="space-y-0.5 text-xs">
            {OSS_LICENSES.map((l) => (
              <li key={l.name} className="flex justify-between">
                <span>{l.name}</span>
                <span className="text-muted-foreground">{l.license}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="피드백">
          <p className="text-xs text-muted-foreground">
            버그 또는 개선 제안은 GitHub 이슈로 알려주세요. 솔로 사이드
            프로젝트입니다.
          </p>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
