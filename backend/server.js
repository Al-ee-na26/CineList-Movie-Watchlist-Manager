import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Movie from "./models/Movie.js";
import Counter from "./models/Counter.js";

dotenv.config();
const app = express();
const frontendUrl = process.env.FRONTEND_URL?.trim();
app.use(cors(frontendUrl ? { origin: frontendUrl } : undefined));
app.use(express.json());

const ok = (res, status, message, data = null) => res.status(status).json({ success: true, message, data });
const fail = (res, status, message) => res.status(status).json({ success: false, message, data: null });
const genres = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance", "Thriller"];
const platforms = ["Netflix", "Prime Video", "Hotstar", "Theatre", "Other"];
const statuses = ["To Watch", "Watching", "Watched"];
const currentYear = () => new Date().getFullYear();

function validateFields(body, creating = true) {
  const fields = creating
    ? ["title", "genre", "releaseYear", "runtime", "platform", "priority"]
    : ["title", "genre", "runtime", "platform", "priority"];
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === "")
      return `${f} is required`;
  }
  if (body.title !== undefined && !String(body.title).trim()) return "Title is required";
  if (body.genre !== undefined && !genres.includes(body.genre)) return "Invalid genre";
  if (body.platform !== undefined && !platforms.includes(body.platform)) return "Invalid platform";
  if (body.releaseYear !== undefined && (!Number.isInteger(Number(body.releaseYear)) || Number(body.releaseYear) < 1950 || Number(body.releaseYear) > currentYear()))
    return `Release year must be between 1950 and ${currentYear()}`;
  if (body.runtime !== undefined && (!Number.isInteger(Number(body.runtime)) || Number(body.runtime) < 30 || Number(body.runtime) > 300))
    return "Runtime must be between 30 and 300 minutes";
  if (body.priority !== undefined && (!Number.isInteger(Number(body.priority)) || Number(body.priority) < 1 || Number(body.priority) > 5))
    return "Priority must be an integer from 1 to 5";
  return null;
}

function moviePayload(doc) {
  return doc;
}

app.get("/api/health", (_req, res) => ok(res, 200, "API is running", { status: "ok" }));

