import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  ArrowRight, ListOrdered, Layers, Trophy, Timer, Flame, BookOpen,
} from 'lucide-react';
import { SubAppHeader, BackToHub } from '@hh/ui';
import type { PuzzleDifficulty } from '../types/poker';

/**
 * POT SPLIT — MIMIC PLAYLAB 모드 인트로.
 * Hub Home 의 디자인 토큰 (#000 outer / #111 inner / #1A1A1A card) 을 그대로 따르되,
 * POT SPLIT 키 컬러는 Hub 글로벌 RED 가 아닌 BLUE (인게임 ChipStack 'pot' tone) — 모드 차별화.
 * 보조 강조는 GOLD (칩 도메인). hero 추상 그래픽은 칩 스택 좌우 분배 표현.
 */

// POT SPLIT 키 컬러 — BLUE (인게임 ChipStack 'pot' tone 과 일치).
// MIMIC 글로벌 RED 는 Hub Navbar / HEADS-UP 영역의 것이며, POT SPLIT 모드 내부에서는 사용하지 않음.
const BLUE = '#3B82F6';       // Primary CTA bg
const BLUE_BRIGHT = '#60A5FA'; // 브랜드 텍스트(POT 글자), 액센트
const GOLD = '#F59E0B';       // 보조 강조 (난이도 active, hairline, 칩 그래픽)
const CARD_BG = '#181A20';    // 미세 푸른빛 dark card (인게임 토큰과 동기)
const BG_BASE = '#0A0C12';    // deep navy black (pure #000 대신 깊이감)
const SUB_TEXT = '#8A8A8A';

