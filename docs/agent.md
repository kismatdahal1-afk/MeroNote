# MERO NOTE — AI AGENT MASTER RULES & PHASE PLAN

## 0. Purpose

Mero Note is a personal-first CSIT study library for desktop and Android. It must support large study resources such as books, short notes, extra notes, questions, past papers, practical/lab materials, and revision notes.

The application must be:

- Clean, premium, modern, student-friendly, and content-first.
- Responsive on laptop and Android.
- Data-driven, not hardcoded.
- Designed for incremental development.
- Safe for large PDF libraries.
- Usable online and offline with a clear distinction between temporary cache and permanent downloads.

## 1. NON-NEGOTIABLE AGENT RULES

### 1.1 Development Workflow

ALWAYS work in small, controlled tasks.

Workflow:

1. Read this file before starting a task.
2. Inspect the existing project before changing anything.
3. Identify the current phase and task.
4. Make the smallest required change.
5. Do NOT rebuild unrelated parts.
6. Run relevant checks/tests.
7. Fix errors caused by the change.
8. Report exactly what changed.
9. Do not move to the next phase unless explicitly instructed.

NEVER:

- Build the entire application in one operation.
- Rewrite working code without a reason.
- Replace the chosen stack without approval.
- Add unnecessary dependencies.
- Delete existing features to simplify implementation.
- Invent APIs, database fields, storage providers, or credentials.
- Assume a feature is complete without testing it.

### 1.2 Existing Code Protection

Before modifying a file:

- Read the file.
- Understand its purpose.
- Preserve existing working behavior.
- Reuse existing components/utilities where appropriate.

If a change may affect multiple existing features:

- Explain the impact first.
- Make the smallest safe change.
- Do not modify unrelated files.

### 1.3 UI Protection

The Stitch-approved design is the visual source of truth.

Follow:

- Existing spacing system.
- Existing typography.
- Existing colors/tokens.
- Existing components.
- Existing responsive behavior.
- Existing animations.

Do not:

- Redesign pages unnecessarily.
- Introduce random colors.
- Add excessive gradients/glows.
- Turn the product into a cyberpunk interface.
- Create inconsistent cards/buttons/forms.
- Replace a working layout just because another design seems better.

Style target: **Premium + minimal + modern + calm + slightly futuristic.**

### 1.4 Responsive Rule

Every UI feature must work on:

- Laptop/desktop.
- Android mobile.

Desktop:

- Sidebar navigation.
- Spacious content layout.

Mobile:

- Bottom navigation and/or drawer.
- Touch-friendly controls.
- Compact cards.
- Readable typography.
- No horizontal overflow.

Never consider a UI task complete if mobile behavior is obviously broken.

### 1.5 Data Rule

Never hardcode real CSIT content into components.

Use:

- API data.
- Database data.
- Temporary mock data only during UI development.

The architecture must allow: **Semester → Subject → Resource → File.**

Resource types must remain extensible:

- Book
- Short Note
- Extra Note
- Questions
- Past Paper
- Important Questions
- Practical/Lab
- Revision Note
- Other

### 1.6 PDF Rule

Large PDFs must NOT be stored directly inside normal MongoDB documents.

- MongoDB Atlas stores metadata.
- PDF binaries use separate file/object storage.

MongoDB resource metadata should contain information such as:

- title
- description
- semester
- subject
- resource type
- file reference
- file size
- page count
- tags
- upload date
- updated date

Use PDF.js for reading.

### 1.7 Online / Cache / Download Rule

There are THREE different concepts:

1. **Online Reading** — The PDF is read from cloud/file storage through the application.
2. **Temporary Cache** — Recently accessed data/pages/assets may be cached locally for faster access.

   Temporary cache:
   - Is not guaranteed permanent.
   - Can be cleared.
   - Must never be treated as a permanent download.

3. **Permanent Download** — When the user explicitly presses Download:
   - Save the PDF locally.
   - Mark it as Downloaded.
   - Make it available offline.
   - Show it in Downloads.

**Clear Cache MUST NOT delete explicit downloads.**

### 1.8 Offline Rule

Offline support must use suitable browser/PWA storage mechanisms such as:

- Service Worker
- Cache API
- IndexedDB
- Local file/download handling where appropriate

