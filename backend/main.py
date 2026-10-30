
import asyncio
import random
import string
import time
import uuid

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.data.questions import QUESTIONS
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Quiz Battle API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

ROOMS = {}
MAX_PLAYERS = 20
QUESTION_TIME = 20
TOTAL_QUESTIONS = 10

CATEGORIES = [
    "General Knowledge",
    "Science & Technology",
    "Programming & Python",
    "Data Science & AI",
    "Mathematics",
    "History & Geography",
    "Sports",
    "Movies & Entertainment",
    "Business & Finance"
]


class CreateRoom(BaseModel):
    host_name: str = Field(min_length=1, max_length=30)
    categories: list[str]


class JoinRoom(BaseModel):
    player_name: str = Field(min_length=1, max_length=30)


def generate_room_code():
    while True:
        code = "".join(
            random.choices(string.ascii_uppercase + string.digits, k=6)
        )
        if code not in ROOMS:
            return code


def public_players(room):
    return [
        {
            "id": p["id"],
            "name": p["name"],
            "score": p["score"],
            "connected": p["connected"]
        }
        for p in room["players"].values()
    ]


class ConnectionManager:

    def __init__(self):
        self.connections = {}

    async def connect(self, websocket, room_code, player_id):
        await websocket.accept()

        self.connections.setdefault(room_code, {})
        self.connections[room_code][player_id] = websocket

    def disconnect(self, room_code, player_id):
        self.connections.get(room_code, {}).pop(player_id, None)

    async def send(self, websocket, data):
        await websocket.send_json(data)

    async def broadcast(self, room_code, data):
        connections = self.connections.get(room_code, {})

        disconnected = []

        for player_id, websocket in list(connections.items()):
            try:
                await websocket.send_json(data)
            except Exception:
                disconnected.append(player_id)

        for player_id in disconnected:
            self.disconnect(room_code, player_id)


manager = ConnectionManager()


async def broadcast_players(room_code):
    room = ROOMS[room_code]

    await manager.broadcast(room_code, {
        "type": "players_updated",
        "players": public_players(room)
    })


def select_questions(categories):
    available = [
        q for q in QUESTIONS
        if q["category"] in categories
    ]

    if len(available) < TOTAL_QUESTIONS:
        raise HTTPException(
            status_code=400,
            detail="Not enough questions for selected categories"
        )

    random.shuffle(available)

    return available[:TOTAL_QUESTIONS]


def leaderboard(room):
    players = list(room["players"].values())

    players.sort(
        key=lambda p: (-p["score"], p["name"].lower())
    )

    return [
        {
            "name": p["name"],
            "score": p["score"],
            "rank": index + 1
        }
        for index, p in enumerate(players)
    ]


async def reveal_question(room_code):
    room = ROOMS.get(room_code)

    if not room or room["status"] != "playing":
        return

    question = room["questions"][room["question_index"]]

    await manager.broadcast(room_code, {
        "type": "answer_reveal",
        "correct_answer": question["answer"],
        "leaderboard": leaderboard(room)
    })


async def run_game(room_code):

    room = ROOMS[room_code]

    while (
        room["status"] == "playing"
        and room["question_index"] < len(room["questions"])
    ):

        question = room["questions"][room["question_index"]]

        room["answers"] = {}
        room["question_started_at"] = time.monotonic()
        room["question_deadline"] = (
            time.monotonic() + QUESTION_TIME
        )

        # Do not send the correct answer to players.
        await manager.broadcast(room_code, {
            "type": "new_question",
            "question_number": room["question_index"] + 1,
            "total_questions": TOTAL_QUESTIONS,
            "question": question["question"],
            "category": question["category"],
            "difficulty": question["difficulty"],
            "options": question["options"],
            "duration": QUESTION_TIME
        })

        await manager.broadcast(room_code, {
            "type": "timer_started",
            "deadline_seconds": QUESTION_TIME
        })

        while time.monotonic() < room["question_deadline"]:

            connected_players = [
                p for p in room["players"].values()
                if p["connected"]
            ]

            answered = len(room["answers"])

            if connected_players and answered >= len(connected_players):
                break

            await asyncio.sleep(0.2)

        # Score only submitted answers.
        for player_id, answer_data in room["answers"].items():

            player = room["players"][player_id]

            if answer_data["answer"] == question["answer"]:

                elapsed = answer_data["elapsed"]

                # Provisional speed-based scoring:
                # 500 points at 0 seconds, 100 at 20 seconds.
                points = max(
                    100,
                    int(500 - elapsed * 20)
                )

                player["score"] += points

        await reveal_question(room_code)

        await asyncio.sleep(3)

        room["question_index"] += 1

    if room["status"] == "playing":

        room["status"] = "finished"

        await manager.broadcast(room_code, {
            "type": "game_finished",
            "leaderboard": leaderboard(room)
        })


