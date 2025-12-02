// ===============================
// Tooltip Setup
// ===============================
const tooltip = d3.select("#tooltip");
let selectedCategories = new Set(["Furniture", "Office Supplies", "Technology"]);

// ===============================
// Global Highlighting Functions
// ===============================
function highlightCategory(category) {
    d3.selectAll(".data-point")      // scatter points
        .attr("opacity", d => d.Category === category ? 1 : 0.15);

    d3.selectAll(".bar")             // bar chart
        .attr("opacity", d => d[0] === category ? 1 : 0.15);

    d3.selectAll(".map-bubble")      // bubbles on the map
        .attr("opacity", d => d.category === category ? 1 : 0.15);
}

function resetHighlight() {
    d3.selectAll(".data-point").attr("opacity", 0.55);
    d3.selectAll(".bar").attr("opacity", 1);
    d3.selectAll(".map-bubble").attr("opacity", 0.7);
}


function showTooltip(event, content) {
    tooltip
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 28) + "px")
        .html(content)
        .classed("visible", true);
}

function hideTooltip() {
    tooltip.classed("visible", false);
}

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
        d.OrderDate = d3.timeParse("%d-%m-%Y")(d["Order Date"]);
    });

    console.log("Data loaded:", data.length, "rows");
    console.log("Sample row:", data[0]);

    // Category filter listener
    d3.selectAll("#filters input").on("change", function() {
        if (this.checked) {
            selectedCategories.add(this.value);
        } else {
            selectedCategories.delete(this.value);
        }

        updateAllCharts();
    });

    // Draw dashboard initially
    updateAllCharts();

    // Function that redraws all charts after filtering
    function updateAllCharts() {
        const filtered = data.filter(d => selectedCategories.has(d.Category));

        d3.selectAll("svg").selectAll("*").remove();

        categorySalesChart(filtered);
        salesProfitScatter(filtered);
        monthlySalesTrend(filtered);
        regionalSalesMap(filtered);
    }

}).catch(error => {
    console.error("Error loading CSV:", error);
});



// ===============================
// 1. Sales by Category (Bar Chart)
// ===============================
function categorySalesChart(data) {

    const svg = d3.select("#category-sales svg");
    width = 360,
    height = 250,
    margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const container = d3.select("#category-sales");
    const containerWidth = container.node().getBoundingClientRect().width;

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Group sales by category
    const categorySales = d3.rollups(
        data,
        v => d3.sum(v, d => d.Sales),
        d => d.Category
    );

    // Sort by sales descending
    categorySales.sort((a, b) => b[1] - a[1]);

    // FIXED COLOR MAPPING - consistent across all charts
    const colorScale = d3.scaleOrdinal()
        .domain(['Furniture', 'Office Supplies', 'Technology'])
        .range(['#3498db', '#2ecc71', '#e74c3c']);

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
    svg.selectAll(".bar")
    .data(categorySales)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d[0]))
    .attr("y", d => y(d[1]))
    .attr("width", x.bandwidth())
    .attr("height", d => y(0) - y(d[1]))
    .attr("fill", d => colorScale(d[0]))
    .on("mouseover", function(event, d) {
        highlightCategory(d[0]);   // NEW
        const content = `<strong>${d[0]}</strong><br/>Sales: $${d[1].toLocaleString()}`;
        showTooltip(event, content);
    })
    .on("mouseout", function(event, d) {
        resetHighlight();          // NEW
        hideTooltip();
    });


    // X Axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.15em");

    // Y Axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)));

    // Axis Labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - 10)
        .attr("text-anchor", "middle")
        .text("Category");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .text("Total Sales ($)");
}