export default function Home() {
  const [, setLocation] = useLocation();
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>('medium');

  const difficultyConfig: Record<PuzzleDifficulty, { label: string; desc: string }> = {
    easy:   { label: '쉬움',   desc: '3명, 단순 팟 구조' },
    medium: { label: '보통',   desc: '3~4명, 사이드팟 포함' },
    hard:   { label: '어려움', desc: '4~5명, 복잡한 멀티팟' },
  };

  const records = (['easy', 'medium', 'hard'] as const).map(d => ({
    d,
    score: parseInt(localStorage.getItem(`pot-quiz:bestScore_${d}`) ?? '0', 10),
    streak: parseInt(localStorage.getItem(`pot-quiz:bestStreak_${d}`) ?? '0', 10),
  }));
  const topStreak = Math.max(0, ...records.map(r => r.streak));
  const hasAnyRecord = records.some(r => r.score > 0 || r.streak > 0);

  const steps = [
    {
      icon: <ListOrdered size={14} color="#FAFAF8" strokeWidth={2.2} />,
      bg: 'rgba(96,165,250,0.22)', border: 'rgba(96,165,250,0.50)',
      title: '1단계 · 핸드 순위',
      desc: '좌석을 탭해 핸드 강도 순서를 지정합니다. 같은 자리 재탭은 동점 처리.',
    },
    {
      icon: <Layers size={14} color="#FAFAF8" strokeWidth={2.2} />,
      bg: 'rgba(192,132,252,0.22)', border: 'rgba(192,132,252,0.50)',
      title: '2단계 · 팟 형성',
      desc: '숏스택 좌석을 클릭해 메인팟·사이드팟을 차례로 만들고, 데드머니는 별도로 합칩니다.',
    },
    {
      icon: <Trophy size={14} color="#FAFAF8" strokeWidth={2.2} />,
      bg: 'rgba(74,222,128,0.22)', border: 'rgba(74,222,128,0.50)',
      title: '3단계 · 팟 분배',
      desc: '각 팟마다 승자 좌석을 클릭합니다. 동률은 다중 선택 후 확정.',
    },
    {
      icon: <Timer size={14} color="#FAFAF8" strokeWidth={2.2} />,
      bg: 'rgba(251,191,36,0.22)', border: 'rgba(251,191,36,0.50)',
      title: '스톱워치 · 90초 합격',
      desc: '제한 시간 안에 분배를 끝내면 성공. 오답 시 즉시 정답 해설이 표시됩니다.',
    },
  ];

  return (
    <div style={{ background: BG_BASE, color: '#FAFAF8', minHeight: '100dvh' }}>
      <div
        style={{
          maxWidth: 430, margin: '0 auto', minHeight: '100dvh', position: 'relative',
          background:
            'radial-gradient(ellipse 85% 50% at 50% 0%, rgba(59,130,246,0.26) 0%, rgba(59,130,246,0) 55%),' +
            'radial-gradient(ellipse 65% 45% at 50% 100%, rgba(245,158,11,0.14) 0%, rgba(245,158,11,0) 60%),' +
            'linear-gradient(180deg, #1A2247 0%, #0F1428 45%, #0A0E1F 80%, #08091A 100%)',
        }}
      >
        {/* ── SubAppHeader — Hub Navbar 바로 아래 sticky (52px).
             인트로에선 hero 의 큰 POT SPLIT 타이틀과 겹치므로 가운데 라벨을 비움.
             톤은 Hub Navbar(dark) 와 동일하게 정렬: bg rgba(10,10,10,0.92) + RED hairline. */}
        <SubAppHeader
          title=""
          className="!bg-[rgba(10,10,10,0.96)] !border-b-[rgba(168,0,20,0.2)] [&_h1]:!text-[#FAFAF8]"
          left={<BackToHub className="text-white hover:text-white/80" />}
        />

        {/* ── 히어로 ─────────────────────────────────────────── */}
        <section className="relative overflow-hidden" style={{ paddingTop: 0 }}>
          {/* 추상 칩 분배 배경 그래픽 */}
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 430 360"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <radialGradient id="hero-glow" cx="50%" cy="38%" r="60%">
                <stop offset="0%" stopColor="rgba(59,130,246,0.28)" />
                <stop offset="35%" stopColor="rgba(96,165,250,0.12)" />
                <stop offset="70%" stopColor="rgba(245,158,11,0.06)" />
                <stop offset="100%" stopColor="rgba(245,158,11,0)" />
              </radialGradient>
              <linearGradient id="chip-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FBBF24" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
              <linearGradient id="chip-gold-dim" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#D97706" />
                <stop offset="100%" stopColor="#78350F" />
              </linearGradient>
            </defs>
            <rect width="430" height="360" fill="url(#hero-glow)" />

            {/* 가운데 분기 라인 — "갈라짐" */}
            <g opacity="0.18">
              <path d="M215 90 L120 290" stroke="#FAFAF8" strokeWidth="1" strokeDasharray="3 5" fill="none" />
              <path d="M215 90 L310 290" stroke="#FAFAF8" strokeWidth="1" strokeDasharray="3 5" fill="none" />
            </g>
            <circle cx="215" cy="90" r="5" fill={GOLD} opacity="0.95" />

            {/* 좌측 칩 더미 — GOLD bright */}
            <g transform="translate(96 286)">
              <ellipse cx="0" cy="0" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="0" rx="44" ry="10" fill="none" stroke="url(#chip-gold)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-10" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="-10" rx="44" ry="10" fill="none" stroke="url(#chip-gold)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-20" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="-20" rx="44" ry="10" fill="none" stroke="url(#chip-gold)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-30" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="-30" rx="44" ry="10" fill="none" stroke="url(#chip-gold)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-30" rx="44" ry="10" fill="rgba(245,158,11,0.12)" />
            </g>

            {/* 우측 칩 더미 — GOLD dim (copper) */}
            <g transform="translate(334 286)">
              <ellipse cx="0" cy="0" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="0" rx="44" ry="10" fill="none" stroke="url(#chip-gold-dim)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-10" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="-10" rx="44" ry="10" fill="none" stroke="url(#chip-gold-dim)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-20" rx="44" ry="10" fill="#1A1A1A" />
              <ellipse cx="0" cy="-20" rx="44" ry="10" fill="none" stroke="url(#chip-gold-dim)" strokeWidth="1.5" />
              <ellipse cx="0" cy="-20" rx="44" ry="10" fill="rgba(217,119,6,0.10)" />
            </g>
          </svg>

          {/* 어두운 그라데이션 오버레이 — Hub Home과 동일 톤 */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(10,12,18,0.55) 0%, rgba(10,12,18,0.20) 45%, rgba(10,12,18,0.85) 78%, #0A0C12 100%)',
            }}
          />

          {/* Hero 콘텐츠 — SubAppHeader(52) 아래 시작. paddingTop 은 hero 내부 여백만. */}
          <div className="relative px-5 pb-6" style={{ paddingTop: 28 }}>
            <p
              style={{
                fontSize: 11, letterSpacing: '0.22em',
                color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginBottom: 10,
              }}
            >
              MIMIC PLAYLAB MODE
            </p>
            <h1
              style={{
                fontSize: 'clamp(28px, 8vw, 42px)', fontWeight: 800,
                letterSpacing: '0.04em', lineHeight: 1.10, textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              <span style={{ color: BLUE_BRIGHT }}>POT</span> SPLIT
            </h1>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
              팟을 정확히 나누는 실전 계산 훈련.<br />
              <span style={{ color: 'rgba(255,255,255,0.48)' }}>
                사이드팟·멀티웨이 수령 칩을 빠르게 판단하세요.
              </span>
            </p>
          </div>
        </section>

        {/* ── 본문 패널 ──────────────────────────────────────── */}
        <div className="px-5 pb-10" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── ACTION PANEL — 첫 fold 안에 들어와야 할 핵심 CTA 영역.
                난이도 + Primary CTA + Secondary CTA 를 한 카드로 묶어
                "시작 흐름" 을 시각적으로 한 덩어리로 인식시킴. GOLD hairline 으로 강조. */}
          <section
            className="rounded-2xl overflow-hidden"
            style={{
              background: CARD_BG,
              border: '1px solid rgba(59,130,246,0.28)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ height: 3, background: BLUE }} />
            <div style={{ padding: 16 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, letterSpacing: '0.20em', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}>
                  난이도 선택
                </p>
                <p style={{ fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                  점수 · 90초
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(difficultyConfig) as PuzzleDifficulty[]).map(d => {
                  const cfg = difficultyConfig[d];
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      data-testid={`difficulty-${d}`}
                      className="rounded-xl text-center transition-all active:opacity-80"
                      style={{
                        padding: '10px 6px',
                        minHeight: 60,
                        background: active ? 'rgba(59,130,246,0.14)' : 'rgba(255,255,255,0.03)',
                        border: active ? `1px solid ${BLUE}` : '1px solid rgba(255,255,255,0.07)',
                        color: active ? '#FAFAF8' : 'rgba(255,255,255,0.55)',
                        boxShadow: active
                          ? `0 0 0 1px ${BLUE}, 0 6px 18px rgba(59,130,246,0.32)`
                          : 'none',
                      }}
                    >
                      <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, letterSpacing: 0 }}>{cfg.label}</p>
                      <p style={{ fontSize: 10, lineHeight: 1.3, opacity: active ? 0.85 : 0.6, letterSpacing: 0 }}>
                        {cfg.desc}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '14px 0' }} />

              <button
                type="button"
                onClick={() => setLocation(`/quiz/${difficulty}`)}
                data-testid="btn-start"
                className="w-full rounded-2xl flex items-center justify-center gap-2 transition-opacity active:opacity-80 hover:opacity-90"
                style={{
                  background: 'linear-gradient(180deg, #60A5FA 0%, #3B82F6 55%, #2563EB 100%)',
                  color: '#FAFAF8',
                  fontSize: 15.5, fontWeight: 800,
                  letterSpacing: '0.05em',
                  padding: '15px 0',
                  boxShadow:
                    '0 14px 32px rgba(59,130,246,0.55), ' +
                    '0 0 0 1px rgba(96,165,250,0.45), ' +
                    'inset 0 1px 0 rgba(255,255,255,0.30)',
                }}
              >
                <span>POT SPLIT 시작</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.78, letterSpacing: '0.04em' }}>
                  · {difficultyConfig[difficulty].label}
                </span>
                <ArrowRight size={16} strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => setLocation(`/practice/${difficulty}`)}
                data-testid="btn-practice"
                className="w-full rounded-xl flex items-center justify-center gap-2 transition-opacity active:opacity-70 hover:opacity-85"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.72)',
                  padding: '11px 0',
                  marginTop: 8,
                  fontSize: 12.5, fontWeight: 600,
                  letterSpacing: 0,
                }}
              >
                <BookOpen size={13} strokeWidth={2.2} />
                <span>연습 모드</span>
                <span style={{ fontSize: 10.5, opacity: 0.55, marginLeft: 2 }}>
                  · 시간 제한 없이 구조 익히기
                </span>
              </button>
            </div>
          </section>

          {/* ── 나의 기록 — 보조 정보 */}
          <section
            className="rounded-2xl"
            style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)', padding: 16 }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, letterSpacing: '0.20em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
                나의 기록
              </p>
              {topStreak > 0 && (
                <div className="flex items-center gap-1">
                  <Flame size={13} color="#FBBF24" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FBBF24', letterSpacing: '0.02em' }}>
                    {topStreak} 연속
                  </span>
                </div>
              )}
            </div>

            <div
              className="flex items-center"
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}
            >
              <div style={{ width: 56 }} />
              <div className="flex-1 text-center">STREAK</div>
              <div className="flex-1 text-center">SCORE</div>
            </div>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginBottom: 4 }} />

            {records.map(({ d, score, streak }) => {
              const cfg = difficultyConfig[d];
              const isSelected = d === difficulty;
              return (
                <div
                  key={d}
                  className="flex items-center"
                  style={{ paddingTop: 7, paddingBottom: 7, opacity: isSelected ? 1 : 0.55 }}
                >
                  <div
                    style={{
                      width: 56, fontSize: 13, fontWeight: 700,
                      color: isSelected ? '#FAFAF8' : SUB_TEXT, letterSpacing: 0,
                    }}
                  >
                    {cfg.label}
                    {isSelected && <span style={{ marginLeft: 6, fontSize: 8, color: BLUE, verticalAlign: 'middle' }}>●</span>}
                  </div>
                  <div
                    className="flex-1 text-center tabular-nums"
                    data-testid={`home-best-streak-${d}`}
                    style={{ fontSize: 14, fontWeight: 700, color: streak > 0 ? '#FAFAF8' : 'rgba(255,255,255,0.22)' }}
                  >
                    {streak > 0 ? streak : '–'}
                  </div>
                  <div
                    className="flex-1 text-center tabular-nums"
                    data-testid={`home-best-score-${d}`}
                    style={{ fontSize: 14, fontWeight: 700, color: score > 0 ? '#FAFAF8' : 'rgba(255,255,255,0.22)' }}
                  >
                    {score > 0 ? score.toLocaleString() : '–'}
                  </div>
                </div>
              );
            })}

            {!hasAnyRecord && (
              <p
                className="text-center"
                style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}
              >
                기록 없음 — 첫 게임을 시작해보세요
              </p>
            )}
          </section>

          {/* ── 게임 방식 — 보조 정보 */}
          <section
            className="rounded-2xl relative overflow-hidden"
            style={{ background: CARD_BG, border: '1px solid rgba(255,255,255,0.06)', padding: 16 }}
          >
            <svg
              aria-hidden
              className="pointer-events-none absolute right-3 top-3"
              width="56" height="56" viewBox="0 0 64 64" fill="rgba(255,255,255,0.035)"
            >
              <path d="M32 4 C18 16 6 22 6 34 C6 43 13 48 22 46 C19 52 15 56 10 58 L54 58 C49 56 45 52 42 46 C51 48 58 43 58 34 C58 22 46 16 32 4Z" />
            </svg>
            <p
              style={{
                fontSize: 11, letterSpacing: '0.20em', color: 'rgba(255,255,255,0.45)',
                textTransform: 'uppercase', marginBottom: 12,
              }}
            >
              게임 방식
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map(s => (
                <div key={s.title} className="flex items-start gap-3">
                  <div
                    className="flex shrink-0 items-center justify-center rounded-full"
                    style={{
                      width: 28, height: 28, marginTop: 1,
                      background: s.bg, border: `1px solid ${s.border}`,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: '#FAFAF8', lineHeight: 1.3, letterSpacing: 0 }}>
                      {s.title}
                    </p>
                    <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.52)', lineHeight: 1.5, marginTop: 2, letterSpacing: 0 }}>
                      {s.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 하단 카피 */}
          <p
            className="text-center"
            style={{
              fontSize: 12, color: 'rgba(255,255,255,0.42)',
              lineHeight: 1.7, marginTop: 4,
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            팟이 갈라지는 순간,<br />
            정확한 계산 감각이 실력 차이를 만듭니다.
          </p>
        </div>
      </div>
    </div>
  );
}
