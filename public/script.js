// Function to load events into the Admin Table AND the Summarized Report
let currentParticipants = [];
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return new Date(year, month - 1, day); // Creates LOCAL date (no UTC shift)
}
 // This stores the list so we can filter it instantly
async function loadAdminEvents() {
    try {
        const res = await fetch('/api/events');
        const events = await res.json();
        
        const activeList = document.getElementById('admin-event-list');
        const closedList = document.getElementById('closed-event-list');
        
        if (activeList) activeList.innerHTML = '';
        if (closedList) closedList.innerHTML = '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        events.forEach(ev => {

            // ✅ SAFE LOCAL DATE PARSE
            const dateOnly = ev.event_date.split('T')[0]; 
            const [year, month, day] = dateOnly.split('-');
            const eventDate = new Date(year, month - 1, day);

            const deadline = new Date(eventDate);
            deadline.setDate(deadline.getDate() - 1);

            const isExpired = today > deadline;  // ✅ YOU FORGOT THIS

            const dateStr = `${day}-${month}-${year}`;

            const evJson = JSON.stringify(ev).replace(/'/g, "&apos;");

            const rowHtml = `
                <tr>
                    <td style="font-weight:bold; color:#1a73e8;">#${ev.id}</td> 
                    <td>${ev.name}</td>
                    <td>${ev.venue}</td>
                    <td>${dateStr}</td>
                    <td>${ev.is_paid ? '₹' + ev.amount : 'Free'}</td>
                    <td>
                        <button class="btn-list" onclick="showStudentList(${ev.id})">Participants</button>
                        <button class="btn-edit" onclick='openEditModal(${evJson})'>Edit</button>
                        <button class="btn-delete" onclick="deleteEvent(${ev.id})" style="color:red;">Delete</button>
                    </td>
                </tr>`;

            if (isExpired) {
                closedList.innerHTML += rowHtml;
            } else {
                activeList.innerHTML += rowHtml;
            }
        });

        loadSummaryReport(); 
    } catch (err) {
        console.error("Error loading admin dashboard:", err);
    }
}


// Function to open the modal for a NEW event
function openCreateModal() {
    document.getElementById('modalTitle').innerText = "Create New Event";
    document.getElementById('editEventId').value = ""; // Clear ID for new entry
    
    // Reset all fields
    document.getElementById('evName').value = "";
    document.getElementById('evVenue').value = "";
    document.getElementById('evDate').value = "";
    document.getElementById('evTime').value = "";
    document.getElementById('evSlots').value = "";
    document.getElementById('evType').value = "0";
    document.getElementById('evAmount').value = "0";
    document.getElementById('priceBox').style.display = "none";

    // Show overlay
    document.getElementById('event-modal-overlay').style.display = 'block';
}

// Function to open the modal for EDITING an event
async function openEditModal(ev) {
    // 1. Reset/Set the Modal Headers and ID
    document.getElementById('modalTitle').innerText = "Edit Event Details";
    document.getElementById('editEventId').value = ev.id;

    // 2. Map Basic Text Fields
    document.getElementById('evName').value = ev.name;
    document.getElementById('evVenue').value = ev.venue;
    document.getElementById('evTime').value = ev.event_time;

    // 3. --- THE BULLETPROOF DATE FIX ---
    // We treat the date as a raw string and extract YYYY-MM-DD.
    // This ignores timezones completely, so Sep 21 remains Sep 21.
    if (ev.event_date) {
        const match = ev.event_date.match(/(\d{4}-\d{2}-\d{2})/);
        if (match) {
            document.getElementById('evDate').value = match[0];
        }
    }

    // 4. Map Payment Logic
    document.getElementById('evType').value = ev.is_paid ? "1" : "0";
    document.getElementById('evAmount').value = ev.amount;
    document.getElementById('priceBox').style.display = ev.is_paid ? "block" : "none";

    // 5. --- CAPACITY RE-CALCULATION ---
    // Total Capacity = Current Remaining Slots + Existing Student Registrations
    try {
        const res = await fetch(`/api/registrations/${ev.id}`);
        if (res.ok) {
            const participants = await res.json();
            const alreadyRegisteredCount = participants.length;

            // Display original total capacity instead of remaining slots
            const originalTotal = parseInt(ev.slots) + alreadyRegisteredCount;
            document.getElementById('evSlots').value = originalTotal;
            
            console.log(`Edit Loaded: ${ev.slots} available + ${alreadyRegisteredCount} registered = ${originalTotal} total capacity`);
        } else {
            // Fallback if API fails
            document.getElementById('evSlots').value = ev.slots;
        }
    } catch (err) {
        console.error("Failed to fetch registrations for capacity calculation:", err);
        document.getElementById('evSlots').value = ev.slots; 
    }

    // 6. Reveal the Modal Overlay
    document.getElementById('event-modal-overlay').style.display = 'block';
}

