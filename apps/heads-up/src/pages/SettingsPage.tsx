import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ConfirmModal } from '../components/common/ConfirmModal';
import { useSettings } from '../hooks/useSettings';
import {
  MIN_MATCH_LENGTH,
  MAX_MATCH_LENGTH,
} from '../storage/settings';
import { useToastStore } from '../store/toast-store';
import { _resetDBForTests, clearAll } from '../storage/history';
import { APP_VERSION } from '../utils/version';
import { BetPresetsEditor } from '../components/common/BetPresetsEditor';

export default function SettingsPage() {
  const {
    settings,
    setNickname,
    setSoundEnabled,
    setHapticEnabled,
    setBetPresets,
    setMatchLength,
    setDisplayUnit,
  } = useSettings();
  const [nicknameDraft, setNicknameDraft] = useState(settings.nickname);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearStatus, setClearStatus] = useState<string | null>(null);

  const onSaveNickname = () => {
    setNickname(nicknameDraft);
  };

  const onClearAll = async () => {
    try {
      await clearAll();
      // Reset toast-store shown ids so milestones can fire fresh.
      useToastStore.getState().reset();
      // Force a fresh DB connection on next access.
      await _resetDBForTests();
      setClearStatus('모든 기록이 삭제되었습니다.');
    } catch (err) {
      setClearStatus(`삭제 실패: ${(err as Error).message}`);
    } finally {
      setConfirmClear(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← 홈
        </Link>
        <h1 className="text-base font-bold text-primary">설정</h1>
        <div className="w-10" /> {/* spacer */}
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        {/* Nickname */}
        <Section title="닉네임">
          <div className="flex gap-2">
            <input
              type="text"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              maxLength={20}
              placeholder="익명"
              aria-label="닉네임"
              className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <button
              type="button"
              onClick={onSaveNickname}
              disabled={nicknameDraft.trim() === settings.nickname}
              className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              저장
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            친구와 플레이 시 상대에게 표시됩니다. 최대 20자.
          </p>
        </Section>

        {/* Toggles */}
        <Section title="피드백">
          <ToggleRow
            label="효과음"
            desc="칩 클릭, 승리 효과음"
            checked={settings.soundEnabled}
            onChange={setSoundEnabled}
          />
          <ToggleRow
            label="햅틱 (모바일)"
            desc="액션 시 진동 (지원 기기만)"
            checked={settings.hapticEnabled}
            onChange={setHapticEnabled}
          />
        </Section>

        {/* 금액 표시 단위 */}
        <Section title="금액 표시 단위">
          <p className="mb-2 text-[11px] text-muted-foreground">
            베팅 금액·팟·액션 토스트에 사용할 단위.
          </p>
          <div className="flex gap-2">
            {(['bb', 'chips'] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDisplayUnit(u)}
                className={clsx(
                  'flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors',
                  settings.displayUnit === u
                    ? 'border-amber-400 bg-amber-400/15 text-amber-300'
                    : 'border-border bg-card text-muted-foreground hover:bg-white/5',
                )}
              >
                {u === 'bb' ? 'BB 단위' : '칩 수량'}
              </button>
            ))}
          </div>
        </Section>

        {/* Match length — 마스터 스펙 v2 §8.3 */}
        <Section title="매치 길이">
          <p className="mb-2 text-[11px] text-muted-foreground">
            한 매치당 핸드 수. 다음 매치부터 적용됩니다.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={MIN_MATCH_LENGTH}
              max={MAX_MATCH_LENGTH}
              step={1}
              value={settings.matchLength}
              onChange={(e) => setMatchLength(Number(e.target.value))}
              aria-label="매치 길이"
              className="flex-1 accent-amber-400"
            />
            <span className="w-12 rounded-md border border-border bg-card px-2 py-1 text-center text-sm font-bold text-foreground">
              {settings.matchLength}
            </span>
            <span className="text-xs text-muted-foreground">핸드</span>
          </div>
        </Section>

        {/* Bet sizing presets */}
        <Section title="베팅 사이즈 프리셋">
          <p className="mb-2 text-[11px] text-muted-foreground">
            팟 대비 비율로 레이즈/베팅 시 사용할 단축 버튼. ALL-IN은 항상 표시됩니다.
          </p>
          <BetPresetsEditor
            value={settings.betPresets}
            onChange={setBetPresets}
          />
        </Section>

        {/* Theme — placeholder */}
        <Section title="테마">
          <div className="flex items-center justify-between rounded bg-card px-3 py-2 text-sm">
            <span>다크 (기본)</span>
            <span className="text-[10px] text-muted-foreground">라이트 모드는 준비 중</span>
          </div>
        </Section>

        {/* Danger zone */}
        <Section title="데이터" tone="danger">
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="w-full rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-900/50 active:scale-95"
          >
            모든 기록 삭제
          </button>
          <p className="mt-1 text-[11px] text-muted-foreground">
            저장된 모든 핸드, 통계, 마일스톤이 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
          </p>
          {clearStatus && (
            <div
              role="status"
              className="mt-2 rounded bg-card px-2 py-1 text-xs text-foreground"
            >
              {clearStatus}
            </div>
          )}
        </Section>

        {/* Meta */}
        <Section title="정보">
          <div className="space-y-1 text-xs">
            <Row label="앱 버전" value={APP_VERSION} />
            <Row
              label="문서"
              value={
                <Link to="/about" className="text-primary hover:underline">
                  앱 소개 →
                </Link>
              }
            />
          </div>
        </Section>
      </div>

      <ConfirmModal
        open={confirmClear}
        title="모든 기록 삭제"
        message={
          '저장된 모든 핸드 기록·통계·마일스톤이 영구 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.'
        }
        confirmLabel="삭제"
        danger
        onConfirm={onClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </main>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: 'danger';
}) {
  return (
    <section
      className={clsx(
        'rounded-lg border bg-card p-4',
        tone === 'danger' ? 'border-red-900/40' : 'border-border',
      )}
    >
      <h2
        className={clsx(
          'mb-2 text-xs font-bold uppercase tracking-wide',
          tone === 'danger' ? 'text-red-400' : 'text-muted-foreground',
        )}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          checked ? 'bg-primary' : 'bg-secondary',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 inline-block h-5 w-5 rounded-full bg-card shadow transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