app.post("/api/movies", async (req, res) => {
  try {
    const error = validateFields(req.body, true);
    if (error) return fail(res, 400, error);
    const title = String(req.body.title).trim();
    const releaseYear = Number(req.body.releaseYear);
    const duplicate = await Movie.findOne({ title, releaseYear }).collation({ locale: "en", strength: 2 });
    if (duplicate) return fail(res, 409, "A movie with this title and release year already exists");
    const counter = await Counter.findOneAndUpdate(
      { _id: releaseYear }, { $inc: { sequence: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const movieCode = `MV-${releaseYear}-${String(counter.sequence).padStart(3, "0")}`;
    const movie = await Movie.create({
      movieCode, title, genre: req.body.genre, releaseYear,
      runtime: Number(req.body.runtime), platform: req.body.platform,
      priority: Number(req.body.priority), status: "To Watch", rating: null, watchedDate: null
    });
    return ok(res, 201, "Movie added successfully", moviePayload(movie));
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "A movie with this title and release year already exists");
    console.error(e);
    return fail(res, 500, "Unable to add movie");
  }
});

app.get("/api/movies", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 6;
    const filter = {};
    if (req.query.status && statuses.includes(req.query.status)) filter.status = req.query.status;
    if (req.query.genre && genres.includes(req.query.genre)) filter.genre = req.query.genre;
    if (req.query.search) filter.title = { $regex: String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const total = await Movie.countDocuments(filter);
    const movies = await Movie.find(filter)
      .sort({ status: 1, priority: -1, runtime: 1, createdAt: -1 })
      .skip((page - 1) * limit).limit(limit);
    // Ensure To Watch movies appear first by priority, regardless of other status sorting.
    movies.sort((a, b) => {
      if (a.status === "To Watch" && b.status !== "To Watch") return -1;
      if (b.status === "To Watch" && a.status !== "To Watch") return 1;
      if (a.status === "To Watch" && b.status === "To Watch") return b.priority - a.priority || a.runtime - b.runtime;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return ok(res, 200, "Movies fetched", { movies, page, limit, totalMovies: total, totalPages: Math.ceil(total / limit) });
  } catch (e) { console.error(e); return fail(res, 500, "Unable to fetch movies"); }
});

app.get("/api/movies/watch-next", async (_req, res) => {
  try {
    const movie = await Movie.findOne({ status: "To Watch" }).sort({ priority: -1, runtime: 1, createdAt: 1 });
    if (!movie) return fail(res, 404, "No movies are waiting to be watched");
    return ok(res, 200, "Here is your next movie", movie);
  } catch (e) { return fail(res, 500, "Unable to find the next movie"); }
});

app.get("/api/movies/stats", async (_req, res) => {
  try {
    const [statusRows, watchedRows, genreRows] = await Promise.all([
      Movie.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Movie.aggregate([{ $match: { status: "Watched" } }, { $group: {
        _id: null, count: { $sum: 1 }, totalRuntime: { $sum: "$runtime" },
        averageRating: { $avg: "$rating" }
      }}]),
      Movie.aggregate([{ $match: { status: "Watched" } }, { $group: { _id: "$genre", count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }, { $limit: 1 }])
    ]);
    const counts = { "To Watch": 0, "Watching": 0, "Watched": 0 };
    statusRows.forEach(r => counts[r._id] = r.count);
    const watched = watchedRows[0] || { count: 0, totalRuntime: 0, averageRating: null };
    return ok(res, 200, "Statistics fetched", {
      statusCounts: counts,
      totalHoursWatched: Math.round((watched.totalRuntime / 60) * 10) / 10,
      averageRating: watched.averageRating == null ? null : Math.round(watched.averageRating * 10) / 10,
      topWatchedGenre: genreRows[0] ? { genre: genreRows[0]._id, count: genreRows[0].count } : null
    });
  } catch (e) { console.error(e); return fail(res, 500, "Unable to fetch statistics"); }
});

app.put("/api/movies/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return fail(res, 404, "Movie not found");
    if ("movieCode" in req.body || "releaseYear" in req.body || "status" in req.body || "watchedDate" in req.body)
      return fail(res, 400, "Movie Code, Release Year, Status and Watched Date cannot be edited here");
    const error = validateFields(req.body, false);
    if (error) return fail(res, 400, error);
    movie.title = String(req.body.title).trim();
    movie.genre = req.body.genre;
    movie.runtime = Number(req.body.runtime);
    movie.platform = req.body.platform;
    movie.priority = Number(req.body.priority);
    await movie.save();
    return ok(res, 200, "Movie updated successfully", movie);
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "A movie with this title and release year already exists");
    console.error(e); return fail(res, 400, "Unable to update movie");
  }
});

app.patch("/api/movies/:id/status", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return fail(res, 404, "Movie not found");
    const next = req.body.status;
    if (!statuses.includes(next)) return fail(res, 400, "Invalid status");
    const allowed = {
      "To Watch": ["Watching", "Watched"],
      "Watching": ["Watched", "To Watch"],
      "Watched": []
    };
    if (!allowed[movie.status].includes(next)) return fail(res, 400, `Cannot change status from ${movie.status} to ${next}`);
    if (next === "Watched") {
      const rating = Number(req.body.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) return fail(res, 400, "A rating from 1 to 10 is required when marking a movie Watched");
      movie.rating = rating;
      movie.watchedDate = new Date();
    } else {
      if (req.body.rating !== undefined) return fail(res, 400, "Rating is only allowed for Watched movies");
      movie.rating = null;
      movie.watchedDate = null;
    }
    movie.status = next;
    await movie.save();
    return ok(res, 200, "Movie status updated", movie);
  } catch (e) { console.error(e); return fail(res, 400, "Unable to update status"); }
});

app.patch("/api/movies/:id/rating", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return fail(res, 404, "Movie not found");
    if (movie.status !== "Watched") return fail(res, 400, "Only Watched movies can have a rating");
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) return fail(res, 400, "Rating must be an integer from 1 to 10");
    movie.rating = rating;
    await movie.save();
    return ok(res, 200, "Rating updated", movie);
  } catch (e) { return fail(res, 400, "Unable to update rating"); }
});

app.delete("/api/movies/:id", async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return fail(res, 404, "Movie not found");
    if (movie.status === "Watching") return fail(res, 400, "Movies currently Watching cannot be deleted");
    await movie.deleteOne();
    return ok(res, 200, "Movie deleted successfully", { id: req.params.id });
  } catch (e) { return fail(res, 400, "Unable to delete movie"); }
});

const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    app.listen(port, () => console.log(`Backend running at http://localhost:${port}`));
  })
  .catch(err => {
    console.error("MongoDB connection failed. Check backend/.env MONGODB_URI:", err.message);
    process.exit(1);
  });
