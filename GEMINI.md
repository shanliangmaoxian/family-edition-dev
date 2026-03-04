# 九月进销存系统 (September Inventory System) - GEMINI Context

## Project Overview
A fully offline, desktop-based inventory management system designed for family members. It features large fonts, a minimalist UI, and robust local data persistence using SQLite.

### Tech Stack
- **Frontend Framework:** Next.js 16 (React 19, TypeScript, Tailwind CSS)
- **Desktop Runtime:** Tauri 2
- **Database:** SQLite (via `tauri-plugin-sql`)
- **Backend Logic (Desktop):** Rust (Tauri commands and plugins)
- **Deployment:** GitHub Actions for automated `.exe` and `.dmg` releases.
- **Update Mechanism:** Tauri Updater integrated with GitHub Releases.

## Architecture
- **Static Export:** The Next.js project is configured for static export (`output: 'export'`) to be embedded within the Tauri binary.
- **Offline Data:** Data is stored in `inventory.db` within the user's local application data directory.
- **Hybrid Bridge:** 
    - `src/lib/tauri-db.ts`: Handles the SQLite schema and raw SQL execution through Tauri's SQL plugin.
    - `src/lib/actions-client.ts`: Provides a unified interface for UI components to interact with the database, handle backups, and check for updates.
- **Native Plugins:** Uses `tauri-plugin-sql`, `tauri-plugin-updater`, `tauri-plugin-fs`, and `tauri-plugin-dialog`.

## Building and Running

### Development
1. **Frontend + Tauri Dev:**
   ```bash
   npm run tauri dev
   ```
2. **Standalone Web Dev (Experimental, local DB won't work):**
   ```bash
   npm run dev
   ```

### Database Initialization
- **Manual Setup (Node.js):** `node setup.js` (Creates `inventory.db` in project root with sample data for testing).
- **Auto Setup (Tauri):** The app automatically initializes the schema in the system's AppData folder on launch.

### Production Build
1. **Generate Binary:**
   ```bash
   npm run tauri build
   ```
   The output will be located in `src-tauri/target/release/bundle`.

## Key Files & Directories
- `src/app/page.tsx`: The main user interface with large font styling.
- `src/lib/tauri-db.ts`: Database connection and schema definitions.
- `src/lib/actions-client.ts`: Client-side logic for search, transactions, backups, and updates.
- `src-tauri/tauri.conf.json`: Core Tauri configuration including updater endpoints.
- `src-tauri/src/lib.rs`: Rust-side plugin initialization.
- `.github/workflows/release.yml`: CI/CD pipeline for automated multi-platform builds.

## Development Conventions
- **UI:** Use Tailwind CSS with `text-xl` or larger for accessibility.
- **Database:** Prefer direct SQL queries via the `tauri-plugin-sql` bridge for performance and reliability in the offline environment.
- **State Management:** Use React `useState` and `useTransition` for responsive UI feedback during database operations.
- **Backup:** Backups are saved as `.db` files to the user's chosen location via the system save dialog.
