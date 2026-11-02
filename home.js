const form = document.getElementById("complaintForm");
const message = document.getElementById("formMessage");
const button = document.getElementById("submitButton");

const GOOGLE_SCRIPT_URL = "  https://script.google.com/macros/s/AKfycbxEjWk13UehoiSsjw3JhJE0XqZJ6vv4_PsHxjstR8rAxsccg0T9EwF_yZaK_Nggejg3Aw/exec";

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "";
  button.disabled = true;
  button.textContent = "Submitting...";

  const formData = new FormData(form);

  const complaint = {
    studentName: formData.get("studentName").trim(),
    class: formData.get("className").trim(),
    section: formData.get("section").trim(),
    rollNumber: formData.get("rollNumber").trim(),
    phoneNumber: formData.get("phone").trim(),
    complaintDetails: formData.get("details").trim()
  };

  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(complaint)
    });

    message.textContent = "Complaint submitted. Check Google Sheets.";
    message.style.color = "green";
    form.reset();

  } catch (error) {
    message.textContent = "Unable to submit. Please try again.";
    message.style.color = "red";

  } finally {
    button.disabled = false;
    button.textContent = "Submit Complaint";
  }
});