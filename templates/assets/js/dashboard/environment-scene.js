(function () {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const state = {
        initialized: false,
        container: null,
        canvas: null,
        ctx: null,
        svg: null,
        lightningBolt: null,
        particles: [],
        lastFrameTime: 0,
        lastLightningTime: 0,
        animationFrameId: null,
        referenceDate: new Date(),
        sunAltitude: 8,
        sunAzimuth: 225,
        cloudCover: 0.45,
        rainIntensity: 0,
        snowIntensity: 0,
        windSpeed: 2,
        windDirection: 260,
        temperature: null,
        condition: "Calm",
        reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    window.initializeEnvironmentScene = function initializeEnvironmentScene(containerId, astronomyJS) {
        const container = document.getElementById(containerId);
        if (!container || state.initialized) return;

        state.initialized = true;
        state.container = container;
        container.insertAdjacentHTML("afterbegin", getEnvironmentSvgMarkup());
        state.svg = container.querySelector("#environmentSvg");
        state.lightningBolt = container.querySelector("#environmentLightningBolt");

        const canvas = document.createElement("canvas");
        canvas.id = "environmentWeatherCanvas";
        canvas.className = "environment-weather-canvas";
        canvas.setAttribute("aria-hidden", "true");
        container.appendChild(canvas);
        state.canvas = canvas;
        state.ctx = canvas.getContext("2d");

        updateEnvironmentSceneTime(new Date(), astronomyJS);
        resizeEnvironmentCanvas();
        applyEnvironmentState();
        updateEnvironmentHud();
        seedEnvironmentParticles();

        if ("ResizeObserver" in window) {
            new ResizeObserver(resizeEnvironmentCanvas).observe(container);
        } else {
            window.addEventListener("resize", resizeEnvironmentCanvas);
        }

        if (!state.reducedMotion) {
            state.animationFrameId = requestAnimationFrame(animateEnvironment);
        }
    };

    window.updateEnvironmentSceneTime = function updateEnvironmentSceneTime(referenceDate, astronomyJS) {
        if (!referenceDate || isNaN(referenceDate)) return;
        state.referenceDate = new Date(referenceDate);

        if (astronomyJS) {
            try {
                const sun = astronomyJS.getAltitudeAzimuthCoordinatesForObject("Sun", state.referenceDate);
                state.sunAltitude = Number.isFinite(sun.altitude) ? sun.altitude : state.sunAltitude;
                state.sunAzimuth = Number.isFinite(sun.azimuth) ? sun.azimuth : state.sunAzimuth;
            } catch (error) {
                console.warn("Could not update environment sun position.", error);
            }
        }

        applyEnvironmentState();
        updateEnvironmentHud();
    };

    window.updateEnvironmentSceneFromDashboardData = function updateEnvironmentSceneFromDashboardData(data, astronomyJS) {
        const currentHour = getCurrentWeatherHour(data);
        const weatherLabels = Array.isArray(currentHour?.weather) ? currentHour.weather : [];
        const weatherText = weatherLabels.join(" ").toLowerCase();
        const rain = Number(currentHour?.rain) || 0;
        const snow = Number(currentHour?.snow) || 0;
        const precipitationChance = Number(currentHour?.chanceOfPrecipitation) || 0;

        state.cloudCover = clamp((Number(currentHour?.cloudCover) || 0) / 100, 0, 1);
        state.temperature = Number.isFinite(Number(currentHour?.temperature)) ? Number(currentHour.temperature) : state.temperature;
        state.rainIntensity = clamp(Math.max(rain / 2.5, weatherText.includes("rain") ? 0.35 : 0, precipitationChance * 0.35), 0, 1);
        state.snowIntensity = clamp(Math.max(snow / 2, weatherText.includes("snow") ? 0.45 : 0), 0, 1);
        state.windSpeed = Number(currentHour?.windSpeed) || state.windSpeed;
        state.windDirection = Number(currentHour?.windDirection) || state.windDirection;
        state.condition = getEnvironmentConditionLabel(weatherLabels, state.rainIntensity, state.snowIntensity, state.cloudCover);

        updateEnvironmentSceneTime(new Date(data?.lastUpdated || Date.now()), astronomyJS);
        applyEnvironmentState();
        updateEnvironmentHud();
    };

    function getCurrentWeatherHour(data) {
        const hourly = Object.values(data?.weather?.hourly || {});
        if (hourly.length === 0) return null;

        const now = Date.now() / 1000;
        return hourly.find((hour) => Number(hour.timestamp) >= now) || hourly[0];
    }

    function getEnvironmentConditionLabel(weatherLabels, rainIntensity, snowIntensity, cloudCover) {
        if (snowIntensity > 0.15) return "Snow";
        if (rainIntensity > 0.55) return "Rain";
        if (rainIntensity > 0.15) return "Drizzle";
        if (weatherLabels.length > 0) return weatherLabels[0];
        if (cloudCover > 0.75) return "Cloudy";
        if (cloudCover > 0.35) return "Partly cloudy";
        return "Clear";
    }

    function applyEnvironmentState() {
        if (!state.container) return;

        const palette = getSkyPalette(state.sunAltitude);
        state.container.style.setProperty("--environment-sky-top", palette.top);
        state.container.style.setProperty("--environment-sky-mid", palette.mid);
        state.container.style.setProperty("--environment-sky-bottom", palette.bottom);
        state.container.style.setProperty("--environment-tint", palette.tint);
        state.container.style.setProperty("--environment-tint-opacity", String(palette.tintOpacity));
        state.container.style.setProperty("--environment-cloud-opacity", String(0.18 + state.cloudCover * 0.72));
        state.container.style.setProperty("--environment-cloud-duration", `${clamp(100 - state.windSpeed * 4.5, 28, 110)}s`);
        state.container.style.setProperty("--environment-light-opacity", String(clamp((-state.sunAltitude + 4) / 12, 0, 1)));
        state.container.style.setProperty("--environment-star-opacity", String(clamp((-state.sunAltitude - 4) / 18, 0, 1) * (1 - state.cloudCover * 0.85)));
        state.container.style.setProperty("--environment-wet-opacity", String(clamp(state.rainIntensity * 0.9, 0, 0.72)));
        state.container.style.setProperty("--environment-snow-opacity", String(clamp(state.snowIntensity * 0.8, 0, 0.7)));

        const shadowLength = clamp((28 - state.sunAltitude) * 2.2, 8, 88);
        const shadowAngle = (state.sunAzimuth + 180) * Math.PI / 180;
        state.container.style.setProperty("--environment-shadow-x", `${Math.sin(shadowAngle) * shadowLength}px`);
        state.container.style.setProperty("--environment-shadow-y", `${-Math.cos(shadowAngle) * shadowLength * 0.42}px`);
        state.container.style.setProperty("--environment-shadow-opacity", String(clamp((state.sunAltitude / 22) * (1 - state.cloudCover), 0, 0.34)));
    }

    function getSkyPalette(sunAltitude) {
        if (sunAltitude < -12) {
            return {
                top: "#071326",
                mid: "#101a31",
                bottom: "#1f2336",
                tint: "rgba(4, 8, 22, 0.68)",
                tintOpacity: 0.7,
            };
        }

        if (sunAltitude < -3) {
            return {
                top: "#24365d",
                mid: "#5f668a",
                bottom: "#d48b82",
                tint: "rgba(22, 24, 48, 0.36)",
                tintOpacity: 0.48,
            };
        }

        if (sunAltitude < 5) {
            return {
                top: "#86bce6",
                mid: "#c8dbee",
                bottom: "#f1b58d",
                tint: "rgba(75, 64, 90, 0.12)",
                tintOpacity: 0.2,
            };
        }

        return {
            top: "#8fcaf4",
            mid: "#d8edf9",
            bottom: "#f3d5b6",
            tint: "rgba(255, 255, 255, 0)",
            tintOpacity: 0,
        };
    }

    function updateEnvironmentHud() {
        const timeLabel = document.getElementById("environmentTimeLabel");
        const conditionLabel = document.getElementById("environmentConditionLabel");
        const temperatureLabel = document.getElementById("environmentTemperatureLabel");

        if (timeLabel) {
            timeLabel.textContent = state.referenceDate.toLocaleTimeString("sv-SE", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
            });
        }
        if (conditionLabel) {
            conditionLabel.textContent = `${state.condition} - ${Math.round(state.cloudCover * 100)}% clouds`;
        }
        if (temperatureLabel) {
            temperatureLabel.textContent = Number.isFinite(state.temperature) ? `${state.temperature.toFixed(1)} C` : "-- C";
        }
    }

    function resizeEnvironmentCanvas() {
        if (!state.container || !state.canvas) return;
        const rect = state.container.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        const ratio = window.devicePixelRatio || 1;
        state.canvas.width = Math.round(rect.width * ratio);
        state.canvas.height = Math.round(rect.height * ratio);
        state.canvas.style.width = `${rect.width}px`;
        state.canvas.style.height = `${rect.height}px`;
        state.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function seedEnvironmentParticles() {
        const maxParticles = 140;
        state.particles = Array.from({length: maxParticles}, () => createEnvironmentParticle(true));
    }

    function createEnvironmentParticle(randomizeY = false) {
        const width = state.canvas ? state.canvas.clientWidth : 1200;
        const height = state.canvas ? state.canvas.clientHeight : 700;
        const isSnow = state.snowIntensity > state.rainIntensity;

        return {
            x: Math.random() * width,
            y: randomizeY ? Math.random() * height : -20,
            length: isSnow ? 2 + Math.random() * 3 : 18 + Math.random() * 26,
            speed: isSnow ? 18 + Math.random() * 46 : 520 + Math.random() * 420,
            drift: isSnow ? -20 + Math.random() * 40 : (state.windDirection - 180) / 12,
            kind: isSnow ? "snow" : "rain",
            alpha: isSnow ? 0.5 + Math.random() * 0.42 : 0.22 + Math.random() * 0.34,
        };
    }

    function animateEnvironment(timestamp) {
        const delta = state.lastFrameTime ? Math.min((timestamp - state.lastFrameTime) / 1000, 0.05) : 0.016;
        state.lastFrameTime = timestamp;

        resizeEnvironmentCanvas();
        drawWeatherParticles(delta);
        maybeTriggerLightning(timestamp);

        state.animationFrameId = requestAnimationFrame(animateEnvironment);
    }

    function drawWeatherParticles(delta) {
        if (!state.ctx || !state.canvas) return;
        const width = state.canvas.clientWidth;
        const height = state.canvas.clientHeight;
        if (width <= 0 || height <= 0) return;

        state.ctx.clearRect(0, 0, width, height);
        const intensity = clamp(state.rainIntensity + state.snowIntensity, 0, 1);
        if (intensity <= 0.02) return;

        const activeCount = Math.floor(18 + intensity * 122);
        while (state.particles.length < activeCount) {
            state.particles.push(createEnvironmentParticle());
        }

        state.ctx.lineCap = "round";
        state.particles.slice(0, activeCount).forEach((particle, index) => {
            particle.y += particle.speed * delta;
            particle.x += particle.drift * delta * 12;

            if (particle.y > height + 40 || particle.x < -80 || particle.x > width + 80 || particle.kind !== getParticleKind()) {
                state.particles[index] = createEnvironmentParticle();
                return;
            }

            if (particle.kind === "snow") {
                state.ctx.fillStyle = `rgba(247, 252, 255, ${particle.alpha})`;
                state.ctx.beginPath();
                state.ctx.arc(particle.x, particle.y, particle.length, 0, Math.PI * 2);
                state.ctx.fill();
            } else {
                state.ctx.strokeStyle = `rgba(168, 210, 255, ${particle.alpha})`;
                state.ctx.lineWidth = 1.2;
                state.ctx.beginPath();
                state.ctx.moveTo(particle.x, particle.y);
                state.ctx.lineTo(particle.x - 16 - state.windSpeed, particle.y + particle.length);
                state.ctx.stroke();
            }
        });
    }

    function getParticleKind() {
        return state.snowIntensity > state.rainIntensity ? "snow" : "rain";
    }

    function maybeTriggerLightning(timestamp) {
        const stormPotential = state.cloudCover * state.rainIntensity;
        if (stormPotential < 0.45 || timestamp - state.lastLightningTime < 7000) return;
        if (Math.random() > 0.006 * stormPotential) return;

        state.lastLightningTime = timestamp;
        state.container.style.setProperty("--environment-lightning-opacity", "0.85");
        if (state.lightningBolt) state.lightningBolt.setAttribute("opacity", "0.85");

        window.setTimeout(() => {
            if (!state.container) return;
            state.container.style.setProperty("--environment-lightning-opacity", "0");
            if (state.lightningBolt) state.lightningBolt.setAttribute("opacity", "0");
        }, 140);
    }

    function getEnvironmentSvgMarkup() {
        return `
<svg id="environmentSvg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Cartoon courtyard based on IMG_9619.DNG">
    <defs>
        <linearGradient id="environmentSkyGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="var(--environment-sky-top, #9ed4ff)"/>
            <stop offset="58%" stop-color="var(--environment-sky-mid, #d5ecff)"/>
            <stop offset="100%" stop-color="var(--environment-sky-bottom, #ffd2b5)"/>
        </linearGradient>
        <linearGradient id="environmentGrassGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#78b765"/>
            <stop offset="100%" stop-color="#2f6f48"/>
        </linearGradient>
        <filter id="environmentSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8"/>
        </filter>
    </defs>

    <rect width="1600" height="900" fill="url(#environmentSkyGradient)"/>

    <g class="environment-star" fill="#fff8d7">
        <circle cx="185" cy="92" r="2.2"/><circle cx="328" cy="144" r="1.5"/>
        <circle cx="522" cy="78" r="1.8"/><circle cx="759" cy="126" r="2"/>
        <circle cx="992" cy="82" r="1.7"/><circle cx="1246" cy="152" r="1.4"/>
        <circle cx="1412" cy="95" r="2.1"/>
    </g>

    <g class="environment-cloud cloud-1" fill="#eef6fb">
        <ellipse cx="214" cy="134" rx="94" ry="28"/><ellipse cx="286" cy="124" rx="72" ry="34"/>
        <ellipse cx="360" cy="139" rx="116" ry="30"/><ellipse cx="1180" cy="190" rx="140" ry="28" opacity="0.72"/>
    </g>
    <g class="environment-cloud cloud-2" fill="#d8e5ee">
        <ellipse cx="660" cy="178" rx="160" ry="28" opacity="0.74"/>
        <ellipse cx="790" cy="162" rx="110" ry="32" opacity="0.7"/>
        <ellipse cx="938" cy="183" rx="180" ry="30" opacity="0.68"/>
    </g>
    <g class="environment-cloud cloud-3" fill="#ffffff">
        <ellipse cx="1310" cy="92" rx="120" ry="24" opacity="0.64"/>
        <ellipse cx="1430" cy="82" rx="92" ry="30" opacity="0.6"/>
        <ellipse cx="1544" cy="96" rx="130" ry="24" opacity="0.58"/>
    </g>

    <path id="environmentLightningBolt" d="M1284 105 L1238 242 L1286 225 L1248 360 L1358 178 L1308 196 L1352 105 Z" fill="#f9fbff" opacity="0"/>

    <g class="environment-shadow" fill="#1d2b35" filter="url(#environmentSoftShadow)">
        <ellipse cx="292" cy="713" rx="92" ry="22"/><ellipse cx="809" cy="618" rx="180" ry="26"/>
        <ellipse cx="1070" cy="682" rx="120" ry="18"/><ellipse cx="1285" cy="625" rx="118" ry="22"/>
    </g>

    <path d="M0 472 C220 426 430 470 635 424 C836 378 1022 434 1205 390 C1370 350 1508 366 1600 344 L1600 900 L0 900 Z" fill="url(#environmentGrassGradient)"/>
    <path d="M452 556 L1062 560 L1214 835 L324 835 Z" fill="#5c6770" opacity="0.62"/>
    <path d="M524 548 L965 552 L1040 765 L454 765 Z" fill="#c6a888"/>
    <path d="M1006 578 L1226 602 L1174 760 L974 742 Z" fill="#b7a183"/>
    <path d="M1040 600 L1160 614 L1136 710 L1016 700 Z" fill="#d8c9ad"/>
    <path d="M1048 614 L1150 626 L1128 695 L1028 686 Z" fill="#b99b73"/>
    <path d="M520 548 L965 552 L1040 765 L454 765 Z" fill="none" stroke="#8e6e52" stroke-width="8"/>
    <path d="M1006 578 L1226 602 L1174 760 L974 742 Z" fill="none" stroke="#8f7a64" stroke-width="6"/>

    <g class="environment-ground-wet">
        <path d="M452 556 L1062 560 L1214 835 L324 835 Z" fill="#263846" opacity="0.48"/>
        <path d="M520 548 L965 552 L1040 765 L454 765 Z" fill="#415465" opacity="0.36"/>
    </g>
    <g class="environment-snow-cover" fill="#edf5fb">
        <path d="M0 502 C240 470 410 512 650 466 C860 426 1018 462 1208 426 C1380 394 1504 400 1600 386 L1600 900 L0 900 Z"/>
        <path d="M524 548 L965 552 L1040 765 L454 765 Z"/><path d="M1006 578 L1226 602 L1174 760 L974 742 Z"/>
    </g>

    <g id="environmentBuildings">
        <rect x="120" y="314" width="380" height="190" rx="5" fill="#c8c1a8"/>
        <rect x="500" y="292" width="500" height="210" rx="5" fill="#b99f76"/>
        <rect x="1000" y="310" width="470" height="205" rx="5" fill="#c8bea6"/>
        <rect x="120" y="300" width="380" height="24" fill="#d9e1e5"/>
        <rect x="500" y="278" width="500" height="26" fill="#d9e1e5"/>
        <rect x="1000" y="296" width="470" height="28" fill="#d9e1e5"/>
        <rect x="1020" y="252" width="42" height="58" fill="#8b918e"/>
        <rect x="690" y="260" width="16" height="40" fill="#7d6659"/>
        <rect x="310" y="272" width="18" height="38" fill="#7d6659"/>
        <g fill="#f1f6fb" stroke="#7f8f98" stroke-width="4">
            <rect x="154" y="344" width="50" height="38"/><rect x="238" y="344" width="50" height="38"/>
            <rect x="322" y="344" width="50" height="38"/><rect x="406" y="344" width="50" height="38"/>
            <rect x="154" y="408" width="50" height="38"/><rect x="238" y="408" width="50" height="38"/>
            <rect x="322" y="408" width="50" height="38"/><rect x="406" y="408" width="50" height="38"/>
            <rect x="532" y="322" width="48" height="38"/><rect x="616" y="322" width="48" height="38"/>
            <rect x="700" y="322" width="48" height="38"/><rect x="784" y="322" width="48" height="38"/>
            <rect x="868" y="322" width="48" height="38"/><rect x="532" y="386" width="48" height="38"/>
            <rect x="616" y="386" width="48" height="38"/><rect x="700" y="386" width="48" height="38"/>
            <rect x="784" y="386" width="48" height="38"/><rect x="868" y="386" width="48" height="38"/>
            <rect x="1050" y="342" width="58" height="46"/><rect x="1144" y="342" width="58" height="46"/>
            <rect x="1238" y="342" width="58" height="46"/><rect x="1332" y="342" width="58" height="46"/>
            <rect x="1050" y="416" width="58" height="46"/><rect x="1144" y="416" width="58" height="46"/>
            <rect x="1238" y="416" width="58" height="46"/><rect x="1332" y="416" width="58" height="46"/>
        </g>
        <g class="environment-window-light" fill="#ffd86b">
            <rect x="238" y="344" width="50" height="38"/><rect x="616" y="386" width="48" height="38"/>
            <rect x="784" y="322" width="48" height="38"/><rect x="1144" y="416" width="58" height="46"/>
            <rect x="1332" y="342" width="58" height="46"/>
        </g>
    </g>

    <g id="environmentTrees">
        <g fill="#22623e">
            <circle cx="76" cy="414" r="112"/><circle cx="164" cy="458" r="88"/><circle cx="1455" cy="425" r="92"/>
            <circle cx="1370" cy="486" r="96"/><circle cx="1220" cy="466" r="82"/><circle cx="656" cy="452" r="62"/>
        </g>
        <g fill="#3a8555">
            <circle cx="28" cy="548" r="98"/><circle cx="205" cy="598" r="90"/><circle cx="96" cy="690" r="120"/>
            <circle cx="1458" cy="592" r="110"/><circle cx="1325" cy="674" r="112"/><circle cx="1546" cy="680" r="96"/>
        </g>
        <g fill="#5ca36b"><circle cx="594" cy="502" r="44"/><circle cx="712" cy="488" r="46"/><circle cx="1088" cy="492" r="52"/></g>
    </g>

    <g id="environmentPlayground">
        <rect x="688" y="498" width="18" height="110" fill="#dce7ed"/>
        <rect x="674" y="490" width="46" height="28" rx="4" fill="#e3443c"/>
        <path d="M698 608 L698 720" stroke="#e5ecf0" stroke-width="8"/>
        <path d="M684 720 L716 720" stroke="#e3443c" stroke-width="10"/>
        <path d="M546 604 L564 764 M914 604 L896 764 M552 604 L908 604" fill="none" stroke="#9bd466" stroke-width="10" stroke-linecap="round"/>
        <path d="M640 604 L640 692 M748 604 L748 696 M840 604 L840 680" stroke="#2d3943" stroke-width="4"/>
        <ellipse cx="640" cy="706" rx="30" ry="12" fill="#222932"/><ellipse cx="748" cy="710" rx="30" ry="12" fill="#222932"/>
        <rect x="828" y="680" width="46" height="16" rx="6" fill="#e9d9b0"/>
    </g>

    <g id="environmentFurniture" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <g stroke="#6c5140" stroke-width="8">
            <path d="M250 788 L372 760"/><path d="M260 810 L382 782"/><path d="M280 818 L292 850 M356 800 L368 834"/>
            <path d="M1180 632 L1276 650"/><path d="M1172 652 L1268 670"/><path d="M1194 670 L1184 706 M1246 680 L1238 714"/>
        </g>
        <g stroke="#334048" stroke-width="5">
            <path d="M1118 540 L1118 638"/><rect x="1098" y="512" width="40" height="32" fill="#26313a"/>
            <path d="M1490 510 L1490 722"/><rect x="1468" y="474" width="44" height="36" fill="#26313a"/>
        </g>
        <g class="environment-lamp-light" fill="#fff2a8" stroke="none">
            <circle cx="1118" cy="532" r="68" opacity="0.22"/><circle cx="1490" cy="496" r="74" opacity="0.2"/>
        </g>
    </g>
</svg>`;
    }
})();