Cache only what is practical.

Do not claim that normal browser cache is permanent offline storage.

Offline UI must clearly distinguish:

- Available online
- Cached
- Downloaded
- Offline available

### 1.9 Database Rule

Recommended collections:

- users
- semesters
- subjects
- resources
- readingProgress
- bookmarks
- favorites

Keep relationships clean and scalable.

- Do not create unnecessary duplicate data.
- Use validation for important fields.
- Use indexes for frequently searched/filtered fields when needed.

### 1.10 Security Rule

Authentication/authorization must be enforced server-side.

Roles:

- USER
- ADMIN

USER can:

- Read
- Search
- Download
- Favorite
- Bookmark
- Track reading progress
- Manage personal study data

ADMIN can additionally:

- Upload resources
- Edit resources
- Delete resources
- Manage semesters
- Manage subjects
- Manage resource metadata

- Never trust frontend-only role checks.
- Never expose secrets in frontend code.

Never commit:

- API keys
- Database credentials
- JWT secrets
- Storage credentials
- .env files containing secrets

Use environment variables.

### 1.11 Error Handling Rule

Every network/storage operation should have:

- Loading state.
- Success state.
- Error state.
- Empty state where relevant.

Errors must be understandable to normal users.

- Do not silently swallow errors.
- Do not expose sensitive backend details to users.

### 1.12 Testing Rule

After meaningful changes, run appropriate checks.

Frontend where applicable:

- lint
- typecheck
- build
- tests

Backend where applicable:

- TypeScript/build
- API tests
- validation tests
- auth tests

For PDF/download/offline features, manually test the actual user flow.

Never report a feature as verified if it was not actually checked.

### 1.13 Dependency Rule

Before adding a package:

- Check whether the project already has an equivalent utility.
- Prefer established, lightweight dependencies.
- Avoid unnecessary packages.
- Do not introduce a new framework for a small feature.
- Do not change React/Vite/TypeScript/Express/MongoDB architecture without explicit approval.

### 1.14 Git Rule

Do not automatically push to GitHub unless explicitly instructed.

Preferred workflow:

1. Implement.
2. Test.
3. Explain.
4. Let the user review.
5. User decides when to commit/push.

Suggested branch names:

- feature/foundation
- feature/dashboard
- feature/pdf-reader
- feature/auth
- feature/admin
- feature/offline
- feature/downloads

### 1.15 Documentation Rule

When architecture or behavior changes significantly:

- Update the relevant documentation.
- Keep documentation concise.
- Do not create duplicate documentation.

Important docs:

- project-rules.md
- project-roadmap.md
- system-architecture.md
- ui-specification.md
- database-schema.md
- api-specification.md
- offline-storage-plan.md

## 2. TECH STACK — LOCKED DEFAULT

Frontend:

- React
- Vite
- TypeScript
- Tailwind CSS

Backend:

- Node.js
- Express
- TypeScript

Database:

- MongoDB Atlas

PDF:

- PDF.js

PWA/offline:

- Service Worker
- Cache API
- IndexedDB

Authentication:

- JWT
- Secure/HTTP-only cookies where appropriate

File storage:

- Separate object/file storage for large PDFs

Deployment target:

- Frontend: suitable static hosting
- Backend: suitable Node.js hosting
- Database: MongoDB Atlas
- PDF files: object/file storage

Android:

- PWA installed through Chrome/Add to Home Screen.
- No Play Store/App Store requirement for V1.
- Same React codebase should serve desktop and Android.

## 3. ARCHITECTURE

```
Mero Note
├── client/
│   ├── React + Vite + TypeScript
│   ├── UI
│   ├── PDF Reader
│   ├── PWA
│   └── local cache/download handling
│
├── server/
│   ├── Express + TypeScript
│   ├── API routes
│   ├── authentication
│   ├── authorization
│   ├── business logic
│   └── file/storage integration
│
├── docs/
│   ├── project-rules.md
│   ├── project-roadmap.md
│   ├── system-architecture.md
│   ├── ui-specification.md
│   ├── database-schema.md
│   ├── api-specification.md
│   └── offline-storage-plan.md
│
└── README.md
```

Core flow:

