import { JiraApiClient } from '../jiraApiClient.js';
import { ToolResult, Project, FormattedProject, WorklogRequest } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { formatMarkdownTable } from '../utils/formatters.js';

// Project Service
export class ProjectService {
  private logger: Logger;

  constructor(private apiClient: JiraApiClient) {
    this.logger = new Logger('ProjectService');
  }

  async getProjects(): Promise<ToolResult> {
    try {
      this.logger.debug('Fetching all projects');

      const projects: Project[] = await this.apiClient.getProjects();

      const formattedProjects: FormattedProject[] = projects.map(project => ({
        key: project.key,
        name: project.name,
        projectType: project.projectTypeKey,
        leadName: project.lead?.displayName || 'No lead assigned',
        issueTypeCount: project.issueTypes?.length || 0,
        componentCount: project.components?.length || 0,
        versionCount: project.versions?.length || 0,
      }));

      const tableData = formattedProjects.map(project => [
        project.key,
        project.name.length > 30 ? project.name.substring(0, 27) + '...' : project.name,
        project.projectType,
        project.leadName || 'No lead',
        project.issueTypeCount.toString(),
        project.componentCount.toString(),
        project.versionCount.toString(),
      ]);

      const markdownTable = formatMarkdownTable(
        ['Key', 'Name', 'Type', 'Lead', 'Issue Types', 'Components', 'Versions'],
        tableData
      );

      const projectTypes = [...new Set(projects.map(p => p.projectTypeKey))];
      const totalIssueTypes = projects.reduce((sum, p) => sum + (p.issueTypes?.length || 0), 0);

      return {
        content: [
          {
            type: 'text',
            text: `# 📁 Jira Projects (${projects.length} total)

${markdownTable}

## Summary
- **Total Projects**: ${projects.length}
- **Project Types**: ${projectTypes.join(', ')}
- **Total Issue Types**: ${totalIssueTypes}
- **Projects with Components**: ${projects.filter(p => p.components && p.components.length > 0).length}
- **Projects with Versions**: ${projects.filter(p => p.versions && p.versions.length > 0).length}

## Quick Actions
- Get project details: Use \`get_project_details\` with any project key
- Search project issues: Use \`search_issues\` with JQL: \`project = "PROJECT_KEY"\`
- Create new issue: Use \`create_issue\` with any project key`,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get projects:', error);
      throw new Error(`Failed to retrieve projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProjectDetails(projectKey: string): Promise<ToolResult> {
    try {
      this.logger.debug(`Fetching project details for: ${projectKey}`);

      const project: Project = await this.apiClient.getProject(projectKey);

      const issueTypes = project.issueTypes || [];
      const components = project.components || [];
      const versions = project.versions || [];

      return {
        content: [
          {
            type: 'text',
            text: `# 📁 Project Details: ${project.name}

## Basic Information
- **Key**: ${project.key}
- **Name**: ${project.name}
- **Type**: ${project.projectTypeKey}
- **Style**: ${project.style}
- **Privacy**: ${project.isPrivate ? '🔒 Private' : '🌐 Public'}
- **Simplified**: ${project.simplified ? 'Yes' : 'No'}

## Leadership
- **Project Lead**: ${project.lead?.displayName || 'No lead assigned'}
${project.lead ? `- **Lead Email**: ${project.lead.emailAddress || 'Not available'}` : ''}

## Issue Types (${issueTypes.length})
${issueTypes.map(type => `- **${type.name}**: ${type.description || 'No description'} ${type.subtask ? '(Subtask)' : ''}`).join('\n')}

## Components (${components.length})
${components.length > 0 ? components.map(comp => `- **${comp.name}**: ${comp.description || 'No description'} (Lead: ${comp.lead?.displayName || 'None'})`).join('\n') : '- No components defined'}

## Versions (${versions.length})
${versions.length > 0 ? versions.map(version => `- **${version.name}**: ${version.released ? '✅ Released' : '🚧 In Development'} ${version.releaseDate ? `(${new Date(version.releaseDate).toLocaleDateString()})` : ''}`).join('\n') : '- No versions defined'}

## Quick Actions
- Search all issues: Use \`search_issues\` with JQL: \`project = "${project.key}"\`
- Create new issue: Use \`create_issue\` with projectKey: \`${project.key}\`
- Get project boards: Use \`get_boards\` with projectKey: \`${project.key}\`

## Example JQL Queries
\`\`\`
project = "${project.key}" AND status != Done
project = "${project.key}" AND created >= -7d
project = "${project.key}" AND assignee = currentUser()
\`\`\``,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get project details for ${projectKey}:`, error);
      throw new Error(`Failed to retrieve project details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProjectWorkflows(projectKey: string): Promise<ToolResult> {
    try {
      this.logger.debug(`Fetching workflows for project: ${projectKey}`);

      // Get project statuses which include workflow information
      const statuses = await this.apiClient.getProjectStatuses(projectKey);

      if (!statuses || statuses.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `# 🔄 Project Workflows: ${projectKey}\n\n**No workflows found** for this project.`,
            },
          ],
        };
      }

      // Extract unique workflows and their statuses
      const workflowMap: Record<string, any> = {};

      statuses.forEach((statusInfo: any) => {
        const issueType = statusInfo.name || 'Unknown';
        const statusesForType = statusInfo.statuses || [];

        statusesForType.forEach((status: any) => {
          const workflowName = status.statusCategory?.name || 'Unknown Workflow';
          
          if (!workflowMap[workflowName]) {
            workflowMap[workflowName] = {
              name: workflowName,
              issueTypes: new Set<string>(),
              statuses: new Map<string, any>(),
            };
          }

          workflowMap[workflowName].issueTypes.add(issueType);
          
          const statusKey = status.name || 'Unknown';
          if (!workflowMap[workflowName].statuses.has(statusKey)) {
            workflowMap[workflowName].statuses.set(statusKey, {
              name: status.name,
              id: status.id,
              description: status.description,
              statusCategory: status.statusCategory,
            });
          }
        });
      });

      let output = `# 🔄 Project Workflows: ${projectKey}\n\n`;
      output += `**Total Workflows**: ${Object.keys(workflowMap).length}\n\n`;

      Object.values(workflowMap).forEach((workflow: any) => {
        const statusList = Array.from(workflow.statuses.values());
        const issueTypesList = Array.from(workflow.issueTypes);
        
        output += `## 📋 ${workflow.name}\n\n`;
        output += `**Issue Types**: ${issueTypesList.join(', ')}\n`;
        output += `**Statuses**: ${statusList.length}\n\n`;

        // Group statuses by category
        const byCategory: Record<string, any[]> = {};
        statusList.forEach((status: any) => {
          const category = status.statusCategory?.name || 'Unknown';
          if (!byCategory[category]) {
            byCategory[category] = [];
          }
          byCategory[category].push(status);
        });

        Object.entries(byCategory).forEach(([category, categoryStatuses]) => {
          const categoryEmoji = category === 'To Do' ? '📝' : category === 'In Progress' ? '🔄' : category === 'Done' ? '✅' : '⚪';
          output += `### ${categoryEmoji} ${category} (${categoryStatuses.length})\n`;
          categoryStatuses.forEach((status: any) => {
            output += `- **${status.name}** (ID: ${status.id})\n`;
            if (status.description) {
              output += `  ${status.description}\n`;
            }
          });
          output += '\n';
        });
      });

      output += `## 📊 Summary\n\n`;
      const allStatuses = new Set<string>();
      Object.values(workflowMap).forEach((workflow: any) => {
        workflow.statuses.forEach((status: any) => {
          allStatuses.add(status.name);
        });
      });
      output += `- **Unique Statuses**: ${allStatuses.size}\n`;
      output += `- **Workflows**: ${Object.keys(workflowMap).length}\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get workflows for ${projectKey}:`, error);
      throw new Error(`Failed to retrieve workflows: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
