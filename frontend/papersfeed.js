// frontend/papersfeed.js
// Global variables
let table;
let allData = [];
let currentDetailsPaper = null;
let readingTimeColorScale = null;
let interactionDaysColorScale = null;
let readingActivityData = [];
let currentHeatmapMetric = 'papers';

// Utility function to normalize dates using Chrono
function normalizeDate(dateString) {
  if (!dateString) return null;
  
  try {
    // Try to parse with Chrono
    const parsedDate = chrono.parseDate(dateString);
    
    if (parsedDate) {
      // Return in YYYY-MM-DD format for consistency
      return parsedDate.toISOString().split('T')[0];
    }
    
    // Fallback to native Date parsing if Chrono fails
    const fallbackDate = new Date(dateString);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate.toISOString().split('T')[0];
    }
    
    // If all parsing fails, return original string
    console.warn(`Could not parse date: ${dateString}`);
    return dateString;
    
  } catch (error) {
    console.warn(`Date parsing error for "${dateString}":`, error);
    return dateString;
  }
}

/**
 * Calculate the number of days between two dates
 * @param {string} startDate - Date in 'YYYY-MM-DD' format
 * @param {string} endDate - Date in 'YYYY-MM-DD' format
 * @returns {number} Number of days between the dates (positive if endDate is after startDate)
 */
function daysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Calculate the difference in milliseconds
  const diffTime = end - start;
  
  // Convert to days (1 day = 24 * 60 * 60 * 1000 milliseconds)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// Filter Manager for unified filter state
class FilterManager {
  constructor(table) {
    this.table = table;
    this.filters = new Map(); // name -> {fn, description}
    this.listeners = new Set();
  }
  
  setFilter(name, filterFunction, description) {
    this.filters.set(name, { fn: filterFunction, desc: description });
    this.applyFilters();
    this.notifyListeners();
  }
  
  removeFilter(name) {
    this.filters.delete(name);
    this.applyFilters();
    this.notifyListeners();
  }
  
  clearAll() {
    this.filters.clear();
    this.applyFilters();
    this.notifyListeners();
  }
  
  applyFilters() {
    if (this.filters.size === 0) {
      this.table.clearFilter();
    } else {
      this.table.setFilter((data) => {
        return Array.from(this.filters.values())
          .every(filter => filter.fn(data));
      });
    }
    
    // Update heatmap with filtered data
    this.updateHeatmap();
  }
  
  updateHeatmap() {
    // If viewing paper details, show only that paper's activity
    if (currentDetailsPaper) {
      const singlePaperActivity = extractReadingActivityData([currentDetailsPaper], currentHeatmapMetric);
      createReadingHeatmap(singlePaperActivity);
      return;
    }
    
    // Otherwise, get currently filtered data from the table
    const filteredData = this.table.getData("active");
    console.log("Updating heatmap with", filteredData.length, "filtered papers");
    
    // Extract reading activity from filtered data
    const filteredActivityData = extractReadingActivityData(filteredData, currentHeatmapMetric);
    
    // Recreate the heatmap with filtered data
    createReadingHeatmap(filteredActivityData);
  }
  
  getActiveFilters() {
    return Array.from(this.filters.entries())
      .map(([name, {desc}]) => ({name, description: desc}));
  }
  
  addListener(callback) {
    this.listeners.add(callback);
  }
  
  removeListener(callback) {
    this.listeners.delete(callback);
  }
  
  notifyListeners() {
    this.listeners.forEach(callback => callback());
  }
}

// Filter Status Bar UI Component
class FilterStatusBar {
  constructor(filterManager) {
    this.filterManager = filterManager;
    this.container = document.getElementById('filter-status-bar');
    this.badgeContainer = document.getElementById('filter-badges');
    this.clearAllBtn = document.getElementById('clear-all-filters');
    
    // Listen for filter changes
    this.filterManager.addListener(() => this.render());
    
    // Set up clear all button
    this.clearAllBtn.addEventListener('click', () => {
      this.filterManager.clearAll();
    });
  }
  
  render() {
    const activeFilters = this.filterManager.getActiveFilters();
    
    if (activeFilters.length === 0) {
      this.container.style.display = 'none';
      return;
    }
    
    this.container.style.display = 'block';
    this.badgeContainer.innerHTML = '';
    
    activeFilters.forEach(({name, description}) => {
      const badge = this.createFilterBadge(name, description);
      this.badgeContainer.appendChild(badge);
    });
  }
  