```
User
→ React/PWA
→ Express API
→ MongoDB Atlas for metadata
→ Object/File Storage for PDFs
```

PDF reading:

```
Cloud PDF → PDF.js → Reader
```

Explicit offline download:

```
Cloud PDF → local storage/download → Downloaded
```

Temporary cache:

```
Cloud data → browser/PWA cache → temporary cached content
```

## 4. DEVELOPMENT PHASE PLAN

### PHASE 1 — FOUNDATION

Goal: Create a clean full-stack project foundation.

Tasks:

- Initialize Git repository.
- Create client.
- Create server.
- Configure React/Vite/TypeScript.
- Configure Tailwind.
- Configure Express/TypeScript.
- Add environment configuration.
- Add basic API structure.
- Add /api/health.
- Configure basic error handling.
- Configure CORS appropriately.
- Create initial documentation.
- Verify frontend and backend run independently.

Exit criteria:

- Frontend starts.
- Backend starts.
- Health endpoint works.
- No TypeScript/build errors.
- Repository structure is clean.

### PHASE 2 — UI FOUNDATION + STITCH IMPLEMENTATION

Goal: Implement the approved UI with mock data.

Screens:

- Welcome/Landing
- Login
- Dashboard
- Semester Library
- Subject List
- Subject Detail
- Resource List
- Resource Detail
- PDF Reader shell
- Search
- Favorites
- Bookmarks
- Downloads
- Recent
- Settings
- Admin Dashboard
- Admin Upload
- Admin Resource Management

Implement:

- Layout.
- Sidebar.
- Mobile navigation.
- Header.
- Cards.
- Buttons.
- Forms.
- Search UI.
- Empty states.
- Loading states.
- Error states.
- Responsive behavior.
- Light/dark mode if included in design.

Use mock data only.

Exit criteria:

- Main UI flows are clickable.
- Desktop works.
- Android/mobile layout works.
- No real backend dependency is required yet.

### PHASE 3 — DATABASE + DATA MODEL

Goal: Connect the application to MongoDB Atlas.

Collections:

- users
- semesters
- subjects
- resources
- readingProgress
- bookmarks
- favorites

Implement:

- Schemas/models.
- Validation.
- Indexes where useful.
- Database connection.
- CRUD/service layer.
- Seed/sample data if useful.

Relationships:

- Semester → Subjects
- Subject → Resources
- User → personal study data

Exit criteria:

- API can read/write core metadata.
- Validation works.
- No real PDF binary storage in normal documents.

### PHASE 4 — AUTHENTICATION + ADMIN

Goal: Create secure user/admin access.

Implement:

- Registration/login as required.
- Session/auth handling.
- JWT.
- Secure cookies where appropriate.
- Role checks.
- Protected routes.
- USER/ADMIN authorization.
- Admin dashboard.
- Admin resource management UI.

USER:

- Read/search.
- Download.
- Favorite.
- Bookmark.
- Progress.

ADMIN:

- Upload.
- Edit.
- Delete.
- Manage semesters.
- Manage subjects.
- Manage resources.

Exit criteria:

- Unauthorized users cannot access admin operations.
- Authorization is enforced by backend.
- Secrets are not exposed.

### PHASE 5 — REAL PDF STORAGE + UPLOAD

Goal: Make resource files real.

Flow:

```
Admin selects PDF
→ Backend validates upload
→ PDF goes to object/file storage
→ MongoDB stores metadata + file reference
→ Resource becomes available in library
```

Implement:

- Upload.
- File validation.
- File size handling.
- MIME validation.
- Metadata creation.
- Storage integration.
- Secure access.
- Delete/replace handling.
- Upload progress where useful.

Do not store large PDFs directly in normal MongoDB documents.

Exit criteria:

- Admin can upload a real PDF.
- User can retrieve it.
- Metadata is correct.
- Delete/replace does not leave uncontrolled orphan files.

### PHASE 6 — PDF READER

Goal: Build the real study reader.

Use PDF.js.

Features:

- Open PDF.
- Page navigation.
- Page number.
- Zoom.
- Search inside PDF where supported.
- Fullscreen.
- Responsive reader.
- Bookmark current page.
- Download.
- Last-read page.
- Continue Reading.

Prioritize usability over visual complexity.

Exit criteria:

