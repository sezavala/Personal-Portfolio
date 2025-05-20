import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import session from "express-session";

dotenv.config();

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60,
    },
  })
);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_DATABASE,
  connectionLimit: 10,
  waitForConnections: true,
});
const conn = await pool.getConnection();

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.userAuthenticated || false;
  next();
});

// Routes
app.get("/", (req, res) => {
  res.render("home");
});

app.get("/admin/logout", isAuthenticated, (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

app.get("/admin/login", (req, res) => {
  res.render("login");
});

app.post("/admin/login", async (req, res) => {
  let email = req.body.email.toLowerCase();
  let password = req.body.password;

  let sql = `SELECT * FROM admin WHERE email = ?`;
  const [rows] = await conn.query(sql, [email]);
  if (rows.length === 0) {
    return res.render("login", { error: "Wrong credentials!" });
  }

  const hashedPassword = rows[0].password;
  const match = await bcrypt.compare(password, hashedPassword);

  if (match) {
    req.session.userAuthenticated = true;
    req.session.adminId = rows[0].adminId;
    res.redirect("/blog");
  } else {
    res.render("login", { error: "Wrong credentials!" });
  }
});

app.get("/about", (req, res) => {
  res.render("about");
});

app.get("/cv", (req, res) => {
  res.render("cv");
});

app.get("/research", (req, res) => {
  res.render("research");
});

app.get("/experience", (req, res) => {
  res.render("experience");
});

app.get("/project", (req, res) => {
  res.render("project");
});

app.get("/blog", async (req, res) => {
  let sql = `SELECT * FROM playlist NATURAL JOIN admin ORDER BY createdAt DESC`;
  const [playlists] = await conn.query(sql);
  res.render("blog", { playlists });
});

app.get("/deletePlaylist", isAuthenticated, async (req, res) => {
  try {
    const playlistId = req.query.playlistId;

    if (!playlistId) {
      return res.status(400).send("Playlist ID is required");
    }

    const sql = `DELETE FROM playlist WHERE playlistId = ?`;
    await conn.query(sql, [playlistId]);

    res.redirect("/blog");
  } catch (error) {
    console.error("Error in /deletePlaylist route:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/addPlaylist", isAuthenticated, async (req, res) => {
  res.render("addPlaylist");
});

app.post("/addPlaylist", isAuthenticated, async (req, res) => {
  try {
    const title = req.body.title;
    const description = req.body.description;
    const adminId = req.session.adminId;
    if (title.length < 3) {
      return res.render("addPlaylist", { error: "Title too short" });
    } else if (description.length < 10) {
      return res.render("addPlaylist", { error: "Description too short" });
    }
    const curr = new Date();
    let sql = `INSERT INTO playlist (title, description, createdAt, adminId) VALUES (?,?,?,?)`;
    let sqlParam = [title, description, curr, adminId];
    await conn.query(sql, sqlParam);
    res.redirect("/blog");
  } catch (error) {
    console.error("Error in /addPlaylist route:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Start server
app.listen(3000, () => {
  console.log("server started");
});

function isAuthenticated(req, res, next) {
  if (req.session.userAuthenticated) {
    next();
  } else {
    res.redirect("/");
  }
}
