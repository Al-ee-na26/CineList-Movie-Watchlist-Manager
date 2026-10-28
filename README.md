# CineList - Movie Watchlist Manager

CineList is a MERN movie watchlist application. It lets you add, search, filter,
edit, delete, and update the watching status of movies.

## Project structure

- `backend/` - Express API, Mongoose models, and MongoDB connection
- `frontend/` - React and Vite user interface

## Run locally

### 1. Configure the backend

Open a terminal in `backend/` and create a local `.env` file. You can copy
`backend/.env.example` and replace the placeholder MongoDB URI with your own
MongoDB Atlas connection string:

```powershell
cd backend
Copy-Item .env.example .env
```

The backend variables are:

```text
MONGODB_URI=your-mongodb-atlas-connection-string
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Never commit the real `.env` file or its MongoDB password.

Install and start the backend:

```powershell
npm install
npm run dev
```

The API runs at `http://localhost:5000`.

### 2. Configure and start the frontend

Open a second terminal in `frontend/`:

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`.

## Deploy the backend to Render

Do not put the MongoDB password in this README or in GitHub. Enter it only in
the Render environment-variable settings.

1. Push the project to your GitHub repository, making sure no real `.env` file
   is tracked.
2. Sign in to [Render](https://render.com).
3. Select **New +** and choose **Web Service**.
4. Connect the GitHub repository.
5. Use these settings:

   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`

6. Add these environment variables under **Environment**:

   ```text
   MONGODB_URI=<your MongoDB Atlas connection string>
   FRONTEND_URL=http://localhost:5173
   ```

   `PORT` is supplied automatically by Render. You normally do not need to
   add it.
7. Click **Create Web Service** and wait for the deployment to finish.
8. Copy the Render service URL, for example:

   ```text
   https://your-service-name.onrender.com
   ```

9. Test the backend by opening:

   ```text
   https://your-service-name.onrender.com/api/health
   ```

   A successful response contains `"API is running"`.

## Deploy the frontend to Vercel

1. Sign in to [Vercel](https://vercel.com).
2. Select **Add New Project** and import the GitHub repository.
3. Use these project settings:

   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

4. Add this environment variable:

   ```text
   VITE_API_URL=https://your-service-name.onrender.com/api
   ```

   Replace the example hostname with the actual Render service URL. Keep the
   `/api` suffix.
5. Deploy the Vercel project.
6. Copy the Vercel deployment URL, for example:

   ```text
   https://your-project.vercel.app
   ```

## Finish CORS configuration

After you know the Vercel URL, return to the Render service:

1. Open **Environment**.
2. Change `FRONTEND_URL` to the exact Vercel URL:

   ```text
   FRONTEND_URL=https://your-project.vercel.app
   ```

3. Save the environment variable and allow Render to redeploy.

The backend allows all origins when `FRONTEND_URL` is not set, which keeps local
development working. When `FRONTEND_URL` is set, requests are restricted to
that frontend origin.

## Verify the deployed application

1. Open the Vercel URL.
2. Confirm the movie list loads.
3. Add a test movie.
4. Refresh the page and confirm the movie remains.
5. Test editing, status changes, and deletion using a test record.
6. If the list does not load, check the browser console and confirm:
   - the Vercel `VITE_API_URL` points to the Render URL and ends in `/api`;
   - the Render `FRONTEND_URL` exactly matches the Vercel URL;
   - `MONGODB_URI` is set in Render;
   - the Render health URL responds successfully.

## API endpoints

The backend implements:

- `GET /api/health` - health check
- `GET /api/movies` - list movies with pagination, search, status, and genre filters
- `POST /api/movies` - add a movie
- `GET /api/movies/stats` - watchlist statistics
- `GET /api/movies/watch-next` - choose the next movie
- `PUT /api/movies/:id` - edit a movie
- `PATCH /api/movies/:id/status` - change watching status
- `PATCH /api/movies/:id/rating` - edit a watched movie's rating
- `DELETE /api/movies/:id` - delete a movie

## Security notes

- Real `.env` files are ignored by the root `.gitignore`.
- Only `.env.example` files with placeholders belong in the repository.
- If a MongoDB password was ever committed publicly, rotate it in MongoDB
  Atlas before deploying.
