const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(express.static('public'));
app.use(bodyParser.json());

// --- 1. CONFIGURE MULTER FIRST ---
const storage = multer.diskStorage({
    destination: 'public/uploads/', 
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// --- 2. MYSQL CONNECTION ---
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root', 
    password: '123', 
    database: 'college_events'
});

db.connect(err => {
    if (err) throw err;
    console.log("Connected to MySQL Database");
});

// --- 3. EVENT ROUTES ---

// GET ALL
app.get('/api/events', (req, res) => {
    db.query('SELECT * FROM events', (err, results) => {
        if (err) res.status(500).send(err);
        else res.json(results);
    });
});

// CREATE NEW (Handles Poster)
app.post('/api/events', upload.single('poster'), (req, res) => {
    const { name, venue, event_date, event_time, slots, is_paid, amount } = req.body;
    const posterPath = req.file ? req.file.filename : null; 

    const sql = `INSERT INTO events (name, venue, event_date, event_time, slots, is_paid, amount, poster) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [name, venue, event_date, event_time, slots, is_paid, amount, posterPath], (err) => {
        if (err) {
            console.error("Database Insert Error:", err);
            return res.status(500).send(err);
        }
        res.sendStatus(200);
    });
});

// UPDATE EVENT
app.put('/api/events/:id', upload.single('poster'), (req, res) => {
    const { name, venue, event_date, event_time, slots, is_paid, amount } = req.body;
    const eventId = req.params.id;
    
    let sql, params;
    if (req.file) {
        sql = `UPDATE events SET name=?, venue=?, event_date=?, event_time=?, slots=?, is_paid=?, amount=?, poster=? WHERE id=?`;
        params = [name, venue, event_date, event_time, slots, is_paid, amount, req.file.filename, eventId];
    } else {
        sql = `UPDATE events SET name=?, venue=?, event_date=?, event_time=?, slots=?, is_paid=?, amount=? WHERE id=?`;
        params = [name, venue, event_date, event_time, slots, is_paid, amount, eventId];
    }

    db.query(sql, params, (err) => {
        if (err) res.status(500).send(err);
        else res.sendStatus(200);
    });
});

// DELETE EVENT
app.delete('/api/events/:id', (req, res) => {
    db.query('DELETE FROM events WHERE id = ?', [req.params.id], (err) => {
        if (err) res.status(500).send(err);
        else res.sendStatus(200);
    });
});

// --- 4. REGISTRATION ROUTES ---

app.post('/api/register', (req, res) => {
    const { event_id, student_name, department, semester, email, mobile } = req.body;
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const tokenId = `TKN-${event_id}-${randomNum}`; 

    const sql = `INSERT INTO registrations (event_id, student_name, department, semester, email, mobile, token_id) 
                 VALUES (?,?,?,?,?,?,?)`;
                 
    db.query(sql, [event_id, student_name, department, semester, email, mobile, tokenId], (err) => {
        if (err) return res.status(500).send(err);
        res.json({ tokenId });
    });
});

app.get('/api/registrations/:eventId', (req, res) => {
    const sql = `SELECT student_name, department, semester, email, mobile, token_id 
                 FROM registrations WHERE event_id = ?`;
    db.query(sql, [req.params.eventId], (err, results) => {
        if (err) res.status(500).send(err);
        else res.json(results);
    });
});
// GET Summarized Report from View (JOINs & Aggregates)
app.get('/api/reports/summary', (req, res) => {
    const sql = `SELECT * FROM event_summary_report`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).send(err);
        res.json(results);
    });
});

app.listen(3000, () => console.log('Server running at http://localhost:3000'));
