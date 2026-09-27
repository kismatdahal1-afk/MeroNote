<p align="center">
  <img src="client/public/icon/icon.png" alt="Mero Note" width="96" />
</p>

<h1 align="center">Mero Note</h1>

<p align="center">Personal-first CSIT study library for desktop and mobile.</p>

<p align="center">
  <a href="https://meronote.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-meronote.vercel.app-5B3DF5?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
</p>

## ✨ Features

- 📚 Semester → Subject → Topic → Resource library organization
- 🔍 Unified search across semesters, subjects, topics, resources, books, and notices
- 📖 PDF reader with zoom, page navigation, bookmarks, and reading progress
- ⭐ Favorites, bookmarks, continue reading, and recent resources
- 📥 Offline downloads for studying without internet
- 🗓️ Semester planning with progress tracking
- 📢 Notices board for announcements and deadlines
- 🛠️ Admin CMS for managing semesters, subjects, topics, resources, books, and notices
- 🌗 Light / dark / system theme
- 📱 PWA support with mobile-friendly navigation

## 🛠️ Tech Stack

**Frontend**
![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![PDF.js](https://img.shields.io/badge/PDF.js-FF6F00?style=flat-square&logo=mozilla&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router-CA4245?style=flat-square&logo=reactrouter&logoColor=white)

**Backend**
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Mongoose](https://img.shields.io/badge/Mongoose-880000?style=flat-square&logo=mongoose&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat-square&logo=jsonwebtokens&logoColor=white)
![B2 SDK](https://img.shields.io/badge/AWS_SDK-232F3E?style=flat-square&logo=amazonaws&logoColor=white)

**Storage**
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Backblaze B2](https://img.shields.io/badge/Backblaze_B2-E21E25?style=flat-square&logo=backblaze&logoColor=white)

## 📁 Project Structure

```
MeroNote/
├── client/   # React + Vite + TS + Tailwind frontend
├── server/   # Express + TS API
├── docs/     # project documentation
└── README.md
```

## 🚀 Getting Started

Install dependencies for both apps:

```bash
# backend
cd server
npm install

# frontend
cd ../client
npm install
```

Run the backend:

```bash
cd server
npm run dev
```

API runs at `http://localhost:5000`.

Run the frontend:

```bash
cd client
npm run dev
```

Opens at `http://localhost:5173` backed by the API above.

<details>
<summary><b>🌱 Seed & admin (development)</b></summary>

```bash
cd server
npm run seed:dev                    # dev data (refuses production)
npm run promote-admin -- you@email  # grant ADMIN (refuses production)
```

</details>

## ✅ Requirements

- Node.js >= 20 < 28
- npm
- MongoDB Atlas (or local MongoDB) for the backend

## 🔑 Environment Variables

Create `server/.env` (variable names come from `server/src/config/env.ts`):

```bash
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
CLIENT_URL=http://localhost:5173
# Storage ops only:
B2_KEY_ID=...
B2_APPLICATION_KEY=...
B2_BUCKET_NAME=...
```

The client needs no env file for local development (`VITE_API_URL`
defaults to `http://localhost:5000`).

## 👀 Product Preview

<p align="center">
  <img src="client/public/images/Dashboard.png" alt="Mero Note dashboard" width="800" />
</p>
<p align="center">
  <img src="client/public/images/Semester.png" alt="Mero Note semester view" width="390" />
  <img src="client/public/images/note.png" alt="Mero Note notes view" width="390" />
</p>

## 📚 Documentation

Start at [`docs/README.md`](docs/README.md) — system, backend, database,
authentication, storage, features, and operations.

## 🌐 Live Demo

**https://meronote.vercel.app/**

## 👤 Creator

Designed & Developed by **KISMAT DAHAL**

https://www.instagram.com/kisma_tt07/
