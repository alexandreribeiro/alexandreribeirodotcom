function drawRainGraph(svgSelectorId, startDate, rainValues) {
    // Build the data array
    const data = rainValues.map((value, i) => ({
        time: new Date(startDate.getTime() + i * 60000),
        value: value
    }));

    const svg = d3.select(svgSelectorId);
    const margin = {top: 20, right: 20, bottom: 20, left: 45};
    const width = 400 - margin.left - margin.right;
    const height = 200 - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // X scale
    const x = d3.scaleBand()
        .domain([...data.map(d => d.time), new Date(startDate.getTime() + 60 * 60 * 1000)])
        .range([0, width])
        .padding(0.05);

    // Y scale
    const y = d3.scaleLinear()
        .domain([0, 1]).nice()
        .range([height, 0]);

    // Bars
    g.selectAll(".bar")
        .data(data)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.time))
        .attr("y", d => y(d.value))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.value));

    // X Axis
    let xTicks = data.filter(i => i.time.getUTCMinutes() % 15 === 0).map(d => d.time);
    const xAxis = d3.axisBottom(x).tickValues(xTicks).tickFormat(d3.timeFormat("%H:%M"));

    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .attr("class", "x-axis")
        .call(xAxis);

    // Y Axis
    const yAxis = d3.axisLeft(y).ticks(4).tickFormat(d => `${d.toFixed(1)} mm`);
    g.append("g").call(yAxis);
    svg.append("text")
        .attr("x", margin.left - 40)
        .attr("y", margin.top - 10)
        .attr("text-anchor", "start")
        .attr("font-size", "14px")
        .text("Rain/minute");
}

function drawCloudCoverageGraph(svgSelector, dataDict) {
    const width = 400;
    const height = 200;
    const margin = {top: 20, right: 20, bottom: 50, left: 35};
    const svg = d3.select(svgSelector).attr("width", width).attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const data = Object.entries(dataDict).map(([_, values]) => ({
        date: values['parsedDate'],
        rain: values['rain'],
        snow: values['snow'],
        cloudCoverage: values['cloudCover'],
    }));

    const xTimeScale = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, width]);
    const xAxis = d3.axisBottom(xTimeScale).ticks(d3.timeHour.every(3)).tickFormat(d3.timeFormat("%a %H:%M"));

    const yCloudCoverScale = d3.scaleLinear().domain([0, 100]).range([0, height * 0.3]);
    const yCloudCoverAxis = d3.axisLeft(yCloudCoverScale).tickFormat(d => `${d.toFixed(0)}%`);

    const yPrecipitationScale = d3.scaleLinear().domain([0, 3]).range([height - margin.bottom, (height - margin.bottom) * 0.7]);
    const yPrecipitationAxis = d3.axisLeft(yPrecipitationScale).tickValues([0, 1, 2, 3]).tickFormat(d => `${d.toFixed(0)}mm`);

    g.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "middle")
        .style("display", (d, i) => i % 2 === 0 ? null : "none");

    g.append("g").call(yCloudCoverAxis).selectAll("text")
        .style("display", (d, i) => i % 2 === 0 ? null : "none");
    g.append("g").call(yPrecipitationAxis);

    // Draw vertical lines at midnight to separate days
    {
        const [domainStart, domainEnd] = xTimeScale.domain();
        const firstMidnight = d3.timeDay.ceil(domainStart);
        const midnights = d3.timeDay.range(firstMidnight, domainEnd);
        g.selectAll(".day-separator")
            .data(midnights)
            .enter()
            .append("line")
            .attr("class", "day-separator")
            .attr("x1", d => xTimeScale(d))
            .attr("x2", d => xTimeScale(d))
            .attr("y1", 0)
            .attr("y2", height - margin.bottom)
            .attr("stroke", "#999")
            .attr("stroke-dasharray", "4,3")
            .attr("stroke-width", 1)
            .attr("opacity", 0.6)
            .attr("pointer-events", "none");
        g.selectAll(".day-separator").raise();
    }

    const areaClouds = d3.area().x(d => xTimeScale(d.date))
        .y0(d => yCloudCoverScale(d.cloudCoverage))
        .y1(d => yCloudCoverScale(0))
        .curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("class", "area-clouds").attr("d", areaClouds);

    const areaRain = d3.area().x(d => xTimeScale(d.date)).y0(d => yPrecipitationScale(0))
        .y1(d => yPrecipitationScale(d.rain))
        .curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("class", "area-rain").attr("d", areaRain);

    const areaSnow = d3.area().x(d => xTimeScale(d.date)).y0(d => yPrecipitationScale(0))
        .y1(d => yPrecipitationScale(d.snow))
        .curve(d3.curveMonotoneX);
    g.append("path").datum(data).attr("class", "area-snow").attr("d", areaSnow);
}

