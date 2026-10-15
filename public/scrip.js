
const API = "/api/countries";

const countryForm = document.getElementById("countryForm");
const countryList = document.getElementById("countryList");
const searchForm = document.getElementById("searchForm");
const searchResults = document.getElementById("searchResults");

// Convert country code such as JP into a flag emoji.
function getCountryFlag(item) {
    if (item.alpha2Code) {
        return String.fromCodePoint(
            ...[...item.alpha2Code.toUpperCase()]
                .map(char => 127397 + char.charCodeAt(0))
        );
    }

    return item.flag || "🌍";
}

// Load saved destinations.
async function loadCountries() {
    try {
        const response = await fetch(API);
        if (!response.ok) throw new Error("Unable to load destinations.");

        const countries = await response.json();
        countryList.innerHTML = "";

        if (!countries.length) {
            countryList.innerHTML =
                '<p class="empty-message">No destinations added yet.</p>';
            return;
        }

        countries.forEach(country => {
            const card = document.createElement("div");
            card.className = "country-card";

            const heading = document.createElement("h3");
            heading.textContent = `🌍 ${country.country}`;

            const capital = document.createElement("p");
            capital.textContent = `Capital: ${country.capital}`;

            const notes = document.createElement("p");
            notes.textContent = `Notes: ${country.notes}`;

            const editButton = document.createElement("button");
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => editCountry(country.id));

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete";
            deleteButton.className = "delete";
            deleteButton.addEventListener("click", () => deleteCountry(country.id));

            card.append(heading, capital, notes, editButton, deleteButton);
            countryList.appendChild(card);
        });
    } catch (error) {
        console.error(error);
        countryList.innerHTML =
            '<p class="empty-message">Unable to load destinations.</p>';
    }
}

// Add a destination.
async function addCountry(country, capital, notes) {
    const response = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country, capital, notes })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Unable to add country.");
    }
}

countryForm.addEventListener("submit", async event => {
    event.preventDefault();

    const country = document.getElementById("country").value.trim();
    const capital = document.getElementById("capital").value.trim();
    const notes = document.getElementById("notes").value.trim();

    if (!country || !capital || !notes) {
        alert("Please fill in all fields.");
        return;
    }

    try {
        await addCountry(country, capital, notes);
        countryForm.reset();
        await loadCountries();
        alert("Destination added successfully!");
    } catch (error) {
        alert(error.message);
    }
});

// Open the edit page.
function editCountry(id) {
    window.location.href = `edit.html?id=${encodeURIComponent(id)}`;
}

// Delete a destination.
async function deleteCountry(id) {
    if (!confirm("Are you sure you want to delete this destination?")) {
        return;
    }

    try {
        const response = await fetch(
            `${API}/${encodeURIComponent(id)}`,
            { method: "DELETE" }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Unable to delete country.");
        }

        await loadCountries();
        alert("Destination deleted successfully!");
    } catch (error) {
        alert(error.message);
    }
}

// Search for online country information.
searchForm.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("searchCountry").value.trim();

    if (!name) {
        alert("Enter a country name.");
        return;
    }

    searchResults.innerHTML = "<p>Searching...</p>";

    try {
        const response = await fetch(
            `/api/lookup/${encodeURIComponent(name)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Country not found.");
        }

        searchResults.innerHTML = "";
        const results = Array.isArray(data) ? data : [data];

        results.forEach(item => {
            const card = document.createElement("div");
            card.className = "country-card";

            const heading = document.createElement("h3");
            heading.textContent = `${getCountryFlag(item)} ${item.country}`;

            const currencies = item.currencies
                ?.map(currency =>
                    typeof currency === "string"
                        ? currency
                        : [currency.name, currency.code ? `(${currency.code})` : ""]
                            .filter(Boolean).join(" ")
                )
                .join(", ") || "Unknown";

            const languages = item.languages
                ?.map(language =>
                    typeof language === "string" ? language : language.name
                )
                .join(", ") || "Unknown";

            const details = [
                ["Capital", item.capital || "Unknown"],
                ["Region", item.region || "Unknown"],
                ["Subregion", item.subregion || "Unknown"],
                ["Population", Number(item.population || 0).toLocaleString()],
                ["Currency", currencies],
                ["Languages", languages],
                ["Time Zone", item.timezones?.join(", ") || "Unknown"]
            ];

            card.appendChild(heading);

            details.forEach(([label, value]) => {
                const paragraph = document.createElement("p");
                const strong = document.createElement("strong");
                strong.textContent = `${label}: `;
                paragraph.append(strong, document.createTextNode(value));
                card.appendChild(paragraph);
            });

            const placesHeading = document.createElement("h4");
            placesHeading.textContent = "📍 Interesting Places";
            card.appendChild(placesHeading);

            const placesList = document.createElement("ul");
            const places = item.places || [];

            if (places.length) {
                places.forEach(place => {
                    const li = document.createElement("li");
                    li.textContent = typeof place === "string"
                        ? place
                        : place.name || "Unknown place";
                    placesList.appendChild(li);
                });
            } else {
                const li = document.createElement("li");
                li.textContent = "No places found.";
                placesList.appendChild(li);
            }

            card.appendChild(placesList);

            const addButton = document.createElement("button");
            addButton.textContent = "Add to Bucket List";
            addButton.addEventListener("click", () => {
                useCountry(item.country, item.capital || "");
            });

            card.appendChild(addButton);
            searchResults.appendChild(card);
        });
    } catch (error) {
        searchResults.innerHTML = "";
        const message = document.createElement("p");
        message.className = "empty-message";
        message.textContent = error.message;
        searchResults.appendChild(message);
    }
});

// Fill in the destination form from search results.
function useCountry(country, capital) {
    document.getElementById("country").value = country;
    document.getElementById("capital").value = capital;
    document.getElementById("notes").focus();

    window.scrollTo({ top: 250, behavior: "smooth" });
}

loadCountries();

