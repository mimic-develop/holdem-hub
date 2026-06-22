import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SubAppHeader, BackToHub } from '@hh/ui';
import { CreateRoomDialog } from '../components/home/CreateRoomDialog';
import { JoinRoomDialog } from '../components/home/JoinRoomDialog';
import { useSettings } from '../hooks/useSettings';
import { useGameStore } from '../store/game-store';
import { getLeaderboard, type LeaderboardEntry } from '../storage/leaderboard';
import { AI_PERSONAS, ALL_PERSONA_IDS } from '../bot/personas';
import { ALL_LEVELS, LEVEL_LABEL } from '../bot/levels';
import type { AiLevel, AiPersonaId } from '../types/ai';

type RemoteDialog = 'none' | 'create' | 'join';

/** 리더보드 미리보기용 — 순위 메달/판단 점수 색상. */
function lbRankBadge(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
}
function lbScoreColor(score: number): string {
  if (score >= 80) return '#34d399';
  if (score >= 50) return '#fbbf24';
  return '#fb7185';
}

/* ── 색상 토큰 (MIMIC PLAYLAB 톤앤매너) ─────────────────── */
const COLORS = {
  bg: '#000',
  cardBg: '#141414',
  cardBgInset: '#1a1a1a',
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',
  red: '#E53935',
  redDim: 'rgba(229,57,53,0.18)',
  redGlow: 'rgba(229,57,53,0.28)',
  textPrimary: '#FFFCF3',
  textSecondary: 'rgba(255,252,243,0.65)',
  textMuted: 'rgba(255,252,243,0.4)',
  blue: '#4F6BED',
  blueDim: 'rgba(79,107,237,0.15)',
};

