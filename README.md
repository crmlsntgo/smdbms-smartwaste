# SmartWaste Frontend (React Migration)

This project is a React-based frontend for the SmartWaste application, migrating from a legacy HTML/JS/CSS structure.

## 🚀 Getting Started

1.  **Install Dependencies:**
    ```bash
    cd frontend
    npm install
    ```

2.  **Environment Setup:**
    Ensure a `.env` file exists in the `frontend` directory with your Firebase configuration:
    ```env
    VITE_FIREBASE_API_KEY=...
    VITE_FIREBASE_AUTH_DOMAIN=...
    ...
    ```
    (A default `.env` has been created based on legacy config).

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```

## 📂 Project Structure

-   `src/components`: Reusable UI components (Header, Sidebar).
-   `src/pages`: Main application pages (Dashboard, Profile, Customize, Archive, Settings, Auth).
-   `src/utils`: Helper functions and services (Auth, Firebase).
-   `src/styles/vendor`: CSS files migrated from the legacy project.
-   `public/legacy`: Contains the original HTML, JS, and CSS files for reference and fallback (e.g., Admin pages).

## 🔄 Migration Status

-   **User Pages:** Fully migrated to React (`Dashboard`, `Profile`, `Customize`, `Archive`, `Settings`).
-   **Authentication:** Login and Register pages migrated. Google Auth setup page available.
-   **Admin Pages:** Currently forwarded to `public/legacy/html/admin/` until migrated.
-   **Assets:** Static assets moved to `public/legacy`.

## 🛠️ Tech Stack

-   **Vite:** Build tool and dev server.
-   **React:** UI library.
-   **Firebase:** Authentication and Firestore database.
-   **Tailwind CSS:** Utility-first CSS (gradual adoption).

