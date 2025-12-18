/**
 * Neo4j Integration Module (HTTP API)
 * Handles Neo4j graph database connections via HTTP API and vis.js visualization
 */

class Neo4jManager {
    constructor() {
        this.config = {
            neo4jUrl: '',
            neo4jUsername: '',
            neo4jPassword: '',
            neo4jDatabase: 'neo4j'
        };

        this.network = null;
        this.nodes = null;
        this.edges = null;
        this.expandedNodes = new Set(); // Track expanded nodes
        this.originalNodeIds = new Set(); // Track nodes from original query

        // Dynamic color assignment
        this.labelColorMap = new Map(); // Track which labels have which colors
        this.colorPalette = [
            { border: '#818cf8', background: 'rgba(129, 140, 248, 0.3)' },
            { border: '#34d399', background: 'rgba(52, 211, 153, 0.3)' },
            { border: '#fbbf24', background: 'rgba(251, 191, 36, 0.3)' },
            { border: '#f472b6', background: 'rgba(244, 114, 182, 0.3)' },
            { border: '#fb7185', background: 'rgba(251, 113, 133, 0.3)' },
            { border: '#60a5fa', background: 'rgba(96, 165, 250, 0.3)' },
            { border: '#a78bfa', background: 'rgba(167, 139, 250, 0.3)' },
            { border: '#2dd4bf', background: 'rgba(45, 212, 191, 0.3)' },
            { border: '#fb923c', background: 'rgba(251, 146, 60, 0.3)' },
            { border: '#e879f9', background: 'rgba(232, 121, 249, 0.3)' },
            { border: '#38bdf8', background: 'rgba(56, 189, 248, 0.3)' },
            { border: '#4ade80', background: 'rgba(74, 222, 128, 0.3)' },
            { border: '#facc15', background: 'rgba(250, 204, 21, 0.3)' },
            { border: '#f87171', background: 'rgba(248, 113, 113, 0.3)' },
            { border: '#c084fc', background: 'rgba(192, 132, 252, 0.3)' }
        ];

        // Load config asynchronously
        this.init();
    }

    /**
     * Initialize async
     */
    async init() {
        await this.loadConfig();
    }

    /**
     * Load configuration from encrypted localStorage
     */
    async loadConfig() {
        if (window.CryptoUtils) {
            const stored = await window.CryptoUtils.getItem('nox-neo4j-config');
            if (stored) {
                this.config = stored;
            }
        } else {
            // Fallback to unencrypted (for initial load)
            const stored = localStorage.getItem('nox-neo4j-config');
            if (stored) {
                try {
                    this.config = JSON.parse(stored);
                } catch (e) {
                    console.error('Failed to load Neo4j config:', e);
                }
            }
        }
    }

