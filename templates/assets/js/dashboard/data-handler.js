function fetchDashboardData(astronomyJS) {
    fetch(`https://gist.githubusercontent.com/alexandreribeiro/49274eb247138291249ff9fe6ae3c4de/raw/dashboard.json`)
        .then(response => response.json())
        .then(data => {
            Object.entries(data['weather']['hourly']).forEach(([_, it]) => {
                let parsedDate = new Date(it['timestamp'] * 1000);
                it.parsedDate = parsedDate;
                it.sunAltitude = astronomyJS.getAltAzCoordinatesForObject('Sun', parsedDate).latitude;
            });

            const tenMinutesInMilliseconds = 60 * 1000 * 15;
            let lastUpdatedDate = new Date(data['lastUpdated']);
            let lastUpdatedOutdoorsPressure = new Date(data['homeAssistant']['atmosphericPressure']['lastUpdated']);
            let lastUpdatedOutdoorsTemperature = new Date(data['homeAssistant']['outdoorsTemperature']['lastUpdated']);
            let lastUpdatedBalconyTemperature = new Date(data['homeAssistant']['balconyTemperature']['lastUpdated']);
            let lastUpdatedOfficeTemperature = new Date(data['homeAssistant']['officeTemperature']['lastUpdated']);
            let lastUpdatedBedroomTemperature = new Date(data['homeAssistant']['bedroomTemperature']['lastUpdated']);
            let lastUpdatedOtherBedroomTemperature = new Date(data['homeAssistant']['otherBedroomTemperature']['lastUpdated']);

            document.getElementById('outdoorsPressureOutdated').textContent =
                (Math.abs(lastUpdatedDate - lastUpdatedOutdoorsPressure) > tenMinutesInMilliseconds) ? `⏳` : ``;
            document.getElementById('outdoorsOutdated').textContent =
                (Math.abs(lastUpdatedDate - lastUpdatedOutdoorsTemperature) > tenMinutesInMilliseconds) ? `⏳` : ``;
            document.getElementById('balconyOutdated').textContent =
                (Math.abs(lastUpdatedDate - lastUpdatedBalconyTemperature) > tenMinutesInMilliseconds) ? `⏳` : ``;
            document.getElementById('officeOutdated').textContent =
                (Math.abs(lastUpdatedDate - lastUpdatedOfficeTemperature) > tenMinutesInMilliseconds) ? `⏳` : ``;
            document.getElementById('otherBedroomOutdated').textContent =
                (Math.abs(lastUpdatedDate - lastUpdatedOtherBedroomTemperature) > tenMinutesInMilliseconds) ? `⏳` : ``;
            document.getElementById('bedroomOutdated').textContent =
                (Math.abs(lastUpdatedDate - lastUpdatedBedroomTemperature) > tenMinutesInMilliseconds) ? `⏳` : ``;

            document.getElementById('lastUpdated').textContent =
                `Last updated: ${lastUpdatedDate.toLocaleString('sv-SE')}`;
            document.getElementById('ESSA').textContent = data.metar?.ESSA?.split('\n')[1];
            document.getElementById('ESSB').textContent = data.metar?.ESSB?.split('\n')[1];
            document.getElementById('outdoorsPressureRow').title =
                lastUpdatedOutdoorsPressure.toLocaleString('sv-SE');
            document.getElementById('outdoorsPressure').textContent =
                `${data['homeAssistant']['atmosphericPressure']['value']}
                ${data['homeAssistant']['atmosphericPressure']['unit']}`;
            document.getElementById('outdoorsPressureTrend').textContent =
                `${data['homeAssistant']['atmosphericPressureTrend']['value']}
                (${lastUpdatedOutdoorsPressure.toLocaleString('sv-SE')})`;
            document.getElementById('outdoorsRow').title =
                `${new Date(data['homeAssistant']['outdoorsTemperature']['lastUpdated']).toLocaleString('sv-SE')}`;
            document.getElementById('outdoorsTemperature').textContent =
                `${data['homeAssistant']['outdoorsTemperature']['value']}
                ${data['homeAssistant']['outdoorsTemperature']['unit']}`;
            document.getElementById('outdoorsHumidity').textContent =
                `${data['homeAssistant']['outdoorsHumidity']['value']}
                ${data['homeAssistant']['outdoorsHumidity']['unit']}`;
            document.getElementById('balconyRow').title =
                `${new Date(data['homeAssistant']['balconyTemperature']['lastUpdated']).toLocaleString('sv-SE')}`;
            document.getElementById('balconyTemperature').textContent =
                `${data['homeAssistant']['balconyTemperature']['value']}
            ${data['homeAssistant']['balconyTemperature']['unit']}`;
            document.getElementById('balconyHumidity').textContent =
                `${data['homeAssistant']['balconyHumidity']['value']}
                ${data['homeAssistant']['balconyHumidity']['unit']}`;
            document.getElementById('officeRow').title =
                `${new Date(data['homeAssistant']['officeTemperature']['lastUpdated']).toLocaleString('sv-SE')}`;
            document.getElementById('officeTemperature').textContent =
                `${data['homeAssistant']['officeTemperature']['value']}
                ${data['homeAssistant']['officeTemperature']['unit']}`;
            document.getElementById('officeHumidity').textContent =
                `${data['homeAssistant']['officeHumidity']['value']}
                ${data['homeAssistant']['officeHumidity']['unit']}`
            document.getElementById('bedroomRow').title =
                `${new Date(data['homeAssistant']['bedroomTemperature']['lastUpdated']).toLocaleString('sv-SE')}`;
            document.getElementById('bedroomTemperature').textContent =
                `${data['homeAssistant']['bedroomTemperature']['value']}
                ${data['homeAssistant']['bedroomTemperature']['unit']}`;
            document.getElementById('bedroomHumidity').textContent =
                `${data['homeAssistant']['bedroomHumidity']['value']}
                ${data['homeAssistant']['bedroomHumidity']['unit']}`;
            document.getElementById('otherBedroomRow').title =
                `${new Date(data['homeAssistant']['otherBedroomTemperature']['lastUpdated']).toLocaleString('sv-SE')}`;
            document.getElementById('otherBedroomTemperature').textContent =
                `${data['homeAssistant']['otherBedroomTemperature']['value']}
                ${data['homeAssistant']['otherBedroomTemperature']['unit']}`;
            document.getElementById('otherBedroomHumidity').textContent =
                `${data['homeAssistant']['otherBedroomHumidity']['value']}
                ${data['homeAssistant']['otherBedroomHumidity']['unit']}`;
            drawSVGGauge('#atmosphericPressureGauge', data['homeAssistant']['atmosphericPressure']['value'],
                data['homeAssistant']['atmosphericPressure']['unit']);
            drawRainGraph('#rainGraph', new Date(data['weather']['nextHour']['startDate']), data['weather']['nextHour']['values']);
            let essaWindSpeedInMetersPerSecond, windDirection;
            try {
                const parsedEssaMetar = parseWindDirection(data.metar?.ESSA?.split('\n')[1]);
                essaWindSpeedInMetersPerSecond = parsedEssaMetar && typeof parsedEssaMetar.speed === 'number' ? parsedEssaMetar.speed * 0.514444 : 0;
                windDirection = parsedEssaMetar?.direction;
            } catch (e) {
                essaWindSpeedInMetersPerSecond = null;
                windDirection = null;
            }
            drawWindGauge('#windDirectionGauge', windDirection, essaWindSpeedInMetersPerSecond);
            drawHourlyWeatherTable('hourlyWeatherTable', data['weather']['hourly']);
            drawCloudCoverageGraph('#cloudCoverageGraph', data['weather']['hourly']);
        })
        .catch(error => {
            console.error("Error fetching Gist:", error);
            document.getElementById("lastUpdated").textContent = "Failed to load gist.";
        });
}

