/* script.js – coordinated dashboard with category + state filters */

// ===============================
// Global variables
// ===============================
let data = [];
let selectedCategory = null;  // null = all categories
let selectedState = null;     // null = all states
const tooltip = d3.select('.tooltip');

// ===============================
// Tooltip helpers
// ===============================
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

// ===============================
// Load and process data
// ===============================
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
    
    // Draw all views once
    applyFilters();
    // Map is static in terms of geometry, but interactive
    regionalSalesMap(data);
});

// ===============================
// Main coordinator
// ===============================
function applyFilters() {
    createCategoryBarChart();      // uses selectedState for overlays
    createMonthlySalesLineChart(); // uses selectedState for trend
    createSalesVsProfitScatter();  // uses both selectedCategory & selectedState
}

// ===============================
// 1. BAR CHART - Sales by Category (also category selector)
// ===============================
function createCategoryBarChart() {
    console.log('📊 BAR CHART: Rendering with state:', selectedState);
    const container = document.querySelector('#category-sales');
    const margin = {top: 10, right: 10, bottom: 60, left: 50};
    const baseWidth = container.clientWidth;
    const baseHeight = container.clientHeight - 40; // account for title
    const width = baseWidth - margin.left - margin.right;
    const height = baseHeight - margin.top - margin.bottom;
    
    const root = d3.select('#category-sales svg')
        .attr('width', baseWidth)
        .attr('height', baseHeight);

    root.selectAll('*').remove(); // clear previous

    const svg = root.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Global aggregate sales by category
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
    
    // Base color scale
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
        .call(d3.axisLeft(y).ticks(4).tickFormat(d => '$' + d3.format('.2s')(d)));
    
    // Bars (global totals)
    svg.selectAll('.bar')
        .data(chartData)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.category))
        .attr('y', d => y(d.sales))
        .attr('width', x.bandwidth())
        .attr('height', d => height - y(d.sales))
        .attr('fill', d => color(d.category))
        .attr('opacity', d =>
            !selectedCategory || d.category === selectedCategory ? 1 : 0.3
        )
        .on('mouseover', function(event, d) {
            showTooltip(event, `
                <strong>${d.category}</strong><br>
                Total Sales (All States): $${d3.format(',.0f')(d.sales)}
            `);
        })
        .on('mouseout', function() {
            hideTooltip();
        })
        .on('click', function(_, d) {
            // Toggle category selection
            if (selectedCategory === d.category) {
                selectedCategory = null;
            } else {
                selectedCategory = d.category;
            }
            applyFilters();
        });

    // If a state is selected, overlay mini-bars showing state's contribution
    if (selectedState) {
        // Aggregate state sales by category
        const stateData = data.filter(d => d.State === selectedState);
        const stateCatRollup = d3.rollup(
            stateData,
            v => d3.sum(v, d => d.Sales),
            d => d.Category
        );

        svg.selectAll('.state-overlay')
            .data(chartData)
            .join('rect')
            .attr('class', 'state-overlay')
            .attr('x', d => x(d.category) + x.bandwidth() * 0.2)   // narrower, centered
            .attr('width', x.bandwidth() * 0.6)
            .attr('y', d => {
                const stateSales = stateCatRollup.get(d.category) || 0;
                const ratio = d.sales ? stateSales / d.sales : 0;
                const fullH = height - y(d.sales);
                const overlayH = fullH * ratio;
                return y(d.sales) + (fullH - overlayH);
            })
            .attr('height', d => {
                const stateSales = stateCatRollup.get(d.category) || 0;
                const ratio = d.sales ? stateSales / d.sales : 0;
                const fullH = height - y(d.sales);
                return fullH * ratio;
            })
            .attr('fill', d => d3.color(color(d.category)).darker(0.8))
            .attr('opacity', 0.9)
            .on('mouseover', function(event, d) {
                const stateSales = stateCatRollup.get(d.category) || 0;
                const ratio = d.sales ? stateSales / d.sales : 0;
                showTooltip(event, `
                    <strong>${selectedState} – ${d.category}</strong><br>
                    State Sales: $${d3.format(',.0f')(stateSales)}<br>
                    Share of Category: ${d3.format('.1%')(ratio)}
                `);
            })
            .on('mouseout', hideTooltip);
    }

    console.log('BAR CHART: Complete!');
}

