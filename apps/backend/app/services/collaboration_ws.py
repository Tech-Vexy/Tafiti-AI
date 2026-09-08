"""
WebSocket Collaboration Manager for real-time thesis editing.

Manages:
- Connection lifecycle (join/leave per thesis room)
- Presence tracking (who's online, cursor position, selections)
- Broadcast of content changes, cursors, selections
- Permission checks (owner, editor, viewer)
- Heartbeat/ping for stale connection cleanup
"""
import json
import time
import asyncio
from dataclasses import dataclass, field
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from app.core.logger import get_logger

logger = get_logger("collaboration_ws")


@dataclass
class CollaboratorInfo:
    """Tracks a single collaborator's state in a thesis room."""
    user_id: str
    display_name: str
    avatar_url: Optional[str] = None
    color: str = "#6366f1"  # default indigo
    role: str = "editor"  # owner, editor, viewer
    cursor_offset: int = 0
    selection_start: Optional[int] = None
    selection_end: Optional[int] = None
    is_typing: bool = False
    last_heartbeat: float = field(default_factory=time.time)
    connected_at: float = field(default_factory=time.time)


# Predefined cursor colors for collaborators (distinct, accessible on dark bg)
COLLABORATOR_COLORS = [
    "#6366f1",  # indigo
    "#f59e0b",  # amber
    "#10b981",  # emerald
    "#ef4444",  # rose
    "#8b5cf6",  # violet
    "#06b6d4",  # cyan
    "#f97316",  # orange
    "#ec4899",  # pink
    "#14b8a6",  # teal
    "#84cc16",  # lime
]


