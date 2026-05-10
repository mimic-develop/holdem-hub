import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SubAppHeader } from '@hh/ui';
import heroBg from '../assets/hero-bg.mp4';
import { CreateRoomDialog } from '../components/home/CreateRoomDialog';
import { JoinRoomDialog } from '../components/home/JoinRoomDialog';
import { useSettings } from '../hooks/useSettings';
import { useStats } from '../hooks/useStats';
import { useGameStore } from '../store/game-store';
import { AI_PERSONAS, ALL_PERSONA_IDS } from '../bot/personas';
import { ALL_LEVELS, LEVEL_LABEL } from '../bot/levels';
import type { AiLevel, AiPersonaId } from '../types/ai';

const PERSONA_ICON: Record<AiPersonaId, string> = {
  STANDARD: '◐',
  NIT: '◇',
  LAG: '▲',
  CALLING: '○',
  MANIAC: '✕',
};

type RemoteDialog = 'none' | 'create' | 'join';

const RANGE_LABELS: Record<string, string> = {
  today: '오늘',
  week: '주간',
  month: '월간',
  all: '전체',
};

const s: Record<string, React.CSSProperties> = {
  page: { position: 'relative', minHeight: '100vh', background: '#0a0a0a' },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 0,
    background: 'rgba(8,8,8,0.45)',
    pointerEvents: 'none',
  },
  inner: {
    position: 'relative', zIndex: 1,
    maxWidth: 430, margin: '0 auto',
    minHeight: '100vh',
  },
  arena: {
    position: 'relative', overflow: 'hidden', padding: '32px 24px 16px',
    background: 'rgba(8,8,8,0.65)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  vsRow: {
    position: 'relative', zIndex: 2,
    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'flex-start', marginBottom: '28px',
  },
  vsSide: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  vsCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', paddingTop: '12px' },
  vsLabel: { fontSize: '28px', fontWeight: 700, color: '#BA0C19', letterSpacing: '0.05em' },
  vsDot: { width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(186,12,25,0.45)' },
  vsName: { fontSize: '14px', fontWeight: 700, color: '#FFFCF3', letterSpacing: '0.2em', textTransform: 'uppercase' },
  vsSub: { fontSize: '11px', color: 'rgba(255,252,243,0.75)', letterSpacing: '0.1em' },
  charGrid: { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '6px', marginBottom: '10px' },
  charInfo: {
    background: '#0f0f0f', border: '1px solid rgba(255,252,243,0.07)',
    borderTop: '2px solid #BA0C19', padding: '12px 14px', marginBottom: '14px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
  },
  charName: { fontSize: '15px', fontWeight: 700, color: '#FFFCF3', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '3px' },
  charDesc: { fontSize: '11px', color: 'rgba(255,252,243,0.80)', lineHeight: 1.55 },
  diffPills: { display: 'flex', gap: '4px' },
  btnStart: {
    width: '100%', background: '#BA0C19', color: '#FFFCF3',
    fontSize: '15px', fontWeight: 700, letterSpacing: '0.22em',
    textTransform: 'uppercase', padding: '16px', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  section: {
    padding: '10px 24px',
    background: 'rgba(8,8,8,0.6)',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    marginTop: 0,
  },
  secLabel: { fontSize: '11px', letterSpacing: '0.3em', color: 'rgba(255,252,243,0.90)', textTransform: 'uppercase', marginBottom: '11px' },
  statsTabs: { display: 'flex', border: '1px solid rgba(255,252,243,0.14)', marginBottom: '11px' },
  statsEmpty: { padding: '22px', textAlign: 'center', border: '1px solid rgba(255,252,243,0.10)' },
  statsEmptyT: { fontSize: '13px', color: 'rgba(255,252,243,0.85)', marginBottom: '4px' },
  statsEmptyS: { fontSize: '11px', color: 'rgba(255,252,243,0.85)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid rgba(255,252,243,0.12)' },
  statsItem: { padding: '14px', textAlign: 'center', borderRight: '1px solid rgba(255,252,243,0.12)' },
  statsItemLast: { padding: '14px', textAlign: 'center' },
  statsVal: { fontSize: '24px', fontWeight: 700, color: '#BA0C19', marginBottom: '4px' },
  statsLbl: { fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(255,252,243,0.90)', textTransform: 'uppercase' },
  recordCard: {
    width: '100%', border: '1px solid rgba(255,252,243,0.12)', padding: '14px 16px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    cursor: 'pointer', marginTop: '10px', marginBottom: '24px',
    background: 'rgba(8,8,8,0.6)', fontFamily: 'inherit',
    backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
  },
  recordT: { fontSize: '15px', fontWeight: 700, color: '#FFFCF3', letterSpacing: '0.08em' },
  recordS: { fontSize: '11px', color: 'rgba(255,252,243,0.85)', marginTop: '3px' },
  friendGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '13px' },
  btnFriend: {
    padding: '18px', border: '1px solid rgba(0,12,237,0.3)',
    background: 'rgba(0,12,237,0.06)', color: '#6674ee',
    fontSize: '13px', fontWeight: 700, letterSpacing: '0.18em',
    textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnFriendStart: {
    width: '100%', background: '#000CED', color: '#FFFCF3',
    fontSize: '15px', fontWeight: 700, letterSpacing: '0.22em',
    textTransform: 'uppercase', padding: '16px', border: 'none',
    cursor: 'pointer', fontFamily: 'inherit',
  },
};

export default function HomePage() {
  const navigate = useNavigate();
  const { settings, setNickname } = useSettings();
  const [pickedPersona, setPickedPersona] = useState<AiPersonaId>('MANIAC');
  const [pickedLevel, setPickedLevel] = useState<AiLevel>('MEDIUM');
  const [mode, setMode] = useState<'ai' | 'friend'>('ai');
  const [remoteDialog, setRemoteDialog] = useState<RemoteDialog>('none');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startAiGame = useGameStore((s) => s.startAiGame);
  const { stats, isLoading: statsLoading, range, setRange } = useStats('today');

  const handleStart = () => {
    startAiGame(pickedPersona, pickedLevel);
    navigate('/table');
  };

  const persona = AI_PERSONAS[pickedPersona];
  const nickname = settings.nickname || '익명';
  const avatarInitials = nickname.slice(0, 2).toUpperCase();
  const isAiMode = mode === 'ai';

  const handleNameEdit = () => {
    setNameInput(nickname === '익명' ? '' : nickname);
    setEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed) setNickname(trimmed);
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitName();
    if (e.key === 'Escape') setEditingName(false);
  };

  return (
    <main style={s.page}>
      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden
        src={heroBg}
        style={{
          position: 'fixed', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'contain',
          zIndex: 0,
        }}
      />

      <div style={s.overlay} />
      <SubAppHeader
        title="Heads-Up"
        right={
          <Link
            to="/settings"
            aria-label="설정"
            className="flex h-8 w-8 items-center justify-center border border-border text-foreground/50 no-underline transition-colors hover:text-foreground"
          >
            ⚙
          </Link>
        }
      />
      <div style={s.inner}>

      {/* ARENA */}
      <div style={s.arena}>
        {/* Glows */}
        <div style={{
          position: 'absolute', top: 0, left: '-20px', width: '200px', height: '180px',
          borderRadius: '50%', background: 'rgba(186,12,25,0.1)', filter: 'blur(50px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 0, right: '-20px', width: '200px', height: '180px',
          borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none', transition: 'background 0.4s',
          background: isAiMode ? 'rgba(186,12,25,0.1)' : 'rgba(0,12,237,0.14)',
        }} />
        {/* Vertical divider */}
        <div style={{
          position: 'absolute', top: 0, left: '50%', width: '1px', height: '100%',
          pointerEvents: 'none', transition: 'background 0.3s',
          background: isAiMode ? 'rgba(186,12,25,0.18)' : 'rgba(0,12,237,0.22)',
        }} />

        {/* VS ROW */}
        <div style={s.vsRow}>
          {/* Player */}
          <div style={s.vsSide}>
            <div style={{
              width: '76px', height: '76px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px', fontWeight: 700,
              background: 'rgba(186,12,25,0.12)', border: '2px solid rgba(186,12,25,0.45)', color: '#BA0C19',
              boxShadow: '0 0 14px rgba(186,12,25,0.25)',
            }}>
              {avatarInitials}
            </div>
            {editingName ? (
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
                  border: 'none', borderBottom: '1px solid rgba(186,12,25,0.6)',
                  color: '#FFFCF3', fontSize: '14px', fontWeight: 700,
                  letterSpacing: '0.15em', textAlign: 'center',
                  width: '100px', outline: 'none', fontFamily: 'inherit',
                  padding: '2px 0',
                }}
              />
            ) : (
              <button
                type="button"
                onClick={handleNameEdit}
                title="이름 변경"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  position: 'relative', display: 'inline-flex', alignItems: 'center',
                  padding: 0, fontFamily: 'inherit',
                }}
              >
                <span style={{ ...s.vsName as React.CSSProperties }}>
                  {nickname.slice(0, 10)}
                </span>
                <span style={{
                  position: 'absolute', left: '100%', marginLeft: '4px',
                  fontSize: '11px', color: 'rgba(255,252,243,0.25)', lineHeight: 1,
                }}>✎</span>
              </button>
            )}
            <div style={s.vsSub}>나</div>
          </div>

          {/* VS center */}
          <div style={s.vsCenter}>
            <div style={s.vsDot} />
            <div style={s.vsLabel}>VS</div>
            <div style={s.vsDot} />
          </div>

          {/* Opponent */}
          <div style={s.vsSide}>
            {isAiMode ? (
              <img
                src={persona.avatarSrc}
                alt={persona.displayName}
                style={{
                  width: '76px', height: '76px', borderRadius: '50%',
                  objectFit: 'cover', transition: 'all 0.3s',
                  border: '2px solid rgba(255,252,243,0.18)',
                  boxShadow: '0 0 14px rgba(186,12,25,0.35)',
                }}
              />
            ) : (
              <div style={{
                width: '76px', height: '76px', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '24px', fontWeight: 700,
                background: 'rgba(0,12,237,0.1)',
                border: '1px solid rgba(0,12,237,0.4)', color: '#6674ee',
              }}>
                ?
              </div>
            )}
            <div style={s.vsName as React.CSSProperties}>
              {isAiMode ? persona.displayName.toUpperCase() : '친구'}
            </div>
            <div style={s.vsSub}>{isAiMode ? LEVEL_LABEL[pickedLevel] : 'P2P'}</div>
            {/* Mode toggle */}
            <div style={{ display: 'inline-flex', border: '1px solid rgba(255,252,243,0.1)', padding: '2px' }}>
              {(['ai', 'friend'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    background: mode === m
                      ? (m === 'ai' ? 'rgba(186,12,25,0.2)' : 'rgba(0,12,237,0.2)')
                      : 'transparent',
                    border: 'none', padding: '6px 14px',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em',
                    color: mode === m ? (m === 'ai' ? '#BA0C19' : '#6674ee') : 'rgba(255,252,243,0.70)',
                    cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', transition: 'all 0.2s',
                  }}
                >
                  {m === 'ai' ? 'AI' : '친구'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI ZONE */}
        {isAiMode && (
          <>
            {/* Character grid */}
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
                      background: selected ? 'rgba(186,12,25,0.08)' : '#111',
                      border: selected ? '1px solid #BA0C19' : '1px solid rgba(255,252,243,0.07)',
                      padding: '10px 6px 8px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit',
                    }}
                  >
                    {selected && (
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#BA0C19' }} />
                    )}
                    <img
                      src={p.avatarSrc}
                      alt={p.displayName}
                      style={{
                        width: '46px', height: '46px', borderRadius: '50%',
                        objectFit: 'cover', marginBottom: '5px',
                        opacity: selected ? 1 : 0.4,
                        transition: 'opacity 0.2s',
                        display: 'block', margin: '0 auto 5px',
                      }}
                    />
                    <div style={{ fontSize: '9px', fontWeight: 700, color: 'rgba(255,252,243,0.92)', letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {p.displayName}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Char info + difficulty */}
            <div style={s.charInfo}>
              <img
                src={persona.avatarSrc}
                alt={persona.displayName}
                style={{
                  width: '50px', height: '50px', borderRadius: '50%',
                  objectFit: 'cover', flexShrink: 0,
                  border: '1px solid rgba(186,12,25,0.4)',
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={s.charName as React.CSSProperties}>{persona.displayName}</div>
                <div style={s.charDesc}>{persona.description}</div>
              </div>
              <div style={s.diffPills}>
                {ALL_LEVELS.map((lv) => {
                  const active = pickedLevel === lv;
                  return (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setPickedLevel(lv)}
                      style={{
                        background: active ? 'rgba(186,12,25,0.15)' : 'transparent',
                        border: active ? '1px solid #BA0C19' : '1px solid rgba(255,252,243,0.1)',
                        padding: '6px 12px', fontSize: '11px', fontWeight: 700,
                        color: active ? '#FFFCF3' : 'rgba(255,252,243,0.70)',
                        cursor: 'pointer', fontFamily: 'inherit',
                        letterSpacing: '0.1em', whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                    >
                      {LEVEL_LABEL[lv]}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="button" onClick={handleStart} style={s.btnStart as React.CSSProperties}>
              대결 시작 →
            </button>
          </>
        )}

        {/* FRIEND ZONE */}
        {!isAiMode && (
          <>
            <div style={s.friendGrid}>
              <button type="button" onClick={() => setRemoteDialog('create')} style={s.btnFriend as React.CSSProperties}>
                방 만들기
              </button>
              <button
                type="button"
                onClick={() => setRemoteDialog('join')}
                style={{ ...s.btnFriend as React.CSSProperties, background: 'transparent' }}
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

      {/* STATS */}
      <div style={s.section}>
        <div style={s.secLabel as React.CSSProperties}>내 성장 지표</div>
        {/* Range tabs */}
        <div style={s.statsTabs}>
          {(['today', 'week', 'month', 'all'] as const).map((r, i) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                flex: 1, padding: '9px', textAlign: 'center',
                fontSize: '11px', letterSpacing: '0.15em', cursor: 'pointer',
                border: 'none', fontFamily: 'inherit', textTransform: 'uppercase',
                background: range === r ? 'rgba(186,12,25,0.12)' : 'transparent',
                color: range === r ? '#BA0C19' : 'rgba(255,252,243,0.70)',
                borderRight: i < 3 ? '1px solid rgba(255,252,243,0.08)' : 'none',
              }}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {statsLoading || !stats || stats.totalHands === 0 ? (
          <div style={s.statsEmpty}>
            <div style={s.statsEmptyT}>오늘 플레이한 핸드가 없습니다</div>
            <div style={s.statsEmptyS}>첫 대결을 시작해보세요</div>
          </div>
        ) : (
          <div style={s.statsRow}>
            <div style={s.statsItem}>
              <div style={s.statsVal}>{stats.totalHands}</div>
              <div style={s.statsLbl as React.CSSProperties}>핸드</div>
            </div>
            <div style={s.statsItem}>
              <div style={s.statsVal}>{Math.round(stats.winRate * 100)}%</div>
              <div style={s.statsLbl as React.CSSProperties}>승률</div>
            </div>
            <div style={s.statsItemLast}>
              <div style={{ ...s.statsVal, color: stats.winStreak >= 2 ? '#EF9F27' : '#BA0C19' }}>
                {stats.winStreak >= 2 ? `${stats.winStreak}연승` : '-'}
              </div>
              <div style={s.statsLbl as React.CSSProperties}>연승</div>
            </div>
          </div>
        )}
      </div>

      {/* RECORD CARD */}
      <div style={{ padding: '0 24px' }}>
        <button type="button" onClick={() => navigate('/history')} style={s.recordCard as React.CSSProperties}>
          <div>
            <div style={s.recordT}>내 기록 보기</div>
            <div style={s.recordS}>과거 플레이한 핸드 검토</div>
          </div>
          <div style={{ color: 'rgba(255,252,243,0.70)', fontSize: '18px' }}>›</div>
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
      </div>
    </main>
  );
}
