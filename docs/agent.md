# MERO NOTE — BACKEND DEVELOPMENT AGENT RULES

Version: 2.0
Status: Active
Scope: Backend-first development
Frontend status: COMPLETE FOR NOW

---

# 1. PROJECT PURPOSE

Mero Note is a personal-first CSIT study library for desktop and Android/mobile use.

The application manages:

- Semesters
- Subjects
- Topics
- Study Resources
- Books
- Notices
- PDF files
- User accounts
- Favorites
- Bookmarks
- Reading progress
- Downloads
- Recent views
- Semester preferences
- Admin content management

The frontend UI is already substantially complete.

The current priority is to build the real backend and replace the current mock/local data architecture with a production-ready backend architecture.

---

# 2. CURRENT TECHNOLOGY DECISIONS

## Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Existing responsive desktop/mobile UI

Frontend is considered COMPLETE FOR NOW.

Do NOT redesign or rebuild the frontend during backend phases.

Only modify frontend code when a later API integration task genuinely requires it.

---

## Backend

- Node.js
- Express
- TypeScript

Current backend is minimal and currently contains only:

- Express application
- Server entry
- Environment configuration
- Health controller
- Health route
- Error middleware

---

## Database

MongoDB Atlas is the official application database.

MongoDB stores:

- User metadata
- Academic metadata
- Resource metadata
- CMS metadata
- Personal study metadata
- Relationships
- Progress/state metadata
- Other structured application data

MongoDB MUST NOT be used to store large PDF binaries.

---

## Object Storage

Backblaze B2 is the official object storage provider.

Backblaze B2 stores:

- PDF binaries
- Other approved resource files if supported later

MongoDB stores metadata/reference information for those files.

Actual file bytes belong in Backblaze B2.

---

# 3. SOURCE OF TRUTH

Before making backend decisions, inspect the existing codebase.

The following are important sources:

- `client/src/types/index.ts`
- `client/src/data/mock.ts`
- `client/src/state/`
- `client/src/lib/`
- `client/src/pages/`
- `client/src/components/`
- `client/src/router.tsx`
- `server/src/`
- `docs/agent.md` only as historical reference if replaced

The existing frontend audit established that most domain metadata currently exists in the frontend rather than the backend.

Do NOT assume that a field exists simply because it was mentioned in an old roadmap.

Distinguish:

1. Already implemented
2. Expected by current frontend
3. Planned but not implemented
4. Newly required for backend functionality

Never silently invent application requirements.

---

# 4. CURRENT IMPLEMENTATION STATUS

## Frontend

Currently implemented:

- Main UI
- Desktop UI
- Mobile UI
- Student navigation
- Admin navigation
- Semester UI
- Subject UI
- Resource UI
- Reader UI
- Favorites UI
- Bookmarks UI
- Downloads UI
- Notices UI
- Settings UI
- Admin CMS UI
- Local/mock state
- LocalStorage persistence for selected features

The frontend currently uses mock/local data.

---

## Backend

Currently implemented:

- Express
- TypeScript
- `/api/health`

Currently NOT implemented:

- MongoDB connection
- Models
- Schemas
- Validation layer
- Authentication
- Authorization
- User API
- Semester API
- Subject API
- Topic API
- Resource API
- Book API
- Notice API
- Activity API
- Favorites API
- Bookmark API
- Reading-progress API
- Download API
- Recent-view API
- Backblaze B2 integration
- Real PDF upload
- Real PDF retrieval
- Real PDF reader integration
- Search API
- Production deployment

---

# 5. IMPORTANT CURRENT DATA MODEL

The frontend audit identified these major entities:

## Core academic entities

- Semester
- Subject
- Topic
- Resource
- Book
- Notice
- ActivityEntry

## User/personal entities

- User
- Favorite
- FavoriteSubject
- Bookmark
- BookmarkedSubject
- ReadingProgress
- Download
- RecentView
- SemesterUserStatus / semester preferences

## Global configuration

- ProgramInfo
- Admin application settings

Preserve currently implemented domain concepts unless a schema-design phase explicitly approves a change.

---

# 6. CORE RELATIONSHIPS

The current conceptual hierarchy is:

Semester
↓
Subject
↓
Topic
↓
Resource

