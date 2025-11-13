import { JiraApiClient } from '../jiraApiClient.js';
import { ToolResult } from '../types/index.js';
import { Logger } from '../utils/logger.js';

export class StructureService {
  private logger: Logger;

  constructor(private apiClient: JiraApiClient) {
    this.logger = new Logger('StructureService');
  }

  async getStructures(params: { projectKey?: string }): Promise<ToolResult> {
    try {
      this.logger.debug('Fetching structures', params);
      this.logger.debug('Full params:', JSON.stringify(params, null, 2));

      const structures = await this.apiClient.getStructures(params);
      this.logger.debug('Structures response:', JSON.stringify(structures, null, 2));

      if (!structures || structures.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📊 Jira Structures

**No structures found**${params.projectKey ? ` for project: ${params.projectKey}` : ''}

💡 **Note**: Make sure the Jira Structure plugin is installed and you have access to structures.`,
            },
          ],
        };
      }

      const tableData = structures.map((structure: any) => [
        structure.id?.toString() || 'N/A',
        structure.name || 'Unnamed',
        structure.projectKey || 'N/A',
        structure.description || '-',
        structure.elementCount?.toString() || '0',
      ]);

      const markdownTable = `| ID | Name | Project | Description | Elements |
|----|------|---------|-------------|----------|
${tableData.map(row => `| ${row.join(' | ')} |`).join('\n')}`;

      return {
        content: [
          {
            type: 'text',
            text: `# 📊 Jira Structures

**Found**: ${structures.length} structure(s)${params.projectKey ? ` for project: ${params.projectKey}` : ''}

${markdownTable}

## Quick Actions
- Get structure details: Use \`get_structure_details\` with structure ID
- Get structure hierarchy: Use \`get_structure_hierarchy\` with structure ID`,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get structures:', error);
      
      // Provide more detailed error information
      let errorMessage = 'Unknown error';
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if it's a 404 error
        if (errorMessage.includes('404')) {
          errorMessage += '\n\n💡 **Возможные причины 404:**\n';
          errorMessage += '1. Jira Structure plugin не установлен или не активирован\n';
          errorMessage += '2. API endpoint `/rest/structure/2.0/structure` недоступен на этом инстансе Jira\n';
          errorMessage += '3. Недостаточно прав доступа к структурам\n';
          errorMessage += '4. Используется другой путь API для структур\n\n';
          errorMessage += '**Проверьте:**\n';
          errorMessage += '- Установлен ли плагин Jira Structure\n';
          errorMessage += '- Доступен ли API по пути `/rest/structure/2.0/structure`\n';
          errorMessage += '- Есть ли у пользователя права на просмотр структур';
        }
      }
      
      throw new Error(`Failed to retrieve structures: ${errorMessage}`);
    }
  }

