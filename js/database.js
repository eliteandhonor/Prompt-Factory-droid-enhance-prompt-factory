// PromptVerse Database Module
// This module handles all database operations using localStorage for client-side storage

class PromptVerseDB {
    constructor() {
        this.storageKeys = {
            prompts: 'promptverse_prompts',
            categories: 'promptverse_categories',
            comments: 'promptverse_comments',
            outputs: 'promptverse_outputs',
            favorites: 'promptverse_favorites',
            users: 'promptverse_users',
            votes: 'promptverse_votes'
        };
        this.isInitialized = false;
    }

    // Initialize the database with default data
    async initDatabase() {
        if (this.isInitialized) return;

        // Initialize with sample data if no data exists
        if (!localStorage.getItem(this.storageKeys.prompts)) {
            await this.initSampleData();
        }
        this.isInitialized = true;
    }

    // Initialize sample data
    async initSampleData() {
        // Sample categories
        const sampleCategories = [
            {
                id: 'cat1',
                name: 'Creative Writing',
                description: 'Prompts for creative writing and storytelling',
                icon: 'fas fa-pen-fancy',
                status: 'approved',
                promptCount: 3
            },
            {
                id: 'cat2',
                name: 'AI Assistant',
                description: 'Prompts for AI assistants and chatbots',
                icon: 'fas fa-robot',
                status: 'approved',
                promptCount: 2
            },
            {
                id: 'cat3',
                name: 'Code Generation',
                description: 'Prompts for generating and reviewing code',
                icon: 'fas fa-code',
                status: 'approved',
                promptCount: 1
            },
            {
                id: 'cat4',
                name: 'Business',
                description: 'Business and professional prompts',
                icon: 'fas fa-briefcase',
                status: 'approved',
                promptCount: 1
            }
        ];

        // Sample prompts
        const samplePrompts = [
            {
                id: 'prompt1',
                title: 'Creative Story Generator',
                content: 'Write a short story about a character who discovers they can communicate with plants. The story should be approximately 500 words and include dialogue, setting description, and a surprising twist at the end.',
                categoryId: 'cat1',
                tags: ['creative', 'fiction', 'dialogue'],
                views: 142,
                favoritesCount: 23,
                createdAt: new Date('2025-01-15').toISOString(),
                author: 'StoryMaster'
            },
            {
                id: 'prompt2',
                title: 'AI Ethics Discussion',
                content: 'You are an AI ethics expert. Discuss the implications of artificial intelligence in healthcare, focusing on privacy concerns, decision-making transparency, and the balance between automation and human oversight.',
                categoryId: 'cat2',
                tags: ['ethics', 'healthcare', 'AI'],
                views: 89,
                favoritesCount: 15,
                createdAt: new Date('2025-01-20').toISOString(),
                author: 'TechPhilosopher'
            },
            {
                id: 'prompt3',
                title: 'React Component Creator',
                content: 'Create a reusable React component for a modern, accessible dropdown menu. Include TypeScript types, proper ARIA attributes, keyboard navigation support, and custom styling options.',
                categoryId: 'cat3',
                tags: ['react', 'typescript', 'accessibility'],
                views: 67,
                favoritesCount: 12,
                createdAt: new Date('2025-01-25').toISOString(),
                author: 'CodeCrafter'
            },
            {
                id: 'prompt4',
                title: 'Marketing Campaign Analyzer',
                content: 'Analyze the effectiveness of a digital marketing campaign. Consider metrics like conversion rates, customer acquisition cost, engagement rates, and ROI. Provide actionable recommendations for improvement.',
                categoryId: 'cat4',
                tags: ['marketing', 'analysis', 'ROI'],
                views: 55,
                favoritesCount: 8,
                createdAt: new Date('2025-01-30').toISOString(),
                author: 'MarketingPro'
            },
            {
                id: 'prompt5',
                title: 'Character Development Workshop',
                content: 'Create a detailed character profile for a protagonist in a fantasy novel. Include their background, motivations, flaws, special abilities, and how they change throughout their journey.',
                categoryId: 'cat1',
                tags: ['character', 'fantasy', 'development'],
                views: 78,
                favoritesCount: 19,
                createdAt: new Date('2025-02-02').toISOString(),
                author: 'WorldBuilder'
            },
            {
                id: 'prompt6',
                title: 'AI Assistant Personality',
                content: 'Design a helpful and engaging personality for an AI assistant that works in customer service. Define their tone, conversation style, problem-solving approach, and how they handle difficult situations.',
                categoryId: 'cat2',
                tags: ['personality', 'customer-service', 'AI'],
                views: 91,
                favoritesCount: 16,
                createdAt: new Date('2025-02-05').toISOString(),
                author: 'UXDesigner'
            },
            {
                id: 'prompt7',
                title: 'Dialogue Writing Exercise',
                content: 'Write a conversation between two characters who are meeting for the first time but have very different perspectives on life. Show their personalities through their dialogue without explicitly stating their traits.',
                categoryId: 'cat1',
                tags: ['dialogue', 'character', 'writing'],
                views: 63,
                favoritesCount: 11,
                createdAt: new Date('2025-02-08').toISOString(),
                author: 'DialogueMaster'
            }
        ];

        // Save sample data
        localStorage.setItem(this.storageKeys.categories, JSON.stringify(sampleCategories));
        localStorage.setItem(this.storageKeys.prompts, JSON.stringify(samplePrompts));
        localStorage.setItem(this.storageKeys.comments, JSON.stringify([]));
        localStorage.setItem(this.storageKeys.outputs, JSON.stringify([]));
        localStorage.setItem(this.storageKeys.favorites, JSON.stringify([]));
        localStorage.setItem(this.storageKeys.users, JSON.stringify([]));
        localStorage.setItem(this.storageKeys.votes, JSON.stringify([]));
    }