- Large PDFs open reliably.
- Reader works on desktop.
- Reader works on Android.
- Navigation does not break existing app layout.

### PHASE 7 — READING PROGRESS

Goal: Remember where the user stopped.

Store:

- user ID
- resource ID
- last page
- progress
- updated timestamp

Features:

- Continue Reading.
- Resume at last page.
- Recent resources.
- Progress indicator.

Do not save progress excessively on every tiny event if it creates unnecessary network traffic. Use a sensible debounce/throttle strategy.

### PHASE 8 — DOWNLOAD SYSTEM

Goal: Create explicit permanent downloads.

Flow:

```
User presses Download
→ file is fetched
→ local copy is stored
→ resource marked Downloaded
→ user can open offline
```

Implement:

- Download button.
- Progress.
- Cancel/retry if practical.
- Download state.
- Download list.
- Open downloaded PDF.
- Delete local download.
- Storage size tracking.

Downloaded files must remain separate from temporary cache.

### PHASE 9 — CACHE + OFFLINE SYSTEM

Goal: Provide useful offline behavior without treating all cache as permanent storage.

Implement:

- Service Worker.
- Cache API.
- IndexedDB.
- App shell caching.
- Metadata caching.
- Recent-content caching where practical.
- Offline detection.
- Offline indicator.
- Downloaded-resource access.
- Cache clearing.

Settings should distinguish:

- Downloaded Files
- Temporary Cache
- Total Storage

Example:

```
Downloaded Files: 650 MB
Temporary Cache: 82 MB
Total: 732 MB
```

Clear Cache must not delete downloads.

Exit criteria:

- App can load its shell offline.
- Explicitly downloaded PDFs can be opened offline.
- Temporary cache can be cleared independently.
- UI accurately reports availability.

### PHASE 10 — PWA + ANDROID

Goal: Make Mero Note installable on Android without an app store.

Implement:

- Web App Manifest.
- Service Worker.
- App icons.
- Installable PWA.
- Responsive mobile UI.
- Mobile PDF reader.
- Android storage/download testing.

Development testing:

- Laptop and Android on same Wi-Fi.
- Expose development server to LAN.
- Open laptop LAN address from Android.

Production:

- Deploy over HTTPS.
- Open in Android Chrome.
- Add to Home Screen/install PWA.

Do not introduce React Native unless the project requirements later demand it.

### PHASE 11 — MOBILE OPTIMIZATION

Test every major feature on Android.

Check:

- Navigation.
- Touch targets.
- Scrolling.
- Search.
- PDF reader.
- Zoom.
- Download.
- Offline mode.
- Storage manager.
- Dark/light mode.
- Long titles.
- Large PDFs.
- Slow network.
- Small screens.

Fix mobile-specific problems without breaking desktop.

### PHASE 12 — REAL CSIT CONTENT STRUCTURE

Create the real hierarchy:

```
Semester 1
→ Subjects
→ Resources

Semester 2
→ Subjects
→ Resources

Continue through Semester 8.
```

Resource categories:

- Books
- Short Notes
- Extra Notes
- Questions
- Past Papers
- Important Questions
- Practical/Lab
- Revision Notes
- Other

Do not hardcode the number of semesters/subjects into UI logic.

Admin should be able to create/manage content dynamically.

### PHASE 13 — PERSONAL STUDY FEATURES

Implement:

- Favorites.
- Bookmarks.
- Recent resources.
- Reading progress.
- Continue Reading.
- Personal notes if included in requirements.
- Resource tags.
- Download management.

Personal data must belong to the authenticated user.

### PHASE 14 — SEARCH

Start with metadata search:

- Title.
- Subject.
- Semester.
- Resource type.
- Tags.

Add filters:

- Semester.
- Subject.
- Type.
- Downloaded.
- Favorites.

Later, if practical: PDF full-text search/indexing.

Do not implement expensive full-text processing before basic search works.

### PHASE 15 — STORAGE MANAGER

Create a clear storage UI.

Show:

- Downloaded Files.
- Temporary Cache.
- Total Used.
- Available storage when the platform permits it.

Actions:

- Clear Cache.
- Manage Downloads.
- Delete selected download.
- Open downloaded resource.

Never allow Clear Cache to delete permanent downloads.