  async getStructureDetails(structureId: string): Promise<ToolResult> {
    try {
      this.logger.debug(`Fetching structure details for: ${structureId}`);

      const structure = await this.apiClient.getStructure(structureId);

      return {
        content: [
          {
            type: 'text',
            text: `# 📋 Structure Details: ${structure.name || structureId}

## Basic Information
- **ID**: ${structure.id}
- **Name**: ${structure.name || 'Unnamed'}
- **Project**: ${structure.projectKey || 'N/A'}
- **Description**: ${structure.description || 'No description'}
- **Element Count**: ${structure.elementCount || 0}

## Structure Properties
${structure.properties ? Object.entries(structure.properties).map(([key, value]) => 
  `- **${key}**: ${value}`
).join('\n') : '- No additional properties'}

## Quick Actions
- Get hierarchy: Use \`get_structure_hierarchy\` with structure ID: ${structureId}
- Get elements: Use \`get_structure_elements\` with structure ID: ${structureId}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get structure details for ${structureId}:`, error);
      throw new Error(`Failed to retrieve structure details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStructureHierarchy(params: {
    structureId: string;
    issueKey?: string;
    maxResults?: number;
  }): Promise<ToolResult> {
    try {
      this.logger.debug('Building structure hierarchy', params);

      const hierarchyParams: { issueKey?: string; maxResults?: number } = {
        maxResults: params.maxResults || 500,
      };
      if (params.issueKey) {
        hierarchyParams.issueKey = params.issueKey;
      }
      const hierarchy = await this.apiClient.getStructureHierarchy(params.structureId, hierarchyParams);

      if (!hierarchy || !hierarchy.elements || hierarchy.elements.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 🌳 Structure Hierarchy

**Structure ID**: ${params.structureId}
${params.issueKey ? `**Filtered by Issue**: ${params.issueKey}` : ''}

**No elements found** in this structure.

💡 **Note**: The structure might be empty or the issue key might not exist in the structure.`,
            },
          ],
        };
      }

      // Helper function to determine if element is a folder
      const isFolder = (element: any): boolean => {
        return !element.issueKey && (element.type === 'folder' || element.folder === true || element.elementType === 'folder');
      };

      // Helper function to build tree visualization
      const buildTree = (elements: any[], parentId: string | null = null, level: number = 0): string[] => {
        const children = elements.filter((el: any) => {
          if (parentId === null) {
            return !el.parentId || el.parentId === null;
          }
          return el.parentId === parentId;
        });

        const lines: string[] = [];
        children.forEach((child: any, index: number) => {
          const isLast = index === children.length - 1;
          const prefix = '  '.repeat(level);
          const connector = level === 0 ? '' : (isLast ? '└── ' : '├── ');
          
          const folder = isFolder(child);
          
          if (folder) {
            // Handle folder
            const folderName = child.name || child.summary || 'Unnamed Folder';
            const folderIcon = '📁';
            
            lines.push(`${prefix}${connector}${folderIcon} **${folderName}** (Folder)`);
            
            // Recursively add children
            const childLines = buildTree(elements, child.id, level + 1);
            lines.push(...childLines);
          } else {
            // Handle issue
            const issueKey = child.issueKey || 'N/A';
            const summary = child.summary || child.name || 'No summary';
            const status = child.status || 'Unknown';
            const issueType = child.issueType || 'Task';
            
            // Get icons
            const typeIcon = this.getTypeIcon(issueType);
            const childStatusCategory = child.statusCategory?.name || child.statusCategory;
            const statusEmoji = this.getStatusEmoji(status, childStatusCategory);
            
            lines.push(`${prefix}${connector}${typeIcon} **${issueKey}** - ${summary.substring(0, 60)}${summary.length > 60 ? '...' : ''}`);
            lines.push(`${prefix}${isLast ? '    ' : '│   '}   ${statusEmoji} ${status} | ${issueType}`);
            
            // Recursively add children
            const childLines = buildTree(elements, child.id, level + 1);
            lines.push(...childLines);
          }
        });
        
        return lines;
      };

      const treeLines = buildTree(hierarchy.elements);
      
      let output = `# 🌳 Structure Hierarchy\n\n`;
      output += `**Structure ID**: ${params.structureId}\n`;
      output += `**Total Elements**: ${hierarchy.elements.length}\n`;
      if (params.issueKey) {
        output += `**Filtered by Issue**: ${params.issueKey}\n`;
      }
      output += `\n`;
      output += treeLines.join('\n');
      
      // Add summary statistics
      const rootElements = hierarchy.elements.filter((el: any) => !el.parentId || el.parentId === null);
      const folders = hierarchy.elements.filter((el: any) => isFolder(el));
      const issues = hierarchy.elements.filter((el: any) => !isFolder(el));
      const statusCounts: Record<string, number> = {};
      const typeCounts: Record<string, number> = {};
      
      issues.forEach((el: any) => {
        const status = el.status || 'Unknown';
        const type = el.issueType || 'Task';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });
      
      output += `\n\n## 📊 Statistics\n\n`;
      output += `- **Root Elements**: ${rootElements.length}\n`;
      output += `- **Total Elements**: ${hierarchy.elements.length}\n`;
      output += `- **Folders**: ${folders.length}\n`;
      output += `- **Issues**: ${issues.length}\n\n`;
      
      if (Object.keys(statusCounts).length > 0) {
      output += `### Status Distribution\n`;
      Object.entries(statusCounts).forEach(([status, count]) => {
        // Try to find statusCategory for this status
        const statusElement = hierarchy.elements.find((el: any) => (el.status || '') === status);
        const statusCategory = statusElement?.statusCategory?.name || statusElement?.statusCategory;
        output += `- ${this.getStatusEmoji(status, statusCategory)} ${status}: ${count}\n`;
      });
        output += `\n`;
      }
      
      if (Object.keys(typeCounts).length > 0) {
        output += `### Type Distribution\n`;
        Object.entries(typeCounts).forEach(([type, count]) => {
          output += `- ${this.getTypeIcon(type)} ${type}: ${count}\n`;
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to build structure hierarchy:', error);
      throw new Error(`Failed to build structure hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStructureElements(params: {
    structureId: string;
    issueKey?: string;
    maxResults?: number;
  }): Promise<ToolResult> {
    try {
      this.logger.debug('Fetching structure elements', params);

      const elementsParams: { issueKey?: string; maxResults?: number } = {
        maxResults: params.maxResults || 100,
      };
      if (params.issueKey) {
        elementsParams.issueKey = params.issueKey;
      }
      const response = await this.apiClient.getStructureElements(params.structureId, elementsParams);

      const elements = Array.isArray(response) ? response : (response.elements || []);
      
      if (!elements || elements.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📦 Structure Elements

**Structure ID**: ${params.structureId}
${params.issueKey ? `**Filtered by Issue**: ${params.issueKey}` : ''}

**No elements found** in this structure.`,
            },
          ],
        };
      }

      // Helper function to determine if element is a folder
      const isFolder = (element: any): boolean => {
        return !element.issueKey && (element.type === 'folder' || element.folder === true || element.elementType === 'folder');
      };

      const folders = elements.filter((el: any) => isFolder(el));
      const issues = elements.filter((el: any) => !isFolder(el));

      let output = `# 📦 Structure Elements\n\n`;
      output += `**Structure ID**: ${params.structureId}\n`;
      output += `**Total Elements**: ${elements.length}${params.issueKey ? ` (filtered by: ${params.issueKey})` : ''}\n`;
      output += `- **Folders**: ${folders.length}\n`;
      output += `- **Issues**: ${issues.length}\n\n`;

      // Folders table
      if (folders.length > 0) {
        const folderTableData = folders.map((element: any) => [
          '📁',
          (element.name || element.summary || 'Unnamed Folder').substring(0, 50) + 
            ((element.name || element.summary || '').length > 50 ? '...' : ''),
          element.parentId ? 'Yes' : 'No',
        ]);

        const folderTable = `## 📁 Folders\n\n| Type | Name | Has Parent |
|------|------|------------|
${folderTableData.map((row: string[]) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
        output += folderTable;
      }

      // Issues table
      if (issues.length > 0) {
        const issueTableData = issues.map((element: any) => [
          element.issueKey || 'N/A',
          (element.summary || element.name || 'No summary').substring(0, 50) + 
            ((element.summary || element.name || '').length > 50 ? '...' : ''),
          element.status || 'Unknown',
          element.issueType || 'Task',
          element.parentId ? 'Yes' : 'No',
        ]);

        const issueTable = `## 📋 Issues\n\n| Issue Key | Summary | Status | Type | Has Parent |
|-----------|---------|--------|------|------------|
${issueTableData.map((row: string[]) => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
        output += issueTable;
      }

      if (folders.length === 0 && issues.length === 0) {
        output += `**No elements found** in this structure.\n\n`;
      }

      output += `## Quick Actions\n`;
      output += `- Get hierarchy view: Use \`get_structure_hierarchy\` with structure ID: ${params.structureId}\n`;
      output += `- Get structure details: Use \`get_structure_details\` with structure ID: ${params.structureId}`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get structure elements:', error);
      throw new Error(`Failed to retrieve structure elements: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private getStatusEmoji(status: string, statusCategory?: string): string {
    // Use statusCategory if available (more reliable)
    if (statusCategory) {
      const categoryLower = statusCategory.toLowerCase();
      if (categoryLower.includes('todo') || categoryLower.includes('new')) return '📝';
      if (categoryLower.includes('progress') || categoryLower.includes('indeterminate')) return '🔄';
      if (categoryLower.includes('done') || categoryLower.includes('complete')) return '✅';
    }
    
    // Fallback to status name mapping
    const statusLower = status.toLowerCase();
    const map: Record<string, string> = {
      'backlog': '📝',
      'to do': '📝',
      'new': '📝',
      'open': '📝',
      'in progress': '🔄',
      'в работе': '🔄',
      'in review': '👀',
      'under review': '👀',
      'review': '👀',
      'testing': '🧪',
      'done': '✅',
      'сделать': '✅',
      'готово': '✔️',
      'closed': '✔️',
      'resolved': '✔️',
      'выполнено': '✔️',
      'закрыто': '✔️',
    };
    
    for (const [key, emoji] of Object.entries(map)) {
      if (statusLower.includes(key)) {
        return emoji;
      }
    }
    
    return '⚪';
  }

  private getTypeIcon(issueType: string): string {
    const map: Record<string, string> = {
      'Epic': '📦',
      'Эпик': '📦',
      'Story': '📖',
      'Task': '📋',
      'Задача': '📋',
      'Bug': '🐛',
      'Ошибка': '🐛',
      'Sub-task': '📌',
      'Subtask': '📌',
    };
    return map[issueType] || '📄';
  }

  private isFolder(element: any): boolean {
    return !element.issueKey && (element.type === 'folder' || element.folder === true || element.elementType === 'folder');
  }

  private isOpenStatus(status: string, statusCategory?: string): boolean {
    // Use statusCategory if available (more reliable)
    if (statusCategory) {
      const categoryLower = statusCategory.toLowerCase();
      // Open statuses are those NOT in "Done" category
      return !categoryLower.includes('done') && !categoryLower.includes('complete');
    }
    
    // Fallback to status name checking
    const statusLower = status.toLowerCase();
    const closedStatuses = [
      'done', 'готово', 'closed', 'resolved', 'сделано', 'выполнено', 'закрыто',
      'completed', 'finished', 'завершено', 'решено'
    ];
    return !closedStatuses.some(closed => statusLower.includes(closed));
  }

  async getReleaseFolders(params: {
    structureId: string;
    prefix?: string;
  }): Promise<ToolResult> {
    try {
      this.logger.debug(`Searching for release folders in structure: ${params.structureId}`);

      const prefix = params.prefix || 'Релиз ';
      const hierarchy = await this.apiClient.getStructureHierarchy(params.structureId, {
        maxResults: 1000,
      });

      if (!hierarchy || !hierarchy.elements || hierarchy.elements.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📁 Release Folders\n\n**Structure ID**: ${params.structureId}\n\n**No elements found** in this structure.`,
            },
          ],
        };
      }

