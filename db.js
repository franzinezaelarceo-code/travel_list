
const fs = require("fs");
const path = require("path");

const dbFile = path.join(__dirname, "countries.json");

function readCountries() {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, "[]");
  }

  return JSON.parse(fs.readFileSync(dbFile, "utf8"));
}

function saveCountries(countries) {
  fs.writeFileSync(dbFile, JSON.stringify(countries, null, 2));
}

module.exports = { readCountries, saveCountries };