// Function to close the modal
function closeEventModal() {
    document.getElementById('event-modal-overlay').style.display = 'none';
}

// Function to save (Create or Update)
async function saveEvent() {
    const id = document.getElementById('editEventId').value;
    const formData = new FormData();
    
    try {
        const name = document.getElementById('evName').value;
        const slotsInput = document.getElementById('evSlots').value;
        const rawDate = document.getElementById('evDate').value; 

        if (!name || !slotsInput || !rawDate) { 
            alert("Name, Date, and Slots are required!"); 
            return; 
        }

        // --- THE TIMEZONE BUFFER FIX ---
        // We add "12:00:00" to the date string. 
        // If rawDate is "2026-09-21", we send "2026-09-21 12:00:00"
        // This prevents the "Day Before" shift during UTC conversion.
        const safeDate = `${rawDate} 12:00:00`; 

        let newTotalSlots = parseInt(slotsInput);

        if (id) {
            try {
                const regRes = await fetch(`/api/registrations/${id}`);
                const participants = await regRes.json();
                const alreadyRegistered = participants.length;
                newTotalSlots = newTotalSlots - alreadyRegistered;

                if (newTotalSlots < 0) {
                    alert(`Error: ${alreadyRegistered} students registered. Capacity cannot be lower.`);
                    return;
                }
            } catch (err) { console.error(err); }
        }

        formData.append('name', name);
        formData.append('venue', document.getElementById('evVenue').value);
        formData.append('event_date', safeDate); // Using the buffered date
        formData.append('event_time', document.getElementById('evTime').value);
        formData.append('slots', newTotalSlots);
        formData.append('is_paid', document.getElementById('evType').value);
        formData.append('amount', document.getElementById('evAmount').value || 0);
        
        const posterFile = document.getElementById('evPoster').files[0];
        if (posterFile) { formData.append('poster', posterFile); }

        const url = id ? `/api/events/${id}` : '/api/events';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, { method: method, body: formData });

        if (response.ok) {
            alert(id ? "Updated Successfully!" : "Created Successfully!");
            closeEventModal();
            loadAdminEvents();
        }
    } catch (err) {
        alert("System error. Check console.");
    }
}

// Function to delete
async function deleteEvent(id) {
    if (confirm("WARNING: Deleting this event will also delete ALL student registrations associated with it. Do you want to proceed?")) {
        const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadAdminEvents();
        } else {
            alert("Error deleting event.");
        }
    }
}
// --- REPLACE YOUR OLD showStudentList WITH THESE THREE FUNCTIONS ---

async function showStudentList(eventId) {
    try {
        const res = await fetch(`/api/registrations/${eventId}`);
        if (!res.ok) throw new Error("Could not fetch data");
        
        currentParticipants = await res.json(); 
        
        document.querySelector('.student-modal h3').innerText = `Participants for Event #${eventId}`;
        
        // Clear old inputs
        document.getElementById('filterDept').value = '';
        document.getElementById('filterSem').value = '';
        
        // NEW: Force the badge to show the full count immediately
        const countBadge = document.getElementById('filterCount');
        if (countBadge) {
            countBadge.innerText = `Showing: ${currentParticipants.length}`;
        }
        
        renderStudentTable(currentParticipants); 
        document.getElementById('student-list-overlay').style.display = 'block';
    } catch (err) {
        console.error(err);
        alert("Error loading student list.");
    }
}

