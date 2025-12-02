/* Script.js */


// Global variables
let data = [];
const tooltip = d3.select('.tooltip');

// Load and process data
d3.csv('data/Superstore.csv').then(rawData => {
    console.log('=== CSV LOADING ===');
    console.log('Raw data loaded:', rawData.length, 'rows');
    
    // Parse and clean data
    data = rawData.map(d => ({
        ...d,
        Sales: +d.Sales,
        Profit: +d.Profit,
        Quantity: +d.Quantity,
        Discount: +d.Discount,
        OrderDate: new Date(d['Order Date'])
    })).filter(d => !isNaN(d.OrderDate));
    
    console.log('Data loaded:', data.length, 'rows');
    console.log('===================');
    
    // Create all visualizations
    console.log('Starting visualizations...');
    createCategoryBarChart();
    createMonthlySalesLineChart();
    createSalesVsProfitScatter();
    regionalSalesMap(data);
});

// 1. COMPACT BAR CHART - Sales by Category
function createCategoryBarChart() {
    console.log('📊 BAR CHART: Starting...');
    const margin = {top: 20, right: 20, bottom: 70, left: 60};
    const width = 310 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;
    
    const svg = d3.select('#category-sales svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Aggregate sales by category
    const categoryData = d3.rollup(
        data,
        v => d3.sum(v, d => d.Sales),
        d => d.Category
    );
    
    const chartData = Array.from(categoryData, ([category, sales]) => ({
        category,
        sales
    })).sort((a, b) => b.sales - a.sales);
    
    // Scales
    const x = d3.scaleBand()
        .domain(chartData.map(d => d.category))
        .range([0, width])
        .padding(0.3);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.sales)])
        .nice()
        .range([height, 0]);
    
    // Simple color scale - blue theme
    const color = d3.scaleOrdinal()
        .domain(chartData.map(d => d.category))
        .range(['#4285f4', '#34a853', '#fbbc04']);
    
    // Axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.5em');
    
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + d3.format('.2s')(d)));
    
    // Bars
    svg.selectAll('.bar')
        .data(chartData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.category))
        .attr('y', d => y(d.sales))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.sales))
        .attr('fill', d => color(d.category))
        .on('mouseover', function(event, d) {
            d3.select(this).attr('fill', '#ea4335');
            showTooltip(event, `
                <strong>${d.category}</strong><br>
                Sales: $${d3.format(',.0f')(d.sales)}
            `);
        })
        .on('mouseout', function(event, d) {
            d3.select(this).attr('fill', color(d.category));
            hideTooltip();
        });
    
    console.log('📊 BAR CHART: Complete!');
}

// 2. COMPACT LINE CHART - Monthly Sales Trend
function createMonthlySalesLineChart() {
    console.log('📈 LINE CHART: Starting...');
    const margin = {top: 20, right: 20, bottom: 50, left: 60};
    const width = 310 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;
    
    const svg = d3.select('#monthly-sales svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Aggregate sales by month
    const monthlyData = d3.rollup(
        data,
        v => d3.sum(v, d => d.Sales),
        d => d3.timeMonth(d.OrderDate)
    );
    
    const chartData = Array.from(monthlyData, ([date, sales]) => ({
        date,
        sales
    })).sort((a, b) => a.date - b.date);
    
    // Scales
    const x = d3.scaleTime()
        .domain(d3.extent(chartData, d => d.date))
        .range([0, width]);
    
    const y = d3.scaleLinear()
        .domain([0, d3.max(chartData, d => d.sales)])
        .nice()
        .range([height, 0]);
    
    // Axes
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');
    
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => '$' + d3.format('.2s')(d)));
    
    // Line - blue
    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.sales))
        .curve(d3.curveMonotoneX);
    
    svg.append('path')
        .datum(chartData)
        .attr('class', 'line-path')
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', '#4285f4')
        .attr('stroke-width', 3);
    
    // Dots
    svg.selectAll('.line-dot')
        .data(chartData)
        .join('circle')
        .attr('class', 'line-dot')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.sales))
        .attr('r', 3)
        .attr('fill', '#34a853')
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .on('mouseover', function(event, d) {
            d3.select(this).attr('r', 5);
            showTooltip(event, `
                <strong>${d3.timeFormat('%B %Y')(d.date)}</strong><br>
                Sales: $${d3.format(',.0f')(d.sales)}
            `);
        })
        .on('mouseout', function() {
            d3.select(this).attr('r', 3);
            hideTooltip();
        });
    
    console.log('📈 LINE CHART: Complete!');
}

