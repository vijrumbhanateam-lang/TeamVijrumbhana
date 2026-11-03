
const form = document.getElementById("complaintForm");
const message = document.getElementById("formMessage");
const button = document.getElementById("submitButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  message.textContent = "";
  button.disabled = true;
  button.textContent = "Submitting...";

  const formData = new FormData(form);
const complaint = {
    studentName: formData.get("studentName").trim(),
    institutionType: formData.get("institutionType").trim(),
    institutionName: formData.get("institutionName").trim(),
    className: formData.get("className").trim(),
    section: formData.get("section").trim(),
    rollNumber: formData.get("rollNumber").trim(),
    phone: formData.get("phone").trim(),
    details: formData.get("details").trim()
  };
  

  try {
    const response = await fetch("/api/complaints", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(complaint)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Submission failed.");
    }

    message.textContent = "Your complaint was submitted successfully!";
    message.style.color = "green";
    form.reset();

  } catch (error) {
    message.textContent = error.message || "Unable to submit. Please try again.";
    message.style.color = "red";

  } finally {
    button.disabled = false;
    button.textContent = "Submit Complaint";
  }
});
