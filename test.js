const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const axios = require("axios");
const path = require("path");
const { readCountries, saveCountries } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// GET ALL DESTINATIONS
app.get("/api/countries", (req, res) => {
    res.json(readCountries());
});

// COUNTRY LOOKUP

const RC_KEY = process.env.RESTCOUNTRIES_API_KEY;

// Turn an object-or-array field into an array of plain objects
function toList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return Object.entries(value).map(([code, v]) =>
        typeof v === "object" && v !== null ? { code, ...v } : { code, name: String(v) }
    );
}

// First non-empty string among several possible keys (v5 field names vary by object)
function pick(obj, keys, fallback = "") {
    for (const k of keys) {
        if (typeof obj?.[k] === "string" && obj[k].trim()) return obj[k];
    }
    return fallback;
}

async function lookupRestCountries(rawName) {
    const response = await axios.get(
        "https://api.restcountries.com/countries/v5/name",
        {
            params: { q: rawName, limit: 25 },
            timeout: 10000,
            headers: { Authorization: `Bearer ${RC_KEY}` }
        }
    );

    const results = response.data?.data?.objects || [];
    const searchName = rawName.toLowerCase();

    const country =
        results.find(c =>
            c.names?.common?.toLowerCase() === searchName ||
            c.names?.official?.toLowerCase() === searchName
        ) || results[0];

    if (!country) return null;

    const capitals = toList(country.capitals)
        .map(c => (typeof c === "string" ? c : c.name))
        .filter(Boolean);

    const currencies = toList(country.currencies)
        .map(c => {
            const name = pick(c, ["name", "english_name"], c.code || "");
            const symbol = pick(c, ["symbol"]);
            return symbol ? `${name} (${symbol})` : name;
        })
        .filter(Boolean);

    const languages = toList(country.languages)
        .map(l => (typeof l === "string"
            ? l
            : pick(l, ["name", "english_name", "name_english", "english", "native_name"], l.code || "")))
        .filter(Boolean);

    return {
        name: country.names?.common || rawName,
        officialName: country.names?.official || "N/A",
        capital: capitals.join(", ") || "N/A",
        region: country.region || "N/A",
        subregion: country.subregion || "N/A",
        population: country.population ? Number(country.population).toLocaleString() : "N/A",
        currency: currencies.join(", ") || "N/A",
        timezone: Array.isArray(country.timezones) ? country.timezones.join(", ") : "N/A",
        languages: languages.join(", ") || "N/A",
        flag: country.flag?.url_png || country.flag?.url_svg || ""
    };
}

async function lookupCountriesNow(rawInput) {
    const rawName = rawInput.replace(/\b\w/g, ch => ch.toUpperCase());
    const base = "https://countriesnow.space/api/v0.1/countries";
    const opts = { timeout: 10000 };
    const body = { country: rawName };

    const [capital, population, currency, flag] = await Promise.allSettled([
        axios.post(`${base}/capital`, body, opts),
        axios.post(`${base}/population`, body, opts),
        axios.post(`${base}/currency`, body, opts),
        axios.post(`${base}/flag/images`, body, opts)
    ]);

    const get = r => (r.status === "fulfilled" && !r.value.data.error ? r.value.data.data : null);
    const cap = get(capital);
    const pop = get(population);
    const cur = get(currency);
    const flg = get(flag);

    // If none of the calls found the country, treat it as not found
    if (!cap && !pop && !cur && !flg) return null;

    const counts = pop?.populationCounts;
    const latestPop = Array.isArray(counts) && counts.length
        ? counts[counts.length - 1].value
        : null;

    return {
        name: cap?.name || pop?.country || cur?.name || flg?.name || rawName,
        officialName: "N/A",
        capital: cap?.capital || "N/A",
        region: "N/A",
        subregion: "N/A",
        population: latestPop ? Number(latestPop).toLocaleString() : "N/A",
        currency: cur?.currency || "N/A",
        timezone: "N/A",
        languages: "N/A",
        flag: flg?.flag || ""
    };
}

app.get("/api/lookup/:name", async (req, res) => {
    const rawName = req.params.name.trim();
    if (!rawName) {
        return res.status(400).json({ error: "Country name is required." });
    }

    // 1) Try REST Countries v5 (needs a free API key in RESTCOUNTRIES_API_KEY)
    if (RC_KEY) {
        try {
            const result = await lookupRestCountries(rawName);
            if (result) return res.json(result);
            return res.status(404).json({ error: "Country not found." });
        } catch (error) {
            if (error.response && error.response.status === 404) {
                return res.status(404).json({ error: "Country not found." });
            }
            const detail = error.response?.data?.errors?.[0]?.message || error.message;
            console.error("REST Countries v5 failed, trying fallback:",
                error.response?.status || error.code || "", detail);
        }
    } else {
        console.warn("RESTCOUNTRIES_API_KEY not set - using fallback API only.");
    }

    // 2) Fallback to CountriesNow
    try {
        const result = await lookupCountriesNow(rawName);
        if (result) return res.json(result);
        return res.status(404).json({ error: "Country not found." });
    } catch (error) {
        console.error("Fallback API failed:", error.code || "", error.message);
        return res.status(502).json({
            error: "Could not retrieve country information. Try again."
        });
    }
});

// ADD NEW DESTINATION
app.post("/api/countries", (req, res) => {
    const { country, capital, notes, flag, region } = req.body;

    if (!country || !String(country).trim()) {
        return res.status(400).json({ error: "Country name is required." });
    }

    const countries = readCountries();

    const newItem = {
        id: Date.now(),
        country: String(country).trim(),
        capital: capital || "",
        notes: notes || "",
        flag: flag || "",
        region: region || ""
    };

    countries.push(newItem);
    saveCountries(countries);
    res.status(201).json(newItem);
});

// GET ONE DESTINATION BY ID
app.get("/api/countries/:id", (req, res) => {
    const item = readCountries().find(c => String(c.id) === String(req.params.id));

    if (!item) {
        return res.status(404).json({ error: "Country not found." });
    }

    res.json(item);
});

// UPDATE DESTINATION
app.put("/api/countries/:id", (req, res) => {
    const countries = readCountries();
    const index = countries.findIndex(c => String(c.id) === String(req.params.id));

    if (index === -1) {        return res.status(404).json({ error: "Country not found." });
    }

    const { country, capital, notes } = req.body;

    countries[index] = {
        ...countries[index],
        country: country ?? countries[index].country,
        capital: capital ?? countries[index].capital,
        notes: notes ?? countries[index].notes
    };

    saveCountries(countries);
    res.json(countries[index]);
});

// DELETE DESTINATION
app.delete("/api/countries/:id", (req, res) => {
    const countries = readCountries();
    const updated = countries.filter(c => String(c.id) !== String(req.params.id));

    if (updated.length === countries.length) {
        return res.status(404).json({ error: "Country not found." });
    }

    saveCountries(updated);
    res.json({ message: "Country deleted successfully." });
});

// START SERVER
app.listen(PORT, (err) => {
    // Express 5 passes startup errors (like "port already in use") to this callback
    if (err) {
        if (err.code === "EADDRINUSE") {
            console.error(`\nPort ${PORT} is already in use - an OLD copy of the server is still running.`);
            console.error("Close the other terminal (or press Ctrl+C there), then run node server.js again.\n");
        } else {
            console.error("Failed to start server:", err.message);
        }
        process.exit(1);
    }
    console.log(`Server running at http://localhost:${PORT}`);
});