// 3. ENHANCED SCATTERPLOT - Sales vs Profit with Category Filtering
function createSalesVsProfitScatter() {
    console.log('🔵 SCATTER: Starting...');
    
    const container = document.querySelector('#sales-profit');
    if (!container) {
        console.error('❌ SCATTER: #sales-profit element NOT FOUND!');
        return;
    }
    
    console.log('✅ SCATTER: Container found!');
    
    const margin = {top: 20, right: 30, bottom: 60, left: 70};
    const containerWidth = container.clientWidth;
    const width = containerWidth - margin.left - margin.right;
    const height = 500 - margin.top - margin.bottom;
    
    const svg = d3.select('#sales-profit svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Category filter state
    let selectedCategory = 'all';
    
    // Color scale by category
    const color = d3.scaleOrdinal()
        .domain(['Furniture', 'Office Supplies', 'Technology'])
        .range(['#4285f4', '#34a853', '#fbbc04']);
    
    function updateScatter() {
        console.log('🔵 SCATTER: Updating with category:', selectedCategory);
        
        // Filter data by category
        let filteredData = data;
        if (selectedCategory !== 'all') {
            filteredData = data.filter(d => d.Category === selectedCategory);
        }
        
        console.log('🔵 SCATTER: Filtered data points:', filteredData.length);
        
        // Clear previous
        svg.selectAll('*').remove();
        
        // Scales
        const x = d3.scaleLinear()
            .domain([0, d3.max(filteredData, d => d.Sales) * 1.05])
            .range([0, width]);
        
        const y = d3.scaleLinear()
            .domain([
                d3.min(filteredData, d => d.Profit) * 1.1,
                d3.max(filteredData, d => d.Profit) * 1.1
            ])
            .range([height, 0]);
        
        // Grid lines
        svg.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickSize(-height)
                .tickFormat('')
            );
        
        svg.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y)
                .tickSize(-width)
                .tickFormat('')
            );
        
        // Axes
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d => '$' + d3.format('.2s')(d)));
        
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(y).tickFormat(d => '$' + d3.format('.2s')(d)));
        
        // Axis labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + 45)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text('Sales ($)');
        
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#666')
            .text('Profit ($)');
        
        // Zero line for profit
        if (y.domain()[0] < 0 && y.domain()[1] > 0) {
            svg.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', y(0))
                .attr('y2', y(0))
                .attr('stroke', '#e74c3c')
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5');
        }
        
        // Circles
        svg.selectAll('.scatter-circle')
            .data(filteredData)
            .join('circle')
            .attr('class', 'scatter-circle')
            .attr('cx', d => x(d.Sales))
            .attr('cy', d => y(d.Profit))
            .attr('r', 5)
            .attr('fill', d => color(d.Category))
            .attr('opacity', 0.6)
            .attr('stroke', d => color(d.Category))
            .attr('stroke-width', 1)
            .on('mouseover', function(event, d) {
                d3.select(this)
                    .attr('r', 8)
                    .attr('opacity', 1)
                    .attr('stroke-width', 2);
                showTooltip(event, `
                    <strong>${d.Category}</strong><br>
                    ${d['Sub-Category']}<br>
                    Sales: $${d3.format(',.2f')(d.Sales)}<br>
                    Profit: $${d3.format(',.2f')(d.Profit)}<br>
                    Margin: ${d3.format('.1%')(d.Profit / d.Sales)}
                `);
            })
            .on('mouseout', function() {
                d3.select(this)
                    .attr('r', 5)
                    .attr('opacity', 0.6)
                    .attr('stroke-width', 1);
                hideTooltip();
            });
        
        // Legend (only show if 'all' is selected)
        if (selectedCategory === 'all') {
            const legend = svg.append('g')
                .attr('transform', `translate(${width - 150}, 10)`);
            
            const categories = ['Furniture', 'Office Supplies', 'Technology'];
            categories.forEach((cat, i) => {
                const g = legend.append('g')
                    .attr('transform', `translate(0, ${i * 22})`);
                
                g.append('circle')
                    .attr('r', 6)
                    .attr('fill', color(cat))
                    .attr('opacity', 0.6);
                
                g.append('text')
                    .attr('x', 12)
                    .attr('y', 4)
                    .style('font-size', '12px')
                    .style('fill', '#666')
                    .text(cat);
            });
        }
        
        console.log('✅ SCATTER: Chart rendered!');
    }
    
    // Initial render
    updateScatter();
    
    // Category button event listeners
    d3.selectAll('.category-btn').on('click', function() {
        // Remove active class from all buttons
        d3.selectAll('.category-btn').classed('active', false);
        // Add active to clicked button
        d3.select(this).classed('active', true);
        // Update selected category
        selectedCategory = this.dataset.category;
        // Re-render
        updateScatter();
    });
    
    console.log('✅ SCATTER: Complete!');
}

