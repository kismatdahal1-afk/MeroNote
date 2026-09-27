<p align="center">
  <img src="client/public/icon/icon.png" alt="Mero Note" width="96" />
</p>

<h1 align="center">Mero Note</h1>

<p align="center">Personal-first CSIT study library for desktop and mobile.</p>

<p align="center">
  <a href="https://meronote.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-Visit_App-5B3DF5?style=for-the-badge&logo=vercel&logoColor=white" alt="Live Demo" /></a>
  <a href="docs/README.md"><img src="https://img.shields.io/badge/Docs-Start_Here-0F172A?style=for-the-badge&logo=readthedocs&logoColor=white" alt="Documentation" /></a>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#getting-started">Getting Started</a> ·
  <a href="#product-preview">Preview</a> ·
  <a href="#live-demo">Live Demo</a>
</p>

## Features

- Semester → Subject → Topic → Resource library organization
- Unified search across semesters, subjects, topics, resources, books, and notices
- PDF reader with zoom, page navigation, bookmarks, and reading progress
- Favorites, bookmarks, continue reading, and recent resources
- Offline downloads for studying without internet
- Semester planning with progress tracking
- Notices board for announcements and deadlines
- Admin CMS for managing semesters, subjects, topics, resources, books, and notices
- Light / dark / system theme
- PWA support with mobile-friendly navigation

## Tech Stack

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
![AWS SDK](https://img.shields.io/badge/AWS_SDK-232F3E?style=flat-square&logo=amazonaws&logoColor=white)

**Storage**
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Backblaze B2](https://img.shields.io/badge/Backblaze_B2-E21E25?style=flat-square&logo=backblaze&logoColor=white)

## Project Structure

```
MeroNote/
├── client/   # React + Vite + TS + Tailwind frontend
├── server/   # Express + TS API
├── docs/     # project documentation
└── README.md
```

## Getting Started

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
<summary><b>Seed & admin (development)</b></summary>

```bash
cd server
npm run seed:dev                    # dev data (refuses production)
npm run promote-admin -- you@email  # grant ADMIN (refuses production)
```

</details>

## Requirements

- Node.js >= 20 < 28
- npm
- MongoDB Atlas (or local MongoDB) for the backend

## Environment Variables

<details>
<summary><b>Show variables</b></summary>

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

</details>

## Product Preview

<table align="center">
  <tr>
    <td align="center">
      <a href="https://meronote.vercel.app/">
        <img src="client/public/images/Dashboard.png" alt="Dashboard — click to open live demo" width="300" />
      </a>
    </td>
    <td align="center">
      <a href="https://meronote.vercel.app/">
        <img src="client/public/images/Semester.png" alt="Resource — click to open live demo" width="300" />
      </a>
    </td>
    <td align="center">
      <a href="https://meronote.vercel.app/">
        <img src="client/public/images/note.png" alt="PDF Viewer — click to open live demo" width="300" />
      </a>
    </td>
  </tr>
  <tr>
    <td align="center"><b>Dashboard</b></td>
    <td align="center"><b>Resource</b></td>
    <td align="center"><b>PDF Viewer</b></td>
  </tr>
</table>

## Documentation

**Architecture**
[![System](https://img.shields.io/badge/System-docs-5B3DF5?style=flat-square&logo=readthedocs&logoColor=white)](docs/architecture/system.md)
[![Backend](https://img.shields.io/badge/Backend-docs-0F172A?style=flat-square&logo=express&logoColor=white)](docs/architecture/backend.md)
[![Database](https://img.shields.io/badge/Database-docs-47A248?style=flat-square&logo=mongodb&logoColor=white)](docs/architecture/database.md)
[![Authentication](https://img.shields.io/badge/Authentication-docs-CA4245?style=flat-square&logo=jsonwebtokens&logoColor=white)](docs/architecture/authentication.md)
[![Storage](https://img.shields.io/badge/Storage-docs-06B6D4?style=flat-square&logo=amazonaws&logoColor=white)](docs/architecture/storage.md)

**Features**
[![PDF Reader](https://img.shields.io/badge/PDF_Reader-docs-FF6F00?style=flat-square&logo=mozilla&logoColor=white)](docs/features/pdf-reader.md)
[![Offline & Cache](https://img.shields.io/badge/Offline_&_Cache-docs-06B6D4?style=flat-square&logo=readthedocs&logoColor=white)](docs/features/offline-cache.md)
[![Downloads](https://img.shields.io/badge/Downloads-docs-47A248?style=flat-square&logo=readthedocs&logoColor=white)](docs/features/downloads.md)
[![Personalization](https://img.shields.io/badge/Personalization-docs-5B3DF5?style=flat-square&logo=readthedocs&logoColor=white)](docs/features/personalization.md)
[![Search](https://img.shields.io/badge/Search-docs-0F172A?style=flat-square&logo=readthedocs&logoColor=white)](docs/features/search-discovery.md)
[![Admin Portal](https://img.shields.io/badge/Admin_Portal-docs-CA4245?style=flat-square&logo=readthedocs&logoColor=white)](docs/features/admin-portal.md)
[![Landing Page](https://img.shields.io/badge/Landing_Page-docs-646CFF?style=flat-square&logo=readthedocs&logoColor=white)](docs/features/landing-page.md)

**Operations & Project**
[![Deployment](https://img.shields.io/badge/Deployment-docs-646CFF?style=flat-square&logo=vercel&logoColor=white)](docs/operations/deployment.md)
[![Known Issues](https://img.shields.io/badge/Known_Issues-docs-FF6F00?style=flat-square&logo=readthedocs&logoColor=white)](docs/operations/known-issues.md)
[![Agent Rules](https://img.shields.io/badge/Agent_Rules-docs-0F172A?style=flat-square&logo=readthedocs&logoColor=white)](docs/project/agent.md)
[![Product](https://img.shields.io/badge/Product-docs-5B3DF5?style=flat-square&logo=readthedocs&logoColor=white)](docs/project/product.md)

> Full index: [`docs/README.md`](docs/README.md)

## Live Demo

**Deployed on Vercel**

<p align="center">
  <a href="https://meronote.vercel.app/"><img src="https://img.shields.io/badge/Live_Demo-meronote.vercel.app-5B3DF5?style=for-the-badge&logo=vercel&logoColor=white" alt="Open live demo" /></a>
</p>

## Creator

**Designed & Developed by**

<p align="center">
  <img src="https://img.shields.io/badge/KISMAT_DAHAL-Creator-0F172A?style=for-the-badge&logo=github&logoColor=white" alt="Created by Kismat Dahal" />
  <a href="https://www.instagram.com/kisma_tt07/"><img src="https://img.shields.io/badge/Instagram-kisma_tt07-E4405F?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram" /></a>
</p>

<p align="center"><a href="#mero-note">Back to top</a></p>
