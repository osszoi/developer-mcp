import { ToolDefinition, ToolCategory } from '../types/index.js';
import path from 'path';
import { readdir } from 'fs/promises';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private categories: Map<string, ToolCategory> = new Map();

  constructor() {
    this.initializeCategories();
  }

  private initializeCategories() {
    const categories: ToolCategory[] = [
      {
        name: 'examples',
        description: 'Example tools for demonstration',
        subcategories: [
          { name: 'test', description: 'Test examples' }
        ]
      },
      {
        name: 'git',
        description: 'Git version control tools',
        subcategories: [
          { name: 'repository', description: 'Repository management' },
          { name: 'commits', description: 'Commit operations' },
          { name: 'branches', description: 'Branch management' }
        ]
      },
      {
        name: 'docker',
        description: 'Docker container and image management',
        subcategories: [
          { name: 'containers', description: 'Container operations' },
          { name: 'images', description: 'Image management' },
          { name: 'compose', description: 'Docker Compose operations' }
        ]
      },
      {
        name: 'utilities',
        description: 'General utility tools',
        subcategories: [
          { name: 'file', description: 'File operations' },
          { name: 'system', description: 'System utilities' }
        ]
      }
    ];

    categories.forEach(cat => this.categories.set(cat.name, cat));
  }

  registerTool(tool: ToolDefinition): void {
    const toolId = this.generateToolId(tool);
    
    if (this.tools.has(toolId)) {
      throw new Error(`Tool ${toolId} is already registered`);
    }

    if (!this.categories.has(tool.category)) {
      throw new Error(`Category ${tool.category} does not exist`);
    }

    this.tools.set(toolId, tool);
    console.log(`Registered tool: ${toolId}`);
  }

  private generateToolId(tool: ToolDefinition): string {
    const parts = [tool.category];
    if (tool.subcategory) {
      parts.push(tool.subcategory);
    }
    parts.push(tool.name);
    return parts.join('_');
  }

  getTool(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  getAllTools(): Map<string, ToolDefinition> {
    return new Map(this.tools);
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      tool => tool.category === category
    );
  }

  async loadToolsFromDirectory(baseDir: string): Promise<void> {
    const toolsDir = path.join(baseDir, 'tools');
    
    for (const [category, categoryDef] of this.categories) {
      const categoryDir = path.join(toolsDir, category);
      
      try {
        await this.loadCategoryTools(categoryDir, category, categoryDef);
      } catch (error) {
        console.log(`No tools found in category: ${category}`);
      }
    }
  }

  private async loadCategoryTools(
    categoryDir: string, 
    category: string, 
    categoryDef: ToolCategory
  ): Promise<void> {
    try {
      const entries = await readdir(categoryDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && categoryDef.subcategories) {
          const subcategory = categoryDef.subcategories.find(
            sub => sub.name === entry.name
          );
          
          if (subcategory) {
            await this.loadSubcategoryTools(
              path.join(categoryDir, entry.name),
              category,
              entry.name
            );
          }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
          await this.loadToolFile(
            path.join(categoryDir, entry.name),
            category
          );
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }

  private async loadSubcategoryTools(
    subcategoryDir: string,
    category: string,
    subcategory: string
  ): Promise<void> {
    try {
      const files = await readdir(subcategoryDir);
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          await this.loadToolFile(
            path.join(subcategoryDir, file),
            category,
            subcategory
          );
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }

  private async loadToolFile(
    filePath: string,
    category: string,
    subcategory?: string
  ): Promise<void> {
    try {
      const module = await import(filePath);
      
      if (module.default && this.isValidToolDefinition(module.default)) {
        const tool = module.default as ToolDefinition;
        tool.category = category;
        if (subcategory) {
          tool.subcategory = subcategory;
        }
        this.registerTool(tool);
      }
    } catch (error) {
      console.error(`Failed to load tool from ${filePath}:`, error);
    }
  }

  private isValidToolDefinition(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      typeof obj.name === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.handler === 'function' &&
      obj.inputSchema
    );
  }
}