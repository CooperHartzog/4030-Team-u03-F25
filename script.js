// ===============================
// Load Data
// ===============================
d3.csv("data/Superstore.csv").then(function(data) {

    // Convert numeric fields
    data.forEach(d => {
        d.Sales = +d.Sales;
        d.Profit = +d.Profit;
        d.Quantity = +d.Quantity;
        d.Discount = +d.Discount;

        // Parse date (Order Date format: DD-MM-YYYY)
        d.OrderDate = d3.timeParse("%d-%m-%Y")(d["Order Date"]);
    });

    // Build Charts
    categorySalesChart(data);
    salesProfitScatter(data);
    monthlySalesTrend(data);
    regionalSalesMap(data);

});


// ===============================
// 1. Sales by Category (Bar Chart)
// ===============================
function categorySalesChart(data) {

    const svg = d3.select("#category-sales svg"),
          width = 400,
          height = 300,
          margin = { top: 20, right: 20, bottom: 40, left: 60 };

    svg.attr("width", width).attr("height", height);

    // Group sales by category
    const categorySales = d3.rollups(
        data,
        v => d3.sum(v, d => d.Sales),
        d => d.Category
    );

    // Scales
    const x = d3.scaleBand()
        .domain(categorySales.map(d => d[0]))
        .range([margin.left, width - margin.right])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, d3.max(categorySales, d => d[1])])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Bars
    svg.selectAll("rect")
        .data(categorySales)
        .enter()
        .append("rect")
        .attr("x", d => x(d[0]))
        .attr("y", d => y(d[1]))
        .attr("width", x.bandwidth())
        .attr("height", d => y(0) - y(d[1]))
        .attr("fill", "#69b3a2");

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y));
}



// =====================================
// 2. Sales vs Profit (Scatterplot)
// =====================================
function salesProfitScatter(data) {

    const svg = d3.select("#sales-profit svg"),
          width = 400,
          height = 300,
          margin = { top: 20, right: 20, bottom: 40, left: 60 };

    svg.attr("width", width).attr("height", height);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.Sales)])
        .nice()
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.Profit))
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Points
    svg.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Sales))
        .attr("cy", d => y(d.Profit))
        .attr("r", 3)
        .attr("fill", "#3366cc")
        .attr("opacity", 0.6);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y));
}



// =====================================
// 3. Monthly Sales Trend (Line Chart)
// =====================================
function monthlySalesTrend(data) {

    const svg = d3.select("#monthly-sales svg"),
          width = 400,
          height = 300,
          margin = { top: 20, right: 20, bottom: 40, left: 60 };

    svg.attr("width", width).attr("height", height);

    // Group by month
    const monthlySales = d3.rollups(
        data,
        v => d3.sum(v, d => d.Sales),
        d => d3.timeMonth(d.OrderDate)
    ).sort((a, b) => a[0] - b[0]);

    const x = d3.scaleTime()
        .domain(d3.extent(monthlySales, d => d[0]))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(monthlySales, d => d[1])])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Line generator
    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    // Draw line
    svg.append("path")
        .datum(monthlySales)
        .attr("fill", "none")
        .attr("stroke", "#ff6600")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y")).ticks(6));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y));
}

// =====================================
// 4. Regional Sales Bubble Map (USA)
// =====================================
function regionalSalesMap(data) {

    const svg = d3.select("#regional-sales svg"),
          width = 450,
          height = 300;

    svg.attr("width", width).attr("height", height);

    // -----------------------------------
    // Load GeoJSON + then draw the map
    // -----------------------------------
    d3.json("data/us-states.json").then(function(geo) {

        // -----------------------------------------
        // Aggregate sales by state
        // -----------------------------------------
        const salesByState = d3.rollups(
            data,
            v => d3.sum(v, d => d.Sales),
            d => d.State
        );

        const salesMap = new Map(salesByState);

        // -----------------------------------------
        // Projection & Path
        // -----------------------------------------
        const projection = d3.geoAlbersUsa()
            .translate([width / 2, height / 2])
            .scale(400);

        const path = d3.geoPath().projection(projection);

        // Draw states
        svg.selectAll("path")
            .data(geo.features)
            .enter()
            .append("path")
            .attr("d", path)
            .attr("fill", "#e0e0e0")
            .attr("stroke", "#999");

        // -----------------------------------------
        // Prepare bubble data
        // -----------------------------------------
        const bubbles = geo.features.map(d => {
            const center = path.centroid(d);
            const stateName = d.properties.name;
            const sales = salesMap.get(stateName) || 0;

            return {
                state: stateName,
                sales: sales,
                x: center[0],
                y: center[1]
            };
        });

        // Bubble radius scale
        const r = d3.scaleSqrt()
            .domain([0, d3.max(bubbles, d => d.sales)])
            .range([0, 20]);

        // Draw circles
        svg.selectAll("circle")
            .data(bubbles.filter(d => d.x && d.y))
            .enter()
            .append("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => r(d.sales))
            .attr("fill", "steelblue")
            .attr("opacity", 0.7)
            .attr("stroke", "white");

        // OPTIONAL: Add simple tooltips
        svg.selectAll("circle")
            .append("title")
            .text(d => `${d.state}: $${d.sales.toLocaleString()}`);

    });
}

