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

function drawWindGauge(svgSelector, windDirection) {
    const svg = d3.select(svgSelector);
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    const radius = Math.min(width, height) / 2 - 20;
    const center = {x: width / 2, y: height / 2};

    svg.append("defs")
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


// Arrow line across full diameter
    const angleRad = (windDirection + 90) * Math.PI / 180;
    const x1 = center.x - radius * 0.8 * Math.cos(angleRad); // tail
    const y1 = center.y - radius * 0.8 * Math.sin(angleRad);
    const x2 = center.x + radius * 0.6 * Math.cos(angleRad); // head
    const y2 = center.y + radius * 0.6 * Math.sin(angleRad);

    svg.append("line")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .attr("stroke", "red")
        .attr("stroke-width", 3)
        .attr("marker-end", "url(#arrow)");

// Center dot
    svg.append("circle")
        .attr("cx", center.x)
        .attr("cy", center.y)
        .attr("r", 5)
        .attr("fill", "red");
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

function drawSvgArrow(angle) {
    return `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <title>The wind comes from ${angle} degrees</title>
        <path d="M10 2 L14 10 H11 V18 H9 V10 H6 Z" fill="red" transform="rotate(${angle + 180}, 10, 10)" />
        </svg>`
}