const s: Record<string, React.CSSProperties> = {
  page: { position: 'relative', minHeight: '100vh', background: COLORS.bg },
  inner: { position: 'relative', zIndex: 1, maxWidth: 430, margin: '0 auto', padding: '12px 16px 24px' },

  
  /* ARENA — VS 영역 */
  arena: {
    position: 'relative', overflow: 'hidden',
    background: COLORS.cardBg, borderRadius: 16,
    border: `1px solid ${COLORS.border}`, padding: '24px 18px 20px', marginBottom: 12,
  },

  vsRow: {
    position: 'relative', zIndex: 2,
    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center', gap: '10px',
  },
  vsSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  vsCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
  vsLabel: { fontSize: '24px', fontWeight: 800, color: COLORS.red, letterSpacing: '0.08em' },
  vsDot: { width: '5px', height: '5px', borderRadius: '50%', background: COLORS.red, boxShadow: `0 0 8px ${COLORS.red}` },
  vsName: { fontSize: '13px', fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '0.15em', textTransform: 'uppercase' },
  vsSub: { fontSize: '10px', color: COLORS.textSecondary, letterSpacing: 0 },

  /* AI/친구 토글 — 카드형 */
  modeToggle: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
    marginTop: 10, padding: 4, background: COLORS.cardBgInset,
    borderRadius: 10, border: `1px solid ${COLORS.border}`,
  },

  /* 페르소나 그리드 */
  charGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6, marginTop: 14 },

  /* 페르소나 정보 카드 */
  charInfo: {
    background: COLORS.cardBgInset, borderRadius: 12,
    border: `1px solid ${COLORS.border}`,
    padding: '12px 14px', marginTop: 10,
    display: 'flex', alignItems: 'flex-start', gap: 12,
  },
  charName: { fontSize: '14px', fontWeight: 700, color: COLORS.textPrimary, letterSpacing: '0.06em', marginBottom: 2 },
  charDesc: { fontSize: '11px', color: COLORS.textSecondary, lineHeight: 1.45, letterSpacing: 0 },

  diffPills: { display: 'flex', gap: 4, padding: 3, background: 'rgba(0,0,0,0.35)', borderRadius: 8, width: '100%' },

  /* CTA */
  btnStart: {
    width: '100%', background: COLORS.red, color: COLORS.textPrimary,
    fontSize: '15px', fontWeight: 800, letterSpacing: '0.08em',
    padding: '15px', border: 'none', borderRadius: 12,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 14,
    boxShadow: `0 6px 20px rgba(229,57,53,0.35)`,
    transition: 'transform 0.1s, box-shadow 0.2s',
  },

  /* 성장 지표 카드 */
  statsCard: {
    background: COLORS.cardBg, borderRadius: 16,
    border: `1px solid ${COLORS.border}`, padding: '16px 16px 18px', marginBottom: 10,
  },
  secLabel: { fontSize: '12px', color: COLORS.textPrimary, fontWeight: 700, marginBottom: 10, letterSpacing: 0 },
  statsTabs: {
    display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0,
    padding: 3, background: COLORS.cardBgInset, borderRadius: 8,
    marginBottom: 12,
  },
  statsEmpty: { padding: '20px', textAlign: 'center', background: COLORS.cardBgInset, borderRadius: 10 },
  statsEmptyT: { fontSize: '13px', color: COLORS.textPrimary, marginBottom: 4 },
  statsEmptyS: { fontSize: '11px', color: COLORS.textSecondary },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: COLORS.cardBgInset, borderRadius: 10, overflow: 'hidden' },
  statsItem: { padding: '14px 8px', textAlign: 'center', borderRight: `1px solid ${COLORS.border}` },
  statsItemLast: { padding: '14px 8px', textAlign: 'center' },
  statsVal: { fontSize: '22px', fontWeight: 800, color: COLORS.red, marginBottom: 3, letterSpacing: 0 },
  statsLbl: { fontSize: '10px', color: COLORS.textSecondary, letterSpacing: 0 },

  /* 기록 카드 */
  recordCard: {
    width: '100%', background: COLORS.cardBg, borderRadius: 14,
    border: `1px solid ${COLORS.border}`, padding: '14px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  recordIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: COLORS.cardBgInset, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: COLORS.textSecondary,
  },
  recordT: { fontSize: '14px', fontWeight: 700, color: COLORS.textPrimary, letterSpacing: 0 },
  recordS: { fontSize: '11px', color: COLORS.textSecondary, marginTop: 2, letterSpacing: 0 },

  /* 친구 모드 */
  friendGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 },
  btnFriend: {
    padding: '16px', border: `1px solid ${COLORS.blue}`,
    background: COLORS.blueDim, color: COLORS.blue,
    fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em',
    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
  },
  btnFriendStart: {
    width: '100%', background: COLORS.blue, color: COLORS.textPrimary,
    fontSize: '15px', fontWeight: 800, letterSpacing: '0.08em',
    padding: '15px', border: 'none', borderRadius: 12,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 10,
    boxShadow: `0 6px 20px rgba(79,107,237,0.3)`,
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const { settings, setNickname } = useSettings();
  const [pickedPersona, setPickedPersona] = useState<AiPersonaId>('MANIAC');
  const [pickedLevel, setPickedLevel] = useState<AiLevel>('MEDIUM');
  const [mode, setMode] = useState<'ai' | 'friend'>('ai');
  const [remoteDialog, setRemoteDialog] = useState<RemoteDialog>('none');
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startAiGame = useGameStore((st) => st.startAiGame);

  // 선택한 페르소나 리더보드 TOP3 — 메인에서 바로 노출.
  const [topEntries, setTopEntries] = useState<LeaderboardEntry[]>([]);
  useEffect(() => {
    let alive = true;
    void getLeaderboard(pickedPersona).then((d) => {
      if (alive) setTopEntries(d.entries.slice(0, 3));
    });
    return () => {
      alive = false;
    };
  }, [pickedPersona]);

  const handleStart = () => {
    startAiGame(pickedPersona, pickedLevel);
    navigate('/table');
  };

  const persona = AI_PERSONAS[pickedPersona];
  const nickname = settings.nickname || '익명';
  const avatarInitials = nickname.slice(0, 2).toUpperCase();
  const isAiMode = mode === 'ai';

  // 로그인/설정으로 정해진 닉네임을 입력칸에 표시 (사용자가 편집 중이 아닐 때만).
  useEffect(() => {
    if (document.activeElement === nameInputRef.current) return;
    setNameInput(settings.nickname && settings.nickname !== '익명' ? settings.nickname : '');
  }, [settings.nickname]);

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setNickname(trimmed);
  };
  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitName();
  };

  return (
    <main style={s.page}>
      <SubAppHeader
        title="HEADS-UP"
        className="!bg-black !border-b !border-white/10 [&_h1]:!text-white [&_h1]:!text-[15px] [&_h1]:!font-extrabold [&_h1]:!tracking-[0.18em]"
        left={
          <BackToHub
            className="!text-white hover:!text-white !text-[14px] !font-semibold !tracking-normal"
          >
            <span style={{ fontSize: 16, marginRight: 4, lineHeight: 1 }}>←</span>
            <span>홈</span>
          </BackToHub>
        }
        right={
          <Link
            to="/settings"
            aria-label="설정"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 10,
              border: `1px solid rgba(255,255,255,0.14)`,
              background: 'rgba(255,255,255,0.04)',
              color: '#fff', textDecoration: 'none',
              fontSize: 16, lineHeight: 1,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            ⚙
          </Link>
        }
      />

      <div style={s.inner}>

        {/* ════════════════════════════════════════════
            ARENA — VS 영역 + AI/친구 토글 + 페르소나
            ════════════════════════════════════════════ */}
        <div style={s.arena}>
          {/* 좌우 글로우 */}
          <div style={{
            position: 'absolute', top: 0, left: '-30px', width: '180px', height: '180px',
            borderRadius: '50%', background: COLORS.redGlow, filter: 'blur(60px)', pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, right: '-30px', width: '180px', height: '180px',
            borderRadius: '50%', filter: 'blur(60px)', pointerEvents: 'none',
            background: isAiMode ? COLORS.redGlow : 'rgba(79,107,237,0.28)',
          }} />
          {/* ── VS ROW ── */}
          <div style={{ ...s.vsRow, position: 'relative' }}>
            {/* 플레이어 */}
            <div style={s.vsSide}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, fontWeight: 800,
                background: COLORS.cardBgInset,
                border: `2px solid ${COLORS.red}`,
                color: COLORS.red,
                boxShadow: `0 0 18px ${COLORS.redGlow}, inset 0 0 12px rgba(229,57,53,0.15)`,
              }}>
                {avatarInitials}
              </div>
                <input
                  ref={nameInputRef}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value.slice(0, 12))}
                  onBlur={commitName}
                  onKeyDown={handleNameKeyDown}
                  placeholder="닉네임"
                  maxLength={12}
                  style={{
                    background: 'transparent',
                    color: COLORS.textPrimary, fontSize: '13px', fontWeight: 700,
                    letterSpacing: '0.1em', textAlign: 'center',
                    width: '100px', outline: 'none',
                    padding: '2px 0',
                  }}
                />
              <div style={s.vsSub}>나</div>
            </div>

            {/* 중앙 VS */}
            <div style={s.vsCenter}>
              <div style={s.vsLabel}>VS</div>
            </div>

            {/* 상대 */}
            <div style={s.vsSide}>
              {isAiMode ? (
                <img
                  src={persona.avatarSrc}
                  alt={persona.displayName}
                  style={{
                    width: 72, height: 72, borderRadius: '50%',
                    objectFit: 'cover',
                    border: `2px solid ${COLORS.red}`,
                    boxShadow: `0 0 18px ${COLORS.redGlow}`,
                  }}
                />
              ) : (
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700,
                  background: COLORS.blueDim,
                  border: `2px solid ${COLORS.blue}`,
                  color: COLORS.blue,
                  boxShadow: `0 0 18px rgba(79,107,237,0.28)`,
                }}>
                  ?
                </div>
              )}
              <div style={s.vsName as React.CSSProperties}>
                {isAiMode ? persona.displayName.toUpperCase() : '친구'}
              </div>
              <div style={s.vsSub}>{isAiMode ? LEVEL_LABEL[pickedLevel] : 'P2P'}</div>
            </div>
          </div>

          {/* ── AI/친구 토글 (카드형) ── */}
          <div style={s.modeToggle}>
            {(['ai', 'friend'] as const).map((m) => {
              const active = mode === m;
              const activeColor = m === 'ai' ? COLORS.red : COLORS.blue;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    background: active ? activeColor : 'transparent',
                    border: 'none',
                    padding: '10px',
                    fontSize: '12px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: active ? COLORS.textPrimary : COLORS.textSecondary,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    borderRadius: 7,
                    transition: 'all 0.15s',
                    boxShadow: active ? `0 2px 10px ${activeColor}55` : 'none',
                  }}
                >
                  {m === 'ai' ? 'AI' : '친구'}
                </button>
              );
            })}
          </div>

          {/* ── AI ZONE ── */}
          {isAiMode && (
            <>
              {/* 페르소나 그리드 */}
              <div style={s.charGrid}>
                {ALL_PERSONA_IDS.map((id) => {
                  const p = AI_PERSONAS[id];
                  const selected = pickedPersona === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPickedPersona(id)}
                      style={{
                        position: 'relative', overflow: 'hidden',
                        background: COLORS.cardBgInset,
                        border: selected ? `1.5px solid ${COLORS.red}` : `1px solid ${COLORS.border}`,
                        borderRadius: 10,
                        padding: '10px 6px 8px', cursor: 'pointer',
                        textAlign: 'center', fontFamily: 'inherit',
                        boxShadow: selected ? `0 0 14px ${COLORS.redGlow}` : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <img
                        src={p.avatarSrc}
                        alt={p.displayName}
                        style={{
                          width: 44, height: 44, borderRadius: '50%',
                          objectFit: 'cover', display: 'block', margin: '0 auto 5px',
                          opacity: selected ? 1 : 0.55,
                          transition: 'opacity 0.15s',
                          filter: selected ? 'none' : 'grayscale(0.3)',
                        }}
                      />
                      <div style={{
                        fontSize: 9, fontWeight: 700,
                        color: selected ? COLORS.textPrimary : COLORS.textSecondary,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
                      }}>
                        {p.displayName}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* 페르소나 정보 + 난이도 */}
              <div style={s.charInfo}>
                <img
                  src={persona.avatarSrc}
                  alt={persona.displayName}
                  style={{
                    width: 46, height: 46, borderRadius: '50%',
                    objectFit: 'cover', flexShrink: 0,
                    border: `1px solid ${COLORS.red}`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={s.charName as React.CSSProperties}>{persona.displayName}</div>
                    <div style={s.charDesc}>{persona.description}</div>
                  </div>
                  <div style={s.diffPills}>
                  {/* 베타: Normal(MEDIUM) 만 활성. EASY/HARD 는 '곧 업데이트' 안내. */}
                  {ALL_LEVELS.map((lv) => {
                    const active = pickedLevel === lv;
                    const enabled = lv === 'MEDIUM';
                    return (
                      <button
                        key={lv}
                        type="button"
                        onClick={() => enabled && setPickedLevel(lv)}
                        disabled={!enabled}
                        title={enabled ? undefined : '곧 업데이트'}
                        aria-disabled={!enabled}
                        style={{
                          flex: 1,
                          background: enabled
                            ? (active ? COLORS.red : 'transparent')
                            : 'rgba(255,255,255,0.05)',
                          border: 'none',
                          padding: '6px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                          color: enabled
                            ? (active ? COLORS.textPrimary : COLORS.textSecondary)
                            : 'rgba(255,255,255,0.32)',
                          cursor: enabled ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit',
                          letterSpacing: 0,
                          whiteSpace: 'nowrap',
                          borderRadius: 6,
                          boxShadow: active && enabled ? `0 2px 8px ${COLORS.redGlow}` : 'none',
                          transition: 'all 0.15s',
                          opacity: 1,
                        }}
                      >
                        {LEVEL_LABEL[lv]}
                        {!enabled && <span style={{ marginLeft: 4, fontSize: 8, opacity: 0.7 }}>• 곧</span>}
                      </button>
                    );
                  })}
                  </div>
                </div>
              </div>

              <button type="button" onClick={handleStart} style={s.btnStart as React.CSSProperties}>
                대결 시작 →
              </button>

              {/* 선택 페르소나 리더보드 TOP3 — 바로 노출 (탭하면 전체 보드) */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/leaderboard?persona=${pickedPersona}`)}
                style={{
                  marginTop: 12,
                  background: COLORS.cardBgInset,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: topEntries.length ? 8 : 0,
                  }}
                >
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                    }}
                  >
                    <span style={{ width: 20, textAlign: 'center' }}>🏆</span>
                    {persona.displayName} 리더보드
                  </span>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>전체 보기 ›</span>
                </div>
                {topEntries.length === 0 ? (
                  <div style={{ fontSize: 11, color: COLORS.textMuted, textAlign: 'center', padding: '8px 0' }}>
                    아직 순위에 오른 플레이어가 없습니다
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {topEntries.map((e) => (
                      <div key={e.rank} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                        <span style={{ width: 20, textAlign: 'center', fontWeight: 700, color: COLORS.textSecondary }}>
                          {lbRankBadge(e.rank)}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: e.isMe ? '#fbbf24' : COLORS.textPrimary,
                            fontWeight: e.isMe ? 700 : 500,
                          }}
                        >
                          {e.nickname}
                          {e.isMe ? ' (나)' : ''}
                        </span>
                        <span
                          style={{
                            minWidth: 28,
                            textAlign: 'right',
                            fontSize: 14,
                            fontWeight: 800,
                            color: lbScoreColor(e.avgScore),
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {e.avgScore}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── 친구 ZONE ── */}
          {!isAiMode && (
            <>
              <div style={s.friendGrid}>
                <button type="button" onClick={() => setRemoteDialog('create')} style={s.btnFriend as React.CSSProperties}>
                  방 만들기
                </button>
                <button
                  type="button"
                  onClick={() => setRemoteDialog('join')}
                  style={{ ...(s.btnFriend as React.CSSProperties), background: 'transparent' }}
                >
                  코드 입력
                </button>
              </div>
              <button type="button" style={s.btnFriendStart as React.CSSProperties}>
                입장하기 →
              </button>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════
            기록 카드
            ════════════════════════════════════════════ */}
        <button type="button" onClick={() => navigate('/history')} style={s.recordCard as React.CSSProperties}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={s.recordIcon}>📋</div>
            <div style={{ textAlign: 'left' }}>
              <div style={s.recordT}>내 기록 보기</div>
              <div style={s.recordS}>과거 플레이한 핸드 검토</div>
            </div>
          </div>
          <div style={{ color: COLORS.textSecondary, fontSize: 18 }}>›</div>
        </button>
      </div>

      <CreateRoomDialog
        open={remoteDialog === 'create'}
        onClose={() => setRemoteDialog('none')}
        myName={settings.nickname}
      />
      <JoinRoomDialog
        open={remoteDialog === 'join'}
        onClose={() => setRemoteDialog('none')}
        myName={settings.nickname}
      />
    </main>
  );
}
