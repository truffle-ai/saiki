## [0.2.0] - YYYY-MM-DD

### Added
- **Web Interface:** Introduced a decoupled Web UI alongside the existing CLI (`--mode web` or `--mode both`).
  - Includes an Express server with WebSocket support for real-time updates.
  - Basic HTML/CSS/JS client application in `app/web/client/`.
  - `WebUISubscriber` to broadcast agent events to web clients.
- **Command Line Arguments:** Added `--mode` and `--web-port` flags to `app/index.ts` to control execution.

### Changed
- **Project Structure:**
  - Refactored CLI code into `app/cli/` directory.
  - Introduced shared initialization logic in `app/shared/initialize.ts`.
  - Updated `app/index.ts` to handle different modes and use shared initialization.
- **Build Configuration:**
  - Excluded `src/servers/` directory from TypeScript compilation (`tsconfig.json`).
  - Excluded `src/servers/` directory from linting (`eslint.config.js`).
- **Linting:**
  - Configured `eslint.config.js` with separate environments for Node.js (`.ts` files) and Browser (`app/web/client/**/*.js`).
  - Resolved `no-case-declarations` errors in `app/web/client/script.js`.

### Fixed
- Resolved ESLint errors related to undefined browser globals (`document`, `window`, `WebSocket`) in client-side JavaScript.
