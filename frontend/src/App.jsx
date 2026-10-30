
import { useEffect, useRef, useState } from "react";

import {
    createRoom,
    joinRoom,
    startGame,
    connectWebSocket
} from "./services/api";

import "./App.css";

const CATEGORIES = [
    "General Knowledge",
    "Science & Technology",
    "Programming & Python",
    "Data Science & AI",
    "Mathematics",
    "History & Geography",
    "Sports",
    "Movies & Entertainment",
    "Business & Finance"
];

function App() {

    const [screen, setScreen] = useState("home");

    const [playerName, setPlayerName] = useState("");
    const [roomCode, setRoomCode] = useState("");
    const [playerId, setPlayerId] = useState("");
    const [isHost, setIsHost] = useState(false);

    const [categories, setCategories] = useState(CATEGORIES);

    const [players, setPlayers] = useState([]);

    const [question, setQuestion] = useState(null);
    const [questionNumber, setQuestionNumber] = useState(0);

    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [correctAnswer, setCorrectAnswer] = useState(null);

    const [timeLeft, setTimeLeft] = useState(20);
    const [leaderboard, setLeaderboard] = useState([]);

    const [error, setError] = useState("");
    const [statusMessage, setStatusMessage] = useState("");

    const socketRef = useRef(null);

    // Connect player to the WebSocket server.
    useEffect(() => {

        if (!roomCode || !playerId) return;

        const socket = connectWebSocket(roomCode, playerId);

        socketRef.current = socket;

        socket.onmessage = (event) => {

            const data = JSON.parse(event.data);

            switch (data.type) {

                case "room_state":
                    setPlayers(data.players);
                    break;

                case "players_updated":
                    setPlayers(data.players);
                    break;

                case "new_question":

                    setQuestion(data);
                    setQuestionNumber(data.question_number);

                    setSelectedAnswer(null);
                    setCorrectAnswer(null);

                    setTimeLeft(data.duration);

                    setScreen("quiz");
                    break;

                case "timer_started":
                    setTimeLeft(data.deadline_seconds);
                    break;

                case "answer_received":
                    setStatusMessage("Answer submitted!");
                    break;

                case "answer_reveal":

                    setCorrectAnswer(data.correct_answer);
                    setLeaderboard(data.leaderboard);

                    setScreen("reveal");
                    break;

                case "game_finished":

                    setLeaderboard(data.leaderboard);
                    setScreen("finished");
                    break;

                default:
                    break;
            }
        };

        socket.onclose = () => {
            console.log("WebSocket disconnected");
        };

        socket.onerror = () => {
            setError("Connection error. Please reconnect.");
        };

        return () => {
            socket.close();
            socketRef.current = null;
        };

    }, [roomCode, playerId]);

    // Local countdown display.
    useEffect(() => {

        if (screen !== "quiz") return;

        const timer = setInterval(() => {
            setTimeLeft(previous => Math.max(0, previous - 1));
        }, 1000);

        return () => clearInterval(timer);

    }, [screen, questionNumber]);

    async function handleCreateRoom() {

        try {

            setError("");

            if (!playerName.trim()) {
                setError("Enter your name");
                return;
            }

            const result = await createRoom(
                playerName,
                categories
            );

            setRoomCode(result.room_code);
            setPlayerId(result.player_id);
            setIsHost(true);

            setScreen("waiting");

        } catch (err) {
            setError(err.message);
        }
    }

    async function handleJoinRoom() {

        try {

            setError("");

            if (!playerName.trim() || !roomCode.trim()) {
                setError("Enter your name and room code");
                return;
            }

            const result = await joinRoom(
                roomCode.trim().toUpperCase(),
                playerName
            );

            setRoomCode(result.room_code);
            setPlayerId(result.player_id);
            setIsHost(false);

            setScreen("waiting");

        } catch (err) {
            setError(err.message);
        }
    }

    async function handleStartGame() {

        try {

            setError("");

            await startGame(roomCode, playerId);

        } catch (err) {
            setError(err.message);
        }
    }

    function submitAnswer(option) {

        if (
            selectedAnswer !== null ||
            !socketRef.current ||
            socketRef.current.readyState !== WebSocket.OPEN
        ) {
            return;
        }

        socketRef.current.send(
            JSON.stringify({
                type: "answer",
                answer: option
            })
        );

        setSelectedAnswer(option);
        setStatusMessage("Answer submitted!");
    }

    function copyRoomCode() {

        navigator.clipboard.writeText(roomCode);

        setStatusMessage("Room code copied!");
    }

    return (

        <div className="app">

            <header className="header">
                <h1>⚡ Quiz Battle</h1>
                <span>Real-time multiplayer quiz</span>
            </header>

            {error && (
                <div className="error">
                    {error}
                </div>
            )}

            {statusMessage && (
                <div className="notice">
                    {statusMessage}
                </div>
            )}

            {/* HOME SCREEN */}

            {screen === "home" && (

                <div className="card">

                    <h2>Welcome to Quiz Battle</h2>

                    <input
                        placeholder="Enter your name"
                        value={playerName}
                        onChange={e => setPlayerName(e.target.value)}
                    />

                    <h3>Create a new game</h3>

                    <p>Select quiz categories</p>

                    {CATEGORIES.map(category => (

                        <label className="category" key={category}>

                            <input
                                type="checkbox"
                                checked={categories.includes(category)}
                                onChange={e => {

                                    setCategories(old =>
                                        e.target.checked
                                            ? [...old, category]
                                            : old.filter(c => c !== category)
                                    );

                                }}
                            />

                            {category}

                        </label>

                    ))}

                    <button
                        onClick={handleCreateRoom}
                        disabled={categories.length === 0}
                    >
                        Create Game
                    </button>

                    <hr />

                    <h3>Join an existing game</h3>

                    <input
                        placeholder="Enter room code"
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    />

                    <button onClick={handleJoinRoom}>
                        Join Game
                    </button>

                </div>

            )}

            {/* WAITING ROOM */}

            {screen === "waiting" && (

                <div className="card">

                    <h2>Waiting Room</h2>

                    <p>Share this room code with friends</p>

                    <div className="room-code">
                        {roomCode}
                    </div>

                    <button onClick={copyRoomCode}>
                        Copy Room Code
                    </button>

                    <h3>Players ({players.length}/20)</h3>

                    {players.map(player => (

                        <div className="player" key={player.id}>
                            {player.name}
                            {player.id === playerId ? " (You)" : ""}
                            {player.connected ? " 🟢" : " ⚪"}
                        </div>

                    ))}

                    {isHost && (

                        <button
                            onClick={handleStartGame}
                            disabled={players.length < 2}
                        >
                            Start Quiz
                        </button>

                    )}

                    {!isHost && (
                        <p>Waiting for the host to start the game...</p>
                    )}

                </div>

            )}

            {/* QUIZ SCREEN */}

            {screen === "quiz" && question && (

                <div className="card">

                    <h3>
                        Question {questionNumber}/10
                    </h3>

                    <div className="timer">
                        ⏱ {timeLeft} seconds
                    </div>

                    <p className="category-title">
                        {question.category} · {question.difficulty}
                    </p>

                    <h2>{question.question}</h2>

                    <div className="options">

                        {Object.entries(question.options).map(
                            ([key, value]) => (

                                <button
                                    key={key}
                                    className={
                                        selectedAnswer === key
                                            ? "selected"
                                            : ""
                                    }
                                    disabled={selectedAnswer !== null}
                                    onClick={() => submitAnswer(key)}
                                >
                                    {key}. {value}
                                </button>

                            )
                        )}

                    </div>

                    <p>{statusMessage}</p>

                </div>

            )}

            {/* ANSWER REVEAL */}

            {screen === "reveal" && (

                <div className="card">

                    <h2>Answer Revealed!</h2>

                    <h3>
                        Correct Answer: {correctAnswer}
                    </h3>

                    <h3>Current Leaderboard</h3>

                    {leaderboard.map(player => (

                        <div className="player" key={player.rank}>
                            #{player.rank} {player.name} – {player.score} points
                        </div>

                    ))}

                    <p>Next question is coming...</p>

                </div>

            )}

            {/* FINAL RESULTS */}

            {screen === "finished" && (

                <div className="card">

                    <h1>🏆 Game Over!</h1>

                    {leaderboard.length > 0 && (

                        <h2>
                            Winner: {leaderboard[0].name}
                        </h2>

                    )}

                    <h3>Final Leaderboard</h3>

                    {leaderboard.map(player => (

                        <div className="player" key={player.rank}>
                            #{player.rank} {player.name} – {player.score} points
                        </div>

                    ))}

                    <button onClick={() => window.location.reload()}>
                        Play Again
                    </button>

                </div>

            )}

        </div>

    );

}

export default App;
