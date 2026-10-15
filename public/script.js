
const countryForm = document.getElementById("countryForm");
const searchForm = document.getElementById("searchForm");
const searchResults = document.getElementById("searchResults");
const countryList = document.getElementById("countryList");

async function loadCountries() {
    try {
        const response = await fetch("/api/countries");
        const countries = await response.json();

        countryList.innerHTML = "";

        if (!countries.length) {
            countryList.innerHTML =
                '<p class="empty-message">Your adventures will appear here.</p>';
            return;
        }

        countries.forEach(country => {
            const card = document.createElement("article");
            card.className = "country-card";

            const title = document.createElement("h3");
            title.textContent = "🌍 " + country.country;

            const capital = document.createElement("p");
            capital.textContent = "Capital: " + country.capital;

            const notes = document.createElement("p");
            notes.textContent = "Travel dreams: " + (country.notes || "None");

            const edit = document.createElement("button");
            edit.textContent = "Edit";
            edit.onclick = () => {
                window.location.href = `/edit.html?id=${encodeURIComponent(country.id)}`;
            };

            const del = document.createElement("button");
            del.textContent = "Delete";
            del.className = "delete";
            del.onclick = async () => {
                if (confirm(`Delete ${country.country}?`)) {
                    await fetch(`/api/countries/${encodeURIComponent(country.id)}`, {
                        method: "DELETE"
                    });
                    loadCountries();
                }
            };

            card.append(title, capital, notes, edit, del);
            countryList.appendChild(card);
        });
    } catch (error) {
        countryList.textContent = "Could not load destinations. Check your server.";
    }
}

countryForm.addEventListener("submit", async event => {
    event.preventDefault();

    const country = document.getElementById("country").value.trim();
    const capital = document.getElementById("capital").value.trim();
    const notes = document.getElementById("notes").value.trim();

    try {
        const response = await fetch("/api/countries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ country, capital, notes })
        });

        if (!response.ok) {
            throw new Error("Could not save destination.");
        }

        countryForm.reset();
        await loadCountries();
        alert("Destination added!");
    } catch (error) {
        alert(error.message);
    }
});

// Save a searched country straight into the bucket list
async function addSearchedCountry(data, button) {
    button.disabled = true;
    button.textContent = "Adding...";

    try {
        // Don't add the same country twice
        const listResponse = await fetch("/api/countries");
        const existing = await listResponse.json();
        const already = existing.some(
            c => String(c.country).trim().toLowerCase() === data.name.trim().toLowerCase()
        );

        if (already) {
            button.textContent = "Already in your list";
            return;
        }

        const hasCapital = data.capital && data.capital !== "N/A";

        const response = await fetch("/api/countries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                country: data.name,
                capital: hasCapital ? data.capital : "Unknown",
                notes: "",
                flag: data.flag || "",
                region: data.region && data.region !== "N/A" ? data.region : ""
            })
        });

        if (!response.ok) {
            throw new Error("Could not save destination.");
        }

        button.textContent = "✓ Added to your list";
        await loadCountries();
    } catch (error) {
        button.disabled = false;
        button.textContent = "+ Add to my list";
        alert(error.message);
    }
}

searchForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("searchCountry").value.trim();
    searchResults.textContent = "Searching...";

    try {
        const response = await fetch(
            `/api/lookup/${encodeURIComponent(name)}`
        );
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Country not found.");
        }

        searchResults.innerHTML = "";

        const card = document.createElement("article");
        card.className = "country-card";

        if (data.flag) {
            const flag = document.createElement("img");
            flag.src = data.flag;
            flag.alt = `Flag of ${data.name}`;
            flag.style.cssText =
                "width:64px;border-radius:6px;display:block;margin-bottom:12px;border:1px solid #e5e9e0;";
            card.appendChild(flag);
        }

        const title = document.createElement("h3");
        title.textContent = data.name;

        card.appendChild(title);

        [
            ["Official name", data.officialName],
            ["Capital", data.capital],
            ["Region", data.region],
            ["Subregion", data.subregion],
            ["Population", data.population],
            ["Currency", data.currency],
            ["Time zone", data.timezone],
            ["Languages", data.languages]
        ].forEach(([label, value]) => {
            const p = document.createElement("p");
            p.textContent = `${label}: ${value || "N/A"}`;
            card.appendChild(p);
        });

        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.textContent = "+ Add to my list";
        addBtn.onclick = () => addSearchedCountry(data, addBtn);
        card.appendChild(addBtn);

        searchResults.appendChild(card);
    } catch (error) {
        searchResults.textContent = error.message;
    }
});

loadCountries();