  createFilterBadge(name, description) {
    const badge = document.createElement('div');
    badge.className = 'filter-badge';
    
    // Add preview styling for search preview
    if (name === 'search-preview') {
      badge.classList.add('preview');
    }
    
    const text = document.createElement('span');
    text.textContent = description;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'filter-badge-remove';
    removeBtn.innerHTML = '×';
    removeBtn.title = `Remove ${description} filter`;
    removeBtn.addEventListener('click', () => {
      this.filterManager.removeFilter(name);
      
      // If removing search preview, also clear the input
      if (name === 'search-preview') {
        document.getElementById("search-input").value = "";
        currentPreviewSearchTerm = null;
      }
    });
    
    badge.appendChild(text);
    badge.appendChild(removeBtn);
    
    return badge;
  }
}

// Global filter manager instance
let filterManager;
let filterStatusBar;

// Extract reading activity data from interaction data
function extractReadingActivityData(data, metric = 'papers') {
  const dailyActivity = new Map();
  
  data.forEach(paper => {
    if (paper.rawInteractionData && paper.rawInteractionData.length > 0) {
      paper.rawInteractionData.forEach(interaction => {
        if (interaction.type === "reading_session" && interaction.timestamp) {
          const date = new Date(interaction.timestamp);
          const dateStr = d3.timeFormat("%Y-%m-%d")(date);
          
          if (!dailyActivity.has(dateStr)) {
            dailyActivity.set(dateStr, {
              papers: new Set(),
              totalTime: 0,
              sessions: 0,
              discoveries: new Set()
            });
          }
          
          const dayData = dailyActivity.get(dateStr);
          dayData.papers.add(paper.paperKey);
          dayData.totalTime += interaction.data.duration_seconds || 0;
          dayData.sessions += 1;
        }
      });
    }
    
    // Track paper discoveries (first read date)
    if (paper.firstRead) {
      const firstReadStr = paper.firstRead;
      if (!dailyActivity.has(firstReadStr)) {
        dailyActivity.set(firstReadStr, {
          papers: new Set(),
          totalTime: 0,
          sessions: 0,
          discoveries: new Set()
        });
      }
      dailyActivity.get(firstReadStr).discoveries.add(paper.paperKey);
    }
  });
  
  // Convert to array format based on selected metric
  const result = Array.from(dailyActivity.entries()).map(([dateStr, dayData]) => {
    let count;
    switch (metric) {
      case 'papers':
        count = dayData.papers.size;
        break;
      case 'time':
        count = Math.round(dayData.totalTime / 60); // Convert to minutes
        break;
      case 'sessions':
        count = dayData.sessions;
        break;
      case 'discoveries':
        count = dayData.discoveries.size;
        break;
      default:
        count = dayData.papers.size;
    }
    
    return {
      date: new Date(dateStr),
      count: count
    };
  });
  
  return result.filter(d => d.count > 0).sort((a, b) => a.date - b.date);
}