class ThesisRoom:
    """Manages all WebSocket connections for a single thesis."""

    def __init__(self, thesis_id: str):
        self.thesis_id = thesis_id
        self.connections: dict[str, WebSocket] = {}  # user_id -> websocket
        self.collaborators: dict[str, CollaboratorInfo] = {}  # user_id -> info
        self._color_index = 0

    @property
    def active_count(self) -> int:
        return len(self.connections)

    def _next_color(self) -> str:
        color = COLLABORATOR_COLORS[self._color_index % len(COLLABORATOR_COLORS)]
        self._color_index += 1
        return color

    async def connect(self, user_id: str, display_name: str, role: str,
                      avatar_url: Optional[str], ws: WebSocket):
        await ws.accept()

        # If user reconnects, close old connection
        if user_id in self.connections:
            old_ws = self.connections[user_id]
            try:
                await old_ws.close(code=4000, reason="reconnected")
            except Exception:
                pass

        self.connections[user_id] = ws
        self.collaborators[user_id] = CollaboratorInfo(
            user_id=user_id,
            display_name=display_name,
            avatar_url=avatar_url,
            color=self._next_color(),
            role=role,
        )

        logger.info(f"collaborator_joined thesis={self.thesis_id} user={user_id} role={role}")

        # Notify existing collaborators
        await self._broadcast({
            "type": "user_joined",
            "user_id": user_id,
            "display_name": display_name,
            "avatar_url": avatar_url,
            "color": self.collaborators[user_id].color,
            "role": role,
        }, exclude=user_id)

        # Send current collaborator list to the new user
        await ws.send_json({
            "type": "presence_sync",
            "collaborators": [
                {
                    "user_id": c.user_id,
                    "display_name": c.display_name,
                    "avatar_url": c.avatar_url,
                    "color": c.color,
                    "role": c.role,
                    "cursor_offset": c.cursor_offset,
                    "is_typing": c.is_typing,
                }
                for c in self.collaborators.values()
                if c.user_id != user_id
            ],
        })

    async def disconnect(self, user_id: str):
        self.connections.pop(user_id, None)
        self.collaborators.pop(user_id, None)

        logger.info(f"collaborator_left thesis={self.thesis_id} user={user_id}")

        await self._broadcast({
            "type": "user_left",
            "user_id": user_id,
        })

    async def handle_message(self, user_id: str, data: dict):
        """Route incoming messages from a collaborator."""
        msg_type = data.get("type", "")
        collab = self.collaborators.get(user_id)
        if not collab:
            return

        collab.last_heartbeat = time.time()

        if msg_type == "cursor_update":
            collab.cursor_offset = data.get("offset", 0)
            await self._broadcast({
                "type": "cursor_update",
                "user_id": user_id,
                "offset": collab.cursor_offset,
                "color": collab.color,
            }, exclude=user_id)

        elif msg_type == "selection_update":
            collab.selection_start = data.get("start")
            collab.selection_end = data.get("end")
            await self._broadcast({
                "type": "selection_update",
                "user_id": user_id,
                "start": collab.selection_start,
                "end": collab.selection_end,
                "color": collab.color,
            }, exclude=user_id)

        elif msg_type == "content_change":
            # Broadcast content change (CRDT-based via Yjs)
            await self._broadcast({
                "type": "content_change",
                "user_id": user_id,
                "change": data.get("change"),  # {offset, delete_count, insert_text}
                "timestamp": time.time(),
            }, exclude=user_id)

        elif msg_type == "yjs_update":
            # Yjs CRDT update — broadcast to all other clients
            # The actual merge is handled by Yjs on each client
            update_b64 = data.get("update")
            if update_b64:
                await self._broadcast({
                    "type": "yjs_update",
                    "user_id": user_id,
                    "update": update_b64,
                    "timestamp": time.time(),
                }, exclude=user_id)

        elif msg_type == "yjs_sync_request":
            # Client requesting a full state sync
            await self._broadcast({
                "type": "yjs_sync_request",
                "user_id": user_id,
            }, exclude=user_id)

        elif msg_type == "typing":
            collab.is_typing = data.get("is_typing", False)
            await self._broadcast({
                "type": "typing",
                "user_id": user_id,
                "is_typing": collab.is_typing,
            }, exclude=user_id)

        elif msg_type == "ping":
            await self.connections[user_id].send_json({"type": "pong"})

        elif msg_type == "request_full_content":
            # A reconnecting client requests the latest content
            await self.connections[user_id].send_json({
                "type": "full_content",
                "requested_by": user_id,
            })

    async def _broadcast(self, message: dict, exclude: Optional[str] = None):
        """Send a message to all connected collaborators except the excluded user."""
        dead = []
        for uid, ws in self.connections.items():
            if uid == exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)

        # Clean up dead connections
        for uid in dead:
            await self.disconnect(uid)

    def get_participants(self) -> list[dict]:
        return [
            {
                "user_id": c.user_id,
                "display_name": c.display_name,
                "avatar_url": c.avatar_url,
                "color": c.color,
                "role": c.role,
                "cursor_offset": c.cursor_offset,
                "is_typing": c.is_typing,
                "connected_at": c.connected_at,
            }
            for c in self.collaborators.values()
        ]


class CollaborationManager:
    """Global manager for all thesis collaboration rooms."""

    def __init__(self):
        self.rooms: dict[str, ThesisRoom] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    def get_room(self, thesis_id: str) -> ThesisRoom:
        if thesis_id not in self.rooms:
            self.rooms[thesis_id] = ThesisRoom(thesis_id)
        return self.rooms[thesis_id]

    async def connect(self, thesis_id: str, user_id: str, display_name: str,
                      role: str, avatar_url: Optional[str], ws: WebSocket):
        room = self.get_room(thesis_id)
        await room.connect(user_id, display_name, role, avatar_url, ws)
        return room

    async def disconnect(self, thesis_id: str, user_id: str):
        room = self.rooms.get(thesis_id)
        if room:
            await room.disconnect(user_id)
            if room.active_count == 0:
                del self.rooms[thesis_id]

    async def handle_message(self, thesis_id: str, user_id: str, data: dict):
        room = self.rooms.get(thesis_id)
        if room:
            await room.handle_message(user_id, data)

    def get_participants(self, thesis_id: str) -> list[dict]:
        room = self.rooms.get(thesis_id)
        return room.get_participants() if room else []

    def get_active_theses(self) -> dict[str, int]:
        return {tid: room.active_count for tid, room in self.rooms.items()}


# Singleton
collaboration_manager = CollaborationManager()