      // Find folders starting with prefix
      const releaseFolders = hierarchy.elements.filter((el: any) => {
        if (!this.isFolder(el)) return false;
        const name = el.name || el.summary || '';
        return name.startsWith(prefix);
      });

      if (releaseFolders.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📁 Release Folders\n\n**Structure ID**: ${params.structureId}\n**Search Prefix**: "${prefix}"\n\n**No folders found** starting with "${prefix}".`,
            },
          ],
        };
      }

      // Helper function to get all nested children of a folder
      const getAllChildren = (folderId: string): any[] => {
        const directChildren = hierarchy.elements.filter((el: any) => el.parentId === folderId);
        const allChildren: any[] = [...directChildren];
        
        directChildren.forEach((child: any) => {
          if (this.isFolder(child)) {
            allChildren.push(...getAllChildren(child.id));
          }
        });
        
        return allChildren;
      };

      // Get folder details with child count
      const folderData = releaseFolders.map((folder: any) => {
        const allChildren = getAllChildren(folder.id);
        const allIssues = allChildren.filter((el: any) => !this.isFolder(el));
        const openIssues = allIssues.filter((el: any) => {
          const statusCategory = el.statusCategory?.name || el.statusCategory;
          return this.isOpenStatus(el.status || 'Unknown', statusCategory);
        });
        
        return {
          id: folder.id,
          name: folder.name || folder.summary || 'Unnamed Folder',
          totalChildren: allChildren.length,
          openIssues: openIssues.length,
          hasChildren: allChildren.length > 0,
        };
      });

      const tableData = folderData.map((folder: any) => [
        folder.name,
        folder.totalChildren.toString(),
        folder.openIssues.toString(),
        folder.hasChildren ? 'Yes' : 'No',
      ]);

      const markdownTable = `| Folder Name | Total Children | Open Issues | Has Children |
|-------------|---------------|-------------|--------------|
${tableData.map((row: string[]) => `| ${row.join(' | ')} |`).join('\n')}`;

      let output = `# 📁 Release Folders\n\n`;
      output += `**Structure ID**: ${params.structureId}\n`;
      output += `**Search Prefix**: "${prefix}"\n`;
      output += `**Found**: ${releaseFolders.length} folder(s)\n\n`;
      output += markdownTable;
      output += `\n\n## 🧭 Actions\n\n`;
      output += `- View folder hierarchy: Use \`get_folder_hierarchy\` with structure ID and folder ID\n`;
      output += `- View only open issues: Use \`get_folder_hierarchy\` with \`onlyOpen: true\`\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get release folders:', error);
      throw new Error(`Failed to retrieve release folders: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getFolderHierarchy(params: {
    structureId: string;
    folderId: string;
    onlyOpen?: boolean;
  }): Promise<ToolResult> {
    try {
      this.logger.debug(`Getting folder hierarchy for folder: ${params.folderId}`);

      const hierarchy = await this.apiClient.getStructureHierarchy(params.structureId, {
        maxResults: 1000,
      });

      if (!hierarchy || !hierarchy.elements || hierarchy.elements.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📁 Folder Hierarchy\n\n**Structure ID**: ${params.structureId}\n**Folder ID**: ${params.folderId}\n\n**No elements found** in this structure.`,
            },
          ],
        };
      }

      // Find the folder
      const folder = hierarchy.elements.find((el: any) => el.id === params.folderId);
      if (!folder) {
        return {
          content: [
            {
              type: 'text',
              text: `# ❌ Folder Not Found\n\n**Structure ID**: ${params.structureId}\n**Folder ID**: ${params.folderId}\n\nFolder not found in this structure.`,
            },
          ],
        };
      }