// Helper function to build the table HTML
function renderStudentTable(students) {
    const container = document.getElementById('student-table-container');
    const countBadge = document.getElementById('filterCount'); // Get the badge element
    
    if (!container) return;

    // UPDATE THE COUNT BADGE
    if (countBadge) {
        countBadge.innerText = `Showing: ${students.length}`;
    }

    if (!students || students.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">No matching participants found.</p>';
        return;
    }

    let html = `
        <table style="width:100%; border-collapse: collapse; text-align: left;">
            <thead style="background: #f8fafc; position: sticky; top: 0; z-index: 10;">
                <tr>
                    <th style="padding:12px; border-bottom:2px solid #e2e8f0;">Student Info</th>
                    <th style="padding:12px; border-bottom:2px solid #e2e8f0;">Dept/Sem</th>
                    <th style="padding:12px; border-bottom:2px solid #e2e8f0;">Token</th>
                </tr>
            </thead>
            <tbody>`;
    
    students.forEach(s => {
        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding:12px;">
                    <strong>${s.student_name}</strong><br>
                    <small style="color:#64748b;">📧 ${s.email}</small><br>
                    <small style="color:#1a73e8;">📞 ${s.mobile}</small>
                </td>
                <td style="padding:12px;">${s.department} (S${s.semester})</td>
                <td style="padding:12px;">
                    <code style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-weight:bold;">${s.token_id}</code>
                </td>
            </tr>`;
    });
    container.innerHTML = html + `</tbody></table>`;
}

// Logic to filter the array without refreshing the page
// 1. Logic to filter the array in real-time
function filterStudents() {
    const deptVal = document.getElementById('filterDept').value.toUpperCase();
    const semVal = document.getElementById('filterSem').value;
    const countBadge = document.getElementById('filterCount');

    // Filter the global array
    const filtered = currentParticipants.filter(s => {
        const matchesDept = (s.department || "").toUpperCase().includes(deptVal);
        const matchesSem = semVal === "" || s.semester.toString() === semVal;
        return matchesDept && matchesSem;
    });

    // UPDATE THE COUNT IMMEDIATELY
    if (countBadge) {
        countBadge.innerText = `Showing: ${filtered.length}`;
    }

    // Now draw the table with that filtered list
    renderStudentTable(filtered);
}

// 2. Fix for the Reset Button
function resetFilters() {
    console.log("Resetting filters...");
    // Clear the text boxes
    document.getElementById('filterDept').value = '';
    document.getElementById('filterSem').value = '';
    
    // Show the full original list again
    renderStudentTable(currentParticipants);
}

function closeStudentModal() {
    document.getElementById('student-list-overlay').style.display = 'none';
}
// Function to load events into the grid
// Inside script.js
async function loadStudentEvents() {
    try {
        const res = await fetch('/api/events');
        const events = await res.json();
        const grid = document.getElementById('event-grid');
        
        if (!grid) return; 
        grid.innerHTML = ''; 

        if (events.length === 0) {
            grid.innerHTML = '<p style="text-align:center; width:100%;">No events are currently scheduled.</p>';
            return;
        }

      // Inside your loadStudentEvents loop...
events.forEach(ev => {
    const posterImg = ev.poster ? `/uploads/${ev.poster}` : 'default-poster.jpg';
    const evJson = JSON.stringify(ev).replace(/'/g, "&apos;");
    
    // --- ✅ CONSISTENT LOCAL DATE LOGIC ---
    const dateOnly = ev.event_date.split('T')[0]; 
    const [year, month, day] = dateOnly.split('-');
    const eventDate = new Date(year, month - 1, day);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(eventDate);
    deadline.setDate(deadline.getDate() - 1); 

    const isFull = ev.slots <= 0; 
    const isExpired = today > deadline; 
    // ---------------------------------------

    let statusText = '';
    let btnHtml = '';

    if (isExpired) {
        statusText = '<span style="color:orange;">(Registration Closed)</span>';
        btnHtml = `<button class="btn-primary" disabled style="background: #666; cursor: not-allowed; width: 100%; margin-top: 15px;">Deadline Passed</button>`;
    } else if (isFull) {
        statusText = '<span style="color:red;">(Sold Out)</span>';
        btnHtml = `<button class="btn-primary" disabled style="background: #ccc; cursor: not-allowed; width: 100%; margin-top: 15px;">Sold Out</button>`;
    } else {
        btnHtml = `<button class="btn-primary" onclick='openRegModal(${evJson})' style="width: 100%; margin-top: 15px;">Register Now</button>`;
    }

    const displayDate = `${day}-${month}-${year}`; // Nice clean DD-MM-YYYY format

    grid.innerHTML += `
        <div class="event-card" style="${(isFull || isExpired) ? 'opacity: 0.7;' : ''}">
            <img src="${posterImg}" alt="Poster" style="width:100%; height:150px; object-fit:cover; border-radius:8px; margin-bottom:10px;">
            <small>Event ID: #${ev.id}</small>
            <h3>${ev.name} ${statusText}</h3>
            <p>📍 ${ev.venue}</p>
            <p>📅 Event Date: ${displayDate}</p>
            <p style="font-weight:bold; color: ${isExpired ? '#666' : (isFull ? 'red' : 'green')};">
                ${isExpired ? 'Registration ended' : '🎟️ Slots Left: ' + ev.slots}
            </p>
            <div style="font-weight:bold; color:#2c3e50; margin-top:10px;">
                ${ev.is_paid ? 'Amount: ₹' + ev.amount : 'FREE'}
            </div>
            ${btnHtml}
        </div>
    `;
});
    } catch (err) {
        console.error("Failed to load events:", err);
    }
}

// Function to open the centered registration popup
function openRegModal(ev) {
    document.getElementById('regEventId').value = ev.id;
    document.getElementById('targetEventName').innerText = ev.name;
    
    // Handle paid info display
    const paidInfo = document.getElementById('paidInfo');
    if (ev.is_paid) {
        paidInfo.style.display = 'block';
        document.getElementById('eventPrice').innerText = '₹' + ev.amount;
    } else {
        paidInfo.style.display = 'none';
    }
    
    // Show the overlay
    document.getElementById('reg-modal-overlay').style.display = 'block';
}

// Function to close the registration popup
function closeRegModal() {
    document.getElementById('reg-modal-overlay').style.display = 'none';
    // Clear all inputs
    document.getElementById('studentName').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('studentMobile').value = '';
}

// Function to handle registration and give Token ID
async function submitRegistration() {
    const eventId = document.getElementById('regEventId').value;
    const emailInput = document.getElementById('studentEmail').value.trim().toLowerCase();

    const data = {
        event_id: eventId,
        student_name: document.getElementById('studentName').value,
        department: document.getElementById('studentDept').value,
        semester: document.getElementById('studentSem').value,
        email: emailInput,
        mobile: document.getElementById('studentMobile').value
    };

    // 1. Basic Validation
    if (!data.student_name || !data.email || !data.mobile) {
        alert("Please fill in all the details.");
        return;
    }

    try {
        // --- DUPLICATE CHECK LOGIC ---
        // Fetch existing participants for this specific event
        const checkRes = await fetch(`/api/registrations/${eventId}`);
        const existingParticipants = await checkRes.json();

        // Check if any participant already has this email
        const isDuplicate = existingParticipants.some(p => p.email.toLowerCase() === emailInput);

        if (isDuplicate) {
            alert("This email is already registered for this event. Duplicate entries are not allowed!");
            return; // Stop the function here
        }
        // -----------------------------

        // 2. If not a duplicate, proceed with registration
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            const result = await res.json();
            alert(`Registration Successful!\n\nYOUR TOKEN ID: ${result.tokenId}\nPlease save this for the event.`);
            
            closeRegModal();
            loadStudentEvents(); // Refresh slots on the grid
        } else {
            alert("Server error during registration.");
        }
    } catch (err) {
        console.error("Registration failed:", err);
        alert("Server error. Please try again.");
    }
}
// Function to load the summarized report using Aggregates and Views
async function loadSummaryReport() {
    try {
        const response = await fetch('/api/reports/summary');
        const data = await response.json();
        const container = document.getElementById('summary-report-container');

        let html = `
            <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
                <tr style="background: #f8fafc; text-align: left; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px;">Event Name</th>
                    <th style="padding: 12px;">Total Participants </th>
                    <th style="padding: 12px;">Revenue </th>
                    <th style="padding: 12px;">Remaining Slots</th>
                </tr>`;

        data.forEach(row => {
            html += `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-weight: 600;">${row.event_name}</td>
                    <td style="padding: 12px;">${row.total_registrations}</td>
                    <td style="padding: 12px;">₹${row.total_revenue}</td>
                    <td style="padding: 12px;">${row.remaining_slots}</td>
                </tr>`;
        });
        html += `</table>`;
        container.innerHTML = html;
    } catch (err) {
        console.error("Failed to load DBMS report view:", err);
    }
}