Resource may optionally reference:

- Book

User-owned data relates to:

User
├── Favorites
├── Bookmarks
├── Reading Progress
├── Downloads
├── Recent Views
└── Semester Preferences

Do not introduce unrelated relationships without a documented reason.

---

# 7. FRONTEND PROTECTION RULE

The existing frontend is NOT the current development target.

During backend development:

DO NOT:

- redesign UI
- change layouts
- change colors
- change typography
- change navigation
- change responsive behavior
- replace components unnecessarily
- modify desktop navigation
- modify mobile navigation
- rewrite existing visual components
- remove existing mock functionality unless explicitly required
- refactor frontend merely for code style

Frontend changes are allowed ONLY when:

1. The current phase explicitly requires frontend/API integration, OR
2. A backend contract cannot be consumed without a small frontend change, AND
3. The change is minimal and directly related to the phase.

---

# 8. GENERAL DEVELOPMENT RULES

These rules apply to EVERY phase.

## Rule 1 — Inspect first

Before modifying anything:

- inspect the existing implementation
- identify affected files
- understand existing types and relationships
- check existing conventions
- check dependencies

Never modify blindly.

---

## Rule 2 — Small controlled changes

Implement only the current phase.

Do not jump ahead.

Do not implement future phases "while you are here."

---

## Rule 3 — No invented APIs

Do not invent:

- undocumented endpoints
- fields
- credentials
- environment variables
- external services
- database relationships

If a requirement is unclear, stop and report it.

---

## Rule 4 — Preserve existing behavior

Do not break existing functionality unnecessarily.

If a change may affect existing functionality:

- identify it
- explain it
- test it

---

## Rule 5 — Secrets

NEVER hardcode:

- MongoDB credentials
- Backblaze credentials
- JWT secrets
- API keys
- passwords
- tokens

Use environment variables.

NEVER commit `.env`.

---

## Rule 6 — Validation

Backend input must be validated.

Never trust:

- request body
- query parameters
- URL parameters
- uploaded files
- user roles
- client-side permissions

---

## Rule 7 — Authorization

Frontend role checks are NOT security.

All protected operations must be checked server-side.

USER and ADMIN permissions must be enforced by backend middleware/services.

---

## Rule 8 — Error handling

Use consistent backend error handling.

Do not expose:

- secrets
- database credentials
- internal sensitive information
- production stack traces

Development-only diagnostics may be allowed where appropriate.

---

## Rule 9 — Database safety

Do not:

- delete collections accidentally
- drop the database
- overwrite production data
- run destructive migrations without explicit approval

Use safe migrations/seeding where required.

---

## Rule 10 — File safety

PDF uploads must be validated.

Do not trust only the file extension.

Do not store large PDFs inside MongoDB documents.

---

## Rule 11 — Dependencies

Do not install packages unnecessarily.

Before adding a dependency:

- verify it is required
- check whether existing dependencies can solve the problem
- add only what is necessary

---

## Rule 12 — No unrelated refactoring

Do not clean up unrelated code during a phase.

Avoid broad rewrites.

---

# 9. PHASE ROADMAP

The backend development must follow this order unless the project owner explicitly changes it.

---

# PHASE 0 — BACKEND ARCHITECTURE & SCHEMA DESIGN

## Goal

Create the approved backend architecture before implementing database models.

## Tasks

Design:

- MongoDB collections
- Field definitions
- Data types
- Required/optional fields
- Relationships
- References
- User ownership
- Validation rules
- Indexes
- Soft-delete strategy
- Status strategy
- Favorite/bookmark strategy
- Resource/Book relationship
- Backblaze B2 metadata strategy
- Authentication data requirements

Clearly separate:

MongoDB
vs
Backblaze B2
vs
Client/device storage.

## Important decisions to resolve

### User identity

Current personal records do not contain `userId`.

Backend must establish proper user ownership.

### Semester status

Current frontend contains multiple status concepts:

- enrollment
- SemesterUserStatus
- CMS PublishStatus

Do not blindly merge them.

Define their exact meanings.

### Favorites/bookmarks

Current frontend contains:

- resource favorites
- subject favorites
- resource bookmarks
- subject bookmarks

Define a clean backend representation.