### PHASE 16 — TESTING + HARDENING

Test:

Frontend:

- lint
- typecheck
- build
- component tests where useful

Backend:

- health.
- auth.
- authorization.
- CRUD.
- upload.
- download.
- validation.
- errors.

User flows:

- Login.
- Browse semester.
- Browse subject.
- Open resource.
- Read PDF.
- Save progress.
- Bookmark.
- Favorite.
- Download.
- Open offline.
- Clear cache.
- Delete download.

Device testing:

- Laptop.
- Android.

Network testing:

- Good connection.
- Slow connection.
- Offline.

Large PDF testing:

- Small PDF.
- Medium PDF.
- Very large PDF.

### PHASE 17 — DEPLOYMENT

Production architecture:

```
Android/Desktop
→ Frontend hosting
→ Backend API
→ MongoDB Atlas
→ PDF object/file storage
```

Before deployment:

- Configure production environment variables.
- Configure CORS.
- Configure HTTPS.
- Secure cookies/auth.
- Configure storage access.
- Run production build.
- Test upload/read/download/offline.
- Check logs.
- Remove development-only behavior.

Do not deploy secrets.

## 5. UI REQUIREMENTS

Main desktop navigation:

- Dashboard
- Semesters
- Subjects
- Favorites
- Bookmarks
- Downloads
- Recent
- Settings
- User/profile area

Mobile:

- Bottom navigation for key sections.
- Drawer for secondary sections.

Dashboard should prioritize:

- Continue Reading.
- Recent resources.
- Semester shortcuts.
- Favorites/downloads.
- Useful study overview.

Resource cards should show useful metadata without clutter.

PDF reader should prioritize:

- Reading area.
- Page controls.
- Search.
- Zoom.
- Bookmark.
- Download.

## 6. PERFORMANCE RULES

Because the library may contain very large PDFs:

- Do not load the entire library into memory unnecessarily.
- Paginate large resource lists.
- Lazy-load UI sections when useful.
- Avoid unnecessary re-renders.
- Avoid downloading PDFs until needed.
- Stream/fetch large files appropriately.
- Do not preload every PDF.
- Cache selectively.
- Keep API payloads small.
- Use thumbnails/previews only when useful.
- Never load 300–1000+ page PDFs completely into a normal list page.

## 7. AGENT TASK FORMAT

When the user gives a task, internally determine:

```
PHASE:
TASK:
FILES TO CHANGE:
DEPENDENCIES:
RISK:
TESTS:
```

Before coding:

- Inspect relevant files.
- Confirm current implementation.
- Avoid assumptions.

After coding:

- Run appropriate checks.
- Summarize files changed.
- Summarize behavior added.
- Report tests/checks.
- Report any known limitation.

If the request conflicts with this master file:

- Point out the conflict briefly.
- Follow the user's explicit newer instruction only when it clearly overrides the rule.
- Otherwise preserve the architecture and rules.

## 8. STOP CONDITIONS

STOP and ask for clarification when:

- A required design decision is genuinely missing and cannot safely be inferred.
- A task would require changing the locked architecture.
- A destructive operation could delete user/project data.
- Credentials or secrets are required.
- A requested feature conflicts with existing functionality and there is no safe interpretation.

Do NOT stop for minor implementation choices that can safely follow existing project conventions.

## 9. DEFINITION OF DONE

A task is DONE only when:

- Requested functionality exists.
- Existing functionality still works.
- Code follows the project architecture.
- UI follows the established design system.
- Desktop behavior is acceptable.
- Mobile behavior is acceptable where relevant.
- Errors/loading/empty states are handled where relevant.
- Appropriate tests/checks pass.
- No unnecessary files/dependencies were added.
- Documentation is updated if the change affects architecture or behavior.

## 10. CURRENT PRIORITY

- Always use the user's explicitly stated current phase/task as the immediate priority.
- Do not automatically continue through the roadmap.
- When a phase is completed: verify it, report completion, and wait for the next instruction.

- The roadmap is the source of project direction.
- This file is the source of agent behavior and engineering rules.
- The existing codebase is the source of current implementation truth.
- The approved Stitch UI is the source of visual truth.

**END OF MERO NOTE AGENT RULES**
