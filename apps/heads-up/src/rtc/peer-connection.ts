import { Peer, type DataConnection } from 'peerjs';
import {
  generateRoomCode,
  isProtocolMessage,
  peerIdForRoom,
  type ProtocolMessage,
} from './protocol';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface PeerConnectionOptions {
  /** Override PeerJS broker config for tests. */
  peerOptions?: Record<string, unknown>;
}

/**
 * Thin wrapper over PeerJS + its DataConnection, exposing a message-oriented
 * API suitable for the game protocol.
 *
 * Lifecycle:
 *   createRoom()  → resolves with the room code once the broker accepts our ID.
 *   joinRoom(id)  → resolves once the DataConnection to the host is open.
 *   send(msg)     → no-op if not connected.
 *   close()       → LEAVE message best-effort, then tears everything down.
 */
export class PeerConnection {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private myPeerId: string | null = null;

  private messageHandler: ((msg: ProtocolMessage) => void) | null = null;
  private disconnectHandler: (() => void) | null = null;
  private reconnectHandler: (() => void) | null = null;
  private statusHandler: ((s: ConnectionStatus) => void) | null = null;
  private status: ConnectionStatus = 'DISCONNECTED';
  private destroyed = false;

  constructor(private readonly options: PeerConnectionOptions = {}) {}

  getMyPeerId(): string {
    if (!this.myPeerId) throw new Error('peer not initialized');
    return this.myPeerId;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  async createRoom(): Promise<string> {
    // Generate a 4-digit code; the broker-facing peer id is the prefixed form.
    // If the broker rejects (ID taken), retry a handful of times with fresh codes.
    const MAX_ATTEMPTS = 5;
    let lastErr: unknown;
    let roomCode: string | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (this.destroyed) throw new Error('PeerConnection destroyed');
      const candidate = generateRoomCode();
      try {
        await this.openPeer(peerIdForRoom(candidate));
        this.myPeerId = peerIdForRoom(candidate);
        roomCode = candidate;
        break;
      } catch (err) {
        lastErr = err;
        this.peer?.destroy();
        this.peer = null;
      }
    }
    if (!this.myPeerId || !roomCode) {
      throw new Error(
        `방 만들기에 실패했습니다. 네트워크 상태를 확인하세요. (${String(lastErr)})`,
      );
    }

    // Listen for the guest to connect.
    this.peer!.on('connection', (conn: DataConnection) => {
      this.attachConnection(conn);
    });

    this.setStatus('CONNECTING');
    // Return the bare 4-digit code for display; getMyPeerId() keeps the prefix.
    return roomCode;
  }

  async joinRoom(hostPeerId: string): Promise<void> {
    if (!hostPeerId) throw new Error('hostPeerId required');
    // Guest: auto-generate our own peer id via broker, then dial the host.
    await this.openPeer();
    this.myPeerId = this.peer!.id;
    this.setStatus('CONNECTING');

    const conn = this.peer!.connect(hostPeerId, {
      reliable: true,
      serialization: 'json',
    });
    this.attachConnection(conn);

    const peer = this.peer!;
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        clearTimeout(timeout);
        conn.off('open', onOpen);
        conn.off('error', onConnError);
        peer.off('error', onPeerError);
      };
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        fn();
      };
      const onOpen = () => settle(resolve);
      const onConnError = (err: Error) => settle(() => reject(err));
      // The broker reports "host not found / already left" as a peer-level
      // error (type 'peer-unavailable'), NOT a conn error. Without this
      // listener a wrong/expired code just hangs until the timeout fires.
      const onPeerError = (err: Error & { type?: string }) =>
        settle(() =>
          reject(
            err.type === 'peer-unavailable'
              ? new Error(
                  '방을 찾을 수 없습니다. 코드가 맞는지, 상대가 아직 방에 있는지 확인하세요.',
                )
              : err,
          ),
        );
      timeout = setTimeout(
        () =>
          settle(() =>
            reject(
              new Error(
                '연결 시간이 초과되었습니다. 방 코드가 맞는지, 상대방이 방을 만들었는지 확인하세요.',
              ),
            ),
          ),
        15000,
      );
      conn.once('open', onOpen);
      conn.once('error', onConnError);
      peer.once('error', onPeerError);
    });
  }

  send(msg: ProtocolMessage): void {
    if (!this.conn || !this.conn.open) return;
    try {
      this.conn.send(msg);
    } catch (err) {
      // Ignore send failures — they'll surface via disconnect handler.
      console.error('[peer] send failed', err);
    }
  }

  onMessage(handler: (msg: ProtocolMessage) => void): void {
    this.messageHandler = handler;
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  onReconnect(handler: () => void): void {
    this.reconnectHandler = handler;
  }

  onStatusChange(handler: (s: ConnectionStatus) => void): void {
    this.statusHandler = handler;
  }

  close(): void {
    this.destroyed = true;
    try {
      if (this.conn?.open) {
        this.conn.send({ type: 'LEAVE' });
      }
    } catch {
      // ignored
    }
    try {
      this.conn?.close();
    } catch {
      // ignored
    }
    try {
      this.peer?.destroy();
    } catch {
      // ignored
    }
    this.conn = null;
    this.peer = null;
    this.setStatus('DISCONNECTED');
  }

  private openPeer(id?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const PeerCtor = Peer as unknown as new (
        id?: string,
        options?: typeof this.options.peerOptions,
      ) => Peer;
      this.peer = id
        ? new PeerCtor(id, this.options.peerOptions)
        : new PeerCtor(undefined, this.options.peerOptions);

      const cleanup = () => {
        this.peer?.off('open', onOpen);
        this.peer?.off('error', onError);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      this.peer.once('open', onOpen);
      this.peer.once('error', onError);
    });
  }

  private attachConnection(conn: DataConnection): void {
    // If a previous connection existed (reconnect scenario), replace it.
    this.conn = conn;

    conn.on('open', () => {
      this.setStatus('CONNECTED');
      this.reconnectHandler?.();
    });
    conn.on('data', (raw: unknown) => {
      if (isProtocolMessage(raw)) {
        this.messageHandler?.(raw);
      }
    });
    conn.on('close', () => {
      this.setStatus('DISCONNECTED');
      this.disconnectHandler?.();
    });
    conn.on('error', (err: Error) => {
      console.error('[peer] connection error', err);
      this.setStatus('DISCONNECTED');
      this.disconnectHandler?.();
    });
  }

  private setStatus(s: ConnectionStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.statusHandler?.(s);
  }
}