    /**
     * Save configuration to encrypted localStorage
     */
    async saveConfig(config) {
        this.config = { ...this.config, ...config };

        if (window.CryptoUtils) {
            await window.CryptoUtils.setItem('nox-neo4j-config', this.config);
        } else {
            // Fallback to unencrypted
            localStorage.setItem('nox-neo4j-config', JSON.stringify(this.config));
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Execute Cypher query via HTTP API
     * @param {string} cypherQuery - Cypher query to execute
     * @returns {Promise<Object>} - Query results
     */
    async executeQuery(cypherQuery) {
        if (!this.config.neo4jUrl || !this.config.neo4jUsername || !this.config.neo4jPassword) {
            throw new Error('Neo4j not configured. Please check settings.');
        }

        const authHeader = 'Basic ' + btoa(`${this.config.neo4jUsername}:${this.config.neo4jPassword}`);

        try {
            const response = await fetch(this.config.neo4jUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    statements: [{
                        statement: cypherQuery,
                        resultDataContents: ['row', 'graph'],
                        includeStats: true
                    }]
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            // Check for Neo4j errors
            if (data.errors && data.errors.length > 0) {
                const error = data.errors[0];
                throw new Error(`Neo4j Error: ${error.message} (${error.code})`);
            }

            return data;
        } catch (error) {
            console.error('Neo4j query error:', error);
            throw error;
        }
    }

    /**
     * Initialize visualization with vis.js
     * @param {string} containerId - DOM element ID for the graph container
     * @param {string} cypherQuery - Cypher query to execute
     */
    async initializeVisualization(containerId, cypherQuery) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container ${containerId} not found`);
        }

        // Execute query
        const result = await this.executeQuery(cypherQuery);

        // Parse graph data
        const graphData = this.parseGraphData(result);

        // Configure vis.js options for beautiful graph
        const options = {
            nodes: {
                shape: 'dot',
                size: 20,
                font: {
                    size: 14,
                    color: '#e1e4e8',
                    face: 'system-ui, -apple-system, sans-serif',
                    bold: {
                        color: '#ffffff'
                    }
                },
                borderWidth: 2,
                borderWidthSelected: 4,
                shadow: {
                    enabled: true,
                    color: 'rgba(102, 126, 234, 0.3)',
                    size: 10,
                    x: 0,
                    y: 0
                },
                color: {
                    border: '#667eea',
                    background: 'rgba(102, 126, 234, 0.2)',
                    highlight: {
                        border: '#818cf8',
                        background: 'rgba(129, 140, 248, 0.3)'
                    },
                    hover: {
                        border: '#a5b4fc',
                        background: 'rgba(165, 180, 252, 0.3)'
                    }
                }
            },
            edges: {
                width: 2,
                color: {
                    color: 'rgba(102, 126, 234, 0.5)',
                    highlight: 'rgba(129, 140, 248, 0.8)',
                    hover: 'rgba(165, 180, 252, 0.6)'
                },
                arrows: {
                    to: {
                        enabled: true,
                        scaleFactor: 0.8,
                        type: 'arrow'
                    }
                },
                smooth: {
                    enabled: true,
                    type: 'dynamic',
                    roundness: 0.5
                },
                font: {
                    size: 12,
                    color: '#9ca3af',
                    strokeWidth: 0,
                    align: 'middle',
                    face: 'system-ui, -apple-system, sans-serif'
                },
                shadow: {
                    enabled: true,
                    color: 'rgba(102, 126, 234, 0.2)',
                    size: 5,
                    x: 0,
                    y: 0
                }
            },
            physics: {
                enabled: true,
                barnesHut: {
                    gravitationalConstant: -8000,
                    centralGravity: 0.3,
                    springLength: 150,
                    springConstant: 0.04,
                    damping: 0.09,
                    avoidOverlap: 0.5
                },
                stabilization: {
                    enabled: true,
                    iterations: 200,
                    updateInterval: 25
                }
            },
            interaction: {
                hover: true,
                tooltipDelay: 100,
                navigationButtons: true,
                keyboard: false, // Disable keyboard to prevent interference with chat input
                zoomView: true,
                dragView: true
            },
            layout: {
                improvedLayout: true,
                randomSeed: 42
            }
        };

        // Create network
        this.nodes = new vis.DataSet(graphData.nodes);
        this.edges = new vis.DataSet(graphData.edges);

        const data = {
            nodes: this.nodes,
            edges: this.edges
        };

        this.network = new vis.Network(container, data, options);

        // Store original node IDs
        this.originalNodeIds.clear();
        graphData.nodes.forEach(node => this.originalNodeIds.add(node.id));

        // Add event listeners for interactivity
        this.network.on('click', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                const node = this.nodes.get(nodeId);
                console.log('Node clicked:', node);
            }
        });

        // Add double-click handler for node expansion
        this.network.on('doubleClick', (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.expandNode(nodeId);
            }
        });

        return {
            nodeCount: graphData.nodes.length,
            edgeCount: graphData.edges.length
        };
    }

    /**
     * Expand a node to show its 1-hop neighbors
     */
    async expandNode(nodeId) {
        try {
            console.log('Expanding node:', nodeId);

            // Query for 1-hop neighbors
            const query = `MATCH (n)-[r]-(m) WHERE id(n) = ${nodeId} RETURN n, r, m`;
            const result = await this.executeQuery(query);
            const graphData = this.parseGraphData(result);

            // Mark the expanded node
            const expandedNode = this.nodes.get(nodeId);
            if (expandedNode) {
                expandedNode.expanded = true;
                expandedNode.borderWidth = 4;
                this.nodes.update(expandedNode);
                this.expandedNodes.add(nodeId);
            }

            // Add new nodes (avoiding duplicates)
            let newNodesCount = 0;
            graphData.nodes.forEach(node => {
                if (!this.nodes.get(node.id)) {
                    this.nodes.add(node);
                    newNodesCount++;
                }
            });

            // Add new edges (avoiding duplicates)
            let newEdgesCount = 0;
            graphData.edges.forEach(edge => {
                if (!this.edges.get(edge.id)) {
                    this.edges.add(edge);
                    newEdgesCount++;
                }
            });

            // Stabilize the layout
            this.network.stabilize();

            return {
                nodeCount: newNodesCount,
                edgeCount: newEdgesCount,
                totalNodes: this.nodes.length,
                totalEdges: this.edges.length
            };
        } catch (error) {
            console.error('Failed to expand node:', error);
            throw error;
        }
    }

    /**
     * Collapse all expanded nodes back to original query
     */
    collapseAll() {
        if (!this.nodes || !this.edges) return;

        // Remove all nodes that weren't in the original query
        const nodesToRemove = this.nodes.get().filter(node => !this.originalNodeIds.has(node.id));
        this.nodes.remove(nodesToRemove.map(n => n.id));

        // Remove orphaned edges
        const currentNodeIds = new Set(this.nodes.getIds());
        const edgesToRemove = this.edges.get().filter(edge =>
            !currentNodeIds.has(edge.from) || !currentNodeIds.has(edge.to)
        );
        this.edges.remove(edgesToRemove.map(e => e.id));

        // Reset expanded nodes visual state
        this.expandedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                node.expanded = false;
                node.borderWidth = 2;
                this.nodes.update(node);
            }
        });
        this.expandedNodes.clear();

        // Re-fit the view
        this.fit();

        return {
            nodeCount: this.nodes.length,
            edgeCount: this.edges.length
        };
    }

    /**
     * Parse Neo4j HTTP API response into vis.js format
     * @param {Object} result - Neo4j HTTP API response
     * @returns {Object} - {nodes: [], edges: []}
     */
    parseGraphData(result) {
        const nodesMap = new Map();
        const edgesArray = [];

        if (!result.results || result.results.length === 0) {
            return { nodes: [], edges: [] };
        }

        const statement = result.results[0];

        // Process graph data if available
        if (statement.data) {
            statement.data.forEach((record) => {
                if (record.graph) {
                    // Process nodes
                    record.graph.nodes.forEach((node) => {
                        if (!nodesMap.has(node.id)) {
                            const label = this.getNodeLabel(node);
                            const color = this.getNodeColor(node.labels);

                            nodesMap.set(node.id, {
                                id: node.id,
                                label: label,
                                title: this.getNodeTooltip(node),
                                color: color,
                                size: 20 + (Object.keys(node.properties).length * 2),
                                font: {
                                    size: 14,
                                    color: '#ffffff',
                                    face: 'system-ui, -apple-system, sans-serif',
                                    strokeWidth: 3,
                                    strokeColor: 'rgba(0, 0, 0, 0.8)'
                                },
                                // Store metadata for reference
                                metadata: {
                                    labels: node.labels,
                                    properties: node.properties
                                }
                            });
                        }
                    });

                    // Process relationships
                    record.graph.relationships.forEach((rel) => {
                        edgesArray.push({
                            id: rel.id,
                            from: rel.startNode,
                            to: rel.endNode,
                            label: rel.type,
                            title: this.getEdgeTooltip(rel),
                            arrows: 'to'
                        });
                    });
                }
            });
        }

        return {
            nodes: Array.from(nodesMap.values()),
            edges: edgesArray
        };
    }

    /**
     * Get label for node
     */
    getNodeLabel(node) {
        // Try common label properties
        const labelProps = ['name', 'title', 'label', 'id'];
        for (const prop of labelProps) {
            if (node.properties[prop]) {
                return String(node.properties[prop]);
            }
        }

        // Fallback to first label or ID
        return node.labels[0] || `Node ${node.id}`;
    }

    /**
     * Simple hash function for consistent color assignment
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Get color for node based on labels (dynamic assignment)
     */
    getNodeColor(labels) {
        // Predefined colors for common types
        const predefinedColors = {
            // Security & Threats
            'Campaign': { border: '#ef4444', background: 'rgba(239, 68, 68, 0.3)' },
            'Threat': { border: '#dc2626', background: 'rgba(220, 38, 38, 0.3)' },
            'Malware': { border: '#991b1b', background: 'rgba(153, 27, 27, 0.3)' },
            'Vulnerability': { border: '#f97316', background: 'rgba(249, 115, 22, 0.3)' },
            'Attack': { border: '#ea580c', background: 'rgba(234, 88, 12, 0.3)' },

            // People & Users
            'Person': { border: '#818cf8', background: 'rgba(129, 140, 248, 0.3)' },
            'User': { border: '#60a5fa', background: 'rgba(96, 165, 250, 0.3)' },
            'Employee': { border: '#38bdf8', background: 'rgba(56, 189, 248, 0.3)' },
            'Customer': { border: '#0ea5e9', background: 'rgba(14, 165, 233, 0.3)' },

            // Organizations
            'Company': { border: '#f472b6', background: 'rgba(244, 114, 182, 0.3)' },
            'Organization': { border: '#ec4899', background: 'rgba(236, 72, 153, 0.3)' },
            'Department': { border: '#db2777', background: 'rgba(219, 39, 119, 0.3)' }
        };

        // Check predefined colors first
        for (const label of labels) {
            if (predefinedColors[label]) {
                return predefinedColors[label];
            }
        }

        // For unknown labels, use dynamic color assignment
        const primaryLabel = labels[0] || 'Unknown';

        // Check if we've already assigned a color to this label
        if (this.labelColorMap.has(primaryLabel)) {
            return this.labelColorMap.get(primaryLabel);
        }

        // Assign a new color based on hash
        const hash = this.hashString(primaryLabel);
        const colorIndex = hash % this.colorPalette.length;
        const color = this.colorPalette[colorIndex];

        // Store the assignment
        this.labelColorMap.set(primaryLabel, color);

        return color;
    }

    /**
     * Get tooltip for node (plain text with newlines)
     */
    getNodeTooltip(node) {
        let text = `${node.labels.join(', ')}\n`;
        text += `ID: ${node.id}\n`;

        const propEntries = Object.entries(node.properties);
        if (propEntries.length > 0) {
            text += `\nProperties:\n`;
            propEntries.forEach(([key, value]) => {
                // Truncate long values
                const displayValue = String(value).length > 60
                    ? String(value).substring(0, 60) + '...'
                    : value;
                text += `  ${key}: ${displayValue}\n`;
            });
        } else {
            text += `\nNo properties`;
        }

        return text;
    }

    /**
     * Get tooltip for edge (plain text with newlines)
     */
    getEdgeTooltip(rel) {
        let text = `${rel.type}\n`;
        text += `ID: ${rel.id}\n`;

        if (rel.properties && Object.keys(rel.properties).length > 0) {
            text += `\nProperties:\n`;
            Object.entries(rel.properties).forEach(([key, value]) => {
                const displayValue = String(value).length > 60
                    ? String(value).substring(0, 60) + '...'
                    : value;
                text += `  ${key}: ${displayValue}\n`;
            });
        } else {
            text += `\nNo properties`;
        }

        return text;
    }

    /**
     * Update visualization with new query
     */
    async updateVisualization(cypherQuery) {
        if (!this.network) {
            throw new Error('Network not initialized');
        }

        const result = await this.executeQuery(cypherQuery);
        const graphData = this.parseGraphData(result);

        this.nodes.clear();
        this.edges.clear();

        this.nodes.add(graphData.nodes);
        this.edges.add(graphData.edges);

        return {
            nodeCount: graphData.nodes.length,
            edgeCount: graphData.edges.length
        };
    }

    /**
     * Clear visualization
     */
    clearVisualization() {
        if (this.nodes) this.nodes.clear();
        if (this.edges) this.edges.clear();
    }

    /**
     * Stabilize graph layout
     */
    stabilize() {
        if (this.network) {
            this.network.stabilize();
        }
    }

    /**
     * Fit graph to view
     */
    fit() {
        if (this.network) {
            this.network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    }
}

// Create global instance
const neo4jManager = new Neo4jManager();
