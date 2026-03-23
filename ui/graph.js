// Memento — Memory Graph Visualization
// Vanilla JS + D3.js v7

(function () {
  "use strict";

  // ── Config ──────────────────────────────────────────
  const API_URL =
    new URLSearchParams(window.location.search).get("api") || "http://127.0.0.1:21476";

  const TAG_COLORS = {
    decision: "#e74c3c",
    architecture: "#3498db",
    code: "#2ecc71",
    error: "#e67e22",
    config: "#9b59b6",
    dependency: "#1abc9c",
    todo: "#f1c40f",
    conversation: "#95a5a6",
  };

  const DEFAULT_COLOR = "#555";

  // ── State ───────────────────────────────────────────
  let allNodes = [];
  let allLinks = [];
  let simulation;
  let svg, g, linkGroup, nodeGroup;
  let activeFilters = new Set(Object.keys(TAG_COLORS));
  activeFilters.add("_untagged");

  // ── Init ────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    setupSVG();
    setupFilterListeners();
    await loadMemories();
  });

  // ── SVG Setup ───────────────────────────────────────
  function setupSVG() {
    svg = d3.select("#graph-svg");
    const width = svg.node().parentElement.clientWidth;
    const height = svg.node().parentElement.clientHeight;

    g = svg.append("g");

    // Zoom + pan
    const zoom = d3
      .zoom()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoom);

    linkGroup = g.append("g").attr("class", "links");
    nodeGroup = g.append("g").attr("class", "nodes");

    // Center zoom
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));
  }

  // ── Data Loading ────────────────────────────────────
  async function loadMemories() {
    try {
      const res = await fetch(`${API_URL}/api/list?limit=100`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = data.entries || [];

      processEntries(entries);
      buildTagFilters();
      renderGraph();
      updateStats();
    } catch (err) {
      console.error("Failed to load memories:", err);
      document.getElementById("graph-stats").textContent = "Failed to connect to API at " + API_URL;
    }
  }

  function processEntries(entries) {
    const nodeMap = new Map();

    entries.forEach((entry) => {
      const tags = entry.tags || [];
      const primaryTag = tags[0] || "_untagged";
      const importance = entry.importance || 0.5;

      nodeMap.set(entry.id, {
        id: entry.id,
        summary: entry.summary || "(no summary)",
        tags: tags,
        primaryTag: primaryTag,
        timestamp: entry.timestamp,
        importance: importance,
        radius: 5 + importance * 15,
        color: TAG_COLORS[primaryTag] || DEFAULT_COLOR,
        content: entry.content,
        namespace: entry.namespace,
        relatedMemoryIds: entry.relatedMemoryIds || [],
      });
    });

    allNodes = Array.from(nodeMap.values());

    // Build links from relatedMemoryIds
    const linkSet = new Set();
    allNodes.forEach((node) => {
      (node.relatedMemoryIds || []).forEach((relId) => {
        if (nodeMap.has(relId)) {
          const key = [node.id, relId].sort().join("--");
          if (!linkSet.has(key)) {
            linkSet.add(key);
            allLinks.push({
              source: node.id,
              target: relId,
              strength: 0.5,
            });
          }
        }
      });
    });

    // If there are no explicit links, create proximity links based on shared tags
    if (allLinks.length === 0 && allNodes.length > 1) {
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const shared = allNodes[i].tags.filter((t) => allNodes[j].tags.includes(t));
          if (shared.length > 0) {
            allLinks.push({
              source: allNodes[i].id,
              target: allNodes[j].id,
              strength: Math.min(shared.length / 3, 1),
            });
          }
        }
      }
    }
  }

  // ── Tag Filter UI ───────────────────────────────────
  function buildTagFilters() {
    const container = document.getElementById("tag-filters");
    container.innerHTML = "";

    const allTags = new Set();
    allNodes.forEach((n) => {
      if (n.tags.length === 0) allTags.add("_untagged");
      n.tags.forEach((t) => allTags.add(t));
    });

    Array.from(allTags)
      .sort()
      .forEach((tag) => {
        const label = document.createElement("label");
        label.className = "tag-checkbox";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = activeFilters.has(tag);
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) activeFilters.add(tag);
          else activeFilters.delete(tag);
          applyFilters();
        });

        const dot = document.createElement("span");
        dot.className = "tag-dot";
        dot.style.backgroundColor = TAG_COLORS[tag] || DEFAULT_COLOR;

        const text = document.createTextNode(tag === "_untagged" ? "untagged" : tag);

        label.appendChild(checkbox);
        label.appendChild(dot);
        label.appendChild(text);
        container.appendChild(label);
      });
  }

  // ── Render Graph ────────────────────────────────────
  function renderGraph() {
    // Filter nodes
    const visibleNodes = getVisibleNodes();
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleLinks = allLinks.filter((l) => {
      const sid = typeof l.source === "object" ? l.source.id : l.source;
      const tid = typeof l.target === "object" ? l.target.id : l.target;
      return visibleIds.has(sid) && visibleIds.has(tid);
    });

    // Clear
    linkGroup.selectAll("*").remove();
    nodeGroup.selectAll("*").remove();

    // Links
    const links = linkGroup
      .selectAll("line")
      .data(visibleLinks)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke-opacity", (d) => 0.2 + d.strength * 0.6);

    // Node groups
    const nodes = nodeGroup
      .selectAll("g")
      .data(visibleNodes, (d) => d.id)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(d3.drag().on("start", dragStart).on("drag", dragging).on("end", dragEnd));

    // Circles
    nodes
      .append("circle")
      .attr("r", (d) => d.radius)
      .attr("fill", (d) => d.color)
      .on("click", (event, d) => selectNode(d))
      .on("mouseenter", (event, d) => showTooltip(event, d))
      .on("mousemove", (event) => moveTooltip(event))
      .on("mouseleave", hideTooltip);

    // Labels
    nodes
      .append("text")
      .attr("class", "node-label")
      .attr("dy", (d) => d.radius + 12)
      .text((d) => truncate(d.summary, 20));

    // Simulation
    if (simulation) simulation.stop();

    simulation = d3
      .forceSimulation(visibleNodes)
      .force(
        "link",
        d3
          .forceLink(visibleLinks)
          .id((d) => d.id)
          .distance(80)
          .strength((d) => d.strength * 0.3),
      )
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(0, 0))
      .force(
        "collide",
        d3.forceCollide().radius((d) => d.radius + 4),
      )
      .on("tick", () => {
        links
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        nodes.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });
  }

  // ── Filtering ───────────────────────────────────────
  function getVisibleNodes() {
    const searchTerm = document.getElementById("search-box").value.toLowerCase();
    const namespace = document.getElementById("namespace-filter").value.toLowerCase();
    const dateFrom = document.getElementById("date-from").value;
    const dateTo = document.getElementById("date-to").value;

    return allNodes.filter((node) => {
      // Tag filter
      const nodeTags = node.tags.length > 0 ? node.tags : ["_untagged"];
      const tagMatch = nodeTags.some((t) => activeFilters.has(t));
      if (!tagMatch) return false;

      // Namespace filter
      if (namespace && node.namespace && !node.namespace.toLowerCase().includes(namespace)) {
        return false;
      }

      // Date filter
      if (node.timestamp) {
        const ts = node.timestamp.slice(0, 10);
        if (dateFrom && ts < dateFrom) return false;
        if (dateTo && ts > dateTo) return false;
      }

      // Search filter
      if (searchTerm) {
        const haystack = (node.summary + " " + node.tags.join(" ")).toLowerCase();
        if (!haystack.includes(searchTerm)) return false;
      }

      return true;
    });
  }

  function applyFilters() {
    renderGraph();
    highlightSearch();
    updateStats();
  }

  function highlightSearch() {
    const term = document.getElementById("search-box").value.toLowerCase();
    if (!term) {
      nodeGroup.selectAll("circle").classed("highlighted", false).classed("dimmed", false);
      nodeGroup.selectAll(".node-label").classed("dimmed", false);
      linkGroup.selectAll("line").classed("dimmed", false);
      return;
    }

    nodeGroup.selectAll(".node").each(function (d) {
      const match = (d.summary + " " + d.tags.join(" ")).toLowerCase().includes(term);
      d3.select(this).select("circle").classed("highlighted", match).classed("dimmed", !match);
      d3.select(this).select(".node-label").classed("dimmed", !match);
    });

    linkGroup.selectAll("line").classed("dimmed", true);
  }

  // ── Filter Listeners ────────────────────────────────
  function setupFilterListeners() {
    document.getElementById("search-box").addEventListener("input", () => {
      applyFilters();
    });

    document.getElementById("namespace-filter").addEventListener("input", () => {
      applyFilters();
    });

    document.getElementById("date-from").addEventListener("change", () => {
      applyFilters();
    });

    document.getElementById("date-to").addEventListener("change", () => {
      applyFilters();
    });
  }

  // ── Node Selection ──────────────────────────────────
  function selectNode(d) {
    const panel = document.getElementById("detail-panel");
    const content = document.getElementById("detail-content");
    panel.style.display = "block";

    const tagsHtml = d.tags.length
      ? d.tags
          .map(
            (t) =>
              `<span class="detail-tag" style="background:${TAG_COLORS[t] || DEFAULT_COLOR}">${t}</span>`,
          )
          .join("")
      : '<span style="color:#7a7a9e">none</span>';

    const time = d.timestamp ? new Date(d.timestamp).toLocaleString() : "unknown";

    content.innerHTML = `
      <div class="detail-field">
        <div class="detail-label">Summary</div>
        <div>${escapeHtml(d.summary)}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">Tags</div>
        <div class="detail-tags">${tagsHtml}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">Timestamp</div>
        <div>${time}</div>
      </div>
      <div class="detail-field">
        <div class="detail-label">ID</div>
        <div style="font-family:monospace;font-size:0.75rem;color:#7a7a9e;word-break:break-all">${escapeHtml(d.id)}</div>
      </div>
      ${d.namespace ? `<div class="detail-field"><div class="detail-label">Namespace</div><div>${escapeHtml(d.namespace)}</div></div>` : ""}
    `;

    // Highlight selected node
    nodeGroup.selectAll("circle").attr("stroke", "#1a1a2e").attr("stroke-width", 1.5);
    nodeGroup
      .selectAll(".node")
      .filter((n) => n.id === d.id)
      .select("circle")
      .attr("stroke", "#e94560")
      .attr("stroke-width", 3);
  }

  // ── Tooltip ─────────────────────────────────────────
  function showTooltip(event, d) {
    const tooltip = document.getElementById("tooltip");
    const tagsHtml = d.tags
      .map(
        (t) =>
          `<span class="tip-tag" style="background:${TAG_COLORS[t] || DEFAULT_COLOR}">${t}</span>`,
      )
      .join("");
    const time = d.timestamp ? new Date(d.timestamp).toLocaleString() : "";

    tooltip.innerHTML = `
      <div>${escapeHtml(d.summary)}</div>
      ${tagsHtml ? `<div class="tip-tags">${tagsHtml}</div>` : ""}
      ${time ? `<div class="tip-time">${time}</div>` : ""}
    `;
    tooltip.classList.add("visible");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const tooltip = document.getElementById("tooltip");
    tooltip.style.left = event.clientX + 14 + "px";
    tooltip.style.top = event.clientY + 14 + "px";
  }

  function hideTooltip() {
    document.getElementById("tooltip").classList.remove("visible");
  }

  // ── Drag Handlers ───────────────────────────────────
  function dragStart(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragging(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragEnd(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // ── Helpers ─────────────────────────────────────────
  function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + "..." : str;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function updateStats() {
    const visible = getVisibleNodes().length;
    document.getElementById("graph-stats").textContent =
      `${visible} of ${allNodes.length} memories | ${allLinks.length} connections`;
  }
})();
