# Quiz Battle – Real-Time Multiplayer Quiz Game

**Project Overview**

Quiz Battle is a real-time multiplayer quiz application designed to bring friends, families, students, and classmates together through interactive knowledge-based competitions. Built using Python, FastAPI, React, and WebSockets, the platform allows up to 20 players to participate in a shared quiz room using a unique room code, without requiring user registration or software installation.

**Key Features**

- **Multiplayer Rooms:** Create private game rooms with unique six-character room codes.
- **Easy Player Access:** Players can join from mobile phones, tablets, and laptops without creating accounts.
- **Nine Quiz Categories:** General Knowledge, Science & Technology, Programming & Python, Data Science & AI, Mathematics, History & Geography, Sports, Movies & Entertainment, and Business & Finance.
- **Interactive Quiz Sessions:** Ten multiple-choice questions per game, with four answer options and a 20-second countdown per question.
- **Mixed Difficulty:** Questions include Easy, Medium, and Hard levels.
- **Real-Time Synchronization:** WebSocket communication keeps questions, answers, player status, and leaderboard updates synchronized across connected devices.
- **Competitive Scoring:** Speed-based scoring rewards players for answering correctly and quickly.
- **Live Leaderboard:** Players can track their rankings and scores throughout the competition.
- **Host Controls:** The host can create rooms, participate in the competition, and start the game.

**Technology Stack**

- Backend: Python, FastAPI
- Frontend: React, JavaScript, CSS
- Real-Time Communication: WebSockets
- Database: PostgreSQL (planned)
- In-Memory Game State: Python (Redis integration planned)
- Deployment: Docker and cloud hosting

**Problem Statement**

Traditional quiz competitions often require participants to be physically present, use separate applications, or depend on a centralized presentation system. Quiz Battle addresses these limitations by providing an accessible, browser-based multiplayer experience where participants can compete remotely with synchronized game sessions.

**Innovation and Impact**

Quiz Battle combines real-time communication, interactive learning, and competitive gameplay to make knowledge sharing more engaging. It can be used for classroom activities, virtual team-building events, family entertainment, coding competitions, and educational challenges.

**Project Vision**

Our vision is to create an accessible and scalable multiplayer quiz platform that transforms traditional question-and-answer sessions into engaging real-time competitions, connecting people through learning and friendly competition.