      if (!this.isFolder(folder)) {
        return {
          content: [
            {
              type: 'text',
              text: `# ❌ Not a Folder\n\n**Structure ID**: ${params.structureId}\n**Element ID**: ${params.folderId}\n\nThis element is not a folder.`,
            },
          ],
        };
      }

      // Filter elements: only children of this folder
      let folderElements = hierarchy.elements.filter((el: any) => {
        // Include the folder itself and its direct children
        if (el.id === params.folderId) return true;
        if (el.parentId === params.folderId) return true;
        
        // Include nested children (recursively)
        const isNestedChild = (element: any, targetParentId: string): boolean => {
          if (element.parentId === targetParentId) return true;
          const parent = hierarchy.elements.find((e: any) => e.id === element.parentId);
          if (!parent) return false;
          if (parent.parentId === targetParentId) return true;
          return isNestedChild(parent, targetParentId);
        };
        
        return isNestedChild(el, params.folderId);
      });

      // Filter only open issues if requested
      if (params.onlyOpen) {
        folderElements = folderElements.filter((el: any) => {
          if (this.isFolder(el)) return true; // Keep all folders
          const statusCategory = el.statusCategory?.name || el.statusCategory;
          return this.isOpenStatus(el.status || 'Unknown', statusCategory);
        });
      }

