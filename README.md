# Hour-Glass

> A collaborative project and time-tracking web application (frontend + server + optional desktop app).

**Repository layout**
- **`Frontend/`**: React/Vite or Webpack-based UI (app code, pages, components, public assets).
- **`server/`**: Express API, MongoDB models, authentication, and routes (including `ProjectRoutes.js`).
- **`winapp/`**: Electron packaging for a desktop build.

**Quick Summary**
- **Purpose**: Manage projects, members, tasks, budgets, and basic time/cost tracking with role-based permissions.
- **Key backend route**: `server/routes/ProjectRoutes.js` implements project and task management endpoints (create, update, archive, members, tasks, and more).

**Team Members**
| Name | Roll No |
| --- | ---: |
| Raiyani Rudra Chetanbhai | 202301223 |
| Patel Apurv Ashokbhai | 202301230 |
| Ajudiya Kashyap Jagdishbhai | 202301239 |
| Shreyas Dutta | 202301246 |
| Rishik Yalamanchili | 202301258 |
| Chirag Katkoriya | 202301259 |
| Mahek Jikkar | 202301260 |
| Patel Nakul Jaymitkumar | 202301261 |
| Jalu Rishabh Devdanbhai | 202301265 |
| Siddhant Shekhar | 202301268 |

**Prerequisites**
- **Node.js** (16+ recommended) and **npm** or **pnpm**.
- **MongoDB**: local server or a hosted MongoDB Atlas URI.
- Optional: `git` for cloning and `yarn` if you prefer.

**Environment**
Create a `.env` file in `server/` with at least these values (example):

```
MONGODB_URL='your_mongodb_connection_string'
JWT_SECRET='secret#text'
NODE_ENV='development'
SENDER_EMAIL="your_email_address"
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
BREVO_API_KEY="your_brevo_api_key"
GROQ_API_KEY="your_groq_api_key"
```

Adjust other `server/config` settings as needed (mailer, passport, etc.).

**Install & Run (development)**

- Backend (API):

```
cd server
npm install
# then 
node server.js
# or, if a dev script exists, run
npm run dev
# or
npm start
```

- Frontend:

```
cd Frontend
npm install
# dev server (check `Frontend/package.json` for the exact script)
npm run dev
```

- Electron / desktop app (optional):

```
cd winapp
npm install
# see `winapp/README.md` or package.json scripts for packaging commands
```

Open the frontend (usually at `http://localhost:3000`) and point the frontend to the backend API (`http://localhost:5000` by default).

**Authentication**
- Most API endpoints require an authenticated user. Send the JWT in the `Authorization` header as `Bearer <token>`.
 
**APIs**
- Backend routes live in `server/routes/`
- See the individual route files in `server/routes/` for full details on available endpoints and authorization requirements.

**Data notes**
- `memberRates` is stored as a `Map` in the project model and serialized to plain objects for API responses.
- Tasks include fields such as `title`, `description`, `assignee`, `dueDate`, `isDelayed`, `delayAlertSent`, and `status`.
- The server synchronizes task `status` and `isDelayed` based on due dates when projects are fetched/modified.

**Testing & Linting**
- Check `package.json` files in `Frontend/`, `server/`, and `winapp/` for scripts like `test`, `lint`, or `format`.