// =====================================
// 2. Sales vs Profit (Scatterplot)
// =====================================
function salesProfitScatter(data) {

    const svg = d3.select("#sales-profit svg"),
          width = 900,
          height = 300,
          margin = { top: 40, right: 200, bottom: 60, left: 80 };

    svg.attr("width", width).attr("height", height);

    // -------------------------------
    //  Compute clipped extents
    // -------------------------------
    const salesSorted = data.map(d => d.Sales).sort(d3.ascending);
    const profitSorted = data.map(d => d.Profit).sort(d3.ascending);

    const salesClip = d3.quantile(salesSorted, 0.95);   // cap at 95%
    const profitLowClip = d3.quantile(profitSorted, 0.02);  // bottom 2%
    const profitHighClip = d3.quantile(profitSorted, 0.98); // top 2%

    // -------------------------------
    //  Scales
    // -------------------------------
    const x = d3.scaleLinear()
        .domain([0, salesClip])
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([profitLowClip, profitHighClip])
        .range([height - margin.bottom, margin.top]);

    const categories = Array.from(new Set(data.map(d => d.Category)));

    const color = d3.scaleOrdinal()
        .domain(categories)
        .range(["#1f77b4", "#ff7f0e", "#2ca02c"]);

    // -------------------------------
    //  Tooltip
    // -------------------------------
    const tooltip = d3.select("body")
        .append("div")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "8px")
        .style("font-size", "12px")
        .style("pointer-events", "none")
        .style("opacity", 0);

    // -------------------------------
    //  Draw Points
    // -------------------------------
    svg.selectAll(".data-point")
    .data(data.filter(d => d.Sales <= salesClip &&
                           d.Profit >= profitLowClip &&
                           d.Profit <= profitHighClip))
    .enter()
    .append("circle")
    .attr("class", "data-point")   // NEW
    .attr("cx", d => x(d.Sales))
    .attr("cy", d => y(d.Profit) + (Math.random() * 8 - 4))
    .attr("r", 3)
    .attr("fill", d => color(d.Category))
    .attr("opacity", 0.55)
    .on("mouseover", (event, d) => {
        highlightCategory(d.Category);         // NEW
        tooltip.style("opacity", 1).html(`
            <strong>${d['Product Name']}</strong><br>
            Sales: $${d.Sales.toFixed(2)}<br>
            Profit: $${d.Profit.toFixed(2)}<br>
            Category: ${d.Category}
        `);
    })
    .on("mousemove", (event) => {
        tooltip.style("top", (event.pageY + 10) + "px")
               .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", () => {
        resetHighlight();                       // NEW
        tooltip.style("opacity", 0);
    });


    // -------------------------------
    //  Axes
    // -------------------------------
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y));

    // Axis Labels
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 15)
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .text("Sales (Clipped at 95th percentile)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .text("Profit (Clipped at 2%–98%)");

    // -------------------------------
    //  Legend
    // -------------------------------
    const legend = svg.append("g")
        .attr("transform", `translate(${width - margin.right + 20}, ${margin.top})`);

    categories.forEach((cat, i) => {
        const g = legend.append("g")
            .attr("transform", `translate(0, ${i * 20})`);

        g.append("rect")
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", color(cat));

        g.append("text")
            .attr("x", 20)
            .attr("y", 10)
            .style("font-size", "12px")
            .text(cat);
    });
}


function monthlySalesTrendForState(data, stateName) {
    const svg = d3.select("#monthly-sales svg");
    svg.selectAll("*").remove();  // Clear existing line chart

    const width = 360,
          height = 250,
          margin = { top: 20, right: 20, bottom: 40, left: 60 };

    // Filter to selected state
    const filtered = data.filter(d => d.State === stateName);

    // Group by month
    const monthlySales = d3.rollups(
        filtered,
        v => d3.sum(v, d => d.Sales),
        d => d3.timeMonth(d.OrderDate)
    ).sort((a, b) => a[0] - b[0]);

    const x = d3.scaleTime()
        .domain(d3.extent(monthlySales, d => d[0]))
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(monthlySales, d => d[1]) || 1])
        .nice()
        .range([height - margin.bottom, margin.top]);

    // Line
    const line = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(monthlySales)
        .attr("fill", "none")
        .attr("stroke", "#e67e22")
        .attr("stroke-width", 3)
        .attr("d", line);

    // Points
    svg.selectAll(".state-point")
        .data(monthlySales)
        .enter()
        .append("circle")
        .attr("class", "state-point")
        .attr("cx", d => x(d[0]))
        .attr("cy", d => y(d[1]))
        .attr("r", 4)
        .attr("fill", "#d35400");

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y")).ticks(6))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)));

    // Label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .text(`Monthly Sales – ${stateName}`);
}

function resetMonthlyLine(data) {
    d3.select("#monthly-sales svg").selectAll("*").remove();
    monthlySalesTrend(data);
}



