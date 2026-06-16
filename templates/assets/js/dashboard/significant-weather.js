const SIGNIFICANT_WEATHER_GIST_URL =
    "https://gist.githubusercontent.com/alexandreribeiro/49274eb247138291249ff9fe6ae3c4de/raw/swc-norden.json";
const SIGNIFICANT_WEATHER_TIME_ZONE = "Europe/Stockholm";

function initializeSignificantWeather() {
    fetchSignificantWeather();
    setInterval(fetchSignificantWeather, 60_000 * 15);
}

function fetchSignificantWeather() {
    updateSignificantWeatherStatus("Loading significant weather chart...");

    fetch(SIGNIFICANT_WEATHER_GIST_URL)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Significant weather request failed with ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            renderSignificantWeather(data);
            updateSignificantWeatherStatus("");
        })
        .catch((error) => {
            console.error("Error fetching significant weather chart:", error);
            updateSignificantWeatherStatus("Failed to load significant weather chart.");
        });
}

function renderSignificantWeather(data) {
    const image = document.getElementById("significantWeatherImage");
    if (!image) return;

    const imageSource = getSignificantWeatherImageSource(data);
    if (!imageSource) {
        throw new Error("Significant weather data did not include an image.");
    }

    image.src = imageSource;
    image.alt = "Significant weather chart for the Nordic region";

    updateSignificantWeatherText("significantWeatherLastUpdated", `Last updated: ${formatSignificantWeatherDateTime(data.lastUpdated)}`);
    updateSignificantWeatherText("significantWeatherSourceModified", `Source image: ${formatSignificantWeatherDateTime(data.sourceLastModified)}`);
    updateSignificantWeatherText("significantWeatherContentLength", `Size: ${formatSignificantWeatherBytes(data.contentLength)}`);

    const sourceLink = document.getElementById("significantWeatherSource");
    if (sourceLink && data.source) {
        sourceLink.href = data.source;
        sourceLink.hidden = false;
    }
}

function getSignificantWeatherImageSource(data) {
    if (data.base64) {
        return `data:${data.mimeType || "image/gif"};base64,${data.base64}`;
    }

    return data.imageUrl || "";
}

function formatSignificantWeatherDateTime(value) {
    const date = new Date(value);
    if (isNaN(date)) return "-";

    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: SIGNIFICANT_WEATHER_TIME_ZONE,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

function formatSignificantWeatherBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) return "-";
    if (bytes < 1024) return `${bytes} B`;

    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) return `${kilobytes.toFixed(0)} KB`;

    return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function updateSignificantWeatherText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function updateSignificantWeatherStatus(message) {
    const element = document.getElementById("significantWeatherStatus");
    if (element) {
        element.textContent = message;
        element.hidden = message === "";
    }
}
