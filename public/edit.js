const API = "/api/countries";

const params = new URLSearchParams(window.location.search);
const id = params.get("id");

const editForm = document.getElementById("editForm");

async function loadCountry() {
    if (!id) {
        alert("Country ID is missing.");
        window.location.href = "index.html";
        return;
    }

    try {
        // Fetch specific country directly from the endpoint instead of fetching all
        const response = await fetch(`${API}/${encodeURIComponent(id)}`);

        if (!response.ok) {
            alert("Country not found.");
            window.location.href = "index.html";
            return;
        }

        const country = await response.json();

        document.getElementById("country").value = country.country || "";
        document.getElementById("capital").value = country.capital || "";
        document.getElementById("notes").value = country.notes || "";

    } catch (error) {
        console.error("Error loading country:", error);
        alert("Unable to load country.");
    }
}

if (editForm) {
    editForm.addEventListener("submit", async event => {
        event.preventDefault();

        const country = document.getElementById("country").value.trim();
        const capital = document.getElementById("capital").value.trim();
        const notes = document.getElementById("notes").value.trim();

        if (!country || !capital) {
            alert("Please fill in country and capital.");
            return;
        }

        try {
            const response = await fetch(
                `${API}/${encodeURIComponent(id)}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        country,
                        capital,
                        notes
                    })
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Unable to update country.");
            }

            alert("Destination updated successfully!");
            window.location.href = "index.html";

        } catch (error) {
            alert(error.message);
        }
    });
}

loadCountry();