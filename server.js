const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static('public')); // Serves your frontend files

// DB CONNECTION
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '123', // Add your MySQL password here
    database: 'campus_db'
});

db.connect(err => {
    if (err) throw err;
    console.log("Database connected successfully!");
});

// --- ADMIN ROUTES ---

// Create Event
app.post('/api/events', (req, res) => {
    const { title, venue, event_date } = req.body; // Ensure event_date is here
    const q = "INSERT INTO events (title, venue, event_date) VALUES (?, ?, ?)";
    db.query(q, [title, venue, event_date], (err, result) => {
        if (err) return res.status(500).json(err);
        res.status(200).json({ message: "Event Created" });
    });
});

// Get Master List (The SQL JOIN)
app.get('/api/admin/registrations', (req, res) => {
    // We must explicitly ask for r.token
    const q = `
        SELECT r.id, e.title AS event_name, r.student_name, r.student_email, r.token 
        FROM registrations r 
        JOIN events e ON r.event_id = e.id
    `;
    db.query(q, (err, data) => {
        if (err) return res.status(500).json(err);
        res.json(data);
    });
});

// --- STUDENT ROUTES ---

// Get all events for display
app.get('/api/events', (req, res) => {
    db.query("SELECT * FROM events", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// Register for an event
app.post('/api/register', (req, res) => {
    const { event_id, name, email } = req.body;
    
    // 1. Generate a temporary random string or use a timestamp
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const generatedToken = `CC-${randomNum}`; // e.g., CC-4829

    // 2. Insert all 4 pieces of data into the table
    const q = "INSERT INTO registrations (event_id, student_name, student_email, token) VALUES (?, ?, ?, ?)";
    
    db.query(q, [event_id, name, email, generatedToken], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        
        // 3. Send the token back so the student can see it
        res.json({ 
            message: "Registration Successful", 
            token: generatedToken 
        });
    });
});

// DELETE: Removes event (and registrations via Cascade)
app.delete('/api/events/:id', (req, res) => {
    db.query("DELETE FROM events WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Event and associated registrations deleted." });
    });
});

// EDIT: Updates venue and date
app.put('/api/events/:id', (req, res) => {
    const { venue, event_date } = req.body;
    const q = "UPDATE events SET venue = ?, event_date = ? WHERE id = ?";
    
    db.query(q, [venue, event_date, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "Event details updated." });
    });
});

app.listen(3000, '127.0.0.1', () => console.log("Server running at http://127.0.0.1:3000"));

