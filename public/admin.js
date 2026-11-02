
const loginForm = document.getElementById("loginForm");
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginMessage = document.getElementById("loginMessage");
const dashboardMessage = document.getElementById("dashboardMessage");
const complaintsList = document.getElementById("complaintsList");

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }

  return data;
}
function showDashboard() {
  loginSection.hidden = true;
  dashboardSection.hidden = false;
  loadComplaints();
}

async function loadComplaints() {
  complaintsList.textContent = "Loading complaints...";
  dashboardMessage.textContent = "";

  try {
    const complaints = await api("/api/admin/complaints");
    complaintsList.replaceChildren();

    if (complaints.length === 0) {
      complaintsList.textContent = "No complaints submitted yet.";
      return;
    }

    complaints.forEach(complaint => {
      const card = document.createElement("article");
      card.className = "form-card";
      card.style.marginTop = "20px";

      const heading = document.createElement("h3");
      heading.textContent = complaint.studentName;

      const details = document.createElement("p");
      details.textContent =
        `Class: ${complaint.className} | Section: ${complaint.section}`;

      const roll = document.createElement("p");
      roll.textContent = `Roll Number: ${complaint.rollNumber}`;

      const phone = document.createElement("p");
      phone.textContent = `Phone: ${complaint.phone}`;

      const description = document.createElement("p");
      description.textContent = `Complaint: ${complaint.details}`;

      const date = document.createElement("p");
      date.textContent = `Submitted: ${new Date(complaint.createdAt).toLocaleString()}`;

      const statusLabel = document.createElement("label");
      statusLabel.textContent = "Complaint Status";

      const status = document.createElement("select");

      ["Pending", "In Progress", "Resolved"].forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        status.appendChild(option);
      });

      status.value = complaint.status;

      const updateButton = document.createElement("button");
      updateButton.textContent = "Update Status";

      updateButton.addEventListener("click", async () => {
        try {
          await api(`/api/admin/complaints/${encodeURIComponent(complaint.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: status.value })
          });

          dashboardMessage.textContent = "Status updated successfully.";
          await loadComplaints();
        } catch (error) {
          dashboardMessage.textContent = error.message;
        }
      });

      card.append(
        heading, details, roll, phone, description, date,
        statusLabel, status, updateButton
      );

      complaintsList.appendChild(card);
    });

  } catch (error) {
    complaintsList.textContent = "";
    dashboardMessage.textContent = error.message;
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  loginMessage.textContent = "Checking password...";

  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        password: document.getElementById("password").value
      })
    });

    document.getElementById("password").value = "";
    showDashboard();

  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

document.getElementById("refreshButton").addEventListener("click", loadComplaints);

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await api("/api/admin/logout", { method: "POST" });
    dashboardSection.hidden = true;
    loginSection.hidden = false;
    complaintsList.replaceChildren();
    loginMessage.textContent = "You have logged out.";
  } catch (error) {
    dashboardMessage.textContent = error.message;
  }
});

(async () => {
  try {
    await api("/api/admin/complaints");
    showDashboard();
  } catch {
    // Admin needs to log in.
  }
})();