### Resource file metadata

Current frontend lacks storage fields.

Define required backend file metadata such as:

- storage key
- object reference
- MIME type
- checksum/ETag where appropriate
- file size
- page count

Do not implement these fields until the architecture is approved.

## Phase completion

Phase 0 is complete when:

- collection design exists
- fields are documented
- relationships are documented
- indexes are documented
- validation rules are documented
- B2 strategy is documented
- unresolved decisions are resolved
- architecture is reviewed/approved

DO NOT create final MongoDB models before Phase 0 approval.

---

# PHASE 1 — BACKEND FOUNDATION

## Goal

Create a clean production-ready backend structure.

## Tasks

Establish appropriate structure for:

- config
- models
- schemas/validation
- controllers
- services
- routes
- middleware
- utilities
- database connection

Implement:

- MongoDB Atlas connection
- environment configuration
- centralized error handling
- API response conventions
- basic request handling
- health check preservation

## Do NOT

- build all APIs
- build authentication
- build B2 upload
- modify frontend unnecessarily

## Completion

Backend starts successfully and connects safely to MongoDB.

---

# PHASE 2 — MONGODB DATA LAYER

## Goal

Implement the approved database architecture.

## Tasks

Create approved models/collections for:

- Users
- Semesters
- Subjects
- Topics
- Resources
- Books
- Notices
- Activity Logs
- Favorites
- Bookmarks
- Reading Progress
- Downloads
- Recent Views
- User Semester Preferences

Only create collections approved during Phase 0.

Implement:

- schema validation
- indexes
- references
- timestamps
- soft deletion where required

## Completion

Database models are working and validated.

No application-wide API implementation is required yet unless needed for testing.

---

# PHASE 3 — AUTHENTICATION & AUTHORIZATION

## Goal

Replace mock authentication with real backend authentication.

## Tasks

Implement:

- registration strategy if required
- login
- password hashing
- authentication
- token/session mechanism
- protected routes
- current-user endpoint
- logout/session invalidation where applicable
- USER role
- ADMIN role
- authorization middleware

## Security

Never trust:

- frontend role
- frontend user ID
- client-provided ownership

The backend must determine authenticated identity.

## Completion

A user can authenticate and protected endpoints correctly enforce permissions.

---

# PHASE 4 — ACADEMIC CONTENT API

## Goal

Create real APIs for the academic hierarchy.

Implement APIs for:

- Semesters
- Subjects
- Topics
- Resources
- Books
- Notices
- Activity data where approved

Support:

- list
- detail
- relationships
- filtering
- sorting
- admin CRUD where applicable

Maintain the existing academic hierarchy.

## Completion

The backend can provide the real academic library data required by the existing UI.

---

# PHASE 5 — BACKBLAZE B2 STORAGE

## Goal

Implement real PDF storage.

Flow:

Admin
↓
Backend upload
↓
Backblaze B2
↓
File metadata
↓
MongoDB

MongoDB stores metadata/reference.

Backblaze stores actual PDF bytes.

## Tasks

Implement:

- B2 configuration
- upload service
- file validation
- PDF validation
- object naming/key strategy
- metadata persistence
- failure handling
- cleanup handling where required

## Security

B2 credentials remain server-side.

Never expose secret credentials to frontend code.

## Completion

An approved admin workflow can upload a valid PDF and store its metadata/reference correctly.

---

# PHASE 6 — REAL PDF READER

## Goal

Replace the current placeholder reader with real PDF rendering.

Flow:

Resource
↓
Secure file access
↓
Backblaze B2
↓
PDF.js
↓
Reader

Implement:

- PDF retrieval/access
- PDF.js rendering
- page navigation
- zoom
- fullscreen
- initial page
- loading state
- error state
- page count
- reader state

Keep the existing reader UI unless integration genuinely requires small changes.

## Completion

A real uploaded PDF can be opened and read through the existing reader experience.

---

# PHASE 7 — PERSONAL STUDY DATA

## Goal

Move personal study state from local/mock-only storage to backend persistence.

Implement:

- Favorites
- Subject Favorites
- Bookmarks
- Subject Bookmarks
- Reading Progress
- Recent Views
- Semester Preferences

