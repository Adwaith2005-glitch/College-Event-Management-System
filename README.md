1. Clone the repository
Bash
git clone https://github.com/your-username/college-event-management.git
cd college-event-management


2. Install Dependencies
Bash
npm install


3. Start the Server
Bash
# Run with standard Node
node server.js

# Or run with Nodemon (if installed) for auto-restarts
npm run dev




🗄️ Database Schema & SQL Queries
Ensure you have MySQL installed. Run the following queries in your MySQL Workbench or CLI to set up the environment.

1. Database Initialization
SQL
CREATE DATABASE college_events;
USE college_events;


2. Table Creation (with Constraints)
SQL
-- Events Table
CREATE TABLE events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    slots INT CHECK (slots >= 0),
    is_paid TINYINT(1) DEFAULT 0,
    amount DECIMAL(10, 2) DEFAULT 0.00,
    poster VARCHAR(255)
);

-- Registrations Table
CREATE TABLE registrations (
    reg_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT,
    student_name VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    semester INT,
    email VARCHAR(255) UNIQUE,
    mobile VARCHAR(15),
    token_id VARCHAR(50) UNIQUE,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);


3. Database Automation (Trigger)
This trigger automatically reduces the available slots whenever a new registration is added.

SQL
DELIMITER //
CREATE TRIGGER update_slots_after_registration
AFTER INSERT ON registrations
FOR EACH ROW
BEGIN
    UPDATE events 
    SET slots = slots - 1 
    WHERE id = NEW.event_id;
END //
DELIMITER ;


4. Administrative View (Reporting)
A virtual table to aggregate registration counts and total revenue per event.

SQL
CREATE VIEW event_summary_report AS
SELECT 
    e.id AS event_id,
    e.name AS event_name,
    COUNT(r.reg_id) AS total_registrations,
    e.slots AS remaining_slots,
    (COUNT(r.reg_id) * e.amount) AS total_revenue
FROM events e
LEFT JOIN registrations r ON e.id = r.event_id
GROUP BY e.id;
