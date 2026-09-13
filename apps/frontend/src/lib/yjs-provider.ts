/**
 * YjsThesisProvider — bridges Yjs with collaboration WebSocket in TypeScript.
 */

import * as Y from 'yjs';

// Colors for awareness (matching backend)
const COLORS = [
  '#0ea5e9', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16',
];

export interface AwarenessUser {
  id: string;
  name: string;
  color: string;
  cursor: any;
  selection: any;
}

export interface AwarenessState {
  user: AwarenessUser;
}

export class YjsThesisProvider {
  thesisId: string;
  doc: Y.Doc;
  token: string | null;
  ws: WebSocket | null = null;
  connected: boolean = false;
  synced: boolean = false;

  awareness: AwarenessState;
  onSync: (() => void) | null = null;
  onAwarenessUpdate: ((data: any) => void) | null = null;
  onError: ((err: any) => void) | null = null;
  onFullContent: ((content: any) => void) | null = null;

  private _reconnectTimer: any = null;
  private _reconnectDelay: number = 1000;
  private _maxReconnectDelay: number = 30000;
  private _destroyed: boolean = false;
  private _lastStateVector: string | null = null;
  private _heartbeatInterval: any = null;

  constructor(thesisId: string, doc: Y.Doc, token: string | null, userInfo: any = {}) {
    this.thesisId = thesisId;
    this.doc = doc;
    this.token = token;

    this.awareness = {
      user: {
        id: userInfo.userId || 'unknown',
        name: userInfo.displayName || 'Anonymous',
        color: userInfo.color || COLORS[Math.floor(Math.random() * COLORS.length)],
        cursor: null,
        selection: null,
      },
    };
  }

  connect() {
    if (this._destroyed || this.ws) return;

    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_HOST || (typeof window !== 'undefined' ? window.location.host : 'localhost:8000');
    const wsUrl = `${protocol}//${host}/api/v1/thesis/ws/thesis/${this.thesisId}?token=${this.token || ''}`;

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.connected = true;
        this._reconnectDelay = 1000;
        console.log(`[YjsProvider] Connected to thesis ${this.thesisId}`);

        this._sendAwareness();
        this._syncState();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this._handleMessage(msg);
        } catch {
          if (event.data instanceof ArrayBuffer) {
            this._applyUpdate(new Uint8Array(event.data));
          }
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.synced = false;
        console.log(`[YjsProvider] Disconnected from thesis ${this.thesisId}`);
        this._scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[YjsProvider] WebSocket error:', err);
        if (this.onError) this.onError(err);
      };
    } catch (e) {
      console.warn('[YjsProvider] Connection failed:', e);
      this._scheduleReconnect();
    }
  }

  disconnect() {
    this._destroyed = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }

  private _applyUpdate(update: Uint8Array) {
    if (!update || update.length === 0) return;
    try {
      Y.applyUpdate(this.doc, update);
    } catch (e) {
      console.warn('[YjsProvider] Failed to apply update:', e);
    }
  }

  sendUpdate(update: Uint8Array) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const base64 = this._uint8ToBase64(update);
    this.ws.send(JSON.stringify({
      type: 'yjs_update',
      update: base64,
    }));
  }

  private _syncState() {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const stateVector = Y.encodeStateVector(this.doc);
    const base64 = this._uint8ToBase64(stateVector);

    this.ws.send(JSON.stringify({
      type: 'yjs_sync_request',
      state_vector: base64,
    }));
  }

  updateAwareness(update: Partial<AwarenessUser>) {
    this.awareness.user = { ...this.awareness.user, ...update };
    this._sendAwareness();

    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'awareness_update',
        awareness: this.awareness.user,
      }));
    }
  }

  private _sendAwareness() {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'awareness_update',
      awareness: this.awareness.user,
    }));
  }

  private _handleMessage(msg: any) {
    switch (msg.type) {
      case 'yjs_update':
        if (msg.update) {
          const update = this._base64ToUint8(msg.update);
          this._applyUpdate(update);
        }
        break;

      case 'awareness_update':
        if (this.onAwarenessUpdate && msg.awareness) {
          this.onAwarenessUpdate(msg.awareness);
        }
        break;

      case 'user_left':
        if (this.onAwarenessUpdate) {
          this.onAwarenessUpdate({ id: msg.user_id, left: true });
        }
        break;

      case 'presence_sync':
        if (this.onAwarenessUpdate && msg.collaborators) {
          this.onAwarenessUpdate({ collaborators: msg.collaborators });
        }
        break;

      case 'pong':
        break;

      case 'full_content':
        if (msg.content) {
          try {
            const content = JSON.parse(msg.content);
            if (this.onFullContent) this.onFullContent(content);
          } catch {
            console.warn('[YjsProvider] Failed to parse full content');
          }
        }
        break;
    }
  }

  async persistState(apiClient: any) {
    try {
      const state = Y.encodeStateAsUpdate(this.doc);
      const stateVector = Y.encodeStateVector(this.doc);

      const base64State = this._uint8ToBase64(state);
      const base64SV = this._uint8ToBase64(stateVector);

      await apiClient.post(`/yjs/${this.thesisId}/sync`, {
        updates: base64State,
        state_vector: this._lastStateVector || null,
      });

      this._lastStateVector = base64SV;
    } catch (e) {
      console.warn('[YjsProvider] Failed to persist state:', e);
    }
  }

  async loadState(apiClient: any) {
    try {
      const response = await apiClient.get(`/yjs/${this.thesisId}/state`, {
        responseType: 'arraybuffer',
      });

      if (response.data && response.data.byteLength > 0) {
        const update = new Uint8Array(response.data);
        this._applyUpdate(update);
        this.synced = true;
        if (this.onSync) this.onSync();
      }
    } catch (e) {
      console.warn('[YjsProvider] Failed to load state:', e);
    }
  }

  private _scheduleReconnect() {
    if (this._destroyed) return;
    this._reconnectTimer = setTimeout(() => {
      this._reconnectDelay = Math.min(this._reconnectDelay * 2, this._maxReconnectDelay);
      this.connect();
    }, this._reconnectDelay);
  }

  startHeartbeat(intervalMs: number = 30000) {
    this._heartbeatInterval = setInterval(() => {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, intervalMs);
  }

  stopHeartbeat() {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  private _uint8ToBase64(uint8: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  private _base64ToUint8(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export function createThesisYjsDoc() {
  const doc = new Y.Doc();
  const yXmlFragment = doc.getXmlFragment('thesis-content');
  const yMeta = doc.getMap('thesis-meta');
  return { doc, yXmlFragment, yMeta };
}