Every personal record must be correctly scoped to the authenticated user.

## Completion

Different authenticated users have isolated personal data.

---

# PHASE 8 — REAL DOWNLOAD SYSTEM

## Goal

Replace simulated downloads with real downloads.

Implement:

- download initiation
- download state
- progress where technically appropriate
- completed state
- failed state
- remove download
- download metadata
- user ownership

Clearly distinguish:

Server/resource availability
from
device-local downloaded files.

## Completion

A user can download an approved PDF and the application correctly tracks its download state.

---

# PHASE 9 — CACHE & OFFLINE SYSTEM

## Goal

Support useful offline behavior.

Use appropriate browser/PWA technologies such as:

- Service Worker
- Cache API
- IndexedDB

Maintain the distinction:

Temporary cache
≠
Permanent user download

Implement offline behavior only where clearly defined.

## Completion

Approved cached/downloaded resources behave correctly when connectivity is unavailable.

---

# PHASE 10 — SEARCH & DISCOVERY

## Goal

Create backend-powered search.

Search relevant metadata such as:

- Resource title
- Subject
- Semester
- Resource type
- Tags

Implement where required:

- filtering
- sorting
- pagination
- indexes
- search optimization

Do not change the visual search UI unless API integration requires it.

## Completion

Search returns correct backend results with appropriate filtering/sorting.

---

# PHASE 11 — ADMIN CMS BACKEND

## Goal

Move the frontend local CMS functionality to the real backend.

Admin management must cover approved entities:

- Semesters
- Subjects
- Topics
- Resources
- Books
- Notices
- Activity Logs

Support approved operations:

- create
- edit
- publish
- hide
- soft delete
- restore where applicable
- PDF upload
- metadata management

All admin operations require server-side authorization.

## Completion

Admin can manage real database content instead of only localStorage/mock data.

---

# PHASE 12 — FRONTEND ↔ BACKEND INTEGRATION

## Goal

Connect the completed frontend to the real backend.

Replace appropriate mock/local sources with API data.

Integrate:

- authentication
- user profile
- semesters
- subjects
- topics
- resources
- books
- notices
- favorites
- bookmarks
- reading progress
- recent views
- downloads
- PDF reader
- admin CMS

## Frontend rule

This is the main phase where frontend changes are expected.

However:

- preserve existing UI
- preserve layout
- preserve navigation
- preserve responsive behavior
- do not redesign components unnecessarily

Only replace the data source and add required loading/error states.

## Completion

The application can operate using real backend data.

---

# PHASE 13 — PWA / ANDROID OPTIMIZATION

## Goal

Finalize mobile/PWA behavior.

Implement/refine:

- installability
- service worker
- offline behavior
- IndexedDB
- local file handling
- Android behavior
- mobile performance
- app-like experience

Do not redesign the existing mobile UI unless required.

## Completion

The application behaves reliably as a PWA/mobile application.

---

# PHASE 14 — TESTING & SECURITY HARDENING

## Goal

Test the entire system before deployment.

Test:

- authentication
- authorization
- database operations
- CRUD
- validation
- PDF uploads
- B2 integration
- PDF retrieval
- reader
- favorites
- bookmarks
- progress
- downloads
- offline behavior
- search
- admin permissions
- mobile behavior
- error handling

Security checks:

- unauthorized access
- ownership bypass
- invalid input
- malicious upload attempts
- secret exposure
- CORS
- authentication weaknesses
- authorization weaknesses
- database safety

## Completion

Critical application workflows pass testing and identified security issues are addressed.

---

# PHASE 15 — PRODUCTION DEPLOYMENT

## Goal

Deploy Mero Note safely.

Production architecture:

Frontend
↓
Production Hosting

Backend
↓
Production Server

MongoDB Atlas
↓
Production Database

Backblaze B2
↓
Production File Storage

Implement:

- production environment variables
- HTTPS
- CORS configuration
- deployment configuration
- production database configuration
- B2 production configuration
- monitoring/logging
- backup strategy
- final production tests

## Completion

Mero Note is running in production with secure configuration and working core functionality.

---

# 10. DATABASE RULES

MongoDB should primarily contain structured metadata.

Examples:

- user records
- academic entities
- resource metadata
- relationships
- personal state
- timestamps
- statuses
- file references

