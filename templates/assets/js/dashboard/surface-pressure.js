const SURFACE_PRESSURE_GIST_URL =
    "https://gist.githubusercontent.com/alexandreribeiro/49274eb247138291249ff9fe6ae3c4de/raw/surface-pressure.json";
const SURFACE_PRESSURE_TIME_ZONE = "Europe/Stockholm";

const surfacePressureState = {
    chartRun: "",
    charts: [],
    currentChartIndex: 0,
};

function initializeSurfacePressure() {
    const previousButton = document.getElementById("surfacePressurePreviousButton");
    const nextButton = document.getElementById("surfacePressureNextButton");

    if (previousButton) {
        previousButton.addEventListener("click", () => {
            renderSurfacePressureChart(surfacePressureState.currentChartIndex - 1);
        });
    }

    if (nextButton) {
        nextButton.addEventListener("click", () => {
            renderSurfacePressureChart(surfacePressureState.currentChartIndex + 1);
        });
    }

    document.addEventListener("keydown", handleSurfacePressureKeyboardNavigation);

    fetchSurfacePressureData();
    setInterval(updateSurfacePressureRelativeTime, 60_000);
    setInterval(fetchSurfacePressureData, 60_000 * 30);
}

function handleSurfacePressureKeyboardNavigation(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    const panel = document.getElementById("surfacePressurePanel");
    if (!panel || panel.hidden) return;

    event.preventDefault();
    renderSurfacePressureChart(
        surfacePressureState.currentChartIndex + (event.key === "ArrowRight" ? 1 : -1)
    );
}

function fetchSurfacePressureData() {
    updateSurfacePressureStatus("Loading surface pressure charts...");

    fetch(SURFACE_PRESSURE_GIST_URL)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Surface pressure request failed with ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            const previousForecastHour = surfacePressureState.charts[surfacePressureState.currentChartIndex]?.forecastHour;
            const charts = Array.isArray(data.charts)
                ? data.charts
                    .filter((chart) => getSurfacePressureImageSource(chart))
                    .sort((a, b) => Number(a.index ?? a.forecastHour ?? 0) - Number(b.index ?? b.forecastHour ?? 0))
                : [];

            if (charts.length === 0) {
                throw new Error("Surface pressure data did not include any chart images.");
            }

            surfacePressureState.charts = charts;
            surfacePressureState.chartRun = data.chartRun || "";
            surfacePressureState.currentChartIndex = getSurfacePressureInitialIndex(charts, previousForecastHour);

            renderSurfacePressureMeta(data);
            renderSurfacePressureChart(surfacePressureState.currentChartIndex);
            updateSurfacePressureStatus("");
        })
        .catch((error) => {
            console.error("Error fetching surface pressure charts:", error);
            updateSurfacePressureStatus("Failed to load surface pressure charts.");
        });
}

function getSurfacePressureInitialIndex(charts, previousForecastHour) {
    if (previousForecastHour !== undefined) {
        const matchingIndex = charts.findIndex((chart) => chart.forecastHour === previousForecastHour);
        if (matchingIndex >= 0) return matchingIndex;
    }

    return Math.min(surfacePressureState.currentChartIndex, charts.length - 1);
}

function renderSurfacePressureMeta(data) {
    updateSurfacePressureText("surfacePressureLastUpdated", `Last updated: ${formatSurfacePressureDateTime(data.lastUpdated)}`);
    updateSurfacePressureText("surfacePressureSourceIssued", `Source issued: ${formatSurfacePressureDateTime(data.sourceIssuedAt)}`);
    updateSurfacePressureText("surfacePressureRun", `Run: ${data.chartRun || "-"}`);

    const sourceLink = document.getElementById("surfacePressureSource");
    if (sourceLink && data.source) {
        sourceLink.href = data.source;
        sourceLink.hidden = false;
    }
}

function renderSurfacePressureChart(chartIndex) {
    const charts = surfacePressureState.charts;
    if (charts.length === 0) return;

    const normalizedChartIndex = getSurfacePressureCyclicIndex(chartIndex, charts.length);
    const chart = charts[normalizedChartIndex];
    const image = document.getElementById("surfacePressureImage");

    surfacePressureState.currentChartIndex = normalizedChartIndex;

    if (image) {
        image.src = getSurfacePressureImageSource(chart);
        image.alt = chart.alt || "Surface pressure chart";
    }

    updateSurfacePressureText("surfacePressureChartTime", `Valid in Stockholm: ${formatSurfacePressureValidDateTime(chart)}`);
    updateSurfacePressureRelativeTime();
    updateSurfacePressureText("surfacePressureFrameCounter", `Chart: ${normalizedChartIndex + 1} / ${charts.length}`);
}

function getSurfacePressureCyclicIndex(index, length) {
    return ((index % length) + length) % length;
}

function updateSurfacePressureRelativeTime() {
    const chart = surfacePressureState.charts[surfacePressureState.currentChartIndex];
    if (!chart) return;

    updateSurfacePressureText(
        "surfacePressureRelativeTime",
        formatSurfacePressureRelativeValidTime(getSurfacePressureValidDate(chart))
    );
}

function getSurfacePressureImageSource(chart) {
    if (!chart) return "";

    if (chart.base64) {
        return `data:${chart.mimeType || "image/gif"};base64,${chart.base64}`;
    }

    return chart.imageUrl || "";
}

function formatSurfacePressureDateTime(value) {
    const date = new Date(value);
    if (isNaN(date)) return "-";

    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: SURFACE_PRESSURE_TIME_ZONE,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

function formatSurfacePressureValidDateTime(chart) {
    const date = getSurfacePressureValidDate(chart);
    if (isNaN(date)) return chart.validTime || "-";

    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: SURFACE_PRESSURE_TIME_ZONE,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZoneName: "short",
    }).format(date);
}

function getSurfacePressureValidDate(chart) {
    const chartRunDate = parseSurfacePressureChartRun(surfacePressureState.chartRun);
    const forecastHour = Number(chart.forecastHour);
    if (!isNaN(chartRunDate) && Number.isFinite(forecastHour)) {
        return new Date(chartRunDate.getTime() + forecastHour * 60 * 60 * 1000);
    }

    return new Date(NaN);
}

function parseSurfacePressureChartRun(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(\d{2})$/);
    if (!match) return new Date(NaN);

    const [, year, month, day, hour, minute] = match.map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function formatSurfacePressureRelativeValidTime(validDate, now = new Date()) {
    if (isNaN(validDate)) return "Valid: -";

    const hoursFromNow = (validDate.getTime() - now.getTime()) / (60 * 60 * 1000);
    const roundedHours = Math.round(Math.abs(hoursFromNow));
    if (roundedHours === 0) return "Valid now";

    const unit = roundedHours === 1 ? "hour" : "hours";
    if (hoursFromNow < 0) {
        return `Valid ${roundedHours} ${unit} ago`;
    }

    return `Valid in +${roundedHours} ${unit}`;
}

function updateSurfacePressureText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

function updateSurfacePressureStatus(message) {
    const element = document.getElementById("surfacePressureStatus");
    if (element) {
        element.textContent = message;
        element.hidden = message === "";
    }
}