// ===============================
// 2. LINE CHART - Monthly Sales Trend (global or state)
// ===============================
function createMonthlySalesLineChart() {
    console.log('LINE CHART: Rendering with state:', selectedState);
    const container = document.querySelector('#monthly-sales');
    const margin = {top: 10, right: 10, bottom: 50, left: 50};
    const baseWidth = container.clientWidth;
    const baseHeight = container.clientHeight - 40; // account for title
    const width = baseWidth - margin.left - margin.right;
    const height = baseHeight - margin.top - margin.bottom;
    
    const root = d3.select('#monthly-sales svg')
        .attr('width', baseWidth)
        .attr('height', baseHeight);
    root.selectAll('*').remove();
    
    const svg = root.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

    // Update title text depending on selected state
    const titleSelection = d3.select('#monthly-sales h2');
    if (selectedState) {
        titleSelection.text(`Monthly Sales Trend – ${selectedState}`);
    } else {
        titleSelection.text('Monthly Sales Trend (All States)');
    }

    // Filter data by selectedState if set
    const filteredData = selectedState
        ? data.filter(d => d.State === selectedState)
        : data;
    
    // Guard: if no data for that state
    if (!filteredData.length) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .text('No data for this selection');
        return;
    }

    // Aggregate sales by month
    const monthlyData = d3.rollup(
        filteredData,
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
        .call(d3.axisLeft(y).ticks(4).tickFormat(d => '$' + d3.format('.2s')(d)));
    
    // Line color changes slightly for state mode
    const lineColor = selectedState ? '#e67e22' : '#4285f4';
    
    const line = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.sales))
        .curve(d3.curveMonotoneX);
    
    svg.append('path')
        .datum(chartData)
        .attr('class', 'line-path')
        .attr('d', line)
        .attr('fill', 'none')
        .attr('stroke', lineColor)
        .attr('stroke-width', 3);
    
    // Dots
    svg.selectAll('.line-dot')
        .data(chartData)
        .join('circle')
        .attr('class', 'line-dot')
        .attr('cx', d => x(d.date))
        .attr('cy', d => y(d.sales))
        .attr('r', 3)
        .attr('fill', selectedState ? '#d35400' : '#34a853')
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
    
    console.log('LINE CHART: Complete!');
}

