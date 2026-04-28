import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { PeerConnection } from '../../rtc/peer-connection';
import { getPeerOptions } from '../../rtc/peer-options';
import { isValidRoomCode, normalizeRoomCode } from '../../rtc/protocol';
import { useGameStore } from '../../store/game-store';

interface JoinRoomDialogProps {
  open: boolean;
  onClose: () => void;
  myName: string;
}

export function JoinRoomDialog({ open, onClose, myName }: JoinRoomDialogProps) {
  const navigate = useNavigate();
  const attachRemoteConnection = useGameStore((s) => s.attachRemoteConnection);
  const gameState = useGameStore((s) => s.gameState);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const [code, setCode] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode('');
      setConnecting(false);
      setError(null);
    }
  }, [open]);

  // Once connected and we have HAND_START state, navigate to the table.
  useEffect(() => {
    if (open && connectionStatus === 'CONNECTED' && gameState) {
      navigate('/table');
    }
  }, [open, connectionStatus, gameState, navigate]);

  const valid = isValidRoomCode(code);

  const connect = async () => {
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      setError('형식이 올바르지 않습니다. 예: hs-1234-gana');
      return;
    }
    setConnecting(true);
    setError(null);
    const peer = new PeerConnection({ peerOptions: getPeerOptions() });
    try {
      await peer.joinRoom(normalized);
      attachRemoteConnection({
        peer,
        isHost: false,
        myName,
        roomCode: normalized,
        opponentPeerId: normalized,
      });
      // Ownership handed to the store; no dialog-side cleanup needed.
    } catch (err) {
      setConnecting(false);
      peer.close();
      setError(
        (err as Error).message ??
          '연결에 실패했습니다. 코드를 확인하고 다시 시도해주세요.',
      );
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={connecting ? undefined : onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
          >
            <h3 className="mb-3 text-lg font-bold text-primary">코드 입력</h3>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                방 코드
              </span>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && valid && !connecting) connect();
                }}
                placeholder="hs-1234-gana"
                autoComplete="off"
                spellCheck={false}
                disabled={connecting}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-base font-mono text-foreground focus:border-primary focus:outline-none disabled:opacity-50"
              />
            </label>

            {error && (
              <p className="mb-3 rounded-md border border-red-900 bg-red-950/30 p-2 text-xs text-red-300">
                {error}
              </p>
            )}

            {connecting && (
              <div className="mb-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                연결하는 중…
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={connecting}
                className="rounded-md border border-border bg-muted px-4 py-2 text-sm text-foreground hover:bg-secondary disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={connect}
                disabled={!valid || connecting}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                참가
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
