import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PeerConnection } from '../../rtc/peer-connection';
import { getPeerOptions } from '../../rtc/peer-options';
import { useGameStore } from '../../store/game-store';

interface CreateRoomDialogProps {
  open: boolean;
  onClose: () => void;
  myName: string;
}

type State =
  | { status: 'creating' }
  | { status: 'waiting'; code: string }
  | { status: 'error'; message: string };

export function CreateRoomDialog({ open, onClose, myName }: CreateRoomDialogProps) {
  const navigate = useNavigate();
  const attachRemoteConnection = useGameStore((s) => s.attachRemoteConnection);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const gameState = useGameStore((s) => s.gameState);
  const [state, setState] = useState<State>({ status: 'creating' });
  const [peer, setPeer] = useState<PeerConnection | null>(null);
  // Transient "복사됨" feedback after the share/copy button is pressed.
  const [copied, setCopied] = useState(false);
  // Tracks whether this effect's peer was successfully passed to the store
  // (via attachRemoteConnection). Once handed off, the store owns the peer's
  // lifecycle, and dialog unmount must NOT close it — otherwise navigating to
  // /table after a successful connect would kill the live session.
  const handedOffRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setState({ status: 'creating' });
    handedOffRef.current = false;
    const p = new PeerConnection({ peerOptions: getPeerOptions() });
    setPeer(p);
    p.createRoom()
      .then((code) => {
        if (cancelled) {
          p.close();
          return;
        }
        setState({ status: 'waiting', code });
        attachRemoteConnection({
          peer: p,
          isHost: true,
          myName,
          roomCode: code,
        });
        handedOffRef.current = true;
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ status: 'error', message: err.message });
      });
    return () => {
      cancelled = true;
      // Only close if we still own the peer. Once handed to the store (e.g.,
      // after successful createRoom), the store's resetGame / leaveRemoteGame
      // handles the teardown.
      if (!handedOffRef.current) {
        try {
          p.close();
        } catch {
          // swallow — already closed
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Once the guest connects AND we have a game state, navigate to the table.
  useEffect(() => {
    if (open && connectionStatus === 'CONNECTED' && gameState) {
      navigate('/table');
    }
  }, [open, connectionStatus, gameState, navigate]);

  const cancel = () => {
    peer?.close();
    useGameStore.getState().resetGame();
    onClose();
  };

  const flashCopied = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const copyToClipboard = async (value: string): Promise<boolean> => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // fall through to the legacy path below
    }
    // Fallback for non-secure contexts / older browsers without the async API.
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const share = async () => {
    if (state.status !== 'waiting') return;
    const text = `HEADS-UP 대결\n코드: ${state.code}`;
    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as unknown as {
            share?: (d: { title: string; text: string }) => Promise<void>;
          })
        : undefined;
    // Mobile / supported browsers: native share sheet (its own feedback).
    if (nav?.share) {
      try {
        await nav.share({ title: 'HEADS-UP', text });
        return;
      } catch {
        // user cancelled the share sheet, or it failed — fall back to copy.
      }
    }
    // Desktop / no Web Share API: copy the code and show feedback so the
    // button isn't silent.
    if (await copyToClipboard(state.code)) flashCopied();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <h3 className="mb-3 text-lg font-bold text-primary">방 만들기</h3>

            {state.status === 'creating' && (
              <p className="py-6 text-center text-sm text-foreground">방을 만드는 중…</p>
            )}

            {state.status === 'waiting' && (
              <>
                <p className="mb-3 text-sm text-foreground">
                  상대에게 아래 코드를 공유하세요.
                </p>
                <button
                  type="button"
                  onClick={share}
                  title="코드 복사"
                  className="mb-2 w-full rounded-lg border border-primary/30 bg-black/40 p-4 text-center transition-colors hover:border-primary/60 hover:bg-black/60"
                >
                  <div className="text-2xl font-bold tracking-wider text-primary">
                    {state.code}
                  </div>
                </button>
                <p className="mb-3 h-4 text-center text-xs text-green-400">
                  {copied ? '코드를 복사했어요!' : ''}
                </p>
                <div className="mb-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  상대를 기다리는 중…
                </div>
                <div className="flex justify-between gap-2">
                  <button
                    type="button"
                    onClick={cancel}
                    className="flex-1 rounded-md border border-border bg-muted px-4 py-2 text-sm text-foreground hover:bg-secondary"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={share}
                    className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    {copied ? '복사됨 ✓' : '공유'}
                  </button>
                </div>
              </>
            )}

            {state.status === 'error' && (
              <>
                <p className="mb-3 text-sm text-red-400 whitespace-pre-line">{state.message}</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  네트워크 상태를 확인하고 다시 시도하세요. 일부 모바일 네트워크나 엄격한
                  NAT 환경에서는 연결이 실패할 수 있습니다. Wi-Fi 전환이 도움될 수
                  있습니다.
                </p>
                <button
                  type="button"
                  onClick={cancel}
                  className="w-full rounded-md border border-border bg-muted px-4 py-2 text-sm text-foreground hover:bg-secondary"
                >
                  닫기
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
