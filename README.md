# 🌐 GEN-X 2.0 — The Gen-Z Social Universe

A full-stack real-time social networking platform with messaging, audio/video calling, multiplayer gaming, watch parties, stories, and more.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Zustand, Socket.io-client |
| Backend | Node.js, Express, Socket.io, WebRTC |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT (JSON Web Tokens) |
| Styling | CSS Modules + Glassmorphism |

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- PostgreSQL installed and running
- Git

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/genx-platform.git
cd genx-platform
npm run install-all
```

### 2. Configure Environment Variables

**Server** — copy `server/.env.example` to `server/.env`:
```bash
cd server
cp .env.example .env
```
Edit `server/.env`:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/genx"
JWT_SECRET="your-super-secret-key"
PORT=5000
CLIENT_URL="http://localhost:3000"
```

**Client** — copy `client/.env.example` to `client/.env.local`:
```bash
cd client
cp .env.example .env.local
```
The defaults in `.env.example` work for local development.

### 3. Setup Database
```bash
cd server
npx prisma db push
npx prisma db seed   # (optional) seed sample data
```

### 4. Run Development Servers
From the root directory:
```bash
npm run dev
```
Or run them separately:
```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health check: http://localhost:5000/api/health

---

## ☁️ Deployment Guide

### Architecture Overview
```
[Vercel]          [Render]           [Supabase/Neon]
 Client  ◄──────►  Server  ◄──────►  PostgreSQL
 Next.js           Express            Database
                   Socket.io
```

### Step 1: Database (Supabase — Free)
1. Go to [supabase.com](https://supabase.com) → Create project
2. Go to **Settings > Database** → Copy the **Connection String (URI)**
3. Replace `[YOUR-PASSWORD]` in the URI with your Supabase project password

### Step 2: Backend (Render — Free)
1. Push code to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Your Supabase connection string |
   | `JWT_SECRET` | A strong random secret |
   | `PORT` | `5000` |
   | `CLIENT_URL` | `https://your-app.vercel.app` (add after Vercel deploy) |
6. Deploy → Note the URL (e.g., `https://genx-api.onrender.com`)

### Step 3: Frontend (Vercel — Free)
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import same GitHub repo
3. Configure:
   - **Root Directory:** `client`
   - **Framework Preset:** Next.js (auto-detected)
4. Add **Environment Variables**:
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://genx-api.onrender.com/api` |
   | `NEXT_PUBLIC_SOCKET_URL` | `https://genx-api.onrender.com` |
   | `NEXT_PUBLIC_UPLOADS_URL` | `https://genx-api.onrender.com` |
5. Deploy

### Step 4: Link CORS
Go back to Render dashboard → update `CLIENT_URL` to your Vercel URL:
```
CLIENT_URL=https://your-app.vercel.app
```

> **⚠️ Important:** File uploads (avatars, posts, stories) use local disk storage on the server. On Render's free tier, these files are ephemeral (lost on restart). For persistent file storage in production, consider using Cloudinary or AWS S3.

---

## 📂 Project Structure
```
GEN-X 2.0/
├── client/              # Next.js Frontend
│   ├── src/
│   │   ├── app/         # Pages (App Router)
│   │   ├── components/  # Reusable components (CallProvider, etc.)
│   │   ├── lib/         # API client, Socket client
│   │   └── store/       # Zustand stores (auth, call, notification)
│   ├── public/          # Static assets
│   ├── next.config.ts
│   └── package.json
│
├── server/              # Express Backend
│   ├── src/
│   │   ├── routes/      # REST API routes
│   │   ├── socket/      # WebSocket handlers (chat, calls, games, watch)
│   │   └── middleware/  # Auth, upload middleware
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
│
├── .gitignore
├── package.json         # Root workspace scripts
└── README.md
```

---

## 📋 Features

- 🏠 **Social Feed** — Posts, likes, comments, saves
- 📸 **Stories** — 24-hour disappearing media
- 💬 **Real-time Chat** — Typing indicators, read receipts, vanishing messages
- 📞 **Audio/Video Calls** — WebRTC with cross-page floating PiP window
- 🎮 **Multiplayer Games** — Chess, Flappy Bird, Ludo, Guess the Word, Tic Tac Toe, RPS
- 📺 **Watch Parties** — Synchronized YouTube viewing
- 🔍 **Explore** — Discover users, blind-date matching
- 🔔 **Notifications** — Real-time alerts
- 👤 **Profiles** — Customizable with themes (Dark, Neon, Cyberpunk)
- 🛡️ **Admin Panel** — User/content management

---

## 📄 License
MIT
