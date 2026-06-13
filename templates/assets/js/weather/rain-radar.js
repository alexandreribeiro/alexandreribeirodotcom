const RAIN_RADAR_GIST_URL =
    "https://gist.githubusercontent.com/alexandreribeiro/49274eb247138291249ff9fe6ae3c4de/raw/rain.json";
const RAIN_RADAR_TIME_ZONE = "Europe/Stockholm";
const RAIN_RADAR_FRAME_INTERVAL_MS = 500;

const RAIN_RADAR_IMAGE_BOUNDS = {
    south: 53.0841628421789,
    west: -8.03410177882381,
    north: 73.0558890312605,
    east: 40.787194494374,
};

const RAIN_RADAR_STATIC_MAPS = {
    stockholm: {
        bounds: {
            south: 58.65,
            west: 16.75,
            north: 60.25,
            east: 19.45,
        },
        distanceRings: [5, 10, 15, 20, 25],
    },
    nordic: {
        bounds: {
            south: 54.25,
            west: 2.75,
            north: 71.85,
            east: 32.75,
        },
        distanceRings: [100, 200, 300],
    },
};

const RAIN_RADAR_LOCATIONS = [
    {
        name: "Täby Centrum",
        coordinates: {latitude: 59.445264, longitude: 18.071562},
    },
    {
        name: "Höglandspark, Karlskrona",
        coordinates: {latitude: 56.1634014694274, longitude: 15.585936485250043},
    },
];

let rainRadarState = {
    currentFrameIndex: 0,
    frames: [],
    intervalId: null,
    staticMapsInitialized: false,
};

function initializeRainRadarStaticMaps() {
    if (rainRadarState.staticMapsInitialized) return;

    Object.entries(RAIN_RADAR_STATIC_MAPS).forEach(([mapName, mapConfig]) => {
        const container = document.querySelector(`[data-rain-radar-map="${mapName}"]`);
        const overlay = document.querySelector(`[data-rain-radar-overlay="${mapName}"]`);
        if (!container || !overlay) return;

        setRainRadarBoundsStyle(overlay, mapConfig.bounds, RAIN_RADAR_IMAGE_BOUNDS);
        drawRainRadarDistanceRings(mapName, mapConfig);
        addRainRadarLocationMarkers(container, mapConfig.bounds);
    });

    rainRadarState.staticMapsInitialized = true;
}

function setRainRadarBoundsStyle(element, mapBounds, overlayBounds) {
    const position = getRainRadarBoundsPosition(mapBounds, overlayBounds);

    element.style.setProperty("--rain-radar-overlay-left", `${position.left}%`);
    element.style.setProperty("--rain-radar-overlay-top", `${position.top}%`);
    element.style.setProperty("--rain-radar-overlay-width", `${position.width}%`);
    element.style.setProperty("--rain-radar-overlay-height", `${position.height}%`);
}

function drawRainRadarDistanceRings(mapName, mapConfig) {
    const svg = document.querySelector(`[data-rain-radar-distance-overlay="${mapName}"]`);
    if (!svg || !Array.isArray(mapConfig.distanceRings)) return;

    const center = RAIN_RADAR_LOCATIONS[0].coordinates;
    const labelBearings = [0, 90, 180, 270];

    svg.replaceChildren();

    mapConfig.distanceRings.forEach((radiusKm) => {
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.classList.add("rain-radar-distance-ring");
        polyline.setAttribute("points", getRainRadarDistanceRingPoints(mapConfig.bounds, center, radiusKm));
        svg.appendChild(polyline);

        labelBearings.forEach((bearing) => {
            const labelCoordinate = getRainRadarDestinationCoordinate(center, radiusKm, bearing);
            const labelPosition = getRainRadarPointPosition(mapConfig.bounds, labelCoordinate);
            if (!labelPosition) return;

            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.classList.add("rain-radar-distance-label");
            label.setAttribute("dominant-baseline", "central");
            label.setAttribute("x", String(labelPosition.left));
            label.setAttribute("y", String(labelPosition.top));
            label.textContent = String(radiusKm);
            svg.appendChild(label);
        });
    });
}

