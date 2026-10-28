import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Clapperboard, Plus, Search, Film, Clock3, Star, Trash2, Pencil, ChevronLeft, ChevronRight, Sparkles, X, RefreshCw } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const genres = ["Action", "Comedy", "Drama", "Horror", "Sci-Fi", "Romance", "Thriller"];
const platforms = ["Netflix", "Prime Video", "Hotstar", "Theatre", "Other"];
const emptyForm = { title: "", genre: "Action", releaseYear: new Date().getFullYear(), runtime: 120, platform: "Netflix", priority: 3 };
const statusClass = s => s.toLowerCase().replaceAll(" ", "-");

export default function App() {
  const [movies, setMovies] = useState([]);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [genre, setGenre] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [watchNext, setWatchNext] = useState(null);
  const [ratingMovie, setRatingMovie] = useState(null);
  const [rating, setRating] = useState(8);
  const [loading, setLoading] = useState(false);

  const request = async (method, url, data) => (await axios({ method, url: `${API}${url}`, data })).data;
  const loadMovies = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (genre) params.set("genre", genre);
      const result = await request("get", `/movies?${params}`);
      setMovies(result.data.movies); setPages(Math.max(1, result.data.totalPages));
    } catch (e) { setError(e.response?.data?.message || "Could not load movies. Check that the backend is running."); }
  }, [page, search, status, genre]);

  const loadStats = useCallback(async () => {
    try { const result = await request("get", "/movies/stats"); setStats(result.data); } catch { /* handled by movie request */ }
  }, []);

  const refresh = useCallback(async () => { await Promise.all([loadMovies(), loadStats()]); }, [loadMovies, loadStats]);
  useEffect(() => { loadMovies(); }, [loadMovies]);
  useEffect(() => { loadStats(); }, [loadStats]);

  const startAdd = () => { setEditing(null); setForm(emptyForm); setError(""); setShowForm(true); };
  const startEdit = movie => {
    setEditing(movie);
    setForm({ title: movie.title, genre: movie.genre, releaseYear: movie.releaseYear, runtime: movie.runtime, platform: movie.platform, priority: movie.priority });
    setError(""); setShowForm(true);
  };
  const saveMovie = async e => {
    e.preventDefault(); setError(""); setNotice("");
    const year = Number(form.releaseYear), runtime = Number(form.runtime), priority = Number(form.priority);
    if (!form.title.trim()) return setError("Please enter a title.");
    if (!editing && (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear())) return setError(`Release year must be 1950–${new Date().getFullYear()}.`);
    if (!Number.isInteger(runtime) || runtime < 30 || runtime > 300) return setError("Runtime must be between 30 and 300 minutes.");
    if (!Number.isInteger(priority) || priority < 1 || priority > 5) return setError("Priority must be from 1 to 5.");
    try {
      setLoading(true);
      if (editing) await request("put", `/movies/${editing._id}`, { title: form.title, genre: form.genre, runtime, platform: form.platform, priority });
      else await request("post", "/movies", { ...form, releaseYear: year, runtime, priority });
      setShowForm(false); setNotice(editing ? "Movie updated successfully." : "Movie added to your watchlist."); setPage(1); await refresh();
    } catch (e) { setError(e.response?.data?.message || "Could not save movie."); }
    finally { setLoading(false); }
  };

  const changeStatus = async (movie, next) => {
    setError(""); setNotice("");
    try {
      if (next === "Watched") {
        setRatingMovie(movie); setRating(movie.rating || 8); return;
      }
      await request("patch", `/movies/${movie._id}/status`, { status: next });
      setNotice("Status updated."); await refresh();
    } catch (e) { setError(e.response?.data?.message || "Could not change status."); }
  };
  const markWatched = async e => {
    e.preventDefault(); if (!ratingMovie) return;
    try {
      await request("patch", `/movies/${ratingMovie._id}/status`, { status: "Watched", rating: Number(rating) });
      setRatingMovie(null); setNotice("Movie marked Watched and rating saved."); await refresh();
    } catch (e) { setError(e.response?.data?.message || "Could not save rating."); }
  };
  const editRating = async movie => {
    const value = window.prompt("Enter a rating from 1 to 10", String(movie.rating || 8));
    if (value === null) return;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 10) return setError("Rating must be a whole number from 1 to 10.");
    try { await request("patch", `/movies/${movie._id}/rating`, { rating: n }); setNotice("Rating updated."); await refresh(); }
    catch (e) { setError(e.response?.data?.message || "Could not update rating."); }
  };
  const deleteMovie = async movie => {
    if (movie.status === "Watching") return;
    if (!window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) return;
    try { await request("delete", `/movies/${movie._id}`); setNotice("Movie deleted."); await refresh(); }
    catch (e) { setError(e.response?.data?.message || "Could not delete movie."); }
  };
  const getNext = async () => {
    setError(""); setWatchNext(null);
    try { const result = await request("get", "/movies/watch-next"); setWatchNext(result.data); }
    catch (e) { setError(e.response?.data?.message || "No movie available to watch next."); }
  };

  const nextStatuses = movie => movie.status === "To Watch" ? ["Watching", "Watched"] : movie.status === "Watching" ? ["Watched", "To Watch"] : [];
  const statValues = stats ? [
    { label: "To Watch", value: stats.statusCounts["To Watch"], className: "to-watch" },
    { label: "Watching", value: stats.statusCounts.Watching, className: "watching" },
    { label: "Watched", value: stats.statusCounts.Watched, className: "watched" },
    { label: "Hours watched", value: stats.totalHoursWatched, className: "hours" },
    { label: "Average rating", value: stats.averageRating ?? "—", className: "rating" }
  ] : [];

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon"><Clapperboard size={23}/></span><span>Cine<span className="brand-accent">List</span><small>YOUR PERSONAL MOVIE UNIVERSE</small></span></a>
      <button className="primary-btn" onClick={startAdd}><Plus size={18}/> Add movie</button>
    </header>
    <section className="hero">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={14}/> YOUR NEXT FAVORITE FILM AWAITS</span>
        <h1>Every great movie<br/>starts with <em>a list.</em></h1>
        <p>Keep track of the stories you want to see, the ones you're watching, and the ones you'll never forget.</p>
        <button className="hero-btn" onClick={getNext}><Sparkles size={17}/> What should I watch next?</button>
      </div>
      <div className="hero-art"><div className="poster poster-back"><Film size={38}/><span>THE NEXT CHAPTER</span></div><div className="poster poster-front"><Clapperboard size={43}/><span>NOW SHOWING</span></div><div className="orbit orbit-one"/><div className="orbit orbit-two"/></div>
    </section>

    {stats && <section className="stats-grid">
      {statValues.map(s => <div className={`stat-card ${s.className}`} key={s.label}><span>{s.label}</span><strong>{s.value}</strong>{s.label === "Hours watched" && <small>hours of cinema</small>}{s.label === "Average rating" && <small>out of 10</small>}</div>)}
      <div className="stat-card top-genre"><span>Most watched genre</span><strong>{stats.topWatchedGenre?.genre || "—"}</strong><small>{stats.topWatchedGenre ? `${stats.topWatchedGenre.count} watched` : "Watch a movie to unlock"}</small></div>
    </section>}

    {notice && <div className="alert success-alert"><span>{notice}</span><button onClick={() => setNotice("")}><X size={16}/></button></div>}
    {error && <div className="alert error-alert"><span>{error}</span><button onClick={() => setError("")}><X size={16}/></button></div>}

    {watchNext && <section className="next-card"><div className="next-icon"><Sparkles size={24}/></div><div className="next-copy"><span>YOUR NEXT PICK</span><h3>{watchNext.title}</h3><p>{watchNext.genre} · {watchNext.runtime} min · Priority {watchNext.priority}/5</p><small>{watchNext.movieCode} · {watchNext.platform}</small></div><button className="icon-btn" onClick={() => setWatchNext(null)} aria-label="Close"><X size={18}/></button></section>}

    <section className="list-section">
      <div className="section-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h2>The watchlist<span>.</span></h2></div><button className="text-btn" onClick={refresh}><RefreshCw size={15}/> Refresh</button></div>
      <div className="toolbar">
        <label className="searchbox"><Search size={18}/><input placeholder="Search your movies..." value={search} onChange={e => {setSearch(e.target.value); setPage(1);}}/></label>
        <select value={status} onChange={e => {setStatus(e.target.value);setPage(1);}}><option value="">All statuses</option><option>To Watch</option><option>Watching</option><option>Watched</option></select>
        <select value={genre} onChange={e => {setGenre(e.target.value);setPage(1);}}><option value="">All genres</option>{genres.map(g => <option key={g}>{g}</option>)}</select>
      </div>
      {movies.length === 0 ? <div className="empty-state"><div className="empty-icon"><Film size={30}/></div><h3>Your next movie night starts here</h3><p>No movies found. Add one to start building your watchlist.</p><button className="primary-btn" onClick={startAdd}><Plus size={17}/> Add your first movie</button></div> :
      <div className="movie-grid">{movies.map(movie => <article className="movie-card" key={movie._id}>
        <div className={`card-art art-${genres.indexOf(movie.genre) % 5}`}><span className="movie-code">{movie.movieCode}</span><div className="art-symbol"><Clapperboard size={34}/></div><span className="art-genre">{movie.genre}</span></div>
        <div className="movie-info"><div className="movie-title-row"><h3>{movie.title}</h3><span className={`status-badge ${statusClass(movie.status)}`}>{movie.status}</span></div>
          <p className="movie-meta">{movie.releaseYear} <span>·</span> <Clock3 size={13}/> {movie.runtime} min <span>·</span> {movie.platform}</p>
          <div className="movie-details"><div className="priority"><span>PRIORITY</span><div className="priority-dots">{[1,2,3,4,5].map(n => <i key={n} className={n <= movie.priority ? "filled" : ""}/>)}</div></div>
            {movie.rating != null && <button className="rating-chip" onClick={() => editRating(movie)} title="Edit rating"><Star size={14} fill="currentColor"/> {movie.rating}/10</button>}
          </div>
          <div className="card-actions">
            {movie.status !== "Watched" && <select aria-label="Change status" className="status-select" value="" onChange={e => {if(e.target.value) changeStatus(movie,e.target.value);}}><option value="" disabled>Change status…</option>{nextStatuses(movie).map(s => <option key={s}>{s}</option>)}</select>}
            <button className="small-icon-btn" onClick={() => startEdit(movie)} title="Edit movie"><Pencil size={16}/></button>
            <button className="small-icon-btn danger" onClick={() => deleteMovie(movie)} disabled={movie.status === "Watching"} title={movie.status === "Watching" ? "Cannot delete while Watching" : "Delete movie"}><Trash2 size={16}/></button>
          </div>
        </div>
      </article>)}</div>}
      <div className="pagination"><span>Page {page} of {pages}</span><div><button disabled={page <= 1} onClick={() => setPage(p => p-1)} aria-label="Previous page"><ChevronLeft size={18}/></button><button disabled={page >= pages} onClick={() => setPage(p => p+1)} aria-label="Next page"><ChevronRight size={18}/></button></div></div>
    </section>

    <footer><span><Clapperboard size={16}/> CineList</span><p>Made for movie lovers, one story at a time.</p></footer>

    {showForm && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setShowForm(false);}}><section className="modal"><div className="modal-heading"><div><span className="eyebrow">{editing ? "UPDATE YOUR COLLECTION" : "ADD TO YOUR COLLECTION"}</span><h2>{editing ? "Edit movie" : "Add a movie"}<span>.</span></h2></div><button className="icon-btn" onClick={() => setShowForm(false)}><X size={20}/></button></div>
      {error && <div className="alert error-alert">{error}</div>}
      <form className="movie-form" onSubmit={saveMovie}>
        <label className="full-field">Movie title<input value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Interstellar" required maxLength={150}/></label>
        <label>Genre<select value={form.genre} onChange={e => setForm({...form,genre:e.target.value})}>{genres.map(g => <option key={g}>{g}</option>)}</select></label>
        <label>Release year<input type="number" min="1950" max={new Date().getFullYear()} value={form.releaseYear} disabled={!!editing} onChange={e => setForm({...form,releaseYear:e.target.value})} required/></label>
        <label>Runtime (minutes)<input type="number" min="30" max="300" value={form.runtime} onChange={e => setForm({...form,runtime:e.target.value})} required/></label>
        <label>Platform<select value={form.platform} onChange={e => setForm({...form,platform:e.target.value})}>{platforms.map(p => <option key={p}>{p}</option>)}</select></label>
        <label className="full-field">Priority <span className="field-hint">1 = low · 5 = highest</span><div className="priority-picker">{[1,2,3,4,5].map(n => <button type="button" key={n} className={Number(form.priority)===n?"selected":""} onClick={() => setForm({...form,priority:n})}>{n}</button>)}</div></label>
        {editing && <p className="form-note full-field">Movie code and release year cannot be changed after creation.</p>}
        <div className="form-actions full-field"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="primary-btn" disabled={loading}>{loading ? "Saving…" : editing ? "Save changes" : "Add movie"}</button></div>
      </form></section></div>}

    {ratingMovie && <div className="modal-backdrop"><section className="modal rating-modal"><div className="modal-heading"><div><span className="eyebrow">ONE LAST THING</span><h2>Rate this movie<span>.</span></h2></div><button className="icon-btn" onClick={() => setRatingMovie(null)}><X size={20}/></button></div><p className="rating-movie-name">{ratingMovie.title}</p><p className="form-note">Choose a rating from 1 to 10 to mark this movie as Watched.</p><form onSubmit={markWatched}><label>Rating <strong>{rating}/10</strong><input className="rating-range" type="range" min="1" max="10" value={rating} onChange={e => setRating(e.target.value)}/></label><div className="form-actions"><button type="button" className="secondary-btn" onClick={() => setRatingMovie(null)}>Cancel</button><button type="submit" className="primary-btn">Save & mark watched</button></div></form></section></div>}
  </main>;
}