@app.get("/")
async def home():
    return {
        "message": "Welcome to Quiz Battle API",
        "status": "running"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.post("/rooms")
async def create_room(data: CreateRoom):

    if not data.categories:
        raise HTTPException(400, "Select at least one category")

    if not set(data.categories).issubset(set(CATEGORIES)):
        raise HTTPException(400, "Invalid quiz category")

    code = generate_room_code()
    player_id = str(uuid.uuid4())

    ROOMS[code] = {
        "host_id": player_id,
        "players": {
            player_id: {
                "id": player_id,
                "name": data.host_name.strip(),
                "score": 0,
                "connected": False
            }
        },
        "categories": data.categories,
        "questions": [],
        "question_index": 0,
        "answers": {},
        "status": "waiting",
        "game_task": None
    }

    return {
        "room_code": code,
        "player_id": player_id,
        "host_id": player_id,
        "message": "Room created successfully"
    }


@app.post("/rooms/{room_code}/join")
async def join_room(room_code: str, data: JoinRoom):

    room = ROOMS.get(room_code.upper())

    if not room:
        raise HTTPException(404, "Room not found")

    if room["status"] != "waiting":
        raise HTTPException(400, "Game already started")

    if len(room["players"]) >= MAX_PLAYERS:
        raise HTTPException(400, "Room is full")

    if not data.player_name.strip():
        raise HTTPException(400, "Player name cannot be empty")

    player_id = str(uuid.uuid4())

    room["players"][player_id] = {
        "id": player_id,
        "name": data.player_name.strip(),
        "score": 0,
        "connected": False
    }

    await broadcast_players(room_code.upper())

    return {
        "room_code": room_code.upper(),
        "player_id": player_id,
        "message": "Joined successfully"
    }


@app.post("/rooms/{room_code}/start")
async def start_game(room_code: str, player_id: str):

    room = ROOMS.get(room_code.upper())

    if not room:
        raise HTTPException(404, "Room not found")

    if player_id != room["host_id"]:
        raise HTTPException(403, "Only host can start the game")

    if room["status"] != "waiting":
        raise HTTPException(400, "Game already started")

    if len(room["players"]) < 2:
        raise HTTPException(400, "At least 2 players required")

    room["questions"] = select_questions(room["categories"])
    room["status"] = "playing"

    room["game_task"] = asyncio.create_task(
        run_game(room_code.upper())
    )

    return {"message": "Game started"}


@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    player_id: str
):

    room_code = room_code.upper()
    room = ROOMS.get(room_code)

    if not room or player_id not in room["players"]:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket, room_code, player_id)

    room["players"][player_id]["connected"] = True

    await broadcast_players(room_code)

    try:

        await websocket.send_json({
            "type": "room_state",
            "status": room["status"],
            "players": public_players(room),
            "question_number": room["question_index"] + 1
        })

        while True:

            data = await websocket.receive_json()

            if data.get("type") == "answer":

                if room["status"] != "playing":
                    continue

                if player_id in room["answers"]:
                    continue

                answer = data.get("answer")

                question = room["questions"][
                    room["question_index"]
                ]

                if answer not in question["options"]:
                    continue

                now = time.monotonic()

                if now > room["question_deadline"]:
                    continue

                elapsed = now - room["question_started_at"]

                room["answers"][player_id] = {
                    "answer": answer,
                    "elapsed": elapsed
                }

                await websocket.send_json({
                    "type": "answer_received",
                    "message": "Answer submitted"
                })

    except WebSocketDisconnect:

        manager.disconnect(room_code, player_id)

        room["players"][player_id]["connected"] = False

        await broadcast_players(room_code)

    except Exception:

        manager.disconnect(room_code, player_id)

        room["players"][player_id]["connected"] = False

        await broadcast_players(room_code)
