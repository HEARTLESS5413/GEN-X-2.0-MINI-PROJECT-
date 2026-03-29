# Software Requirements Specification (SRS)
## Project: GEN-X 2.0 (The Gen-Z Social Universe)

---

## 1. Introduction
GEN-X 2.0 is a highly interactive, real-time social networking platform tailored for the Gen-Z demographic. It combines standard social media features (feeds, stories, profiles) with advanced real-time capabilities including messaging, audio/video calling, synchronized watch parties, and multiplayer gaming. The platform is designed with a modern, dark-themed "glassmorphism" aesthetic with neon accents.

## 2. Technology Stack & Architecture
### Frontend
*   **Framework:** Next.js 16 (React) with App Router
*   **Styling:** CSS Modules with custom modern properties (Glassmorphism, Neon glow)
*   **State Management:** Zustand (Global stores for Auth, Calls, Notifications, etc.)
*   **Real-time Communication:** Socket.io-client, WebRTC (for audio/video/screen share)

### Backend
*   **Runtime:** Node.js with Express.js
*   **Real-time Engine:** Socket.io for WebSockets
*   **Database:** PostgreSQL
*   **ORM:** Prisma ORM
*   **Authentication:** JSON Web Tokens (JWT)

---

## 3. Core Functionalities & Features

### 3.1. Authentication & User Management
*   **Registration & Login:** Secure authentication with password hashing.
*   **Profiles:** Customizable user profiles with avatars, bios, and theme selection (Dark, Neon, Cyberpunk).
*   **Social Graph:** Follow/Unfollow system with pending/accepted states.

### 3.2. Social Feed & Stories
*   **Posts:** Users can upload images or videos with captions.
*   **Interactions:** Like, comment, and save posts functionality.
*   **Stories:** 24-hour disappearing media updates (Images/Videos) with view tracking.

### 3.3. Real-Time Chat System (Messages)
*   **Direct Messaging:** 1-on-1 real-time text and media sharing.
*   **Live Indicators:** "Typing..." indicators, read receipts (seen states).
*   **Vanishing Mode:** Snapchat-style disappearing messages ("👻 Vanishing message").
*   **In-Chat Invites:** Seamlessly invite users to Games or Watch Parties directly within the chat interface.

### 3.4. Global Calling System (Audio & Video)
*   **Cross-Page Persistence:** Calls continue seamlessly in a draggable, floating Picture-in-Picture (PiP) window even when navigating across the app (Feed, Explore, etc.).
*   **Video & Audio:** High-quality peer-to-peer media streams.
*   **Screen Sharing:** Ability to share screens during an active call.
*   **Device Controls:** Mute microphone, disable camera functionality.
*   **Smart UI:** Full-screen ringing overlays and minimized active call views.
*   **Automations:** Auto-timeout for unanswered calls (Server tracks missed calls), custom ringing tones via Web Audio API.

### 3.5. Multiplayer Gaming Arcade
*   **Lobby System:** Dedicated `/games` lobby and in-chat game picker.
*   **Waiting Rooms:** "Host waiting for opponent" screens before games start.
*   **Game Collection:**
    *   ♟️ **Chess:** Full 8x8 interactive board with Unicode pieces and movement validation.
    *   🐦 **Flappy Bird:** Canvas-based real-time competitive high-score challenge.
    *   🎲 **Ludo:** Traditional 4-token board game mechanics with dice rolls.
    *   🔤 **Guess the Word:** Interactive hangman-style word guessing.
    *   ⭕ **Tic Tac Toe & ✊ RPS:** Classic quick games.
*   **Post-Game:** Rematch or "Change Game" directly from the results screen.

### 3.6. Watch Party (Synchronized Viewing)
*   **Virtual Rooms:** Users create a room and invite friends via chat.
*   **Sync Engine:** Real-time synchronization of Video Play, Pause, and Seek events for YouTube videos.

### 3.7. Explore & Notifications
*   **Explore:** Discover new users, including a "Blind Date" style matching system (Matched, Revealed status).
*   **Notifications:** Real-time push alerts for likes, comments, follows, messages, game invites, and incoming calls.

---

## 4. Key Terminologies Used

1.  **WebRTC (Web Real-Time Communication):** A technology used for the Calling System. It allows audio, video, and data to be shared directly between browsers (peer-to-peer) without needing an intermediate server to route the media stream.
2.  **WebSockets / Socket.io:** The protocol used for instant, two-way communication between the client and server. Used heavily for Chat, Notifications, Game State synchronization, and Watch Party sync.
3.  **Zustand:** A lightweight state management library for React. Used for managing the global state of the application, such as keeping the `CallProvider` active across different pages without losing the call context.
4.  **Glassmorphism:** A UI design trend characterized by semi-transparent, frosted-glass-like backgrounds, layered elements, and vivid colors shining through.
5.  **PiP (Picture-in-Picture):** The UI pattern used in the calling system where the active video or audio call minimizes into a small, movable window so the user can continue browsing the app.
6.  **Prisma / ORM (Object-Relational Mapping):** The backend tool used to interact with the PostgreSQL database using JavaScript/TypeScript objects instead of raw SQL queries.
7.  **ICE Candidates (Interactive Connectivity Establishment):** A part of WebRTC terminology. These are network routing paths that browsers exchange with each other to figure out the best way to connect directly for a video/audio call.
8.  **Vanishing Messages:** Messages that are programmed to disappear or be deleted after they are viewed, emphasizing privacy.

---

## 5. Database Schema Overview (PostgreSQL)
*   **User:** Core identity, auth data, and preferences.
*   **Post, Comment, Like, Save:** Content management and engagement metrics.
*   **Story, StoryView:** Ephemeral content tracking.
*   **Message:** Direct messaging records, including media links and "seen/vanishing" flags.
*   **Call:** Tracks caller, receiver, call status (`RINGING`, `ACTIVE`, `MISSED`, `ENDED`), and timestamps.
*   **GameSession:** Tracks active and finished multiplayer games, storing the live game `state` as JSON.
*   **WatchRoom:** Tracks synchronized video sessions and current video time.
*   **Follow, Notification:** Social graph and system alerts.

---

## 6. References
1.  **Next.js Documentation:** [https://nextjs.org/docs](https://nextjs.org/docs) - Framework documentation for routing, rendering, and API routes.
2.  **React Documentation:** [https://react.dev/](https://react.dev/) - Core UI library concepts and hooks.
3.  **Socket.io Documentation:** [https://socket.io/docs/v4/](https://socket.io/docs/v4/) - Real-time bidirectional event-based communication.
4.  **Zustand Documentation:** [https://github.com/pmndrs/zustand](https://github.com/pmndrs/zustand) - Global state management patterns.
5.  **WebRTC API (MDN):** [https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) - Real-time media and data stream protocols used for the calling system.
6.  **Prisma Documentation:** [https://www.prisma.io/docs](https://www.prisma.io/docs) - Schema definitions and database queries via the ORM.
7.  **PostgreSQL Documentation:** [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/) - Relational database system principles.
8.  **Tailwind CSS / CSS Modules:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs) - Utility styling and glassmorphism design references.