function drawWindGauge(svgSelector, windDirection, windSpeedMps) {
    const svg = d3.select(svgSelector);
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const radius = Math.min(width, height) / 2 - 20;
    const center = {x: width / 2, y: height / 2};

    const YELLOW_THRESHOLD = 5.5; // m/s
    const RED_THRESHOLD = 10.7;   // m/s

    // Determine tier color based on wind speed; length will be proportional
    const speed = (typeof windSpeedMps === 'number' && !isNaN(windSpeedMps)) ? windSpeedMps : 0;
    let arrowColor, headFactor, tailFactor;
    const strokeWidth = 4; // fixed thickness
    const markerSize = 4;  // fixed arrowhead size
    if (speed < YELLOW_THRESHOLD) {
        arrowColor = '#2e6d32';
    } else if (speed <= RED_THRESHOLD) {
        arrowColor = '#f9a825';
    } else {
        arrowColor = '#c62828';
    }

    // Proportional arrow length: map [1 m/s .. 10.7 m/s] -> [min..max] factors
    const MIN_SPEED = 1;
    const MAX_SPEED = RED_THRESHOLD; // 10.7 m/s
    const H_MIN = 0.15, H_MAX = 0.75; // head length factors
    const T_MIN = 0.20, T_MAX = 0.90; // tail length factors

    const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, speed));
    const t = (clamped - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);
    headFactor = H_MIN + t * (H_MAX - H_MIN);
    tailFactor = T_MIN + t * (T_MAX - T_MIN);

    svg.append("defs")
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 0)
        .attr("refY", 5)
        .attr("markerWidth", markerSize)
        .attr("markerHeight", markerSize)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", arrowColor);

// Draw compass background
    svg.append("circle")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "#aaa");

// Cardinal points
    const directions = [
        {label: "N", angle: 0},
        {label: "E", angle: 90},
        {label: "S", angle: 180},
        {label: "W", angle: 270},
    ];

    directions.forEach(d => {
        const angleRad = (d.angle - 90) * Math.PI / 180;
        const x = center.x + (radius - 15) * Math.cos(angleRad);
        const y = center.y + (radius - 15) * Math.sin(angleRad);
        svg.append("text")
            .attr("x", x)
            .attr("y", y)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "middle")
            .attr("font-size", "16px")
            .text(d.label);
    });


    const scale = d3.scaleLinear().domain([0, 360]).range([0, 2 * Math.PI]);

    const arc = svg.append("g").attr("transform", `translate(${center.x},${center.y})`);
    const ticks = d3.range(0, 360, 3);
    ticks.forEach(angleInDegrees => {
        const angle = scale(angleInDegrees);
        const x1 = Math.cos(angle) * (radius - 10);
        const y1 = Math.sin(angle) * (radius - 10);
        const x2 = Math.cos(angle) * radius;
        const y2 = Math.sin(angle) * radius;
        arc.append("line")
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2)
            .attr("stroke", "#333")
            .attr("stroke-width", angleInDegrees % 45 === 0 ? 3 : 1);
    });


    const angleRad = (windDirection + 90) * Math.PI / 180;
    const x1 = center.x - radius * tailFactor * Math.cos(angleRad); // tail
    const y1 = center.y - radius * tailFactor * Math.sin(angleRad);
    const x2 = center.x + radius * headFactor * Math.cos(angleRad); // head
    const y2 = center.y + radius * headFactor * Math.sin(angleRad);

    svg.append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", arrowColor)
        .attr("stroke-width", strokeWidth)
        .attr("marker-end", "url(#arrow)")
        .attr("stroke-linecap", "round");