// =====================================
// 3. Monthly Sales Trend (Line Chart)
// =====================================
function monthlySalesTrend(data) {

    const svg = d3.select("#monthly-sales svg");
    width = 360,
    height = 250,
    margin = { top: 20, right: 20, bottom: 40, left: 60 };
    const container = d3.select("#monthly-sales");
    const containerWidth = container.node().getBoundingClientRect().width;
    

    svg.attr("viewBox", `0 0 ${width} ${height}`);

    // Group by month
    const monthlySales = d3.rollups(
        data,
        v => d3.sum(v, d => d.Sales),
        d => d3.timeMonth(d.OrderDate)
    ).sort((a, b) => a[0] - b[0]);

    console.log("Monthly sales data points:", monthlySales.length);

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
        .y(d => y(d[1]))
        .curve(d3.curveMonotoneX);

    // Draw line
    svg.append("path")
        .datum(monthlySales)
        .attr("class", "line-path")
        .attr("fill", "none")
        .attr("stroke", "#3498db")
        .attr("stroke-width", 3)
        .attr("d", line);

    // Add points
    svg.selectAll(".line-point")
        .data(monthlySales)
        .enter()
        .append("circle")
        .attr("class", "line-point")
        .attr("cx", d => x(d[0]))
        .attr("cy", d => y(d[1]))
        .attr("r", 4)
        .attr("fill", "#e74c3c")
        .attr("stroke", "white")
        .attr("stroke-width", 2)
        .on("mouseover", function(event, d) {
            const content = `<strong>${d3.timeFormat("%B %Y")(d[0])}</strong><br/>
                           Sales: $${d[1].toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            showTooltip(event, content);
        })
        .on("mouseout", hideTooltip);

    // X Axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0, ${height - margin.bottom})`)
        .call(d3.axisBottom(x).tickFormat(d3.timeFormat("%b %Y")).ticks(8))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.15em");

    // Y Axis
    svg.append("g")
        .attr("class", "axis")
        .attr("transform", `translate(${margin.left}, 0)`)
        .call(d3.axisLeft(y).tickFormat(d => "$" + d3.format(".2s")(d)));

    // Axis Labels
    svg.append("text")
        .attr("class", "axis-label")
        .attr("x", width / 2)
        .attr("y", height - 10)
        .attr("text-anchor", "middle")
        .text("Month");

    svg.append("text")
        .attr("class", "axis-label")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", 15)
        .attr("text-anchor", "middle")
        .text("Total Sales ($)");
}

// =====================================
// 4. Regional Sales Bubble Map (USA)
// =====================================
function regionalSalesMap(data) {
  const svg = d3.select("#regional-sales svg");
  const width = 450, height = 300;

  svg.attr("width", width).attr("height", height);
  svg.selectAll("*").remove(); // clear before redraws

  // Load canonical US states (TopoJSON) and convert to GeoJSON
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
    const geo = topojson.feature(us, us.objects.states); // -> GeoJSON FeatureCollection

    // Aggregate totals per state (and top category per state for highlight sync)
    const salesByState = d3.rollup(
      data,
      v => d3.sum(v, d => d.Sales),
      d => d.State
    );

    const byStateCat = d3.rollup(
      data,
      v => d3.rollup(v, vv => d3.sum(vv, d => d.Sales), d => d.Category),
      d => d.State
    );
    const topCategory = (state) => {
      const m = byStateCat.get(state);
      if (!m) return null;
      return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0][0];
    };

    // Projection & path (fit perfectly to the SVG)
    const projection = d3.geoAlbersUsa().fitSize([width, height], geo);
    const path = d3.geoPath(projection);

    // Draw state outlines (inline styles so CSS can’t hide them)
    svg.append("g")
      .attr("class", "states")
      .selectAll("path")
      .data(geo.features)
      .join("path")
        .attr("class", "state-path")
        .attr("d", path)
        .style("fill", "#f2f2f2")
        .style("stroke", "#666")
        .style("stroke-width", 0.8)
        .style("vector-effect", "non-scaling-stroke");

    // Bubbles at state centroids
    const bubbles = geo.features.map(f => {
      const [cx, cy] = path.centroid(f);
      const state = f.properties.name;       // full state name
      const sales = salesByState.get(state) || 0;
      return { state, sales, x: cx, y: cy, category: topCategory(state) };
    }).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));

    const r = d3.scaleSqrt()
      .domain([0, d3.max(bubbles, d => d.sales) || 1])
      .range([0, 20]);

    const fmt = d3.format(",.0f");

    const circles = svg.append("g")
      .selectAll("circle")
      .data(bubbles)
      .join("circle")
        .attr("class", "map-bubble")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r",  d => r(d.sales))
        .style("fill", "steelblue")
        .style("opacity", 0.7)
        .style("stroke", "white")
        .style("stroke-width", 1)
        .on("mouseover", (event, d) => {
          if (d.category) highlightCategory(d.category);
          showTooltip(event, `<strong>${d.state}</strong><br>Sales: $${fmt(d.sales)}`);
        })
        .on("mouseleave", () => { resetHighlight(); hideTooltip(); })
        .on("click", (_, d) => monthlySalesTrendForState(data, d.state));

    // Title for keyboard users
    circles.append("title")
      .text(d => `${d.state}\nSales: $${fmt(d.sales)}`);
  })
  .catch(err => console.error("Map error:", err));
}