    // Get all prompts with optional filtering and sorting
    async getPrompts(options = {}) {
        const prompts = JSON.parse(localStorage.getItem(this.storageKeys.prompts) || '[]');
        let filteredPrompts = [...prompts];

        // Apply filters
        if (options.categoryId) {
            filteredPrompts = filteredPrompts.filter(p => p.categoryId === options.categoryId);
        }
        if (options.search) {
            const searchTerm = options.search.toLowerCase();
            filteredPrompts = filteredPrompts.filter(p => 
                p.title.toLowerCase().includes(searchTerm) ||
                p.content.toLowerCase().includes(searchTerm) ||
                p.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // Apply sorting
        if (options.sortBy) {
            filteredPrompts.sort((a, b) => {
                const aVal = a[options.sortBy] || 0;
                const bVal = b[options.sortBy] || 0;
                return options.sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
            });
        }

        return filteredPrompts;
    }

    // Get a single prompt by ID
    async getPromptById(id) {
        const prompts = JSON.parse(localStorage.getItem(this.storageKeys.prompts) || '[]');
        return prompts.find(p => p.id === id);
    }

    // Get all categories
    async getCategories(options = {}) {
        const categories = JSON.parse(localStorage.getItem(this.storageKeys.categories) || '[]');
        
        if (options.status === 'approved') {
            return categories.filter(c => c.status === 'approved');
        }
        
        return categories;
    }

    // Get category by ID
    async getCategoryById(id) {
        const categories = JSON.parse(localStorage.getItem(this.storageKeys.categories) || '[]');
        return categories.find(c => c.id === id);
    }

    // Add a new prompt
    async addPrompt(promptData) {
        const prompts = JSON.parse(localStorage.getItem(this.storageKeys.prompts) || '[]');
        const newPrompt = {
            id: 'prompt_' + Date.now(),
            ...promptData,
            views: 0,
            favoritesCount: 0,
            createdAt: new Date().toISOString()
        };
        prompts.push(newPrompt);
        localStorage.setItem(this.storageKeys.prompts, JSON.stringify(prompts));
        return newPrompt;
    }

    // Update a prompt
    async updatePrompt(id, updateData) {
        const prompts = JSON.parse(localStorage.getItem(this.storageKeys.prompts) || '[]');
        const index = prompts.findIndex(p => p.id === id);
        if (index !== -1) {
            prompts[index] = { ...prompts[index], ...updateData };
            localStorage.setItem(this.storageKeys.prompts, JSON.stringify(prompts));
            return prompts[index];
        }
        return null;
    }

    // Increment view count
    async incrementViews(promptId) {
        const prompt = await this.getPromptById(promptId);
        if (prompt) {
            await this.updatePrompt(promptId, { views: (prompt.views || 0) + 1 });
        }
    }

    // Add category
    async addCategory(categoryData) {
        const categories = JSON.parse(localStorage.getItem(this.storageKeys.categories) || '[]');
        const newCategory = {
            id: 'cat_' + Date.now(),
            ...categoryData,
            promptCount: 0,
            status: 'pending'
        };
        categories.push(newCategory);
        localStorage.setItem(this.storageKeys.categories, JSON.stringify(categories));
        return newCategory;
    }

    // Update category
    async updateCategory(id, updateData) {
        const categories = JSON.parse(localStorage.getItem(this.storageKeys.categories) || '[]');
        const index = categories.findIndex(c => c.id === id);
        if (index !== -1) {
            categories[index] = { ...categories[index], ...updateData };
            localStorage.setItem(this.storageKeys.categories, JSON.stringify(categories));
            return categories[index];
        }
        return null;
    }

    // Delete category
    async deleteCategory(id) {
        const categories = JSON.parse(localStorage.getItem(this.storageKeys.categories) || '[]');
        const filteredCategories = categories.filter(c => c.id !== id);
        localStorage.setItem(this.storageKeys.categories, JSON.stringify(filteredCategories));
        return true;
    }

    // Get comments for a prompt
    async getComments(promptId) {
        const comments = JSON.parse(localStorage.getItem(this.storageKeys.comments) || '[]');
        return comments.filter(c => c.promptId === promptId);
    }

    // Add comment
    async addComment(commentData) {
        const comments = JSON.parse(localStorage.getItem(this.storageKeys.comments) || '[]');
        const newComment = {
            id: 'comment_' + Date.now(),
            ...commentData,
            createdAt: new Date().toISOString(),
            votes: 0
        };
        comments.push(newComment);
        localStorage.setItem(this.storageKeys.comments, JSON.stringify(comments));
        return newComment;
    }

    // Get outputs for a prompt
    async getOutputs(promptId) {
        const outputs = JSON.parse(localStorage.getItem(this.storageKeys.outputs) || '[]');
        return outputs.filter(o => o.promptId === promptId);
    }

    // Add output
    async addOutput(outputData) {
        const outputs = JSON.parse(localStorage.getItem(this.storageKeys.outputs) || '[]');
        const newOutput = {
            id: 'output_' + Date.now(),
            ...outputData,
            createdAt: new Date().toISOString(),
            votes: 0
        };
        outputs.push(newOutput);
        localStorage.setItem(this.storageKeys.outputs, JSON.stringify(outputs));
        return newOutput;
    }
}

// Create and export a single instance
const db = new PromptVerseDB();
export default db;
