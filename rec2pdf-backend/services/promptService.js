'use strict';

const fs = require('fs').promises;
const path = require('path');
const Handlebars = require('handlebars');

/**
 * PromptService: Manages prompt templates and rendering
 * 
 * Responsibilities:
 * - Load template files from disk
 * - Compile Handlebars templates
 * - Cache compiled templates for performance
 * - Render templates with provided data
 */
class PromptService {
  constructor(templatesDir = './prompts/templates') {
    this.templatesDir = path.resolve(templatesDir);
    this.templateCache = new Map();
    this.cacheEnabled = process.env.NODE_ENV === 'production';
    
    console.log(`📝 PromptService initialized (templates: ${this.templatesDir})`);
  }

  /**
   * Load and compile a template
   * @param {string} templateName - Name of template (without .hbs extension)
   * @returns {Promise<Function>} Compiled template function
   */
  async loadTemplate(templateName) {
    if (this.cacheEnabled && this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName);
    }

    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);
      
      try {
        await fs.access(templatePath);
      } catch {
        throw new Error(`Template not found: ${templateName} (${templatePath})`);
      }

      const templateSource = await fs.readFile(templatePath, 'utf8');
      const compiled = Handlebars.compile(templateSource);
      
      if (this.cacheEnabled) {
        this.templateCache.set(templateName, compiled);
      }
      
      return compiled;

    } catch (error) {
      console.error(`❌ Failed to load template ${templateName}:`, error);
      throw error;
    }
  }

  /**
   * Render a template with provided data
   * @param {string} templateName - Name of template
   * @param {object} data - Data to populate template
   * @returns {Promise<string>} Rendered prompt
   */
  async render(templateName, data = {}) {
    try {
      const template = await this.loadTemplate(templateName);
      const rendered = template(data);
      
      console.log(`📝 Rendered template: ${templateName} (${rendered.length} chars)`);
      
      return rendered;

    } catch (error) {
      console.error(`❌ Failed to render template ${templateName}:`, error);
      throw error;
    }
  }
}

module.exports = { PromptService };