function getSunEphemeris(astronomyJS) {
    return {
        "rise": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "RISE"),
        "set": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "SET"),
        "goldenHourStart": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "GOLDEN_HOUR_START"),
        "goldenHourEnd": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "GOLDEN_HOUR_END"),
        "civilTwilightStart": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "CIVIL_TWILIGHT_START"),
        "civilTwilightEnd": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "CIVIL_TWILIGHT_END"),
        "nauticalTwilightStart": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "NAUTICAL_TWILIGHT_START"),
        "nauticalTwilightEnd": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "NAUTICAL_TWILIGHT_END"),
        "astronomicalTwilightStart": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "ASTRONOMICAL_TWILIGHT_START"),
        "astronomicalTwilightEnd": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "ASTRONOMICAL_TWILIGHT_END"),
        "solarTransit": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "TRANSIT"),
        "lowerSolarTransit": astronomyJS.getEphemerisDateForObject("Sun", astronomyJS.getDate(), "LOWER_TRANSIT"),
    }
}

function updateAllTilesWithTime(sunEphemeris, referenceDate) {
    astronomySVG.setLocation(stockholmLocation.latitude, stockholmLocation.longitude);
    astronomySVG.setTimezone("Europe/Stockholm");
    astronomySVG.setDate(referenceDate);

    document.getElementById('drawPlanetMercuryVisibility').innerHTML = astronomySVG.drawCelestialBodyVisibility("Mercury", 100);
    document.getElementById('drawPlanetVenusVisibility').innerHTML = astronomySVG.drawCelestialBodyVisibility("Venus", 100);
    document.getElementById('drawPlanetMarsVisibility').innerHTML = astronomySVG.drawCelestialBodyVisibility("Mars", 100);
    document.getElementById('drawPlanetJupiterVisibility').innerHTML = astronomySVG.drawCelestialBodyVisibility("Jupiter", 100);
    document.getElementById('drawPlanetSaturnVisibility').innerHTML = astronomySVG.drawCelestialBodyVisibility("Saturn", 100);
    document.getElementById('drawSunAzimuth').innerHTML = astronomySVG.drawAzimuth("Sun", 100);
    document.getElementById('drawSunAltitude').innerHTML = astronomySVG.drawAltitude("Sun", 100);
    document.getElementById('drawSunAltitudePathStockholm').innerHTML = astronomySVG.drawSunAltitudePath(400, true);
    drawAstronomicalClock('#astronomicalClock', sunEphemeris);
    astronomySVG.setLocation(rioLocation.latitude, rioLocation.longitude);
    astronomySVG.setTimezone('America/Sao_Paulo');
    document.getElementById('drawSunAltitudePathRio').innerHTML = astronomySVG.drawSunAltitudePath(400, true);
}