      // Helper function to build tree visualization
      const buildTree = (elements: any[], parentId: string | null = null, level: number = 0): string[] => {
        const children = elements.filter((el: any) => {
          if (parentId === null) {
            return el.id === params.folderId;
          }
          return el.parentId === parentId;
        });

        const lines: string[] = [];
        children.forEach((child: any, index: number) => {
          const isLast = index === children.length - 1;
          const prefix = '  '.repeat(level);
          const connector = level === 0 ? '' : (isLast ? '└── ' : '├── ');
          
          const folder = this.isFolder(child);
          
          if (folder) {
            // Handle folder
            const folderName = child.name || child.summary || 'Unnamed Folder';
            const folderIcon = '📁';
            
            lines.push(`${prefix}${connector}${folderIcon} **${folderName}** (Folder)`);
            
            // Recursively add children
            const childLines = buildTree(elements, child.id, level + 1);
            lines.push(...childLines);
          } else {
            // Handle issue
            const issueKey = child.issueKey || 'N/A';
            const summary = child.summary || child.name || 'No summary';
            const status = child.status || 'Unknown';
            const issueType = child.issueType || 'Task';
            
            // Get icons
            const typeIcon = this.getTypeIcon(issueType);
            const childStatusCategory = child.statusCategory?.name || child.statusCategory;
            const statusEmoji = this.getStatusEmoji(status, childStatusCategory);
            
            lines.push(`${prefix}${connector}${typeIcon} **${issueKey}** - ${summary.substring(0, 60)}${summary.length > 60 ? '...' : ''}`);
            lines.push(`${prefix}${isLast ? '    ' : '│   '}   ${statusEmoji} ${status} | ${issueType}`);
            
            // Recursively add children
            const childLines = buildTree(elements, child.id, level + 1);
            lines.push(...childLines);
          }
        });
        
        return lines;
      };

