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
    const tooltipWidth = 200; // max-width from CSS
    const windowWidth = window.innerWidth;
    const mouseX = event.pageX;
    
    // If mouse is in the right portion of screen, show tooltip on left of cursor
    let leftPos;
    if (mouseX > windowWidth - tooltipWidth - 30) {
        leftPos = mouseX - tooltipWidth - 15;
    } else {
        leftPos = mouseX + 10;
    }
    
    tooltip
        .html(html)
        .style('left', leftPos + 'px')
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
    const margin = {top: 10, right: 10, bottom: 100, left: 50}; // increased bottom margin
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
    const margin = {top: 10, right: 20, bottom: 60, left: 50}; // increased right margin
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
            .style('fill', '#aaa')
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
        .style('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.5em');
    
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y).ticks(4).tickFormat(d => '$' + d3.format('.2s')(d)));
    
    // Line color - uniform red
    const lineColor = '#dc2626';
    
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
        .attr('fill', '#7f1d1d')
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
    
    const margin = {top: 30, right: 30, bottom: 60, left: 60};
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight - 30; // account for title
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;
    
    const root = d3.select('#sales-profit svg')
        .attr('width', containerWidth)
        .attr('height', containerHeight);
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
    // Filter out zero/negative sales (can't plot on log scale)
    filteredData = filteredData.filter(d => d.Sales > 0);
    
    if (!filteredData.length) {
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height / 2)
            .attr('text-anchor', 'middle')
            .style('fill', '#aaa')
            .text('No points for this selection');
        return;
    }

    // Color scale by category
    const color = d3.scaleOrdinal()
        .domain(['Furniture', 'Office Supplies', 'Technology'])
        .range(['#34a853', '#fbbc04', '#4285f4']);
    
    // Scales - using log for Sales, symlog for Profit (handles negatives)
    const xMin = d3.min(filteredData, d => d.Sales);
    const xMax = d3.max(filteredData, d => d.Sales);
    
    const x = d3.scaleLog()
        .domain([Math.max(1, xMin * 0.9), xMax * 1.1])
        .range([0, width])
        .clamp(true);
    
    // Symlog scale for profit - handles negative values
    const yMin = d3.min(filteredData, d => d.Profit);
    const yMax = d3.max(filteredData, d => d.Profit);
    const yAbsMax = Math.max(Math.abs(yMin), Math.abs(yMax));
    
    const y = d3.scaleSymlog()
        .domain([yMin * 1.1, yMax * 1.1])
        .range([height, 0])
        .constant(1); // Smaller constant = more compression near zero
    
    // Grid lines
    svg.append('g')
        .attr('class', 'grid')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .tickValues([10, 100, 1000, 10000])
            .tickSize(-height)
            .tickFormat('')
        );
    
    svg.append('g')
        .attr('class', 'grid')
        .call(d3.axisLeft(y)
            .tickValues([-1000, -100, 0, 100, 1000, 10000])
            .tickSize(-width)
            .tickFormat('')
        );
    
    // Axes with appropriate tick formatting for log scales
    svg.append('g')
        .attr('class', 'axis')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x)
            .tickValues([10, 100, 1000, 10000])
            .tickFormat(d => '$' + d3.format('.2s')(d))
        );
    
    svg.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y)
            .tickValues([-1000, -100, 0, 100, 1000, 10000])
            .tickFormat(d => '$' + d3.format('.2s')(d))
        );
    
    // Axis labels
    svg.append('text')
        .attr('x', width / 2)
        .attr('y', height + 50)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#aaa')
        .text('Sales - Log Scale ($)');

    svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -height / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#aaa')
        .text('Profit - Symlog Scale ($)');
    
    // Zero line for profit (works with symlog)
    const yDomain = y.domain();
    if (yDomain[0] < 0 && yDomain[1] > 0) {
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
    
    // Legend (above chart, horizontal layout with even spacing)
    const legend = svg.append('g')
        .attr('transform', `translate(${width / 2 - 135}, -15)`);

    const categories = ['Technology', 'Furniture', 'Office Supplies'];
    const legendPositions = [0, 95, 180]; // Adjusted for new order
    categories.forEach((cat, i) => {
        const g = legend.append('g')
            .attr('transform', `translate(${legendPositions[i]}, 0)`);

        g.append('circle')
            .attr('r', 5)
            .attr('fill', color(cat))
            .attr('opacity', 0.6);

        g.append('text')
            .attr('x', 10)
            .attr('y', 4)
            .style('font-size', '11px')
            .style('fill', '#aaa')
            .text(cat);
    });
    
    console.log('SCATTER: Complete!');
}