function getRainRadarDistanceRingPoints(mapBounds, center, radiusKm) {
    const points = [];

    for (let bearing = 0; bearing <= 360; bearing += 2) {
        const coordinate = getRainRadarDestinationCoordinate(center, radiusKm, bearing);
        const position = getRainRadarPointPosition(mapBounds, coordinate);
        if (position) {
            points.push(`${position.left.toFixed(4)},${position.top.toFixed(4)}`);
        }
    }

    return points.join(" ");
}

function getRainRadarDestinationCoordinate(center, distanceKm, bearingDegrees) {
    const earthRadiusKm = 6371.0088;
    const angularDistance = distanceKm / earthRadiusKm;
    const bearing = bearingDegrees * Math.PI / 180;
    const centerLatitude = center.latitude * Math.PI / 180;
    const centerLongitude = center.longitude * Math.PI / 180;
    const latitude = Math.asin(
        Math.sin(centerLatitude) * Math.cos(angularDistance) +
        Math.cos(centerLatitude) * Math.sin(angularDistance) * Math.cos(bearing)
    );
    const longitude = centerLongitude + Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatitude),
        Math.cos(angularDistance) - Math.sin(centerLatitude) * Math.sin(latitude)
    );

    return {
        latitude: latitude * 180 / Math.PI,
        longitude: longitude * 180 / Math.PI,
    };
}

function addRainRadarLocationMarkers(container, mapBounds) {
    RAIN_RADAR_LOCATIONS.forEach((location) => {
        const position = getRainRadarPointPosition(mapBounds, location.coordinates);
        if (!position || position.left < 0 || position.left > 100 || position.top < 0 || position.top > 100) {
            return;
        }

        const marker = document.createElement("span");
        marker.className = "rain-radar-location-marker";
        marker.title = location.name;
        marker.setAttribute("aria-label", location.name);
        marker.style.setProperty("--rain-radar-marker-left", `${position.left}%`);
        marker.style.setProperty("--rain-radar-marker-top", `${position.top}%`);
        container.appendChild(marker);
    });
}

function getRainRadarBoundsPosition(mapBounds, overlayBounds) {
    const mapTopLeft = projectRainRadarCoordinate(mapBounds.north, mapBounds.west);
    const mapBottomRight = projectRainRadarCoordinate(mapBounds.south, mapBounds.east);
    const overlayTopLeft = projectRainRadarCoordinate(overlayBounds.north, overlayBounds.west);
    const overlayBottomRight = projectRainRadarCoordinate(overlayBounds.south, overlayBounds.east);
    const mapWidth = mapBottomRight.x - mapTopLeft.x;
    const mapHeight = mapBottomRight.y - mapTopLeft.y;

    return {
        left: ((overlayTopLeft.x - mapTopLeft.x) / mapWidth) * 100,
        top: ((overlayTopLeft.y - mapTopLeft.y) / mapHeight) * 100,
        width: ((overlayBottomRight.x - overlayTopLeft.x) / mapWidth) * 100,
        height: ((overlayBottomRight.y - overlayTopLeft.y) / mapHeight) * 100,
    };
}

function getRainRadarPointPosition(mapBounds, coordinate) {
    const mapTopLeft = projectRainRadarCoordinate(mapBounds.north, mapBounds.west);
    const mapBottomRight = projectRainRadarCoordinate(mapBounds.south, mapBounds.east);
    const point = projectRainRadarCoordinate(coordinate.latitude, coordinate.longitude);
    const mapWidth = mapBottomRight.x - mapTopLeft.x;
    const mapHeight = mapBottomRight.y - mapTopLeft.y;

    if (mapWidth <= 0 || mapHeight <= 0) return null;

    return {
        left: ((point.x - mapTopLeft.x) / mapWidth) * 100,
        top: ((point.y - mapTopLeft.y) / mapHeight) * 100,
    };
}

