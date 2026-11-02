
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_SCRIPT_URL = " https://script.google.com/macros/s/AKfycbxEjWk13UehoiSsjw3JhJE0XqZJ6vv4_PsHxjstR8rAxsccg0T9EwF_yZaK_Nggejg3Aw/exec";

const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "complaints.json");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]");
}

if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.error("Please configure ADMIN_PASSWORD and SESSION_SECRET in .env");
  process.exit(1);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));

app.use(express.json({ limit: "20kb" }));

app.use(session({
  name: "vijrumbhana.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 60 * 1000
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function readComplaints() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveComplaints(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) {
    return res.status(401).json({ error: "Please log in first." });
  }
  next();
}

async function sendWhatsAppNotification(complaint) {
  const {
    WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_ADMIN_NUMBER,
    WHATSAPP_TEMPLATE_NAME,
    WHATSAPP_API_VERSION
  } = process.env;

  if (
    !WHATSAPP_TOKEN ||
    !WHATSAPP_PHONE_NUMBER_ID ||
    !WHATSAPP_ADMIN_NUMBER ||
    !WHATSAPP_TEMPLATE_NAME
  ) {
    console.log("WhatsApp is not configured yet.");
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${WHATSAPP_API_VERSION || "v23.0"}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: WHATSAPP_ADMIN_NUMBER,
        type: "template",
        template: {
          name: WHATSAPP_TEMPLATE_NAME,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US" },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: complaint.studentName },
              { type: "text", text: complaint.className },
              { type: "text", text: complaint.rollNumber },
              { type: "text", text: complaint.section },
              { type: "text", text: complaint.details }
            ]
          }]
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
}

app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

app.post("/api/complaints", async (req, res) => {
  const {
    studentName,
    className,
    rollNumber,
    details,
    phone,
    section
  } = req.body || {};

  const fields = [studentName, className, rollNumber, details, phone, section];

  if (fields.some(value => typeof value !== "string" || !value.trim())) {
    return res.status(400).json({ error: "Please complete all fields." });
  }

  if (fields.some(value => value.length > 2000)) {
    return res.status(400).json({ error: "One or more fields are too long." });
  }

  const complaint = {
    id: Date.now().toString(),
    studentName: studentName.trim(),
    className: className.trim(),
    rollNumber: rollNumber.trim(),
    details: details.trim(),
    phone: phone.trim(),
    section: section.trim(),
    status: "Pending",
    createdAt: new Date().toISOString()
  };

  try {
    const complaints = readComplaints();

    complaints.unshift(complaint);
    saveComplaints(complaints);

    let whatsappSent = false;

    try {
      await sendWhatsAppNotification(complaint);
      whatsappSent = Boolean(process.env.WHATSAPP_TOKEN);
    } catch (error) {
      console.error("WhatsApp notification failed:", error.message);
    }

    res.status(201).json({
      message: "Your complaint has been submitted.",
      whatsappSent
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save your complaint." });
  }
});

app.post("/api/admin/login", async (req, res) => {
  const password = req.body?.password;

  if (typeof password !== "string") {
    return res.status(400).json({ error: "Enter your password." });
  }

  const valid = await bcrypt.compare(
    password,
    await bcrypt.hash(process.env.ADMIN_PASSWORD, 10)
  );

  if (!valid) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  req.session.regenerate(error => {
    if (error) {
      return res.status(500).json({ error: "Login failed." });
    }

    req.session.isAdmin = true;
    res.json({ message: "Login successful." });
  });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("vijrumbhana.sid");
    res.json({ message: "Logged out." });
  });
});

app.get("/api/admin/complaints", requireAdmin, (req, res) => {
  res.json(readComplaints());
});

app.patch("/api/admin/complaints/:id", requireAdmin, (req, res) => {
  const allowed = ["Pending", "In Progress", "Resolved"];
  const { status } = req.body || {};

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const complaints = readComplaints();
  const complaint = complaints.find(item => item.id === req.params.id);

  if (!complaint) {
    return res.status(404).json({ error: "Complaint not found." });
  }

  complaint.status = status;
  saveComplaints(complaints);

  res.json({ message: "Status updated." });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Team Vijrumbhana portal running at http://localhost:${PORT}`);
});