      const treeLines = buildTree(folderElements);
      
      const folderName = folder.name || folder.summary || 'Unnamed Folder';
      let output = `# 📁 Folder Hierarchy: ${folderName}\n\n`;
      output += `**Structure ID**: ${params.structureId}\n`;
      output += `**Folder ID**: ${params.folderId}\n`;
      if (params.onlyOpen) {
        output += `**Filter**: Only open issues\n`;
      }
      output += `**Total Elements**: ${folderElements.length}\n\n`;

      // Statistics
      const folders = folderElements.filter((el: any) => this.isFolder(el));
      const issues = folderElements.filter((el: any) => !this.isFolder(el));
      const openIssues = issues.filter((el: any) => {
        const statusCategory = el.statusCategory?.name || el.statusCategory;
        return this.isOpenStatus(el.status || 'Unknown', statusCategory);
      });
      const closedIssues = issues.filter((el: any) => {
        const statusCategory = el.statusCategory?.name || el.statusCategory;
        return !this.isOpenStatus(el.status || 'Unknown', statusCategory);
      });

      output += `## 📊 Statistics\n\n`;
      output += `- **Folders**: ${folders.length}\n`;
      output += `- **Total Issues**: ${issues.length}\n`;
      if (!params.onlyOpen) {
        output += `- **Open Issues**: ${openIssues.length}\n`;
        output += `- **Closed Issues**: ${closedIssues.length}\n`;
      } else {
        output += `- **Open Issues**: ${openIssues.length} (filtered)\n`;
      }
      output += `\n`;

