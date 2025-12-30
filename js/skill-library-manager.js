/**
 * Skill Library Manager
 * Manages skills stored in Neo4j - view, edit, delete (no create - create only via chat)
 */

class SkillLibraryManager {
    constructor(neo4jManager) {
        this.neo4jManager = neo4jManager;
        this.skills = [];
        this.selectedSkill = null;
        this.filterCategory = 'all';
        this.searchQuery = '';
    }

    /**
     * Load all skills from Neo4j
     */
    async loadSkills() {
        try {
            const query = `
                MATCH (s:Skill)
                RETURN s
                ORDER BY s.usage_count DESC, s.created_at DESC
            `;

            const result = await this.neo4jManager.executeQuery(query);

            // Parse Neo4j response structure
            if (result && result.results && result.results.length > 0) {
                const statement = result.results[0];

                if (statement.data && statement.data.length > 0) {
                    this.skills = statement.data.map(record => {
                        // Get the node from the row (first element since we RETURN s)
                        const node = record.row[0];
                        return node; // Return the entire node object which includes properties
                    });

                    console.log('Loaded skills:', this.skills.length);
                    return this.skills;
                }
            }

            this.skills = [];
            return [];
        } catch (error) {
            console.error('Failed to load skills:', error);
            throw new Error('Failed to load skills from Neo4j');
        }
    }

    /**
     * Get filtered skills based on search and category
     */
    getFilteredSkills() {
        let filtered = [...this.skills];

        // Filter by category
        if (this.filterCategory !== 'all') {
            filtered = filtered.filter(skill =>
                skill.category === this.filterCategory
            );
        }

        // Filter by search query
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(skill =>
                skill.name.toLowerCase().includes(query) ||
                skill.description.toLowerCase().includes(query) ||
                skill.triggers.some(t => t.toLowerCase().includes(query))
            );
        }

        return filtered;
    }

    /**
     * Get skill by ID
     */
    getSkillById(id) {
        return this.skills.find(skill => skill.id === id);
    }

    /**
     * Update skill in Neo4j
     */
    async updateSkill(id, updates) {
        try {
            const skill = this.getSkillById(id);
            if (!skill) {
                throw new Error('Skill not found');
            }

            // Increment version
            const newVersion = (skill.version || 1) + 1;

            // Build SET clause dynamically
            const setStatements = [];
            const params = { id };

            if (updates.name !== undefined) {
                setStatements.push('s.name = $name');
                params.name = updates.name;
            }
            if (updates.description !== undefined) {
                setStatements.push('s.description = $description');
                params.description = updates.description;
            }
            if (updates.category !== undefined) {
                setStatements.push('s.category = $category');
                params.category = updates.category;
            }
            if (updates.triggers !== undefined) {
                setStatements.push('s.triggers = $triggers');
                params.triggers = Array.isArray(updates.triggers) ? updates.triggers : updates.triggers.split(',').map(t => t.trim());
            }
            if (updates.cypher_template !== undefined) {
                setStatements.push('s.cypher_template = $cypher_template');
                params.cypher_template = updates.cypher_template;
            }
            if (updates.parameters !== undefined) {
                setStatements.push('s.parameters = $parameters');
                // Ensure parameters are stored as JSON string
                params.parameters = typeof updates.parameters === 'string' ?
                    updates.parameters : JSON.stringify(updates.parameters);
            }

            // Always update version and updated_at
            setStatements.push('s.version = $version');
            setStatements.push('s.updated_at = datetime()');
            params.version = newVersion;

            const query = `
                MATCH (s:Skill {id: $id})
                SET ${setStatements.join(', ')}
                RETURN s
            `;

            const result = await this.neo4jManager.executeQuery(query, params);

            // Parse Neo4j response
            if (result && result.results && result.results.length > 0) {
                const statement = result.results[0];
                if (statement.data && statement.data.length > 0) {
                    // Reload skills to update local cache
                    await this.loadSkills();
                    const updatedSkill = statement.data[0].row[0];
                    return updatedSkill;
                }
            }

            throw new Error('Failed to update skill');
        } catch (error) {
            console.error('Update skill error:', error);
            throw error;
        }
    }

    /**
     * Delete skill from Neo4j
     */
    async deleteSkill(id) {
        try {
            const query = `
                MATCH (s:Skill {id: $id})
                DELETE s
                RETURN count(s) as deleted
            `;

            const result = await this.neo4jManager.executeQuery(query, { id });

            // Parse Neo4j response
            if (result && result.results && result.results.length > 0) {
                const statement = result.results[0];
                if (statement.data && statement.data.length > 0) {
                    const deletedCount = statement.data[0].row[0];
                    if (deletedCount > 0) {
                        // Reload skills to update local cache
                        await this.loadSkills();
                        return true;
                    }
                }
            }

            return false;
        } catch (error) {
            console.error('Delete skill error:', error);
            throw error;
        }
    }

    /**
     * Get unique categories from skills
     */
    getCategories() {
        const categories = new Set();
        this.skills.forEach(skill => {
            if (skill.category) {
                categories.add(skill.category);
            }
        });
        return Array.from(categories).sort();
    }

    /**
     * Get skill statistics
     */
    getStats() {
        return {
            total: this.skills.length,
            byCategory: this.getCategories().map(cat => ({
                category: cat,
                count: this.skills.filter(s => s.category === cat).length
            })),
            mostUsed: this.skills.slice(0, 5), // Already sorted by usage_count
            totalUsage: this.skills.reduce((sum, s) => sum + (s.usage_count || 0), 0)
        };
    }

    /**
     * Validate skill data
     */
    validateSkill(skillData) {
        const errors = [];

        if (!skillData.name || skillData.name.trim() === '') {
            errors.push('Skill name is required');
        }

        if (!skillData.description || skillData.description.trim() === '') {
            errors.push('Description is required');
        }

        if (!skillData.triggers || skillData.triggers.length === 0) {
            errors.push('At least one trigger is required');
        }

        if (!skillData.cypher_template || skillData.cypher_template.trim() === '') {
            errors.push('Cypher template is required');
        }

        // Validate Cypher has required keywords
        const cypher = skillData.cypher_template.toUpperCase();
        if (!cypher.includes('CREATE') && !cypher.includes('MERGE') && !cypher.includes('MATCH')) {
            errors.push('Cypher template must contain CREATE, MERGE, or MATCH');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
