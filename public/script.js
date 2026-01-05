// --- STUDENT VIEW ---
async function loadStudentEvents() {
    const res = await fetch('/api/events');
    const events = await res.json();

    const grid = document.getElementById('eventGrid');
    
    // Check if there are events
    if (events.length === 0) {
        grid.innerHTML = "<p>No upcoming events at the moment.</p>";
        return;
    }

    grid.innerHTML = events.map(e => {
        const formattedDate = new Date(e.event_date).toDateString(); 

        return `
            <div class="event-card">
                <h4>${e.title}</h4>
                <p><strong>📍 Venue:</strong> ${e.venue}</p>
                <p><strong>📅 Date:</strong> ${formattedDate}</p>
                <button onclick="registerStudent(${e.id})">Register Now</button>
            </div>
        `;
    }).join('');
}

// --- ADMIN VIEW ---
async function loadAdminView() {
    const response = await fetch('/api/admin/registrations');
    const data = await response.json();
    const tbody = document.querySelector('#adminTable tbody');
    
    tbody.innerHTML = data.map(row => `
        <tr>
            <td style="font-weight:bold; color:#764ba2;">${row.token || 'N/A'}</td>
            <td>${row.event_name}</td>
            <td>${row.student_name}</td>
            <td>${row.student_email}</td>
        </tr>
    `).join('');
}

// --- REGISTRATION LOGIC ---
async function registerStudent(eventId) {
    const name = prompt("Enter Your Full Name:");
    const email = prompt("Enter Your Email:");
    
    if(!name || !email) return;

    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ event_id: eventId, name, email })
        });

        const data = await res.json();

        if(res.ok) {
            // This is where the student finally sees their ID
            alert(
                `🎉 REGISTRATION SUCCESSFUL! 🎉\n\n` +
                `Student: ${name}\n` +
                `Token ID: ${data.token}\n\n` +
                `Thank you, ${name}. A confirmation email containing your Token ID (${data.token}) has been sent to ${email}.\n\n` +
            `See you at the event!`
            );
            
            // Refresh the grid to show updated registration counts (if you added them)
            loadStudentEvents();
        } else {
            alert("Registration failed: " + data.error);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("Connection error. Please try again.");
    }
}

// --- LOGIN LOGIC ---
function handleLogin() {
    const role = document.getElementById('roleSelect').value;
    const adminPassword = "admin123"; // You can change this to whatever you like

    if (role === 'admin') {
        const passInput = prompt("Enter Admin Password:");
        
        if (passInput !== adminPassword) {
            alert("Incorrect password! Access denied.");
            return; // Stops the function here so they don't get in
        }
    }

    // If student OR admin with correct password, proceed:
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');

    // Update the User Badge at the top
    const badge = document.getElementById('userBadge');
    badge.innerText = role === 'admin' ? "Logged in as: Admin" : "Logged in as: Student";

    if (role === 'admin') {
        document.getElementById('admin-ui').classList.remove('hidden');
        document.getElementById('student-ui').classList.add('hidden');
        loadAdminView();
        loadAdminEvents();
    } else {
        document.getElementById('student-ui').classList.remove('hidden');
        document.getElementById('admin-ui').classList.add('hidden');
        loadStudentEvents();
    }
}

// --- EVENT CREATION (The Admin Form) ---
document.getElementById('eventForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 

    // These IDs must match your <input id="..."> exactly
    const title = document.getElementById('title').value;
    const venue = document.getElementById('venue').value;
    const event_date = document.getElementById('eventDate').value; 

    const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, venue, event_date }) 
    });

    if (res.ok) {
        alert('Event posted successfully!');
        
        // 1. Clear the form fields
        document.getElementById('eventForm').reset();
        
        // 2. REFRESH the lists immediately without reloading the page
        loadAdminEvents(); // Updates the Edit/Delete list
        loadAdminView();   // Updates the Registration table
    } else {
        alert('Error: Could not save event.');
    }
});
function handleLogout() {
    // Hide the app and show the login page
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-page').classList.remove('hidden');
    
    // Reset the selection for the next login
    document.getElementById('roleSelect').selectedIndex = 0;
}

// Show events with Edit/Delete options
async function loadAdminEvents() {
    const res = await fetch('/api/events');
    const events = await res.json();
    const list = document.getElementById('adminEventList');

    list.innerHTML = events.map(e => `
        <div class="admin-event-item" style="border-bottom: 1px solid #eee; padding: 10px; display: flex; justify-content: space-between;">
            <div>
                <strong>${e.title}</strong> - ${e.venue} (${new Date(e.event_date).toLocaleDateString()})
            </div>
            <div>
                <button onclick="editEvent(${e.id}, '${e.venue}', '${e.event_date}')" style="background: #ffa500; color: white; border: none; padding: 5px; border-radius: 4px; cursor: pointer;">Edit</button>
                <button onclick="deleteEvent(${e.id})" style="background: #ff4757; color: white; border: none; padding: 5px; border-radius: 4px; cursor: pointer;">Delete</button>
            </div>
        </div>
    `).join('');
}

// DELETE function
async function deleteEvent(id) {
    if (!confirm("Delete this event? All student registrations for it will be lost.")) return;

    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
    if (res.ok) {
        loadAdminEvents(); // Refresh event list
        loadAdminView();   // Refresh registration table (it will now be empty for this event)
    }
}

// EDIT function
async function editEvent(id, oldVenue, oldDate) {
    const newVenue = prompt("Edit Venue:", oldVenue);
    const newDate = prompt("Edit Date (YYYY-MM-DD):", oldDate.split('T')[0]);

    if (newVenue && newDate) {
        const res = await fetch(`/api/events/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ venue: newVenue, event_date: newDate })
        });

        if (res.ok) {
            loadAdminEvents(); // Refresh event list
            loadAdminView();   // Refresh registration table to show new details
        }
    }
}