// Center dot
    svg.append("circle")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", 5)
        .attr("fill", arrowColor);
}

function drawSVGGauge(svgItemSelector, displayValue, displayUnit) {
    const svg = d3.select(svgItemSelector);
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const radius = Math.min(width, height) / 2;

    const centerX = width / 2;
    const centerY = height / 2;

    const minPressure = 970;
    const maxPressure = 1060;

    // Scale: spans 270°, centered on 1014 at the top
    const scale = d3.scaleLinear()
        .domain([minPressure, maxPressure])           // e.g., [960, 1060]
        .range([(-5 * Math.PI) / 4, Math.PI / 4]);

    const arc = svg.append("g")
        .attr("transform", `translate(${centerX},${centerY})`);

    // Draw ticks
    const ticks = d3.range(minPressure, maxPressure + 1, 5);

    ticks.forEach(p => {
        const angle = scale(p);
        const x1 = Math.cos(angle) * (radius - 10);
        const y1 = Math.sin(angle) * (radius - 10);
        const x2 = Math.cos(angle) * radius;
        const y2 = Math.sin(angle) * radius;

        arc.append("line")
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2)
            .attr("stroke", "#333")
            .attr("stroke-width", 2);

        if (p % 10 === 0) {
            arc.append("text")
                .attr("x", Math.cos(angle) * (radius - 25))
                .attr("y", Math.sin(angle) * (radius - 25) + 4)
                .attr("text-anchor", "middle")
                .attr("font-size", "12px")
                .text(p);
        }

    });

    // Draw needle
    const needleAngle = scale(displayValue);
    arc.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", Math.cos(needleAngle) * (radius - 30))
        .attr("y2", Math.sin(needleAngle) * (radius - 30))
        .attr("stroke", "red")
        .attr("stroke-width", 4);

    // Center circle
    arc.append("circle")
        .attr("r", 5)
        .attr("fill", "black");

    // Label current pressure
    svg.append("text")
        .attr("x", centerX)
        .attr("y", centerY + radius)
        .attr("text-anchor", "middle")
        .attr("font-size", "14px")
        .text(`${displayValue} ${displayUnit}`);
}