      output += treeLines.join('\n');

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get folder hierarchy:', error);
      throw new Error(`Failed to retrieve folder hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getStructureHierarchyByAssignee(params: {
    assignee: string;
    projectKey?: string;
    maxResults?: number;
  }): Promise<ToolResult> {
    try {
      this.logger.debug(`Getting structure hierarchy by assignee: ${params.assignee}`);

      // First, find all active issues for this assignee using JQL
      const jql = `assignee = "${params.assignee}" AND statusCategory != Done`;
      const issuesResponse = await this.apiClient.searchIssues(jql, {
        maxResults: params.maxResults || 500,
        fields: ['key', 'summary', 'status', 'assignee', 'priority', 'issuetype'],
      });

      const activeIssueKeys = new Set((issuesResponse.issues || []).map((issue: any) => issue.key));
      const issueMap = new Map((issuesResponse.issues || []).map((issue: any) => [
        issue.key,
        {
          key: issue.key,
          summary: issue.fields.summary,
          status: issue.fields.status.name,
          statusCategory: issue.fields.status.statusCategory?.name || issue.fields.status.statusCategory,
          priority: issue.fields.priority?.name || 'None',
          issueType: issue.fields.issuetype.name,
        }
      ]));

      if (activeIssueKeys.size === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📋 Задачи ${params.assignee}\n\n**Активных задач не найдено**\n\nВсе задачи назначенные на "${params.assignee}" завершены или находятся в статусе "Готово".`,
            },
          ],
        };
      }

      // Get all structures
      const structuresResponse = await this.apiClient.getStructures(
        params.projectKey ? { projectKey: params.projectKey } : {}
      );

      // Ensure structures is an array
      const structures = Array.isArray(structuresResponse) ? structuresResponse : [];
      
      this.logger.debug(`Found ${structures.length} structures`);

      if (!structures || structures.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 📋 Задачи ${params.assignee}\n\n**Найдено активных задач**: ${activeIssueKeys.size}\n\n**Структуры не найдены** - невозможно показать иерархию.\n\nИспользуйте \`get_issue_hierarchy\` для просмотра иерархии через Epic Links.`,
            },
          ],
        };
      }

      // Build hierarchy for each structure
      let output = `# 📋 Задачи ${params.assignee} (в иерархии структур)\n\n`;
      output += `**Найдено активных задач**: ${activeIssueKeys.size}\n`;
      output += `**Структур**: ${structures.length}\n\n`;

      let foundInStructures = false;

      for (const structure of structures) {
        const structureId = structure.id?.toString() || structure.id;
        if (!structureId) continue;

        try {
          const hierarchy = await this.apiClient.getStructureHierarchy(structureId, {
            maxResults: 1000,
          });

          if (!hierarchy || !hierarchy.elements || hierarchy.elements.length === 0) {
            continue;
          }

          // Filter elements: keep folders and issues that are in activeIssueKeys
          const filteredElements = hierarchy.elements.filter((el: any) => {
            if (this.isFolder(el)) {
              // Keep folder if it has any active issues as descendants
              return this.hasActiveIssuesInSubtree(el.id, hierarchy.elements, activeIssueKeys);
            } else {
              // Keep issue if it's in activeIssueKeys
              return el.issueKey && activeIssueKeys.has(el.issueKey);
            }
          });

          if (filteredElements.length === 0) {
            continue;
          }

          foundInStructures = true;

          // Build tree visualization
          const buildTree = (elements: any[], parentId: string | null = null, level: number = 0): string[] => {
            const children = elements.filter((el: any) => {
              if (parentId === null) {
                return !el.parentId || el.parentId === null;
              }
              return el.parentId === parentId;
            });

            const lines: string[] = [];
            children.forEach((child: any, index: number) => {
              const isLast = index === children.length - 1;
              const prefix = '  '.repeat(level);
              const connector = level === 0 ? '' : (isLast ? '└── ' : '├── ');
              
              const folder = this.isFolder(child);
              
              if (folder) {
                const folderName = child.name || child.summary || 'Unnamed Folder';
                lines.push(`${prefix}${connector}📁 **${folderName}** (Folder)`);
                
                const childLines = buildTree(elements, child.id, level + 1);
                lines.push(...childLines);
              } else {
                const issueKey = child.issueKey || 'N/A';
                const issueInfo = issueMap.get(issueKey);
                if (!issueInfo) return;

                const summary = issueInfo.summary.substring(0, 60) + (issueInfo.summary.length > 60 ? '...' : '');
                const typeIcon = this.getTypeIcon(issueInfo.issueType);
                const statusEmoji = this.getStatusEmoji(issueInfo.status, issueInfo.statusCategory);
                
                lines.push(`${prefix}${connector}${typeIcon} **${issueKey}** - ${summary}`);
                lines.push(`${prefix}${isLast ? '    ' : '│   '}   ${statusEmoji} ${issueInfo.status} | ${issueInfo.priority}`);
                
                const childLines = buildTree(elements, child.id, level + 1);
                lines.push(...childLines);
              }
            });
            
            return lines;
          };

          const treeLines = buildTree(filteredElements);
          
          output += `## 📊 Структура: ${structure.name || structureId}\n\n`;
          output += treeLines.join('\n');
          output += '\n\n';
        } catch (error) {
          this.logger.warn(`Failed to get hierarchy for structure ${structureId}:`, error);
          continue;
        }
      }

      if (!foundInStructures) {
        output += `**Задачи не найдены в структурах**\n\n`;
        output += `Возможно, задачи не добавлены в структуры или находятся в других структурах.\n\n`;
        output += `**Найденные активные задачи** (${activeIssueKeys.size}):\n\n`;
        const issueList = Array.from(issueMap.values()).slice(0, 20);
        issueList.forEach(issue => {
          const statusEmoji = this.getStatusEmoji(issue.status, issue.statusCategory);
          output += `- ${statusEmoji} **${issue.key}**: ${issue.summary.substring(0, 70)}${issue.summary.length > 70 ? '...' : ''}\n`;
        });
        if (activeIssueKeys.size > 20) {
          output += `\n... и еще ${activeIssueKeys.size - 20} задач\n`;
        }
      }

      output += `\n\n## 🧭 Действия\n\n`;
      output += `- Просмотреть детали задачи: Используйте \`get_issue_details\` с ключом задачи\n`;
      output += `- Просмотреть иерархию через Epic Links: Используйте \`get_issue_hierarchy\` с assignee: "${params.assignee}"\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get structure hierarchy by assignee:', error);
      throw new Error(`Failed to get structure hierarchy by assignee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private hasActiveIssuesInSubtree(folderId: string, allElements: any[], activeIssueKeys: Set<string>): boolean {
    const children = allElements.filter((el: any) => el.parentId === folderId);
    
    for (const child of children) {
      if (this.isFolder(child)) {
        if (this.hasActiveIssuesInSubtree(child.id, allElements, activeIssueKeys)) {
          return true;
        }
      } else {
        if (child.issueKey && activeIssueKeys.has(child.issueKey)) {
          return true;
        }
      }
    }
    
    return false;
  }
}