// ===============================
// 4. Regional Sales Choropleth Map (USA)
// drives state selection
// ===============================
function regionalSalesMap(data) {
    console.log('REGIONAL MAP: Starting...');

    const container = document.querySelector('#regional-sales');
    const svg = d3.select('#regional-sales svg');

    const containerWidth = container ? container.clientWidth : 400;
    const containerHeight = container ? container.clientHeight - 40 : 300; // account for title
    const width = containerWidth - 20;
    const height = containerHeight - 10;

    svg.attr('width', containerWidth).attr('height', containerHeight);
    svg.selectAll('*').remove();

    d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
        .then(us => {
            const geo = topojson.feature(us, us.objects.states);

            // Aggregate sales by state
            const salesByState = d3.rollup(
                data,
                v => d3.sum(v, d => d.Sales),
                d => d.State
            );

            // Get min/max for color scale
            const salesValues = Array.from(salesByState.values());
            const maxSales = d3.max(salesValues) || 1;

            // Color scale - pow scale (sqrt) for better differentiation at lower values
            const colorScale = d3.scalePow()
                .exponent(0.5)
                .domain([0, maxSales])
                .range(['#ffffff', '#dc2626'])
                .interpolate(d3.interpolateRgb);

            const projection = d3.geoAlbersUsa().fitSize([width, height], geo);
            const path = d3.geoPath(projection);

            const fmt = d3.format(',.0f');

            // Draw states as choropleth
            svg.append('g')
                .attr('class', 'states')
                .selectAll('path')
                .data(geo.features)
                .join('path')
                .attr('class', 'state-path')
                .attr('d', path)
                .style('fill', d => {
                    const stateName = d.properties.name;
                    const sales = salesByState.get(stateName) || 0;
                    return sales > 0 ? colorScale(sales) : '#e5e5e5';
                })
                .style('stroke', d => {
                    const stateName = d.properties.name;
                    return selectedState === stateName ? '#facc15' : '#888';
                })
                .style('stroke-width', d => {
                    const stateName = d.properties.name;
                    return selectedState === stateName ? 2.5 : 0.5;
                })
                .style('cursor', 'pointer')
                .style('opacity', d => {
                    const stateName = d.properties.name;
                    if (!selectedState) return 1;
                    return stateName === selectedState ? 1 : 0.7;
                })
                .on('mouseover', function(event, d) {
                    const stateName = d.properties.name;
                    const sales = salesByState.get(stateName) || 0;
                    
                    // Highlight on hover
                    d3.select(this)
                        .style('stroke', '#facc15')
                        .style('stroke-width', 2);
                    
                    showTooltip(event, `
                        <strong>${stateName}</strong><br>
                        Total Sales: $${fmt(sales)}
                    `);
                })
                .on('mouseout', function(event, d) {
                    const stateName = d.properties.name;
                    
                    // Reset stroke based on selection
                    d3.select(this)
                        .style('stroke', selectedState === stateName ? '#facc15' : '#888')
                        .style('stroke-width', selectedState === stateName ? 2.5 : 0.5);
                    
                    hideTooltip();
                })
                .on('click', function(event, d) {
                    const stateName = d.properties.name;
                    
                    // Toggle selected state
                    if (selectedState === stateName) {
                        selectedState = null;
                    } else {
                        selectedState = stateName;
                    }

                    // Update other views
                    applyFilters();

                    // Update map styling
                    svg.selectAll('.state-path')
                        .style('stroke', dd => {
                            return selectedState === dd.properties.name ? '#facc15' : '#888';
                        })
                        .style('stroke-width', dd => {
                            return selectedState === dd.properties.name ? 2.5 : 0.5;
                        })
                        .style('opacity', dd => {
                            if (!selectedState) return 1;
                            return dd.properties.name === selectedState ? 1 : 0.7;
                        });
                });

            // Add legend to the HTML container (next to title)
            const legendContainer = d3.select('#map-legend');
            legendContainer.html(''); // clear previous
            
            const legendWidth = 80;
            const legendHeight = 8;
            
            // Create a small inline SVG for the gradient
            const legendSvg = legendContainer.append('svg')
                .attr('width', legendWidth)
                .attr('height', legendHeight);
            
            const defs = legendSvg.append('defs');
            const gradient = defs.append('linearGradient')
                .attr('id', 'sales-gradient')
                .attr('x1', '0%')
                .attr('x2', '100%');

            // Multiple stops to approximate sqrt scale visually
            gradient.append('stop')
                .attr('offset', '0%')
                .attr('stop-color', colorScale(0));
            
            gradient.append('stop')
                .attr('offset', '25%')
                .attr('stop-color', colorScale(maxSales * 0.0625)); // sqrt(0.25)^2
            
            gradient.append('stop')
                .attr('offset', '50%')
                .attr('stop-color', colorScale(maxSales * 0.25)); // sqrt(0.5)^2
            
            gradient.append('stop')
                .attr('offset', '75%')
                .attr('stop-color', colorScale(maxSales * 0.5625)); // sqrt(0.75)^2

            gradient.append('stop')
                .attr('offset', '100%')
                .attr('stop-color', colorScale(maxSales));

            legendSvg.append('rect')
                .attr('width', legendWidth)
                .attr('height', legendHeight)
                .attr('rx', 2)
                .style('fill', 'url(#sales-gradient)');
            
            // Add text labels
            legendContainer.insert('span', 'svg')
                .text('$0')
                .style('font-size', '9px');
            
            legendContainer.append('span')
                .text('$' + d3.format('.2s')(maxSales))
                .style('font-size', '9px');
            
            console.log('REGIONAL MAP: Complete!');
        })
        .catch(err => console.error('Map error:', err));
}

// ===============================
// 5. Demo Video Modal
// ===============================
const modal = document.getElementById("video-modal");
const video = document.getElementById("demo-video");
const demoBtn = document.getElementById("demo-btn");

// Add collapsed class after initial animation finishes (3s delay + 0.5s animation)
setTimeout(() => {
    demoBtn.classList.add("collapsed");
}, 3500);

demoBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
});

document.getElementById("close-modal").addEventListener("click", () => {
    modal.classList.add("hidden");
    video.pause();
    video.currentTime = 0;
});

// Close modal on background click
modal.addEventListener("click", (e) => {
    if (e.target === modal) {
        modal.classList.add("hidden");
        video.pause();
        video.currentTime = 0;
    }
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
        video.pause();
        video.currentTime = 0;
    }
});