function drawAstronomicalClock(svgSelector, sunEphemeris) {
    const referenceTime = new Date();
    const svg = d3.select(svgSelector);
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const radius = Math.min(width, height) / 3;
    const outerRadius = radius * 1.2;
    const center = {x: width / 2, y: height / 2};

    const defs = svg.append("defs")
        .append("marker")
        .attr("id", "arrow")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 0)
        .attr("refY", 5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M 0 0 L 10 5 L 0 10 z")
        .attr("fill", "red");

    // Draw compass background
    svg.append("circle")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", radius)
        .attr("fill", "none")
        .attr("stroke", "#aaa");

    const scale = d3.scaleLinear().domain([0, 360]).range([0, 2 * Math.PI]);

    const arc = svg.append("g").attr("transform", `translate(${center.x},${center.y})`);
    const ticks = d3.range(0, 360, 6);
    ticks.forEach(angleInDegrees => {
        const angle = scale(angleInDegrees);
        const isHourTick = angleInDegrees % 30 === 0;
        const x1 = Math.cos(angle) * (radius - (isHourTick ? (radius * 0.1) : (radius * 0.166)));
        const y1 = Math.sin(angle) * (radius - (isHourTick ? (radius * 0.1) : (radius * 0.166)));
        const x2 = Math.cos(angle) * (radius - (radius * 0.2));
        const y2 = Math.sin(angle) * (radius - (radius * 0.2));
        arc.append("line")
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2)
            .attr("stroke", "#FFFFFF")
            .attr("stroke-width", isHourTick ? 3 : 1);
    });

    // Arrow line across full diameter
    const hourPointerAngleInRad = (referenceTime.getHours() * 30 - 90 + referenceTime.getMinutes() / 2) * Math.PI / 180;
    const x1 = center.x ; // tail
    const y1 = center.y ;
    const x2 = center.x + radius * 0.5 * Math.cos(hourPointerAngleInRad); // head
    const y2 = center.y + radius * 0.5 * Math.sin(hourPointerAngleInRad);

    svg.append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", "red")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 6);

    // Arrow line across full diameter
    const minutePointerAngleInRad = (referenceTime.getMinutes() * 6 - 90) * Math.PI / 180;
    const xx1 = center.x ; // tail
    const yy1 = center.y ;
    const xx2 = center.x + radius * 0.7 * Math.cos(minutePointerAngleInRad); // head
    const yy2 = center.y + radius * 0.7 * Math.sin(minutePointerAngleInRad);

    svg.append("line")
        .attr("x1", xx1)
        .attr("y1", yy1)
        .attr("x2", xx2)
        .attr("y2", yy2)
        .attr("stroke", "white")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 6);

    // An arc will be created
    //svg, radius, outerRadius, color, center, startAngle, endAngle
    drawSunAltitudeArc(svg, radius, outerRadius, "#BBCAEB", center, getEphemerisAngleInRadians(sunEphemeris["rise"]), getEphemerisAngleInRadians(sunEphemeris["set"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#1E1F24", center, -180 * (Math.PI / 180), getEphemerisAngleInRadians(sunEphemeris["astronomicalTwilightStart"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#1E1F24", center, getEphemerisAngleInRadians(sunEphemeris["astronomicalTwilightEnd"]), 180 * (Math.PI / 180));
    drawSunAltitudeArc(svg, radius, outerRadius, "#2E3959", center, getEphemerisAngleInRadians(sunEphemeris["astronomicalTwilightStart"]), getEphemerisAngleInRadians(sunEphemeris["nauticalTwilightStart"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#2E3959", center, getEphemerisAngleInRadians(sunEphemeris["nauticalTwilightEnd"]), getEphemerisAngleInRadians(sunEphemeris["astronomicalTwilightEnd"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#3C4C87", center, getEphemerisAngleInRadians(sunEphemeris["nauticalTwilightStart"]), getEphemerisAngleInRadians(sunEphemeris["civilTwilightStart"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#3C4C87", center, getEphemerisAngleInRadians(sunEphemeris["civilTwilightEnd"]), getEphemerisAngleInRadians(sunEphemeris["nauticalTwilightEnd"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#668BDB", center, getEphemerisAngleInRadians(sunEphemeris["civilTwilightStart"]), getEphemerisAngleInRadians(sunEphemeris["rise"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#668BDB", center, getEphemerisAngleInRadians(sunEphemeris["set"]), getEphemerisAngleInRadians(sunEphemeris["civilTwilightEnd"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#D3AC5D", center, getEphemerisAngleInRadians(sunEphemeris["rise"]), getEphemerisAngleInRadians(sunEphemeris["goldenHourEnd"]));
    drawSunAltitudeArc(svg, radius, outerRadius, "#D3AC5D", center, getEphemerisAngleInRadians(sunEphemeris["goldenHourStart"]), getEphemerisAngleInRadians(sunEphemeris["set"]));
    d3.range(0, 360, 7.5).forEach(angleInDegrees => {
        const angle = scale(angleInDegrees);
        const x1 = Math.cos(angle) * (outerRadius) + center.x;
        const y1 = Math.sin(angle) * (outerRadius) + center.y;
        const x2 = Math.cos(angle) * (outerRadius * 0.97) + center.x;
        const y2 = Math.sin(angle) * (outerRadius * 0.97) + center.y;

        svg.append("line")
            .attr("x1", x1).attr("y1", y1)
            .attr("x2", x2).attr("y2", y2)
            .attr("stroke", "#72757D")
            .attr("stroke-width", angleInDegrees % 15 === 0 ? 3 : 1);

        if (angleInDegrees % 15 === 0) {
            svg.append("text")
                .attr("x", Math.cos(angle) * (radius * 1.1) + center.x)
                .attr("y", Math.sin(angle) * (radius * 1.1) + center.y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .attr("font-size", "12px")
                .attr("color", "#72757D")
                .text((angleInDegrees - 90 >= 0 ? angleInDegrees - 90 : angleInDegrees + 270) / 15);
        }

        // Center dot
        svg.append("circle")
            .attr("cx", center.x)
            .attr("cy", center.y)
            .attr("r", 6)
            .attr("fill", "yellow");

    });

    // Arrow line across full diameter
    const sunPointerAngleInRad = (((referenceTime.getHours() * 60 + referenceTime.getMinutes()) / 4) + 90) * (Math.PI / 180);
    const sunX1 = center.x ; // tail
    const sunY1 = center.y ;
    const sunX2 = center.x + radius * 1.1 * Math.cos(sunPointerAngleInRad); // head
    const sunY2 = center.y + radius * 1.1 * Math.sin(sunPointerAngleInRad);

    // Draw yellow tick-style markers for solar transit and lower solar transit on the 24h outer ring
    const drawTransitLine = (dateObj) => {
        if (!dateObj || typeof dateObj.getHours !== 'function') return;
        const angle = (((dateObj.getHours() * 60 + dateObj.getMinutes()) / 4) + 90) * (Math.PI / 180);
        const tx1 = center.x + Math.cos(angle) * (outerRadius);
        const ty1 = center.y + Math.sin(angle) * (outerRadius);
        const tx2 = center.x + Math.cos(angle) * (outerRadius * 0.94);
        const ty2 = center.y + Math.sin(angle) * (outerRadius * 0.94);
        svg.append("line")
            .attr("x1", tx1)
            .attr("y1", ty1)
            .attr("x2", tx2)
            .attr("y2", ty2)
            .attr("stroke", "yellow")
            .attr("stroke-width", 3);
    };

    drawTransitLine(sunEphemeris["solarTransit"]);
    drawTransitLine(sunEphemeris["lowerSolarTransit"]);

    svg.append("line")
        .attr("x1", sunX1)
        .attr("y1", sunY1)
        .attr("x2", sunX2)
        .attr("y2", sunY2)
        .attr("stroke", "yellow")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 2);

}

function getEphemerisAngleInRadians(ephemeris) {
    return (((ephemeris.getHours() * 60 + ephemeris.getMinutes()) / 4) - 180) * (Math.PI / 180);
}

function drawSvgArrow(angle) {
    return `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <title>The wind comes from ${angle} degrees</title>
        <path d="M10 2 L14 10 H11 V18 H9 V10 H6 Z" fill="red" transform="rotate(${angle + 180}, 10, 10)" />
        </svg>`
}

function drawSunAltitudeArc(svg, radius, outerRadius, color, center, startAngle, endAngle) {
    svg.append("path")
        .attr("class", "arc")
        .attr("d", d3.arc()
            .innerRadius(radius)
            .outerRadius(outerRadius)
            .startAngle(startAngle)
            .endAngle(endAngle))
        .attr("fill", color)
        .attr("transform", `translate(${center.x},${center.y})`);
}