function projectRainRadarCoordinate(latitude, longitude) {
    const latitudeRadians = latitude * Math.PI / 180;

    return {
        x: (longitude + 180) / 360,
        y: (1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2,
    };
}

function fetchRainRadarData() {
    initializeRainRadarStaticMaps();

    fetch(RAIN_RADAR_GIST_URL)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Rain radar request failed with ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            const frames = Array.isArray(data.images)
                ? data.images
                    .map((frame) => normalizeRainRadarFrame(frame))
                    .filter((frame) => getRainRadarFrameUrl(frame))
                    .sort((a, b) => getRainRadarFrameDate(a) - getRainRadarFrameDate(b))
                : [];

            if (frames.length === 0) {
                throw new Error("Rain radar data did not include any PNG frames.");
            }

            rainRadarState.frames = frames;
            rainRadarState.currentFrameIndex = 0;
            updateRainRadarLastUpdated(data.lastUpdated);
            updateRainRadarStatus("");
            startRainRadarAnimation();
        })
        .catch((error) => {
            console.error("Error fetching rain radar:", error);
            updateRainRadarStatus("Failed to load rain radar.");
        });
}

function startRainRadarAnimation() {
    if (rainRadarState.intervalId) {
        clearInterval(rainRadarState.intervalId);
    }

    renderRainRadarFrame(rainRadarState.currentFrameIndex);

    if (rainRadarState.frames.length > 1) {
        rainRadarState.intervalId = setInterval(() => {
            rainRadarState.currentFrameIndex =
                (rainRadarState.currentFrameIndex + 1) % rainRadarState.frames.length;
            renderRainRadarFrame(rainRadarState.currentFrameIndex);
        }, RAIN_RADAR_FRAME_INTERVAL_MS);
    }
}

function renderRainRadarFrame(frameIndex) {
    const frame = rainRadarState.frames[frameIndex];
    if (!frame) return;

    const frameUrl = getRainRadarFrameUrl(frame);
    document.querySelectorAll("[data-rain-radar-overlay]").forEach((overlay) => {
        overlay.src = frameUrl;
    });

    const frameTimeElement = document.getElementById("rainRadarFrameTime");
    if (frameTimeElement) {
        frameTimeElement.textContent = `Image time: ${formatRainRadarDateTime(getRainRadarFrameDate(frame))}`;
    }

    const frameCounterElement = document.getElementById("rainRadarFrameCounter");
    if (frameCounterElement) {
        frameCounterElement.textContent = `Frame: ${frameIndex + 1} / ${rainRadarState.frames.length}`;
    }
}

function getRainRadarFrameUrl(frame) {
    if (frame.imageUrl) {
        return frame.imageUrl;
    }

    if (frame.base64) {
        return `data:${frame.mimeType || "image/png"};base64,${frame.base64}`;
    }

    return "";
}

function normalizeRainRadarFrame(frame) {
    return {
        base64: frame.imageUrl ? "" : frame.base64,
        createdAt: frame.createdAt,
        imageUrl: frame.imageUrl || "",
        mimeType: frame.mimeType,
        timeJs: frame.timeJs,
        timeUtc: frame.timeUtc,
    };
}

function getRainRadarFrameDate(frame) {
    return parseRainRadarDate(frame.timeUtc || frame.timeJs || frame.createdAt);
}

function parseRainRadarDate(value) {
    if (!value) return new Date(NaN);

    const normalizedValue = String(value)
        .trim()
        .replace(" UTC", "Z")
        .replace(" Z", "Z")
        .replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T")
        .replace(/(\.\d{3})\d+/, "$1");

    return new Date(normalizedValue);
}

function formatRainRadarDateTime(value) {
    const date = value instanceof Date ? value : parseRainRadarDate(value);
    if (isNaN(date)) return "-";

    return new Intl.DateTimeFormat("sv-SE", {
        timeZone: RAIN_RADAR_TIME_ZONE,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(date);
}

function updateRainRadarLastUpdated(lastUpdated) {
    const element = document.getElementById("rainRadarLastUpdated");
    if (element) {
        element.textContent = `Last updated: ${formatRainRadarDateTime(lastUpdated)}`;
    }
}

function updateRainRadarStatus(message) {
    const element = document.getElementById("rainRadarStatus");
    if (element) {
        element.textContent = message;
        element.hidden = message === "";
    }
}