Do NOT store large PDF binaries directly in normal MongoDB documents.

PDF bytes belong in Backblaze B2.

---

# 11. BACKBLAZE B2 RULES

Backblaze B2 is the official file/object storage.

All B2 credentials must remain server-side.

The backend is responsible for:

- upload
- validation
- object naming
- metadata persistence
- secure retrieval strategy
- deletion/cleanup where applicable

Never expose B2 secret credentials in:

- React
- Vite environment variables
- browser source
- committed files

---

# 12. API RULES

APIs must:

- use consistent routes
- validate inputs
- authenticate protected requests
- authorize protected operations
- return predictable responses
- return appropriate HTTP status codes
- avoid leaking internal errors

Avoid unnecessary API duplication.

Use services for reusable business logic.

Controllers should remain focused on request/response handling.

---

# 13. USER DATA SECURITY

Any personal data must be associated with the authenticated user.

Never trust a client-supplied `userId` when authentication already provides identity.

Ownership must be derived from the authenticated request.

Example:

Authenticated User
↓
req.user
↓
Service
↓
user-owned database record

Do NOT allow:

POST /favorites
{
"userId": "some-other-user"
}

to override authenticated ownership.

---

# 14. SOFT DELETE

Where the approved schema uses soft deletion:

- preserve the record
- mark deletion state
- exclude deleted records from normal queries
- allow restore only where explicitly supported
- permanently delete only through an approved operation

Do not introduce permanent destructive deletion casually.

---

# 15. STATUS RULE

Do not confuse:

- publication status
- user enrollment/status
- file/download status
- resource visibility

Each status must have one clear purpose.

Avoid duplicate status fields that represent the same concept.

---

# 16. MIGRATION RULE

The current frontend mock data is reference/seed data.

Do not automatically migrate every localStorage value into MongoDB.

Before migration:

1. identify the data
2. map it to approved backend structures
3. validate it
4. decide whether it should become seed data or user data
5. migrate only approved data

Never treat mock data as production user data.

---

# 17. TESTING RULE

Every meaningful backend phase must include appropriate tests.

At minimum, verify:

- happy path
- invalid input
- unauthorized request
- forbidden request
- missing resource
- database failure where practical
- expected response structure

Do not claim a phase is complete without verifying its completion criteria.

---

# 18. PHASE BOUNDARY RULE

OpenCode MUST NOT continue automatically into the next phase.

When a phase is complete:

1. stop
2. summarize changes
3. list files changed
4. list tests performed
5. report failures/warnings
6. report anything intentionally not implemented
7. wait for explicit approval for the next phase

Never assume approval.

---

# 19. CHANGE REPORT FORMAT

At the end of every phase, report:

## Completed

- item
- item
- item

## Files Created

- path
- path

## Files Modified

- path
- path

## Tests

- test
- result

## Not Implemented

- item
- reason

## Risks / Warnings

- item

## Next Phase

State only the next planned phase.

Do not start it automatically.

---

# 20. FINAL DEVELOPMENT PRINCIPLE

Mero Note must be developed incrementally.

The correct sequence is:

Inspect
→ Design
→ Approve
→ Implement
→ Test
→ Audit
→ Approve
→ Next Phase

Never:

Guess
→ Rewrite
→ Add unrelated features
→ Continue automatically

The existing frontend is the current visual foundation.

The backend must be built around the verified existing domain model while improving the architecture where the approved backend design requires it.

Prioritize:

- correctness
- security
- maintainability
- data integrity
- controlled changes
- clear separation of responsibilities
- reliable PDF storage
- reliable user data
- API consistency

Do not optimize for speed at the cost of architectural correctness.

---

# CURRENT PROJECT STATE

Frontend:
COMPLETE FOR NOW

Backend:
FOUNDATION ONLY

Database:
MongoDB Atlas SELECTED

Object Storage:
Backblaze B2 SELECTED

Current Phase:
PHASE 0 — BACKEND ARCHITECTURE & SCHEMA DESIGN

Next Action:
Create the backend schema/architecture proposal.

DO NOT IMPLEMENT DATABASE MODELS UNTIL PHASE 0 DESIGN IS APPROVED.