// ===============================
// 3. SCATTERPLOT - Sales vs Profit (main view)
// ===============================
function createSalesVsProfitScatter() {
    console.log('SCATTER: Rendering with category/state:', selectedCategory, selectedState);
    
    const container = document.querySelector('#sales-profit');
    if (!container) {
        console.error('SCATTER: #sales-profit element NOT FOUND!');
        return;
    }
    
    const margin = {top: 10, right: 30, bottom: 50, left: 60};
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight - 40; // account for title
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;
    
    const root = d3.select('#sales-profit svg')
        .attr('width', containerWidth)
        .attr('height', height + margin.top + margin.bottom);
    root.selectAll('*').remove();
    
    const svg = root.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Filter data by category and state
    let filteredData = data;
    if (selectedCategory) {
        filteredData = filteredData.filter(d => d.Category === selectedCategory);
    }
    if (selectedState) {
        filteredData = filteredData.filter(d => d.State === selectedState);
    }
    
    if (!filteredData.length) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .text('No points for this selection');
        return;
    }

    // Color scale by category
    const color = d3.scaleOrdinal()
        .domain(['Furniture', 'Office Supplies', 'Technology'])
        .range(['#34a853', '#fbbc04', '#4285f4']);
    
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
        .attr('y', height + 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#666')
        .text('Sales ($)');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
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
        .attr('r', 4)
        .attr('fill', d => color(d.Category))
        .attr('opacity', 0.6)
        .attr('stroke', d => color(d.Category))
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            d3.select(this)
                .attr('r', 7)
                .attr('opacity', 1)
                .attr('stroke-width', 2);
            showTooltip(event, `
                <strong>${d.Category}</strong><br>
                ${d['Sub-Category']}<br>
                State: ${d.State}<br>
                Sales: $${d3.format(',.2f')(d.Sales)}<br>
                Profit: $${d3.format(',.2f')(d.Profit)}<br>
                Margin: ${d3.format('.1%')(d.Profit / d.Sales)}
            `);
        })
        .on('mouseout', function() {
            d3.select(this)
                .attr('r', 4)
                .attr('opacity', 0.6)
                .attr('stroke-width', 1);
            hideTooltip();
        });
    
    // Legend (always visible; you can conditionally show if you want)
    const legend = svg.append('g')
        .attr('transform', `translate(${width - 140}, 5)`);

    const categories = ['Furniture', 'Office Supplies', 'Technology'];
    categories.forEach((cat, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(0, ${i * 20})`);

        g.append('circle')
            .attr('r', 5)
            .attr('fill', color(cat))
            .attr('opacity', 0.6);

        g.append('text')
            .attr('x', 10)
            .attr('y', 4)
            .style('font-size', '11px')
            .style('fill', '#666')
            .text(cat);
    });
    
    console.log('SCATTER: Complete!');
}

// ===============================
// 4. Regional Sales Bubble Map (USA)
// drives state selection
// ===============================
function regionalSalesMap(data) {
    console.log('REGIONAL MAP: Starting...');

    const container = document.querySelector('#regional-sales');
    const svg = d3.select('#regional-sales svg');

    const containerWidth = container ? container.clientWidth : 400;
    const containerHeight = container ? container.clientHeight - 40 : 300; // account for title
    const width = containerWidth - 20;
    const height = containerHeight - 20;

    svg.attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
        .then(us => {
            const geo = topojson.feature(us, us.objects.states);

            const salesByState = d3.rollup(
                data,
                v => d3.sum(v, d => d.Sales),
                d => d.State
            );

            const projection = d3.geoAlbersUsa().fitSize([width, height], geo);
            const path = d3.geoPath(projection);

            svg.append('g')
                .attr('class', 'states')
                .selectAll('path')
                .data(geo.features)
                .join('path')
                .attr('class', 'state-path')
                .attr('d', path)
                .style('fill', '#f2f2f2')
                .style('stroke', '#666')
                .style('stroke-width', 0.5)
                .style('vector-effect', 'non-scaling-stroke');

            const bubbles = geo.features.map(f => {
                const [cx, cy] = path.centroid(f);
                const state = f.properties.name;
                const sales = salesByState.get(state) || 0;
                return { state, sales, x: cx, y: cy };
            }).filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));

            const r = d3.scaleSqrt()
                .domain([0, d3.max(bubbles, d => d.sales) || 1])
                .range([0, 12]);

            const fmt = d3.format(',.0f');

            const circles = svg.append('g')
                .selectAll('.map-bubble')
                .data(bubbles)
                .join('circle')
                .attr('class', 'map-bubble')
                .attr('cx', d => d.x)
                .attr('cy', d => d.y)
                .attr('r', d => r(d.sales))
                .style('fill', 'steelblue')
                .style('opacity', 0.7)
                .style('stroke', 'white')
                .style('stroke-width', 1)
                .on('mouseover', (event, d) => {
                    showTooltip(event, `
                        <strong>${d.state}</strong><br>
                        Total Sales: $${fmt(d.sales)}
                    `);
                    // soft highlight on hover
                    d3.selectAll('.map-bubble')
                        .style('opacity', b =>
                            selectedState
                                ? (b.state === selectedState ? 0.9 : 0.2)
                                : (b.state === d.state ? 0.9 : 0.3)
                        );
                })
                .on('mouseout', () => {
                    hideTooltip();
                    d3.selectAll('.map-bubble')
                        .style('opacity', b =>
                            selectedState
                                ? (b.state === selectedState ? 0.9 : 0.2)
                                : 0.7
                        );
                })
                .on('click', (_, d) => {
                    // Toggle selected state
                    if (selectedState === d.state) {
                        selectedState = null;
                    } else {
                        selectedState = d.state;
                    }

                    // Update other views
                    applyFilters();

                    // Update bubble highlighting
                    d3.selectAll('.map-bubble')
                        .style('opacity', b =>
                            selectedState
                                ? (b.state === selectedState ? 0.9 : 0.2)
                                : 0.7
                        )
                        .style('stroke', b =>
                            selectedState && b.state === selectedState ? '#000' : '#fff'
                        )
                        .style('stroke-width', b =>
                            selectedState && b.state === selectedState ? 2 : 1
                        );
                });

            circles.append('title')
                .text(d => `${d.state}\nSales: $${fmt(d.sales)}`);
            
            console.log('REGIONAL MAP: Complete!');
        })
        .catch(err => console.error('Map error:', err));
}
