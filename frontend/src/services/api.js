const API_URL = "http://localhost:8000";

export async function createRoom(hostName, categories) {
    const response = await fetch(`${API_URL}/rooms`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            host_name: hostName,
            categories
        })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Unable to create room");
    }

    return data;
}

export async function joinRoom(roomCode, playerName) {
    const response = await fetch(
        `${API_URL}/rooms/${roomCode}/join`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                player_name: playerName
            })
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Unable to join room");
    }

    return data;
}

export async function startGame(roomCode, playerId) {
    const response = await fetch(
        `${API_URL}/rooms/${roomCode}/start?player_id=${encodeURIComponent(playerId)}`,
        {
            method: "POST"
        }
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.detail || "Unable to start game");
    }

    return data;
}

export function connectWebSocket(roomCode, playerId) {
    return new WebSocket(
        `ws://localhost:8000/ws/${roomCode}/${playerId}`
    );
}