/**
 * Neo4j Integration Module
 * Handles Neo4j graph database connections and visualization
 */

class Neo4jManager {
    constructor() {
        this.config = {
            neo4jUrl: '',
            neo4jUsername: '',
            neo4jPassword: '',
            neo4jDatabase: 'neo4j'
        };

        this.driver = null;
        this.viz = null;

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
        // Trim trailing slashes from URL
        if (config.neo4jUrl) {
            config.neo4jUrl = config.neo4jUrl.replace(/\/+$/, '');
        }

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
     * Test Neo4j connection
     */
    async testConnection() {
        if (!this.config.neo4jUrl || !this.config.neo4jUsername || !this.config.neo4jPassword) {
            throw new Error('Neo4j connection details are incomplete. Please check settings.');
        }

        try {
            // For now, return a success message
            // Actual connection will be handled by neovis.js in the graph view
            return {
                success: true,
                message: 'Configuration saved. Connection will be tested when opening graph view.',
                config: {
                    url: this.config.neo4jUrl,
                    database: this.config.neo4jDatabase
                }
            };
        } catch (error) {
            console.error('Neo4j connection test failed:', error);
            throw error;
        }
    }

    /**
     * Initialize visualization with neovis.js
     * @param {string} containerId - DOM element ID for the graph container
     * @param {string} cypherQuery - Cypher query to execute
     * @param {string} database - Database to query (optional)
     */
    async initializeVisualization(containerId, cypherQuery, database = null) {
        if (!this.config.neo4jUrl || !this.config.neo4jUsername || !this.config.neo4jPassword) {
            throw new Error('Neo4j connection not configured. Please check settings.');
        }

        const db = database || this.config.neo4jDatabase;

        try {
            // Configure neovis
            const config = {
                containerId: containerId,
                neo4j: {
                    serverUrl: this.config.neo4jUrl,
                    serverUser: this.config.neo4jUsername,
                    serverPassword: this.config.neo4jPassword
                    // Note: Encryption is handled by URL scheme (neo4j+s:// or neo4j+ssc://)
                    // Don't specify driverConfig.encrypted to avoid conflicts
                },
                visConfig: {
                    nodes: {
                        shape: 'dot',
                        size: 25,
                        font: {
                            size: 14,
                            color: '#e1e4e8'
                        },
                        borderWidth: 2,
                        borderWidthSelected: 4
                    },
                    edges: {
                        arrows: {
                            to: { enabled: true, scaleFactor: 0.5 }
                        },
                        color: {
                            color: '#667eea',
                            highlight: '#818cf8',
                            hover: '#a5b4fc'
                        },
                        font: {
                            size: 12,
                            color: '#9ca3af',
                            align: 'top'
                        },
                        smooth: {
                            enabled: true,
                            type: 'dynamic'
                        }
                    },
                    interaction: {
                        hover: true,
                        navigationButtons: true,
                        keyboard: true,
                        tooltipDelay: 200
                    },
                    physics: {
                        enabled: true,
                        stabilization: {
                            iterations: 200
                        },
                        barnesHut: {
                            gravitationalConstant: -8000,
                            springConstant: 0.04,
                            springLength: 95
                        }
                    }
                },
                labels: {},
                relationships: {},
                initialCypher: cypherQuery,
                database: db
            };

            // Create new NeoVis instance
            if (window.NeoVis) {
                this.viz = new window.NeoVis.default(config);

                // Render the graph
                this.viz.render();

                return this.viz;
            } else {
                throw new Error('NeoVis library not loaded. Please check if neovis.js is included.');
            }
        } catch (error) {
            console.error('Failed to initialize Neo4j visualization:', error);
            throw error;
        }
    }

    /**
     * Execute a Cypher query and update visualization
     */
    async executeQuery(cypherQuery, database = null) {
        if (!this.viz) {
            throw new Error('Visualization not initialized. Call initializeVisualization first.');
        }

        try {
            // Update the query and re-render
            this.viz.updateWithCypher(cypherQuery);
        } catch (error) {
            console.error('Failed to execute query:', error);
            throw error;
        }
    }

    /**
     * Clear the current visualization
     */
    clearVisualization() {
        if (this.viz) {
            this.viz.clearNetwork();
        }
    }

    /**
     * Stabilize the graph layout
     */
    stabilize() {
        if (this.viz && this.viz._network) {
            this.viz._network.stabilize();
        }
    }
}

// Create global instance
const neo4jManager = new Neo4jManager();