// Create reading activity heatmap
function createReadingHeatmap(data) {
  const container = d3.select("#reading-heatmap");
  container.selectAll("*").remove(); // Clear existing content
  
  if (!data || data.length === 0) {
    container.append("div")
      .style("text-align", "center")
      .style("color", "#666")
      .style("font-size", "12px")
      .style("padding", "20px")
      .text(currentDetailsPaper ? "No reading sessions for this paper" : "No reading activity data available");
    return;
  }
  
  // Calculate date range - 8 months back, ending today
  const endDateTime = new Date();
  endDateTime.setHours(23, 59, 59, 999); // End of today
  
  const startDateTime = new Date(endDateTime);
  startDateTime.setMonth(startDateTime.getMonth() - 8);
  startDateTime.setHours(0, 0, 0, 0); // Start of day 8 months ago
  
  // Calculate the Sunday of the week containing endDateTime (for right alignment)
  const endSunday = new Date(endDateTime);
  endSunday.setDate(endDateTime.getDate() - endDateTime.getDay());
  endSunday.setHours(0, 0, 0, 0);
  
  // Calculate how many weeks we need to show
  const totalWeeks = Math.ceil(d3.timeWeek.count(startDateTime, endSunday)) + 1;
  
  // Dimensions
  const cellSize = 11;
  const cellGap = 2;
  const width = totalWeeks * (cellSize + cellGap);
  const height = 7 * (cellSize + cellGap) + 20; // 7 days + month labels
  
  // Create SVG
  const svg = container
    .append("svg")
    .attr("width", width)
    .attr("height", height);
  
  // Set the header width to match the heatmap width
  const headerElement = document.querySelector('.heatmap-title');
  if (headerElement) {
    headerElement.style.width = width + 'px';
  }
  
  // Create tooltip
  let tooltip = d3.select("body").select(".heatmap-tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body")
      .append("div")
      .attr("class", "heatmap-tooltip")
      .style("opacity", 0);
  }
  
  // Process data into a map for quick lookup
  const dataMap = new Map();
  data.forEach(d => {
    const dateStr = d3.timeFormat("%Y-%m-%d")(d.date);
    dataMap.set(dateStr, d.count);
  });
  
  // Create color scale - let D3 handle everything
  const maxCount = d3.max(data, d => d.count) || 1;

  const paletteHeatmap = d3.interpolateGreens; //d3.interpolateYlGn; //d3.interpolateBlues;
  const colorScale = maxCount > 10 
    ? d3.scaleSequentialLog(paletteHeatmap).domain([1, maxCount])
    : d3.scaleSequential(paletteHeatmap).domain([0, maxCount]);
  
  // Generate all dates in our range
  const allDates = d3.timeDays(startDateTime, new Date(endDateTime.getTime() + 24 * 60 * 60 * 1000));
  
  // Create cells
  const cells = svg.selectAll(".heatmap-cell")
    .data(allDates)
    .enter()
    .append("rect")
    .attr("class", "heatmap-cell")
    .attr("width", cellSize)
    .attr("height", cellSize)
    .attr("x", d => {
      // Calculate week position relative to the end date (right-aligned)
      const weeksSinceStart = d3.timeWeek.count(startDateTime, d);
      return weeksSinceStart * (cellSize + cellGap);
    })
    .attr("y", d => {
      const dayOfWeek = d.getDay();
      return dayOfWeek * (cellSize + cellGap) + 20; // Offset for month labels
    })
    .attr("fill", d => {
      const dateStr = d3.timeFormat("%Y-%m-%d")(d);
      const count = dataMap.get(dateStr) || 0;
      return colorScale(count);
    })
    .on("mouseover", function(event, d) {
      const dateStr = d3.timeFormat("%Y-%m-%d")(d);
      const count = dataMap.get(dateStr) || 0;
      const formatDate = d3.timeFormat("%B %d, %Y");
      
      tooltip.transition()
        .duration(200)
        .style("opacity", .9);
      
      // Adjust tooltip text based on context and metric
      let paperText;
      if (currentDetailsPaper) {
        paperText = count > 0 ? "Read this paper" : "No activity";
      } else {
        switch (currentHeatmapMetric) {
          case 'papers':
            paperText = `${count} paper${count !== 1 ? 's' : ''} read`;
            break;
          case 'time':
            paperText = `${count} minute${count !== 1 ? 's' : ''} reading`;
            break;
          case 'sessions':
            paperText = `${count} session${count !== 1 ? 's' : ''}`;
            break;
          case 'discoveries':
            paperText = `${count} paper${count !== 1 ? 's' : ''} discovered`;
            break;
          default:
            paperText = `${count} paper${count !== 1 ? 's' : ''} read`;
        }
      }
      
      tooltip.html(`
        <div><strong>${formatDate(d)}</strong></div>
        <div>${paperText}</div>
      `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function(d) {
      tooltip.transition()
        .duration(500)
        .style("opacity", 0);
    })
    .on("click", function(event, d) {
      // Only allow filtering when not viewing paper details
      if (currentDetailsPaper) {
        return; // Disable click filtering when viewing single paper
      }
      
      // Filter table to show papers read on this date
      const dateStr = d3.timeFormat("%Y-%m-%d")(d);
      const count = dataMap.get(dateStr) || 0;
      
      if (count > 0) {
        const formatDate = d3.timeFormat("%B %d, %Y");
        const dateFilter = function(data) {
          if (!data.rawInteractionData || data.rawInteractionData.length === 0) return false;
          
          return data.rawInteractionData.some(interaction => {
            if (interaction.type === "reading_session" && interaction.timestamp) {
              const interactionDateStr = d3.timeFormat("%Y-%m-%d")(new Date(interaction.timestamp));
              return interactionDateStr === dateStr;
            }
            return false;
          });
        };
        
        // Remove any existing heatmap-date filter and add new one
        filterManager.removeFilter('heatmap-date');
        filterManager.setFilter('heatmap-date', dateFilter, `Read on ${formatDate(d)}`);
      }
    });
  
  // Add month labels - only show months that have visible weeks
  const monthsInRange = d3.timeMonths(startDateTime, endDateTime);
  svg.selectAll(".month-label")
    .data(monthsInRange)
    .enter()
    .append("text")
    .attr("class", "month-label")
    .attr("x", d => {
      const weeksSinceStart = d3.timeWeek.count(startDateTime, d);
      return weeksSinceStart * (cellSize + cellGap);
    })
    .attr("y", 12)
    .text(d => d3.timeFormat("%b")(d));
  
  // Add day labels (M, W, F)
  const dayLabels = ["M", "", "W", "", "F", "", ""];
  svg.selectAll(".day-label")
    .data(dayLabels)
    .enter()
    .append("text")
    .attr("class", "day-label")
    .attr("x", -8)
    .attr("y", (d, i) => i * (cellSize + cellGap) + 20 + cellSize/2 + 3)
    .attr("text-anchor", "end")
    .text(d => d);
}

// Format date to YYYY-MM-DD format
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Custom cell formatter for tags
function formatTags(cell) {
  const tags = cell.getValue();
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return tags.map(tag => 
    `<span class="tag">${tag}</span>`
  ).join(' ');
}

function formatReadingTimeWithColor(cell) {
  const seconds = cell.getValue();
  const backgroundColor = readingTimeColorScale(seconds);
  const textColor = getContrastColor(backgroundColor);
  const element = cell.getElement();
  element.style.backgroundColor = backgroundColor;
  element.style.color = textColor;
  return seconds;
}

function formatInteractionDaysWithColor(cell) {
  const seconds = cell.getValue();
  const backgroundColor = interactionDaysColorScale(seconds);
  const textColor = getContrastColor(backgroundColor);
  const element = cell.getElement();
  element.style.backgroundColor = backgroundColor;
  element.style.color = textColor;
  return seconds;
}

// Get contrasting text color for readability
function getContrastColor(rgbColor) {
  // D3 returns rgb() format, parse it
  const rgb = rgbColor.match(/\d+/g);
  if (!rgb) return '#000000';
  
  const r = parseInt(rgb[0]);
  const g = parseInt(rgb[1]); 
  const b = parseInt(rgb[2]);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function formatInteractions(interactions) {
  if (!interactions || interactions.length === 0) {
    return '<p>No reading sessions recorded</p>';
  }
  
  return `
    <table class="sessions-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Duration</th>
          <th>Session ID</th>
        </tr>
      </thead>
      <tbody>
        ${interactions.map(interaction => {
          const date = new Date(interaction.timestamp);
          return `
            <tr>
              <td>${date.toLocaleString()}</td>
              <td>${interaction.data.duration_seconds} seconds</td>
              <td>${interaction.data.session_id}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

function displayPaperDetails(paperId) {
  console.log("Displaying details for paper ID:", paperId);
  
  const paper = allData.find(p => p.paperKey === paperId);
  if (!paper) {
    console.error('Paper not found:', paperId);
    return;
  }
  
  currentDetailsPaper = paper;
  
  // Update heatmap to show only this paper's activity
  const singlePaperActivity = extractReadingActivityData([paper], currentHeatmapMetric);
  createReadingHeatmap(singlePaperActivity);
  
  const detailsSidebar = document.getElementById('details-sidebar');
  const detailsContent = document.getElementById('details-content');
  
  // Content no longer includes close button - it's now fixed in HTML
  detailsContent.innerHTML = `
    <div class="details-header">
      <h2>${paper.title}</h2>
    </div>
    
    <div class="detail-section">
      <h3>Paper Details</h3>
      <table class="detail-table">
        <tr>
          <th>ID:</th>
          <td>${paper.id}</td>
        </tr>
        <tr>
          <th>Authors:</th>
          <td>${paper.authors}</td>
        </tr>
        <tr>
          <th>Publication Date:</th>
          <td>${paper.published}</td>
        </tr>
        <tr>
          <th>Last Read:</th>
          <td>${paper.lastRead}</td>
        </tr>
        <tr>
          <th>Reading Time:</th>
          <td>${paper.readingTime}</td>
        </tr>
        <tr>
          <th>Interaction Days:</th>
          <td>${paper.interactionDays === 1 ? '1 day' : paper.interactionDays + ' days'}</td>
        </tr>
        <tr>
          <th>arXiv Tags:</th>
          <td>${formatTags({ getValue: () => paper.tags })}</td>
        </tr>
        <tr>
          <th>URL:</th>
          <td><a href="${paper.url}" target="_blank">${paper.url}</a></td>
        </tr>
      </table>
    </div>
    
    <div class="detail-section">
      <h3>Abstract</h3>
      <div class="abstract-box">
        ${paper.abstract}
      </div>
    </div>
    
    <div class="detail-section">
      <h3>Reading Sessions</h3>
      ${formatInteractions(paper.rawInteractionData)}
    </div>
  `;
  
  // Show the sidebar
  detailsSidebar.classList.add('active');
}

function hideDetails() {
  const detailsSidebar = document.getElementById('details-sidebar');
  detailsSidebar.classList.remove('active');
  currentDetailsPaper = null;
  
  // Restore heatmap to show filtered data or all data
  if (filterManager && filterManager.filters.size > 0) {
    // If filters are active, show filtered data
    filterManager.updateHeatmap();
  } else {
    // If no filters, show all data
    const activityData = extractReadingActivityData(allData, currentHeatmapMetric);
    createReadingHeatmap(activityData);
  }
}

function removePrefix(string, prefix, sep = ':') {
  if (string.startsWith(prefix + sep)) {
    return string.slice(prefix.length + sep.length);
  }
  return null;
}

function extractObjectId(string, prefix) {
  // Case 1: Format is "prefix:id"
  let result = removePrefix(string, prefix, ':');
  if (result !== null) return result;
  
  // Case 2: Format is "prefix.id"
  result = removePrefix(string, prefix, '.');
  if (result !== null) return result;
  
  // Case 3: Format is "prefix:prefix:id"
  result = removePrefix(string, prefix + ':' + prefix, ':');
  if (result !== null) return result;
  
  // Case 3 alternate: Format is "prefix.prefix.id"
  result = removePrefix(string, prefix + '.' + prefix, '.');
  if (result !== null) return result;
  
  // Case 4: If none of the above, return the original string
  return string;
}

function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname;
    
    // Remove www. prefix
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    
    // Remove .com or .org suffix
    if (domain.endsWith('.com')) {
      domain = domain.substring(0, domain.length - 4);
    } else if (domain.endsWith('.org')) {
      domain = domain.substring(0, domain.length - 4);
    }
    
    return domain;
  } catch (error) {
    // Handle invalid URLs
    console.error("Invalid URL:", error);
    return null;
  }
}

// Simple color formatter for published dates
const publishedColorScale = d3.scaleSequential(d3.interpolateGreens)
  .domain([90, 0]); // 90 days ago = white, 0 days ago = green

function formatPublishedWithColor(cell) {
  const publishedDate = cell.getValue();
  const cellElement = cell.getElement();
  
  if (!publishedDate || publishedDate === 'N/A') {
    cellElement.style.backgroundColor = 'white';
    return publishedDate || '';
  }
  
  try {
    const pubDate = new Date(publishedDate);
    const today = new Date();
    const daysAgo = Math.floor((today - pubDate) / (1000 * 60 * 60 * 24));
    
    if (daysAgo < 0 || daysAgo > 90) {
      // More than 3 months old or future date - white
      cellElement.style.backgroundColor = 'white';
    } else {
      // 0-90 days: use D3 color scale
      const backgroundColor = publishedColorScale(daysAgo);
      const textColor = getContrastColor(backgroundColor);
      cellElement.style.backgroundColor = backgroundColor;
      cellElement.style.color = textColor;
    }
    
    return publishedDate;
  } catch (error) {
    cellElement.style.backgroundColor = 'white';
    return publishedDate;
  }
}

// read and reshape gh-store scnapshot
function processComplexData(data) {
  const result = [];
  const objects = data.objects;
  const paperKeys = Object.keys(objects).filter(key => key.startsWith("paper:"));
  
  for (const paperKey of paperKeys) {
    const paperId = extractObjectId(paperKey, "paper");
    const paperRaw = objects[paperKey];
    const paperData = paperRaw.data;
    const paperMeta = paperRaw.meta;
    const interactionKey = `interactions:${paperId}`;
    const interactionData = objects[interactionKey] ? objects[interactionKey].data : null;
    
    // Calculate reading time
    let totalReadingTime = 0;
    let lastReadDate = null;
    
    // Calculate unique days with interactions
    let uniqueInteractionDays = 0;
    
    if (interactionData && interactionData.interactions) {
      const uniqueDays = new Set();
      
      for (const interaction of interactionData.interactions) {
        if (interaction.type === "reading_session") {
          totalReadingTime += interaction.data.duration_seconds || 0;
          
          // Find the most recent reading session
          const sessionDate = new Date(interaction.timestamp);
          if (!lastReadDate || sessionDate > lastReadDate) {
            lastReadDate = sessionDate;
          }
          
          // Track unique days
          if (interaction.timestamp) {
            const date = new Date(interaction.timestamp);
            const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
            uniqueDays.add(dateString);
          }
        }
      }
      
      uniqueInteractionDays = uniqueDays.size;
    }

    const source = paperData.sourceId === 'arxiv' || paperData.sourceType === 'arxiv' ? 
               'arxiv' : (paperData.url ? extractDomain(paperData.url) : null) ||
                 paperData.sourceId || paperData.sourceType;
    
    // Ensure all fields are properly typed
    const authors = Array.isArray(paperData.authors) ? paperData.authors.join(', ') : (paperData.authors || '');
    const title = paperData.title || '';
    const abstract = paperData.abstract || '';
    const tags = paperData.tags || paperData.arxiv_tags || [];
    
    let freshness = -1;
    if (lastReadDate && paperData.publishedDate) {
      const lastReadStr = lastReadDate.toISOString().split('T')[0];  // Convert to YYYY-MM-DD
      const publishedStr = normalizeDate(paperData.publishedDate);  // Normalize first
      freshness = daysBetween(publishedStr, lastReadStr);
    }
    
    // Create the row data
    result.push({
      paperKey: paperKey,
      id: paperId,
      source: source,
      title: title,
      authors: authors,
      abstract: abstract,
      paperFreshness: freshness,
      published: normalizeDate(paperData.publishedDate),
      firstRead: formatDate(paperMeta.created_at),
      lastRead: lastReadDate ? formatDate(lastReadDate) : formatDate(paperMeta.updated_at),
      lastReadTimestamp: lastReadDate ? lastReadDate : paperMeta.updated_at,
      readingTimeSeconds: totalReadingTime,
      interactionDays: uniqueInteractionDays,
      tags: tags,
      url: paperData.url,
      rawInteractionData: interactionData ? interactionData.interactions : []
    });
  }
  
  return result;
}

// Initialize the Tabulator table
function initTable(data) {

  const interactionDays = data.map(d => d.interactionDays).filter(t => t > 0);
  if (interactionDays.length > 0) {
    const max_id = d3.max(interactionDays);
    interactionDaysColorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([1, max_id]);
  }

  const readingTimes = data.map(d => d.readingTimeSeconds).filter(t => t > 0);
  if (readingTimes.length > 0) {
    const p75 = d3.quantile(readingTimes.sort(d3.ascending), 0.75);
    readingTimeColorScale = d3.scaleSequential(d3.interpolateBlues)
      .domain([1, p75]);
  }
  
  console.log("Reading time color scale domain:", readingTimeColorScale ? readingTimeColorScale.domain() : "No scale");
  
  table = new Tabulator("#papers-table", {
    data: data,
    layout: "fitColumns",
    responsiveLayout: "collapse",
    pagination: "local",
    paginationSize: 1000,
    paginationSizeSelector: [10, 25, 50, 100, 500, 1000, 2000, 5000],
    movableColumns: true,
    groupBy: "lastRead",
    initialSort: [
      {column: "lastReadTimestamp", dir: "desc"},
      {column: "lastRead", dir: "desc"}
    ],
    columns: [
      {
        title: "Read Dates", 
        field: "interactionDays", 
        widthGrow: 1,
        formatter: formatInteractionDaysWithColor
      },
      {
        title: "Read Time (s)", 
        field: "readingTimeSeconds",  
        widthGrow: 1,
        formatter: formatReadingTimeWithColor
      },
      {
        title: "Title", 
        field: "title", 
        widthGrow: 6,
        formatter: function(cell) {
          const value = cell.getValue();
          return value;
        }
      },
      {
        title: "Source", 
        field: "source", 
        widthGrow: 1
      },
      {
        title: "Published", 
        field: "published", 
        widthGrow: 1,
        formatter: formatPublishedWithColor
        // formatter: function(cell) {
        //   const cellElement = cell.getElement();
        //   const freshness = cell.getData().paperFreshness;
        //   cellElement.setAttribute("data-paper-freshness", freshness);
        //   return cell.getData().published;
        // }
      },
      {
        title: "Tags", 
        field: "tags", 
        widthGrow: 1,
        formatter: formatTags
      },
      {
        title: "Last Read Date", 
        field: "lastRead", 
        widthGrow: 1
      },
      {
        title: "Last Read time", 
        field: "lastReadTimestamp", 
        widthGrow: 1
      }
    ],
    rowFormatter: function(row) {
      // Add paper ID as data attribute
      const rowElement = row.getElement();
      const paper_Id = row.getData().paperKey;
      console.log("formatter detected paperId:", paper_Id);
      rowElement.setAttribute("data-paper-id", paper_Id);
    }
  });
  
  // Initialize filter manager and status bar
  filterManager = new FilterManager(table);
  filterStatusBar = new FilterStatusBar(filterManager);
  
  // Remove loading message
  document.querySelector(".loading").style.display = "none";
  
  // Set up global click handler for the table
  document.getElementById("papers-table").addEventListener("click", function(e) {
    // Find the closest row element
    const rowElement = e.target.closest(".tabulator-row");
    if (rowElement) {
      const paperId = rowElement.getAttribute("data-paper-id");
      console.log("detected click on row for paperId:", paperId);
      if (paperId) {
        displayPaperDetails(paperId);
      }
    }
  });
}

// Helper functions for filters
function createSearchFilter(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  return function(data) {
    if (!term) return true;
    
    const searchableText = [
      data.title,
      data.authors,
      data.abstract,
      ...(data.tags || [])
    ].join(' ').toLowerCase();
    
    return searchableText.includes(term);
  };
}

function createMultiSearchFilter(searchTerms) {
  // OR logic: papers must contain ANY of the search terms
  return function(data) {
    if (!searchTerms || searchTerms.length === 0) return true;
    
    const searchableText = [
      data.title,
      data.authors,
      data.abstract,
      ...(data.tags || [])
    ].join(' ').toLowerCase();
    
    return searchTerms.some(term => 
      searchableText.includes(term.toLowerCase().trim())
    );
  };
}

function createDateRangeFilter(fromDate, toDate) {
  return function(data) {
    if (!fromDate && !toDate) return true;
    if (!data.published) return false;
    
    const publishedDate = data.published;
    
    if (fromDate && toDate) {
      return publishedDate >= fromDate && publishedDate <= toDate;
    }
    
    if (fromDate) {
      return publishedDate >= fromDate;
    }
    
    if (toDate) {
      return publishedDate <= toDate;
    }
    
    return true;
  };
}

function createReadingTimeFilter(minMinutes) {
  const minSeconds = minMinutes * 60;
  return function(data) {
    return data.readingTimeSeconds >= minSeconds;
  };
}

function createInteractionDaysFilter(minDays) {
  return function(data) {
    return data.interactionDays >= minDays;
  };
}

// Multi-search state management
let searchTermCounter = 0;
let currentPreviewSearchTerm = null;

// Setup event listeners for filters and search
function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  
  // Heatmap metric selector
  document.getElementById("heatmap-metric-selector").addEventListener("change", function(e) {
    currentHeatmapMetric = e.target.value;
    console.log("Heatmap metric changed to:", currentHeatmapMetric);
    
    // Update heatmap based on current state
    if (currentDetailsPaper) {
      const singlePaperActivity = extractReadingActivityData([currentDetailsPaper], currentHeatmapMetric);
      createReadingHeatmap(singlePaperActivity);
    } else if (filterManager && filterManager.filters.size > 0) {
      filterManager.updateHeatmap();
    } else {
      const activityData = extractReadingActivityData(allData, currentHeatmapMetric);
      createReadingHeatmap(activityData);
    }
  });
  
  // Global search with debouncing for preview
  let searchTimeout;
  searchInput.addEventListener("input", function(e) {
    const searchTerm = e.target.value.trim();
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Debounce search input for preview
    searchTimeout = setTimeout(() => {
      if (searchTerm) {
        // Show preview of current search term
        currentPreviewSearchTerm = searchTerm;
        filterManager.setFilter('search-preview', createSearchFilter(searchTerm), `Search: "${searchTerm}"`);
      } else {
        // Clear preview when input is empty
        currentPreviewSearchTerm = null;
        filterManager.removeFilter('search-preview');
      }
    }, 300);
  });
  
  // Handle Enter key to commit search term
  searchInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const searchTerm = e.target.value.trim();
      
      if (searchTerm) {
        // Remove the preview filter
        filterManager.removeFilter('search-preview');
        currentPreviewSearchTerm = null;
        
        // Add committed search term with unique ID
        const searchId = `search-${++searchTermCounter}`;
        filterManager.setFilter(searchId, createSearchFilter(searchTerm), `Search: "${searchTerm}"`);
        
        // Clear the input for next search term
        e.target.value = "";
      }
    }
  });
  
  // Clear search button - clears current input and preview
  document.getElementById("clear-search").addEventListener("click", function() {
    document.getElementById("search-input").value = "";
    filterManager.removeFilter('search-preview');
    currentPreviewSearchTerm = null;
  });
  
  // Toggle filter sidebar
  document.getElementById("sidebar-toggle").addEventListener("click", function() {
    document.getElementById("sidebar").classList.toggle("active");
    
    // Close details sidebar if open (to avoid both being open at once)
    document.getElementById("details-sidebar").classList.remove("active");
  });
  
  // Floating filter button
  document.getElementById("filter-toggle-btn").addEventListener("click", function() {
    document.getElementById("sidebar").classList.toggle("active");
    
    // Close details sidebar if open (to avoid both being open at once)
    document.getElementById("details-sidebar").classList.remove("active");
  });
  
  // Toggle details with keyboard escape key
  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") {
      document.getElementById("details-sidebar").classList.remove("active");
      document.getElementById("sidebar").classList.remove("active");
    }
  });
  
  // Date range filters
  document.getElementById("apply-date-filter").addEventListener("click", function() {
    const fromDate = document.getElementById("date-filter-from").value;
    const toDate = document.getElementById("date-filter-to").value;
    
    if (fromDate || toDate) {
      const description = formatDateRangeDescription(fromDate, toDate);
      filterManager.setFilter('dateRange', createDateRangeFilter(fromDate, toDate), description);
    } else {
      filterManager.removeFilter('dateRange');
    }
  });
  
  document.getElementById("clear-date-filter").addEventListener("click", function() {
    document.getElementById("date-filter-from").value = "";
    document.getElementById("date-filter-to").value = "";
    filterManager.removeFilter('dateRange');
  });
  
  // Reading time filter
  document.getElementById("apply-reading-filter").addEventListener("click", function() {
    const minReading = document.getElementById("min-reading-time").value;
    
    if (minReading && minReading > 0) {
      filterManager.setFilter(
        'readingTime', 
        createReadingTimeFilter(parseInt(minReading)), 
        `Reading time: ≥${minReading} min`
      );
    } else {
      filterManager.removeFilter('readingTime');
    }
  });
  
  document.getElementById("clear-reading-filter").addEventListener("click", function() {
    document.getElementById("min-reading-time").value = "";
    filterManager.removeFilter('readingTime');
  });
  
  // Interaction days filter
  document.getElementById("apply-days-filter").addEventListener("click", function() {
    const minDays = document.getElementById("min-interaction-days").value;
    
    if (minDays && minDays > 0) {
      const days = parseInt(minDays);
      filterManager.setFilter(
        'interactionDays', 
        createInteractionDaysFilter(days), 
        `Interaction days: ≥${days}`
      );
    } else {
      filterManager.removeFilter('interactionDays');
    }
  });
  
  document.getElementById("clear-days-filter").addEventListener("click", function() {
    document.getElementById("min-interaction-days").value = "";
    filterManager.removeFilter('interactionDays');
  });
  
  // Reset all filters
  document.getElementById("reset-all-filters").addEventListener("click", function() {
    // Clear all input fields
    document.getElementById("search-input").value = "";
    document.getElementById("date-filter-from").value = "";
    document.getElementById("date-filter-to").value = "";
    document.getElementById("min-reading-time").value = "";
    document.getElementById("min-interaction-days").value = "";
    
    // Reset search counter and preview state
    searchTermCounter = 0;
    currentPreviewSearchTerm = null;
    
    // Clear all filters through filter manager
    filterManager.clearAll();
  });
}

// Helper function to format date range descriptions
function formatDateRangeDescription(fromDate, toDate) {
  if (fromDate && toDate) {
    return `Date: ${fromDate} to ${toDate}`;
  } else if (fromDate) {
    return `Date: from ${fromDate}`;
  } else if (toDate) {
    return `Date: until ${toDate}`;
  }
  return 'Date range';
}

// Load and initialize
document.addEventListener("DOMContentLoaded", function() {
  // Fetch data file
  fetch("gh-store-snapshot.json")
    .then(response => {
      if (!response.ok) {
        throw new Error("Failed to load data.json");
      }
      return response.json();
    })
    .then(data => {
      allData = processComplexData(data);
      
      // Initialize table and heatmap
      initTable(allData);
      
      // Create initial heatmap with default metric
      const activityData = extractReadingActivityData(allData, currentHeatmapMetric);
      createReadingHeatmap(activityData);
      
      setupEventListeners();
    })
    .catch(error => {
      document.querySelector(".loading").innerHTML = 
        `Error loading data: ${error.message}. Make sure data.json exists in the same directory as this HTML file.`;
    });
});