// =====================================
// 4. Regional Sales Bubble Map (USA) - LARGER
// =====================================
function regionalSalesMap(data) {
    console.log('🗺️ REGIONAL MAP: Starting...');
    
    const container = document.querySelector('#regional-sales');
    const svg = d3.select("#regional-sales svg");
    
    // Make it larger to fill the space
    const containerWidth = container ? container.clientWidth : 1200;
    const width = Math.min(containerWidth - 50, 1200);
    const height = 600;

    svg.attr("width", width).attr("height", height);
    svg.selectAll("*").remove();

    // Load canonical US states (TopoJSON) and convert to GeoJSON
    d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json").then(us => {
        const geo = topojson.feature(us, us.objects.states);

        // Aggregate totals per state
        const salesByState = d3.rollup(
            data,
            v => d3.sum(v, d => d.Sales),
            d => d.State
        );

        // Projection & path (fit perfectly to the SVG)
        const projection = d3.geoAlbersUsa().fitSize([width, height], geo);
        const path = d3.geoPath(projection);

        // Draw state outlines
        svg.append("g")
            .attr("class", "states")
            .selectAll("path")
            .data(geo.features)
            .join("path")
            .attr("class", "state-path")
            .attr("d", path)
            .style("fill", "#f2f2f2")
            .style("stroke", "#666")
            .style("stroke-width", 1)
            .style("vector-effect", "non-scaling-stroke");

        // Bubbles at state centroids
        const bubbles = geo.features.map(f => {
            const [cx, cy] = path.centroid(f);
            const state = f.properties.name;
            const sales = salesByState.get(state) || 0;
            return { state, sales, x: cx, y: cy };
        }).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));

        // Larger bubble scale for bigger map
        const r = d3.scaleSqrt()
            .domain([0, d3.max(bubbles, d => d.sales) || 1])
            .range([0, 35]);

        const fmt = d3.format(",.0f");

        const circles = svg.append("g")
            .selectAll("circle")
            .data(bubbles)
            .join("circle")
            .attr("class", "map-bubble")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", d => r(d.sales))
            .style("fill", "steelblue")
            .style("opacity", 0.7)
            .style("stroke", "white")
            .style("stroke-width", 2)
            .on("mouseover", (event, d) => {
                showTooltip(event, `<strong>${d.state}</strong><br>Sales: $${fmt(d.sales)}`);
            })
            .on("mouseleave", () => {
                hideTooltip();
            });

        // Title for keyboard users
        circles.append("title")
            .text(d => `${d.state}\nSales: $${fmt(d.sales)}`);
            
        console.log('🗺️ REGIONAL MAP: Complete!');
    })
    .catch(err => console.error("Map error:", err));
}

// =====================================
// TOOLTIP HELPERS
// =====================================
function showTooltip(event, html) {
    tooltip
        .html(html)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 10) + 'px')
        .classed('visible', true);
}

function hideTooltip() {
    tooltip.classed('visible', false);
}
