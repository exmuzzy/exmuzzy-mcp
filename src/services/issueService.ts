import { JiraApiClient } from '../jiraApiClient.js';
import { 
  ToolResult, 
  SearchParams, 
  IssueCreateRequest, 
  IssueUpdateRequest, 
  TransitionRequest 
} from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { formatMarkdownTable } from '../utils/formatters.js';
import { ResolutionGenerator } from '../utils/resolutionGenerator.js';
import { IssueTracker } from '../utils/issueTracker.js';

export class IssueService {
  private logger: Logger;
  private resolutionGenerator: ResolutionGenerator;
  private issueTracker: IssueTracker;

  // Разрешенные статусы для перевода в "Готово"
  private readonly ALLOWED_STATUSES_FOR_COMPLETION = [
    'Сделать',
    'Переоткрыт',
    'Backlog',
    'В работе',
    'For test',
    'Тестирование в процессе',
    'Under Review'
  ];

  constructor(private apiClient: JiraApiClient) {
    this.logger = new Logger('IssueService');
    this.resolutionGenerator = new ResolutionGenerator();
    this.issueTracker = new IssueTracker();
  }

  async searchIssues(params: SearchParams): Promise<ToolResult> {
    try {
      this.logger.debug('Searching issues', params);

      const response = await this.apiClient.searchIssues(params.jql, {
        maxResults: params.maxResults || 50,
        startAt: params.startAt || 0,
        fields: params.fields || [
          'summary', 'status', 'assignee', 'priority', 'issuetype',
          'created', 'updated', 'duedate', 'labels'
        ],
      });

      const issues = response.issues || [];
      
      const tableData = issues.map(issue => [
        issue.key,
        issue.fields.summary.length > 50 
          ? issue.fields.summary.substring(0, 47) + '...'
          : issue.fields.summary,
        issue.fields.status.name,
        issue.fields.assignee?.displayName || 'Unassigned',
        issue.fields.priority?.name || 'None',
        issue.fields.issuetype.name,
        new Date(issue.fields.updated).toLocaleDateString(),
      ]);

      const markdownTable = formatMarkdownTable(
        ['Key', 'Summary', 'Status', 'Assignee', 'Priority', 'Type', 'Updated'],
        tableData
      );

      return {
        content: [
          {
            type: 'text',
            text: `# 🔍 Issue Search Results

**JQL Query**: \`${params.jql}\`
**Total Found**: ${response.total} issues (showing ${issues.length})

${markdownTable}

## Quick Actions
- Get details: Use \`get_issue_details\` with any issue key
- Add comment: Use \`add_comment\` with issue key and comment text
- Transition: Use \`transition_issue\` to change status`,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to search issues:', error);
      throw new Error(`Failed to search issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getMyIssuesGroupedByStatus(params?: { 
    maxResults?: number;
    jql?: string;
    showAll?: boolean;
  }): Promise<ToolResult> {
    try {
      this.logger.debug('Getting my issues grouped by status');

      const jql = params?.jql || 'assignee = currentUser() AND statusCategory != Done';
      const maxResults = params?.maxResults || 500;
      const showAll = params?.showAll ?? true; // По умолчанию показываем все

      // Выполняем ОДИН запрос для получения всех задач
      const response = await this.apiClient.searchIssues(jql, {
        maxResults,
        startAt: 0,
        fields: ['summary', 'status', 'priority', 'issuetype', 'updated'],
      });

      const issues = response.issues || [];
      const total = response.total || 0;

      // Группируем задачи по статусам в памяти (в порядке приоритета)
      const statusGroups: Record<string, any[]> = {
        'В работе': [],
        'Сделать': [],
        'Переоткрыт': [],
        'Backlog': [],
        'For test': [],
        'Тестирование в процессе': [],
        'On hold': [],
        'Blocked': [],
        'Under Review': [],
      };

      // Также собираем задачи с другими статусами
      const otherStatuses: Record<string, any[]> = {};

      for (const issue of issues) {
        const statusName = issue.fields.status.name;
        if (statusGroups[statusName]) {
          statusGroups[statusName].push(issue);
        } else {
          if (!otherStatuses[statusName]) {
            otherStatuses[statusName] = [];
          }
          otherStatuses[statusName].push(issue);
        }
      }

      // Формируем вывод
      const baseUrl = 'https://job.sbertroika.ru/browse/';
      const jiraSearchUrl = `https://job.sbertroika.ru/issues/?jql=${encodeURIComponent(jql)}`;
      let output = `# 📋 Мои открытые задачи\n\n`;
      output += `**Всего открытых задач**: [${total}](${jiraSearchUrl})\n`;
      output += `**Показано**: ${issues.length}\n\n`;

      // Функция для получения эмодзи приоритета (соответствуют цветам Jira)
      const getPriorityEmoji = (priorityName: string): string => {
        switch (priorityName) {
          case 'Блокер':      return '🔴'; // #990000 (темно-красный)
          case 'Highest':     return '🔴'; // #ff7452 (красный)
          case 'High':        return '🟠'; // #ff8f73 (оранжевый)
          case 'Medium':      return '🟡'; // #ffab00 (желтый)
          case 'Low':         return '🔵'; // #0065ff (синий)
          case 'Lowest':      return '⚪'; // #2684ff (светло-синий)
          case 'Незначительный': return '⚪'; // #999999 (серый)
          default:            return '🟡'; // По умолчанию Medium
        }
      };

      // Функция для получения числового значения приоритета (для сортировки)
      const getPriorityValue = (priorityName: string): number => {
        switch (priorityName) {
          case 'Блокер':      return 0;
          case 'Highest':     return 1;
          case 'High':        return 2;
          case 'Medium':      return 3;
          case 'Low':         return 4;
          case 'Lowest':      return 5;
          case 'Незначительный': return 6;
          default:            return 3; // По умолчанию Medium
        }
      };

      // Функция для проверки нужно ли показывать эмодзи приоритета (только для High и выше)
      const shouldShowPriorityEmoji = (priorityName: string): boolean => {
        return ['Блокер', 'Highest', 'High'].includes(priorityName);
      };

      // Функция для форматирования группы задач
      const formatStatusGroup = (statusName: string, tasks: any[], maxShow: number = 20): string => {
        if (tasks.length === 0) return '';

        // Сортируем задачи по приоритету (от высокого к низкому)
        const sortedTasks = [...tasks].sort((a, b) => {
          const priorityA = a.fields.priority?.name || 'Medium';
          const priorityB = b.fields.priority?.name || 'Medium';
          return getPriorityValue(priorityA) - getPriorityValue(priorityB);
        });

        const taskWord = tasks.length === 1 ? 'задача' : tasks.length < 5 ? 'задачи' : 'задач';
        
        // Создаем гиперссылку на количество задач по статусу
        const statusJql = `assignee = currentUser() AND status = "${statusName}"`;
        const statusSearchUrl = `https://job.sbertroika.ru/issues/?jql=${encodeURIComponent(statusJql)}`;
        let section = `### ${statusName} ([${tasks.length}](${statusSearchUrl}) ${taskWord})\n\n`;
        
        const tasksToShow = sortedTasks.slice(0, maxShow);
        for (const task of tasksToShow) {
          const summary = task.fields.summary;
          
          // Определяем эмодзи приоритета (только для High и выше)
          const priorityName = task.fields.priority?.name || 'Medium';
          const priorityEmoji = shouldShowPriorityEmoji(priorityName) ? getPriorityEmoji(priorityName) : '';
          // Выравниваем позицию ключа: если нет эмодзи, добавляем пробелы
          const spacing = priorityEmoji ? `${priorityEmoji} ` : '   ';
          
          section += `- ${spacing}**[${task.key}](${baseUrl}${task.key})** ${summary}\n`;
        }

        if (tasks.length > maxShow) {
          section += `\n_... и ещё ${tasks.length - maxShow} ${tasks.length - maxShow === 1 ? 'задача' : tasks.length - maxShow < 5 ? 'задачи' : 'задач'}_\n\n`;
        }

        return section;
      };

      // Выводим группы задач
      for (const [statusName, tasks] of Object.entries(statusGroups)) {
        if (tasks.length > 0) {
          output += formatStatusGroup(statusName, tasks);
        }
      }

      // Выводим задачи с другими статусами
      for (const [statusName, tasks] of Object.entries(otherStatuses)) {
        output += formatStatusGroup(statusName, tasks);
      }

      // Добавляем меню действий с ссылками
      output += `\n---\n\n`;
      output += `## 🎯 Быстрые ссылки на фильтры\n\n`;
      
      const createStatusFilterLink = (statusName: string, count: number): string => {
        const jql = `assignee = currentUser() AND status = "${statusName}"`;
        const url = `https://job.sbertroika.ru/issues/?jql=${encodeURIComponent(jql)}`;
        return `[${statusName} (${count})](${url})`;
      };
      
      output += `- ${createStatusFilterLink('В работе', statusGroups['В работе'].length)}\n`;
      output += `- ${createStatusFilterLink('Сделать', statusGroups['Сделать'].length)}\n`;
      output += `- ${createStatusFilterLink('Переоткрыт', statusGroups['Переоткрыт'].length)}\n`;
      output += `- ${createStatusFilterLink('Backlog', statusGroups['Backlog'].length)}\n`;
      if (statusGroups['For test'].length > 0) output += `- ${createStatusFilterLink('For test', statusGroups['For test'].length)}\n`;
      if (statusGroups['Тестирование в процессе'].length > 0) output += `- ${createStatusFilterLink('Тестирование в процессе', statusGroups['Тестирование в процессе'].length)}\n`;
      if (statusGroups['Under Review'].length > 0) output += `- ${createStatusFilterLink('Under Review', statusGroups['Under Review'].length)}\n`;
      output += `\n`;
      
      output += `### 💡 Подсказки\n`;
      output += `- Для просмотра задачи: \`/jira RIVER-123\` или просто \`RIVER-123\`\n`;
      output += `- Для поиска: \`/jira <JQL запрос>\`\n`;
      output += `- Для фильтра по пользователю: \`/jira <фамилия>\`\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get my issues grouped by status:', error);
      throw new Error(`Failed to get issues: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIssueDetails(params: { 
    issueKey: string; 
    includeComments?: boolean; 
    includeWorklogs?: boolean; 
  }): Promise<ToolResult> {
    try {
      this.logger.debug(`Fetching issue details for: ${params.issueKey}`);
      
      // Track this issue as the last viewed issue
      this.issueTracker.trackIssue(params.issueKey);

      const expandFields = [];
      if (params.includeComments) expandFields.push('changelog');
      if (params.includeWorklogs) expandFields.push('changelog');

      const issue = await this.apiClient.getIssue(params.issueKey, {
        expand: expandFields,
        fields: [
          'summary', 'description', 'status', 'assignee', 'reporter',
          'priority', 'issuetype', 'project', 'created', 'updated',
          'duedate', 'labels', 'components', 'fixVersions', 'versions',
          'parent', 'subtasks', 'timetracking', 'resolution', 'environment',
          'comment', 'worklog'
        ],
      });

      const timeTracking = issue.fields.timetracking || {};
      
      let details = `# 📋 Issue Details: ${issue.key}

## ${issue.fields.summary}

### Basic Information
- **Status**: ${issue.fields.status.name} (${issue.fields.status.statusCategory.name})
- **Type**: ${issue.fields.issuetype.name}
- **Priority**: ${issue.fields.priority?.name || 'None'}
- **Project**: ${issue.fields.project.name} (${issue.fields.project.key})

### People
- **Assignee**: ${issue.fields.assignee?.displayName || 'Unassigned'}
- **Reporter**: ${issue.fields.reporter?.displayName || 'Unknown'}

### Dates
- **Created**: ${new Date(issue.fields.created).toLocaleString()}
- **Updated**: ${new Date(issue.fields.updated).toLocaleString()}
${issue.fields.duedate ? `- **Due Date**: ${new Date(issue.fields.duedate).toLocaleDateString()}` : ''}

### Time Tracking
${timeTracking.originalEstimate ? `- **Original Estimate**: ${timeTracking.originalEstimate}` : ''}
${timeTracking.remainingEstimate ? `- **Remaining**: ${timeTracking.remainingEstimate}` : ''}
${timeTracking.timeSpent ? `- **Time Spent**: ${timeTracking.timeSpent}` : ''}

### Labels & Components
${issue.fields.labels.length > 0 ? `- **Labels**: ${issue.fields.labels.join(', ')}` : '- **Labels**: None'}
${issue.fields.components.length > 0 ? `- **Components**: ${issue.fields.components.map((c: any) => c.name).join(', ')}` : '- **Components**: None'}

### Fix Versions
${issue.fields.fixVersions.length > 0 ? issue.fields.fixVersions.map((v: any) => `- ${v.name}`).join('\n') : '- No fix versions'}

${issue.fields.description ? `\n### Description\n${typeof issue.fields.description === 'string' ? issue.fields.description : 'Rich text description (use Jira web interface to view)'}` : ''}

${issue.fields.parent ? `\n### Parent Issue\n- **${issue.fields.parent.key}**: ${issue.fields.parent.fields.summary}` : ''}

${issue.fields.subtasks.length > 0 ? `\n### Subtasks (${issue.fields.subtasks.length})\n${issue.fields.subtasks.map((st: any) => `- **${st.key}**: ${st.fields.summary} (${st.fields.status.name})`).join('\n')}` : ''}

${issue.fields.resolution ? `\n### Resolution\n- **${issue.fields.resolution.name}**: ${issue.fields.resolution.description || 'No description'}` : ''}`;

      // Add comments if requested
      if (params.includeComments && issue.fields.comment?.comments.length > 0) {
        details += `\n\n### Recent Comments (${issue.fields.comment.total} total)\n`;
        const recentComments = issue.fields.comment.comments.slice(-3);
        recentComments.forEach((comment: any) => {
          details += `\n**${comment.author.displayName}** (${new Date(comment.created).toLocaleDateString()}):\n`;
          details += typeof comment.body === 'string' ? comment.body : 'Rich text comment (use Jira web interface to view)';
          details += '\n';
        });
      }

      // Add worklogs if requested
      if (params.includeWorklogs && issue.fields.worklog?.worklogs.length > 0) {
        details += `\n\n### Recent Work Logs (${issue.fields.worklog.total} total)\n`;
        const recentWorklogs = issue.fields.worklog.worklogs.slice(-5);
        recentWorklogs.forEach((worklog: any) => {
          details += `- **${worklog.author.displayName}**: ${worklog.timeSpent} on ${new Date(worklog.started).toLocaleDateString()}`;
          if (worklog.comment) {
            details += ` - ${typeof worklog.comment === 'string' ? worklog.comment : 'Rich text comment'}`;
          }
          details += '\n';
        });
      }

      return {
        content: [
          {
            type: 'text',
            text: details,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get issue details for ${params.issueKey}:`, error);
      throw new Error(`Failed to retrieve issue details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createIssue(params: IssueCreateRequest): Promise<ToolResult> {
    try {
      this.logger.debug('Creating new issue', params);

      const issueData: any = {
        fields: {
          project: { key: params.projectKey },
          issuetype: { name: params.issueType },
          summary: params.summary,
        }
      };

      if (params.description) {
        // Use API v2 format (simple text instead of ADF)
        issueData.fields.description = params.description;
      }

      if (params.priority) {
        issueData.fields.priority = { name: params.priority };
      }

      if (params.assignee) {
        // API v2 uses name (username) instead of accountId
        issueData.fields.assignee = { name: params.assignee };
      }

      if (params.labels && params.labels.length > 0) {
        issueData.fields.labels = params.labels;
      }

      if (params.components && params.components.length > 0) {
        issueData.fields.components = params.components.map(name => ({ name }));
      }

      if (params.fixVersions && params.fixVersions.length > 0) {
        issueData.fields.fixVersions = params.fixVersions.map(name => ({ name }));
      }

      if (params.dueDate) {
        issueData.fields.duedate = params.dueDate;
      }

      if (params.parentKey) {
        issueData.fields.parent = { key: params.parentKey };
      }

      const result = await this.apiClient.createIssue(issueData);

      return {
        content: [
          {
            type: 'text',
            text: `# ✅ Issue Created Successfully!

**Issue Key**: ${result.key}
**Summary**: ${params.summary}
**Project**: ${params.projectKey}
**Type**: ${params.issueType}
${params.priority ? `**Priority**: ${params.priority}` : ''}

## Quick Actions
- View details: Use \`get_issue_details\` with key: ${result.key}
- Add comment: Use \`add_comment\` with key: ${result.key}
- Transition: Use \`transition_issue\` to change status

🔗 **View in Jira**: [${result.key}](${result.self})`,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to create issue:', error);
      throw new Error(`Failed to create issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateIssue(params: IssueUpdateRequest): Promise<ToolResult> {
    try {
      this.logger.debug(`Updating issue: ${params.issueKey}`, params);

      const updateData: any = { fields: {} };

      if (params.summary) {
        updateData.fields.summary = params.summary;
      }

      if (params.description) {
        // Use API v2 format (simple text instead of ADF)
        updateData.fields.description = params.description;
      }

      if (params.priority) {
        updateData.fields.priority = { name: params.priority };
      }

      if (params.assignee) {
        // API v2 uses name (username) instead of accountId
        updateData.fields.assignee = { name: params.assignee };
      }

      if (params.labels) {
        updateData.fields.labels = params.labels;
      }

      if (params.components) {
        updateData.fields.components = params.components.map(name => ({ name }));
      }

      if (params.fixVersions) {
        updateData.fields.fixVersions = params.fixVersions.map(name => ({ name }));
      }

      if (params.dueDate) {
        updateData.fields.duedate = params.dueDate;
      }

      await this.apiClient.updateIssue(params.issueKey, updateData);

      const updatedFields = Object.keys(updateData.fields);

      return {
        content: [
          {
            type: 'text',
            text: `# ✅ Issue Updated Successfully!

**Issue**: ${params.issueKey}
**Updated Fields**: ${updatedFields.join(', ')}

## Changes Made
${updatedFields.map(field => {
  const value = updateData.fields[field];
  if (typeof value === 'object' && value.name) {
    return `- **${field}**: ${value.name}`;
  } else if (Array.isArray(value)) {
    return `- **${field}**: ${value.join(', ')}`;
  } else {
    return `- **${field}**: Updated`;
  }
}).join('\n')}

Use \`get_issue_details\` with key: ${params.issueKey} to see all changes.`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to update issue ${params.issueKey}:`, error);
      throw new Error(`Failed to update issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transitionIssue(params: TransitionRequest): Promise<ToolResult> {
    try {
      this.logger.debug(`Transitioning issue: ${params.issueKey}`, params);

      // First, get available transitions
      const transitionsResponse = await this.apiClient.getIssueTransitions(params.issueKey);
      const transitions = transitionsResponse.transitions || [];

      // Find the transition by name
      const transition = transitions.find((t: any) => 
        t.name.toLowerCase() === params.transitionName.toLowerCase()
      );

      if (!transition) {
        const availableTransitions = transitions.map((t: any) => t.name).join(', ');
        throw new Error(`Transition "${params.transitionName}" not found. Available transitions: ${availableTransitions}`);
      }

      await this.apiClient.transitionIssue(params.issueKey, transition.id, params.comment);

      return {
        content: [
          {
            type: 'text',
            text: `# ✅ Issue Transitioned Successfully!

**Issue**: ${params.issueKey}
**Transition**: ${params.transitionName}
**New Status**: ${transition.to.name}
${params.comment ? `**Comment Added**: ${params.comment}` : ''}

## Available Actions
- View updated details: Use \`get_issue_details\` with key: ${params.issueKey}
- Add another comment: Use \`add_comment\`
- Make another transition: Use \`transition_issue\`

### Other Available Transitions
${transitions.filter((t: any) => t.id !== transition.id).map((t: any) => `- ${t.name} → ${t.to.name}`).join('\n')}`,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to transition issue ${params.issueKey}:`, error);
      throw new Error(`Failed to transition issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async addComment(params: { issueKey: string; comment: string }): Promise<ToolResult> {
    try {
      this.logger.debug(`Adding comment to issue: ${params.issueKey}`);

      const result = await this.apiClient.addComment(params.issueKey, params.comment);

      return {
        content: [
          {
            type: 'text',
            text: `# ✅ Comment Added Successfully!

**Issue**: ${params.issueKey}
**Comment ID**: ${result.id}
**Added**: ${new Date(result.created).toLocaleString()}

## Comment Content
${params.comment}

## Quick Actions
- View issue details: Use \`get_issue_details\` with key: ${params.issueKey}
- Add another comment: Use \`add_comment\`
- Transition issue: Use \`transition_issue\``,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to add comment to ${params.issueKey}:`, error);
      throw new Error(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async completeIssue(params: { issueKey?: string; customResolution?: string; confirm?: boolean }): Promise<ToolResult> {
    let issueKey: string | undefined = params.issueKey;
    
    try {
      // If no issueKey provided, try to get last viewed issue
      issueKey = params.issueKey;
      
      if (!issueKey) {
        const lastIssue = this.issueTracker.getLastIssue();
        if (!lastIssue) {
          return {
            content: [
              {
                type: 'text',
                text: `# ❌ Не удалось найти задачу для закрытия

Не указан номер задачи и не найдена последняя просмотренная задача.

**Использование:**
- Укажите номер задачи: "закрой RIVER-123"
- Или сначала просмотрите задачу: "RIVER-123", а затем "закрой"`,
              },
            ],
          };
        }
        
        issueKey = lastIssue;
        
        // If not confirmed, return confirmation request
        if (!params.confirm) {
          return {
            content: [
              {
                type: 'text',
                text: `# ❓ Подтверждение закрытия задачи

**Найдена последняя просмотренная задача:** ${issueKey}

Вы хотите закрыть задачу **${issueKey}**?

**Для подтверждения напишите:** "да", "yes", "закрой ${issueKey}", или "закрой" с подтверждением`,
              },
            ],
          };
        }
      }
      
      this.logger.debug(`Completing issue: ${issueKey}`);

      // Get issue details first
      const issue = await this.apiClient.getIssue(issueKey!, {
        fields: ['summary', 'description', 'status', 'issuetype', 'assignee', 'components', 'labels']
      });

      const currentStatus = issue.fields.status.name;
      const statusCategory = issue.fields.status.statusCategory?.key;

      // Handle special case: if issue is in "Canceled" status, need to go through "Закрыт" first
      if (currentStatus === 'Canceled' && statusCategory === 'done') {
        this.logger.debug('Issue is in Canceled status, transitioning to Закрыт first');
        
        const transitions1 = await this.apiClient.getIssueTransitions(issueKey!, true);
        const closeTransition = transitions1.transitions.find((t: any) => t.to.name === 'Закрыт');
        
        if (closeTransition) {
          // Get resolution for closing
          let resolution: { name: string } | undefined = undefined;
          if (closeTransition.fields?.resolution?.allowedValues && closeTransition.fields.resolution.allowedValues.length > 0) {
            resolution = { name: closeTransition.fields.resolution.allowedValues[0].name };
          }
          
          await this.apiClient.transitionIssue(
            issueKey!,
            closeTransition.id,
            'Перевожу в Закрыт для правильного workflow',
            resolution
          );
          
          // Wait a bit for status to update
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Check if current status is allowed (after potential transition)
      const updatedIssue = await this.apiClient.getIssue(issueKey!, {
        fields: ['status']
      });
      const updatedStatus = updatedIssue.fields.status.name;

      if (!this.ALLOWED_STATUSES_FOR_COMPLETION.includes(updatedStatus) && updatedStatus !== 'Закрыт') {
        // If status is "Закрыт", we can proceed to "Готово"
        if (updatedStatus !== 'Закрыт') {
          throw new Error(
            `Cannot complete issue from status "${updatedStatus}". ` +
            `Allowed statuses: ${this.ALLOWED_STATUSES_FOR_COMPLETION.join(', ')}, or Закрыт`
          );
        }
      }

      // Get available transitions with fields to see available resolutions
      const transitionsResponse = await this.apiClient.getIssueTransitions(issueKey!, true);
      const transitions = transitionsResponse.transitions || [];

      // Find transition to "Готово" status
      const doneTransition = transitions.find((t: any) => 
        t.to.name === 'Готово'
      );

      if (!doneTransition) {
        // Try to find any transition that leads to Done category
        const doneCategoryTransition = transitions.find((t: any) => 
          t.to.statusCategory?.key === 'done'
        );

        if (!doneCategoryTransition) {
          const availableTransitions = transitions.map((t: any) => `${t.name} → ${t.to.name}`).join(', ');
          throw new Error(
            `No transition to "Готово" status found. Available transitions: ${availableTransitions}`
          );
        }

        // Generate resolution
        const resolutionText = params.customResolution || await this.resolutionGenerator.generateResolution(issue);
        
        // Get available resolution from transition fields - prefer "Готово" resolution
        let resolution: { name: string } | undefined = undefined;
        if (doneCategoryTransition.fields?.resolution?.allowedValues && doneCategoryTransition.fields.resolution.allowedValues.length > 0) {
          // Try to find "Готово" resolution first
          const readyResolution = doneCategoryTransition.fields.resolution.allowedValues.find((r: any) => 
            r.name === 'Готово' || r.name.toLowerCase() === 'готово'
          );
          resolution = { name: readyResolution ? readyResolution.name : doneCategoryTransition.fields.resolution.allowedValues[0].name };
        } else {
          // Fallback: try common resolution names
          const commonResolutions = ['Готово', 'Исправлено', 'Fixed', 'Выполнено', 'Done'];
          resolution = { name: commonResolutions[0] };
        }

        await this.apiClient.transitionIssue(
          issueKey!,
          doneCategoryTransition.id,
          resolutionText,
          resolution
        );

        // If we transitioned to "Canceled", need to go through "Закрыт" to "Готово"
        if (doneCategoryTransition.to.name === 'Canceled') {
          this.logger.debug('Issue transitioned to Canceled, moving through Закрыт to Готово');
          
          // Wait for status to update
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Transition to Закрыт
          const transitionsAfterCanceled = await this.apiClient.getIssueTransitions(issueKey!, true);
          const closeTransition = transitionsAfterCanceled.transitions.find((t: any) => t.to.name === 'Закрыт');
          
          if (closeTransition) {
            let closeResolution: { name: string } | undefined = undefined;
            if (closeTransition.fields?.resolution?.allowedValues && closeTransition.fields.resolution.allowedValues.length > 0) {
              closeResolution = { name: closeTransition.fields.resolution.allowedValues[0].name };
            }
            
            await this.apiClient.transitionIssue(
              issueKey!,
              closeTransition.id,
              'Перевожу в Закрыт для правильного workflow',
              closeResolution
            );
            
            // Wait for status to update
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Now transition to Готово
            const transitionsAfterClosed = await this.apiClient.getIssueTransitions(issueKey!, true);
            const readyTransition = transitionsAfterClosed.transitions.find((t: any) => t.to.name === 'Готово');
            
            if (readyTransition) {
              // Get resolution "Готово" - only if required
              let readyResolution: { name: string } | undefined = undefined;
              if (readyTransition.fields?.resolution) {
                if (readyTransition.fields.resolution.required || 
                    (readyTransition.fields.resolution.allowedValues && readyTransition.fields.resolution.allowedValues.length > 0)) {
                  const readyRes = readyTransition.fields.resolution.allowedValues?.find((r: any) => 
                    r.name === 'Готово' || r.name.toLowerCase() === 'готово'
                  );
                  readyResolution = { name: readyRes ? readyRes.name : readyTransition.fields.resolution.allowedValues?.[0]?.name || 'Готово' };
                }
              }
              
              await this.apiClient.transitionIssue(
                issueKey!,
                readyTransition.id,
                resolutionText,
                readyResolution
              );
              
              return {
                content: [
                  {
                    type: 'text',
                    text: `# ✅ Issue Completed Successfully!

**Issue**: ${issueKey}
**Previous Status**: ${currentStatus}${updatedStatus !== currentStatus ? ` (was ${updatedStatus})` : ''}
**Final Status**: Готово
**Resolution**: ${readyResolution?.name || 'не указана'}
**Resolution Comment**: ${resolutionText}

## Workflow Path
${currentStatus} → Canceled → Закрыт → Готово

## Issue Summary
${issue.fields.summary}

## Quick Actions
- View updated details: Use \`get_issue_details\` with key: ${issueKey}
- Add another comment: Use \`add_comment\`
- View other issues: Use \`search_issues\``,
                  },
                ],
              };
            }
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: `# ✅ Issue Completed Successfully!

**Issue**: ${issueKey}
**Previous Status**: ${currentStatus}${updatedStatus !== currentStatus ? ` (was ${updatedStatus})` : ''}
**New Status**: ${doneCategoryTransition.to.name}
**Resolution**: ${resolution?.name || 'не указана'}
**Resolution Comment**: ${resolutionText}

## Issue Summary
${issue.fields.summary}

## Quick Actions
- View updated details: Use \`get_issue_details\` with key: ${issueKey}
- Add another comment: Use \`add_comment\`
- View other issues: Use \`search_issues\``,
            },
          ],
        };
      }

      // Generate resolution
      const resolutionText = params.customResolution || await this.resolutionGenerator.generateResolution(issue);
      
      // Get available resolution from transition fields - only if required
      let resolution: { name: string } | undefined = undefined;
      if (doneTransition.fields?.resolution) {
        // Resolution field exists - check if it's required or has allowed values
        if (doneTransition.fields.resolution.required || 
            (doneTransition.fields.resolution.allowedValues && doneTransition.fields.resolution.allowedValues.length > 0)) {
          // Try to find "Готово" resolution first
          const readyResolution = doneTransition.fields.resolution.allowedValues?.find((r: any) => 
            r.name === 'Готово' || r.name.toLowerCase() === 'готово'
          );
          resolution = { name: readyResolution ? readyResolution.name : doneTransition.fields.resolution.allowedValues?.[0]?.name || 'Готово' };
        }
        // If resolution field exists but is not required and has no allowed values, don't set it
      }

      await this.apiClient.transitionIssue(
        issueKey!,
        doneTransition.id,
        resolutionText,
        resolution
      );

      return {
        content: [
          {
            type: 'text',
            text: `# ✅ Issue Completed Successfully!

**Issue**: ${issueKey}
**Previous Status**: ${currentStatus}${updatedStatus !== currentStatus ? ` (was ${updatedStatus})` : ''}
**New Status**: ${doneTransition.to.name}
**Resolution**: ${resolution?.name || 'не указана'}
**Resolution Comment**: ${resolutionText}

## Issue Summary
${issue.fields.summary}

## Quick Actions
- View updated details: Use \`get_issue_details\` with key: ${issueKey}
- Add another comment: Use \`add_comment\`
- View other issues: Use \`search_issues\``,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to complete issue ${issueKey || 'unknown'}:`, error);
      throw new Error(`Failed to complete issue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getIssueHierarchy(params: { 
    jql?: string;
    assignee?: string;
    maxResults?: number;
  }): Promise<ToolResult> {
    try {
      this.logger.debug('Building issue hierarchy', params);

      // Build JQL query
      let jql = params.jql || `assignee = currentUser() AND statusCategory != Done`;
      if (params.assignee && !params.jql) {
        jql = `assignee = ${params.assignee} AND statusCategory != Done`;
      }

      // Get all issues with hierarchical fields (epic links, issue links)
      const response = await this.apiClient.searchIssues(jql, {
        maxResults: params.maxResults || 200,
        fields: [
          'summary', 'status', 'priority', 'issuetype', 'key', 
          'customfield_10102', 'issuelinks'
        ],
      });

      // Build data structures
      const epicMap: Record<string, string[]> = {};
      const coversMap: Record<string, string[]> = {};
      const parentMap: Record<string, string[]> = {};
      const issueMap: Record<string, any> = {};
      const epicKeysToFetch = new Set<string>();

      // Fill issue_map
      for (const issue of response.issues || []) {
        issueMap[issue.key] = issue;
        
        // Collect epic keys from Epic Links
        const epicLink = issue.fields.customfield_10102;
        if (epicLink) {
          let epicKey: string | undefined;
          if (typeof epicLink === 'string') {
            epicKey = epicLink;
          } else if (epicLink.key) {
            epicKey = epicLink.key;
          } else if (typeof epicLink === 'object' && 'toString' in epicLink) {
            epicKey = epicLink.toString();
          }
          if (epicKey) {
            epicKeysToFetch.add(epicKey);
          }
        }
      }

      // Get epics by assignee/reporter (for epics assigned to user)
      let epicJql = `issuetype = Epic`;
      if (jql.includes('assignee = currentUser()')) {
        epicJql += ` AND (assignee = currentUser() OR reporter = currentUser())`;
      } else if (params.assignee) {
        epicJql += ` AND (assignee = ${params.assignee} OR reporter = ${params.assignee})`;
      } else if (params.jql) {
        epicJql += ` AND (${params.jql})`;
      }
      
      const epicsResponse = await this.apiClient.searchIssues(epicJql, {
        maxResults: 100,
        fields: ['summary', 'status', 'priority', 'key', 'issuetype'],
      });

      // Add epics from assignee query to issueMap
      for (const epic of epicsResponse.issues || []) {
        if (!issueMap[epic.key]) {
          issueMap[epic.key] = epic;
        }
        epicKeysToFetch.add(epic.key);
      }

      // Fetch epics that are referenced by tasks but not in assignee query
      const epicKeysArray = Array.from(epicKeysToFetch);
      const fetchedEpicKeys = new Set((epicsResponse.issues || []).map((e: any) => e.key));
      const epicsToFetch = epicKeysArray.filter(key => !fetchedEpicKeys.has(key));
      
      if (epicsToFetch.length > 0) {
        // Fetch epics by key
        for (const epicKey of epicsToFetch) {
          try {
            const epic = await this.apiClient.getIssue(epicKey, {
              fields: ['summary', 'status', 'priority', 'key', 'issuetype'],
            });
            if (!issueMap[epic.key]) {
              issueMap[epic.key] = epic;
            }
          } catch (error) {
            this.logger.warn(`Failed to fetch epic ${epicKey}:`, error);
          }
        }
      }

      // Process hierarchical relationships
      for (const issue of response.issues || []) {
        const key = issue.key;
        const fields = issue.fields;

        // Epic Link
        const epicLink = fields.customfield_10102;
        if (epicLink) {
          let epicKey: string | undefined;
          if (typeof epicLink === 'string') {
            epicKey = epicLink;
          } else if (epicLink && typeof epicLink === 'object') {
            // Try different possible formats
            if ('key' in epicLink && typeof epicLink.key === 'string') {
              epicKey = epicLink.key;
            } else if ('id' in epicLink && typeof epicLink.id === 'string') {
              // Sometimes epic link might be returned as ID
              epicKey = epicLink.id;
            } else if ('toString' in epicLink && typeof epicLink.toString === 'function') {
              epicKey = epicLink.toString();
            } else {
              // Log for debugging
              this.logger.debug(`Unknown epic link format for ${key}:`, JSON.stringify(epicLink));
            }
          }
          
          if (epicKey) {
            if (!epicMap[epicKey]) {
              epicMap[epicKey] = [];
            }
            epicMap[epicKey].push(key);
            this.logger.debug(`Added ${key} to epic ${epicKey}`);
          } else {
            this.logger.debug(`Could not extract epic key from ${key}, epicLink:`, JSON.stringify(epicLink));
          }
        }

        // Issue Links
        const issuelinks = fields.issuelinks || [];
        for (const link of issuelinks) {
          const linkType = link.type || {};
          const linkId = linkType.id || '';
          const linkName = (linkType.name || '').toLowerCase();
          const inward = (linkType.inward || '').toLowerCase();
          const outward = (linkType.outward || '').toLowerCase();

          // Requirement: covers/covered by (ID: 10703)
          if (linkId === '10703' || linkName.includes('requirement')) {
            const inwardIssue = link.inwardIssue;
            const outwardIssue = link.outwardIssue;

            if (outwardIssue && outward.includes('covers')) {
              const coversKey = key;
              const coveredKey = outwardIssue.key;
              if (coversKey && coveredKey) {
                if (!coversMap[coversKey]) {
                  coversMap[coversKey] = [];
                }
                if (!coversMap[coversKey].includes(coveredKey)) {
                  coversMap[coversKey].push(coveredKey);
                }
                if (!issueMap[coveredKey]) {
                  issueMap[coveredKey] = {
                    key: coveredKey,
                    fields: outwardIssue.fields || {},
                  };
                }
              }
            }

            if (inwardIssue && inward.includes('covered by')) {
              const coversKey = inwardIssue.key;
              const coveredKey = key;
              if (coversKey && coveredKey) {
                if (!coversMap[coversKey]) {
                  coversMap[coversKey] = [];
                }
                if (!coversMap[coversKey].includes(coveredKey)) {
                  coversMap[coversKey].push(coveredKey);
                }
                if (!issueMap[coversKey]) {
                  issueMap[coversKey] = {
                    key: coversKey,
                    fields: inwardIssue.fields || {},
                  };
                }
              }
            }
          }

          // Parent-Child (ID: 10600)
          if (linkId === '10600' || linkName.includes('parent')) {
            const inwardIssue = link.inwardIssue;
            const outwardIssue = link.outwardIssue;

            if (outwardIssue && outward.includes('is parent of')) {
              const parentKey = key;
              const childKey = outwardIssue.key;
              if (parentKey && childKey) {
                if (!parentMap[parentKey]) {
                  parentMap[parentKey] = [];
                }
                if (!parentMap[parentKey].includes(childKey)) {
                  parentMap[parentKey].push(childKey);
                }
                if (!issueMap[childKey]) {
                  issueMap[childKey] = {
                    key: childKey,
                    fields: outwardIssue.fields || {},
                  };
                }
              }
            }

            if (inwardIssue && inward.includes('is child of')) {
              const parentKey = inwardIssue.key;
              const childKey = key;
              if (parentKey && childKey) {
                if (!parentMap[parentKey]) {
                  parentMap[parentKey] = [];
                }
                if (!parentMap[parentKey].includes(childKey)) {
                  parentMap[parentKey].push(childKey);
                }
                if (!issueMap[parentKey]) {
                  issueMap[parentKey] = {
                    key: parentKey,
                    fields: inwardIssue.fields || {},
                  };
                }
              }
            }
          }
        }
      }

      // Helper functions
      const getStatusEmoji = (status: string, statusCategory?: string) => {
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
      };

      const getTypeIcon = (issueType: string) => {
        const map: Record<string, string> = {
          'Эпик': '📦',
          'Задача': '📋',
          'Ошибка': '🐛',
          'Story': '📖',
          'Sub-task': '📌',
        };
        return map[issueType] || '📄';
      };

      // Build tree structure
      const buildTreeLines = (issueKey: string, level: number, prefix: string, isLast: boolean, visited: Set<string>): string[] => {
        if (visited.has(issueKey)) {
          return [];
        }
        visited.add(issueKey);

        const issue = issueMap[issueKey];
        if (!issue) {
          return [];
        }

        const fields = issue.fields || {};
        const summary = (fields.summary || '').substring(0, 70) + 
          ((fields.summary || '').length > 70 ? '...' : '');
        const status = fields.status?.name || 'Unknown';
        const priority = fields.priority?.name || 'Нет';
        const issueType = fields.issuetype?.name || 'Задача';

        const typeIcon = getTypeIcon(issueType);
        const statusCategory = issue.fields?.status?.statusCategory?.name || issue.fields?.status?.statusCategory;
        const statusEmoji = getStatusEmoji(status, statusCategory);
        
        const connector = level === 0 ? '' : (isLast ? '└── ' : '├── ');
        const lines: string[] = [];
        lines.push(`${prefix}${connector}${typeIcon} **${issueKey}** - ${summary}`);
        lines.push(`${prefix}${isLast ? '    ' : '│   '}   ${statusEmoji} ${status} | ${priority}`);

        // Process children (covers + parent-child через links)
        const coveredIssues = coversMap[issueKey] || [];
        const childIssues = parentMap[issueKey] || [];
        const allChildren = Array.from(new Set([...coveredIssues, ...childIssues]));

        if (allChildren.length > 0) {
          for (let i = 0; i < allChildren.length; i++) {
            const childKey = allChildren[i];
            const isLastChild = i === allChildren.length - 1;
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            const childLines = buildTreeLines(childKey, level + 1, childPrefix, isLastChild, visited);
            lines.push(...childLines);
          }
        }

        return lines;
      };

      // Count epics from epicMap (all epics that have tasks)
      // Get all unique epic keys from epicMap (needed for folder lookup)
      const allEpicKeysInMap = Object.keys(epicMap).filter(key => epicMap[key] && epicMap[key].length > 0);

      // Try to get folder information from Structure 138
      const folderMap: Record<string, { folderId: string; folderName: string; structureId: string; structureName: string }[]> = {};
      const issueToFolderMap: Record<string, string[]> = {}; // issueKey -> array of folder paths
      const structureErrors: string[] = []; // Collect errors to show in output
      
      // Use specific structure ID 138
      const targetStructureId = '138';
      
      try {
        const hierarchy = await this.apiClient.getStructureHierarchy(targetStructureId, {
          maxResults: 1000,
        });
        
        if (hierarchy && hierarchy.elements && hierarchy.elements.length > 0) {
          // Build folder path for each issue
          const folderInfoMap: Record<string, { id: string; name: string; parentId: string | null }> = {};
          
          // First, collect all folders
          for (const element of hierarchy.elements) {
            const isFolder = !element.issueKey && (element.type === 'folder' || element.folder === true || element.elementType === 'folder');
            if (isFolder) {
              folderInfoMap[element.id] = {
                id: element.id,
                name: element.name || element.summary || 'Unnamed Folder',
                parentId: element.parentId || null,
              };
            }
          }
          
          // Build folder paths for issues
          const getFolderPath = (elementId: string): string[] => {
            const element = hierarchy.elements.find((e: any) => e.id === elementId);
            if (!element) return [];
            
            const isFolder = !element.issueKey && (element.type === 'folder' || element.folder === true || element.elementType === 'folder');
            if (!isFolder) return [];
            
            const folder = folderInfoMap[elementId];
            if (!folder) return [];
            
            const path = [folder.name];
            if (folder.parentId) {
              const parentPath = getFolderPath(folder.parentId);
              return [...parentPath, ...path];
            }
            return path;
          };
          
          // Map issues and epics to their folder paths
          for (const element of hierarchy.elements) {
            if (element.issueKey) {
              // Check if it's an issue or epic we're interested in
              const isOurIssue = issueMap[element.issueKey];
              const isOurEpic = allEpicKeysInMap.includes(element.issueKey);
              
              if ((isOurIssue || isOurEpic) && element.parentId) {
                const folderPath = getFolderPath(element.parentId);
                if (folderPath.length > 0) {
                  if (!issueToFolderMap[element.issueKey]) {
                    issueToFolderMap[element.issueKey] = [];
                  }
                  const fullPath = folderPath.join(' → ');
                  if (!issueToFolderMap[element.issueKey].includes(fullPath)) {
                    issueToFolderMap[element.issueKey].push(fullPath);
                  }
                  
                  // Also store in folderMap for building hierarchy
                  const folderName = folderPath[folderPath.length - 1];
                  if (!folderMap[folderName]) {
                    folderMap[folderName] = [];
                  }
                  const folderInfo = {
                    folderId: element.parentId,
                    folderName: folderName,
                    structureId: targetStructureId,
                    structureName: `Structure ${targetStructureId}`,
                  };
                  if (!folderMap[folderName].some(f => f.folderId === folderInfo.folderId && f.structureId === folderInfo.structureId)) {
                    folderMap[folderName].push(folderInfo);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        // Check if it's a 404 error (structure not found) - this is normal, don't show as error
        const is404 = (error as any)?.statusCode === 404 || errorMsg.includes('404') || errorMsg.includes('Not Found');
        
        if (is404) {
          this.logger.debug(`Structure ${targetStructureId} not found (404) - skipping`);
          // Don't add to errors - 404 is normal for deleted/unavailable structures
        } else {
          this.logger.warn(`Failed to get hierarchy for structure ${targetStructureId}:`, errorMsg);
          structureErrors.push(`Структура ${targetStructureId}: ${errorMsg}`);
        }
      }

      // Build output
      let output = `# 🌳 Иерархическая структура задач\n\n`;
      output += `**Построено по**: Папки (Structures) → Epic Link → Requirement (covers/covered by) → Parent-Child\n\n`;
      this.logger.debug(`Epic map keys: ${allEpicKeysInMap.join(', ')}`);
      this.logger.debug(`Epic map: ${JSON.stringify(epicMap)}`);
      const foldersCount = Object.keys(folderMap).length;
      const issuesWithFolders = Object.keys(issueToFolderMap).length;
      output += `**Всего задач**: ${response.total} | **Эпиков**: ${allEpicKeysInMap.length}${foldersCount > 0 ? ` | **Папок**: ${foldersCount}` : ''}${issuesWithFolders > 0 ? ` | **Задач в папках**: ${issuesWithFolders}` : ''}\n\n`;
      
      // Show errors or info if no folders found
      if (structureErrors.length > 0) {
        output += `⚠️ **Ошибки при получении папок из Structures**:\n`;
        structureErrors.forEach(err => {
          output += `- ${err}\n`;
        });
        output += `\n`;
      }
      
      if (foldersCount === 0 && issuesWithFolders === 0 && structureErrors.length === 0) {
        output += `ℹ️ **Примечание**: Папки из Structures не найдены для этих задач. Показана иерархия через Epic Links.\n\n`;
      }

      // Build folder → epic → task hierarchy
      // Group epics by folders
      const folderToEpicsMap: Record<string, { epicKey: string; epic: any; issues: string[] }[]> = {};
      const epicsWithoutFolders: { epicKey: string; epic: any; issues: string[] }[] = [];
      
      for (const epicKey of allEpicKeysInMap) {
        const epic = issueMap[epicKey];
        const issuesInEpic = epicMap[epicKey] || [];
        
        // Find folders for this epic and its issues
        const epicFolders = new Set<string>();
        
        // First check if epic itself is in a folder
        if (issueToFolderMap[epicKey]) {
          for (const folderPath of issueToFolderMap[epicKey]) {
            const topFolder = folderPath.split(' → ')[0];
            epicFolders.add(topFolder);
          }
        }
        
        // Then check folders for issues in this epic
        for (const issueKey of issuesInEpic) {
          if (issueToFolderMap[issueKey]) {
            for (const folderPath of issueToFolderMap[issueKey]) {
              // Get the top-level folder (first in path)
              const topFolder = folderPath.split(' → ')[0];
              epicFolders.add(topFolder);
            }
          }
        }
        
        const epicData = { epicKey, epic, issues: issuesInEpic };
        
        if (epicFolders.size > 0) {
          // Add epic to all its folders
          for (const folderName of epicFolders) {
            if (!folderToEpicsMap[folderName]) {
              folderToEpicsMap[folderName] = [];
            }
            // Avoid duplicates
            if (!folderToEpicsMap[folderName].some(e => e.epicKey === epicKey)) {
              folderToEpicsMap[folderName].push(epicData);
            }
          }
        } else {
          // Epic without folder
          epicsWithoutFolders.push(epicData);
        }
      }
      
      // Output folders with epics
      if (Object.keys(folderToEpicsMap).length > 0) {
        output += `## 📁 Папки и иерархия задач\n\n`;
        
        for (const folderName of Object.keys(folderToEpicsMap).sort()) {
          const epicsInFolder = folderToEpicsMap[folderName];
          output += `### 📁 ${folderName}\n\n`;
          
          for (let epicIdx = 0; epicIdx < epicsInFolder.length; epicIdx++) {
            const { epicKey, epic, issues } = epicsInFolder[epicIdx];
            const isLastEpic = epicIdx === epicsInFolder.length - 1;
            
            if (!epic) {
              output += `   ${isLastEpic ? '└──' : '├──'} 📦 **${epicKey}**: (Epic не найден или недоступен)\n`;
              output += `   ${isLastEpic ? '    ' : '│   '}   Задач: ${issues.length}\n\n`;
              continue;
            }
            
            const epicFields = epic.fields || {};
            const epicSummary = epicFields.summary || '';
            const epicStatus = epicFields.status?.name || 'Unknown';
            const epicPriority = epicFields.priority?.name || 'Нет';
            const epicStatusCategory = epicFields.status?.statusCategory?.name || epicFields.status?.statusCategory;
            
            output += `   ${isLastEpic ? '└──' : '├──'} 📦 **${epicKey}**: ${epicSummary}\n`;
            output += `   ${isLastEpic ? '    ' : '│   '}   ${getStatusEmoji(epicStatus, epicStatusCategory)} ${epicStatus} | ${epicPriority} | Задач: ${issues.length}\n`;
            
            if (issues.length > 0) {
              const visited = new Set<string>();
              for (let i = 0; i < Math.min(issues.length, 20); i++) {
                const issueKey = issues[i];
                if (issueMap[issueKey]) {
                  const isLastIssue = i === issues.length - 1 || (i === Math.min(issues.length, 20) - 1);
                  const prefix = isLastEpic ? '    ' : '│   ';
                  const treeLines = buildTreeLines(issueKey, 2, prefix, isLastIssue, visited);
                  output += treeLines.join('\n');
                  if (i < Math.min(issues.length, 20) - 1) {
                    output += '\n';
                  }
                }
              }
              if (issues.length > 20) {
                output += `\n   ${isLastEpic ? '    ' : '│   '}   ... и еще ${issues.length - 20} задач`;
              }
            }
            output += '\n\n';
          }
        }
      }
      
      // Output epics without folders
      if (epicsWithoutFolders.length > 0) {
        if (Object.keys(folderToEpicsMap).length > 0) {
          output += `## 📦 Эпики без папок\n\n`;
        } else {
          output += `## 📦 Эпики и связанные задачи\n\n`;
        }
        
        for (const { epicKey, epic, issues } of epicsWithoutFolders) {
          if (!epic) {
            output += `### 📦 ${epicKey}: (Epic не найден или недоступен)\n`;
            output += `   Задач: ${issues.length}\n\n`;
            
            if (issues.length > 0) {
              const visited = new Set<string>();
              const epicTreeLines: string[] = [];
              for (let i = 0; i < Math.min(issues.length, 30); i++) {
                const issueKey = issues[i];
                if (issueMap[issueKey]) {
                  const isLast = i === Math.min(issues.length, 30) - 1;
                  const treeLines = buildTreeLines(issueKey, 1, '   ', isLast, visited);
                  epicTreeLines.push(...treeLines);
                  if (i < Math.min(issues.length, 30) - 1) {
                    epicTreeLines.push('');
                  }
                }
              }
              if (issues.length > 30) {
                epicTreeLines.push(`   ... и еще ${issues.length - 30} задач`);
              }
              output += epicTreeLines.join('\n');
            }
            output += '\n\n';
            continue;
          }

          const epicFields = epic.fields || {};
          const epicSummary = epicFields.summary || '';
          const epicStatus = epicFields.status?.name || 'Unknown';
          const epicPriority = epicFields.priority?.name || 'Нет';
          const epicStatusCategory = epicFields.status?.statusCategory?.name || epicFields.status?.statusCategory;
          
          output += `### 📦 ${epicKey}: ${epicSummary}\n`;
          output += `   ${getStatusEmoji(epicStatus, epicStatusCategory)} ${epicStatus} | ${epicPriority} | Задач: ${issues.length}\n\n`;

          if (issues.length > 0) {
            const visited = new Set<string>();
            const epicTreeLines: string[] = [];
            for (let i = 0; i < Math.min(issues.length, 30); i++) {
              const issueKey = issues[i];
              if (issueMap[issueKey]) {
                const isLast = i === Math.min(issues.length, 30) - 1;
                const treeLines = buildTreeLines(issueKey, 1, '   ', isLast, visited);
                epicTreeLines.push(...treeLines);
                if (i < Math.min(issues.length, 30) - 1) {
                  epicTreeLines.push('');
                }
              }
            }
            if (issues.length > 30) {
              epicTreeLines.push(`   ... и еще ${issues.length - 30} задач`);
            }
            output += epicTreeLines.join('\n');
          }

          output += '\n\n';
        }
      }

      // Tasks without epics
      const allIssueKeys = Object.keys(issueMap);
      const epicKeysSet = new Set(allEpicKeysInMap); // Use all epic keys from epicMap
      const tasksWithoutEpic = allIssueKeys.filter(
        (k) =>
          !epicKeysSet.has(k) &&
          issueMap[k]?.fields?.issuetype?.name !== 'Эпик' &&
          !issueMap[k]?.fields?.customfield_10102
      );

      if (tasksWithoutEpic.length > 0) {
        const allCovered = new Set(
          Object.values(coversMap).flat()
        );
        const allChildren = new Set(
          Object.values(parentMap).flat()
        );
        const rootTasks = tasksWithoutEpic.filter(
          (k) => !allCovered.has(k) && !allChildren.has(k)
        );

        if (rootTasks.length > 0) {
          output += `\n## 📋 Задачи без эпиков\n\n`;
          const visited = new Set<string>();
          const rootTreeLines: string[] = [];
          for (let i = 0; i < Math.min(rootTasks.length, 20); i++) {
            const taskKey = rootTasks[i];
            const isLast = i === Math.min(rootTasks.length, 20) - 1;
            const treeLines = buildTreeLines(taskKey, 0, '', isLast, visited);
            rootTreeLines.push(...treeLines);
            if (i < Math.min(rootTasks.length, 20) - 1) {
              rootTreeLines.push('');
            }
          }
          if (rootTasks.length > 20) {
            rootTreeLines.push(`\n... и еще ${rootTasks.length - 20} задач`);
          }
          output += rootTreeLines.join('\n');
        }
      }

      output += `\n\n💡 **Статистика**:\n`;
      output += `- Задач с Epic Link: ${Object.values(epicMap).reduce((sum: number, arr: string[]) => sum + arr.length, 0)}\n`;
      output += `- Задач с covers (Requirement): ${Object.values(coversMap).reduce((sum: number, arr: string[]) => sum + arr.length, 0)}\n`;
      output += `- Задач с parent-child (через Issue Links): ${Object.values(parentMap).reduce((sum: number, arr: string[]) => sum + arr.length, 0)}\n`;
      output += `- Всего задач в иерархии: ${Object.keys(issueMap).length}\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to build issue hierarchy:', error);
      throw new Error(
        `Failed to build issue hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getIssueHierarchyFromRoot(params: {
    issueKey: string;
    maxDepth?: number;
    includeEpic?: boolean;
  }): Promise<ToolResult> {
    try {
      this.logger.debug(`Building issue hierarchy from root: ${params.issueKey}`);

      const maxDepth = params.maxDepth || 10;
      const issueMap: Record<string, any> = {};
      const parentMap: Record<string, string[]> = {};
      const coversMap: Record<string, string[]> = {};
      const epicMap: Record<string, string[]> = {};
      const visited = new Set<string>();

      // Recursive function to fetch issue and its children
      const fetchIssueHierarchy = async (key: string, depth: number): Promise<void> => {
        if (depth > maxDepth || visited.has(key)) {
          return;
        }
        visited.add(key);

        try {
          // Get issue with hierarchical fields (epic links, issue links)
          const issue = await this.apiClient.getIssue(key, {
            fields: [
              'summary', 'status', 'priority', 'issuetype', 'key',
              'customfield_10102', 'issuelinks'
            ],
          });

          issueMap[key] = issue;

          // Process epic link
          if (issue.fields.customfield_10102) {
            const epicLink = issue.fields.customfield_10102;
            const epicKey = typeof epicLink === 'string' ? epicLink : epicLink.key;
            if (epicKey) {
              if (!epicMap[epicKey]) {
                epicMap[epicKey] = [];
              }
              if (!epicMap[epicKey].includes(key)) {
                epicMap[epicKey].push(key);
              }
              // Fetch epic if requested and not visited
              if (params.includeEpic && !visited.has(epicKey)) {
                await fetchIssueHierarchy(epicKey, depth + 1);
              }
            }
          }

          // Process issue links (covers/covered by, parent-child)
          if (issue.fields.issuelinks) {
            for (const link of issue.fields.issuelinks) {
              const linkType = link.type || {};
              const linkId = linkType.id || '';
              const linkName = (linkType.name || '').toLowerCase();
              const inward = (linkType.inward || '').toLowerCase();
              const outward = (linkType.outward || '').toLowerCase();

              // Handle covers/covered by
              if (linkId === '10703' || linkName.includes('requirement')) {
                const inwardIssue = link.inwardIssue;
                const outwardIssue = link.outwardIssue;

                if (outwardIssue && outward.includes('covers')) {
                  const coversKey = key;
                  const coveredKey = outwardIssue.key;
                  if (coversKey && coveredKey) {
                    if (!coversMap[coversKey]) {
                      coversMap[coversKey] = [];
                    }
                    if (!coversMap[coversKey].includes(coveredKey)) {
                      coversMap[coversKey].push(coveredKey);
                    }
                    if (!visited.has(coveredKey)) {
                      await fetchIssueHierarchy(coveredKey, depth + 1);
                    }
                  }
                }

                if (inwardIssue && inward.includes('covered by')) {
                  const coversKey = inwardIssue.key;
                  const coveredKey = key;
                  if (coversKey && coveredKey) {
                    if (!coversMap[coversKey]) {
                      coversMap[coversKey] = [];
                    }
                    if (!coversMap[coversKey].includes(coveredKey)) {
                      coversMap[coversKey].push(coveredKey);
                    }
                    if (!visited.has(coversKey)) {
                      await fetchIssueHierarchy(coversKey, depth + 1);
                    }
                  }
                }
              }

              // Handle parent-child links
              if (linkId === '10600' || linkName.includes('parent')) {
                const inwardIssue = link.inwardIssue;
                const outwardIssue = link.outwardIssue;

                if (outwardIssue && outward.includes('is parent of')) {
                  const parentKey = key;
                  const childKey = outwardIssue.key;
                  if (parentKey && childKey) {
                    if (!parentMap[parentKey]) {
                      parentMap[parentKey] = [];
                    }
                    if (!parentMap[parentKey].includes(childKey)) {
                      parentMap[parentKey].push(childKey);
                    }
                    if (!visited.has(childKey)) {
                      await fetchIssueHierarchy(childKey, depth + 1);
                    }
                  }
                }

                if (inwardIssue && inward.includes('is child of')) {
                  const parentKey = inwardIssue.key;
                  const childKey = key;
                  if (parentKey && childKey) {
                    if (!parentMap[parentKey]) {
                      parentMap[parentKey] = [];
                    }
                    if (!parentMap[parentKey].includes(childKey)) {
                      parentMap[parentKey].push(childKey);
                    }
                    if (!visited.has(parentKey)) {
                      await fetchIssueHierarchy(parentKey, depth + 1);
                    }
                  }
                }
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to fetch issue ${key}:`, error);
        }
      };

      // Start fetching from root issue
      await fetchIssueHierarchy(params.issueKey, 0);

      // Helper functions
      const getStatusEmoji = (status: string, statusCategory?: string) => {
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
      };

      const getTypeIcon = (issueType: string) => {
        const map: Record<string, string> = {
          'Эпик': '📦',
          'Задача': '📋',
          'Ошибка': '🐛',
          'Story': '📖',
          'Sub-task': '📌',
        };
        return map[issueType] || '📄';
      };

      // Build tree structure
      const buildTreeLines = (issueKey: string, level: number, prefix: string, isLast: boolean, visitedTree: Set<string>): string[] => {
        if (visitedTree.has(issueKey)) {
          return [];
        }
        visitedTree.add(issueKey);

        const issue = issueMap[issueKey];
        if (!issue) {
          return [];
        }

        const fields = issue.fields || {};
        const summary = (fields.summary || '').substring(0, 70) + 
          ((fields.summary || '').length > 70 ? '...' : '');
        const status = fields.status?.name || 'Unknown';
        const priority = fields.priority?.name || 'Нет';
        const issueType = fields.issuetype?.name || 'Задача';

        const typeIcon = getTypeIcon(issueType);
        const statusCategory = issue.fields?.status?.statusCategory?.name || issue.fields?.status?.statusCategory;
        const statusEmoji = getStatusEmoji(status, statusCategory);
        
        const connector = level === 0 ? '' : (isLast ? '└── ' : '├── ');
        const lines: string[] = [];
        lines.push(`${prefix}${connector}${typeIcon} **${issueKey}** - ${summary}`);
        lines.push(`${prefix}${isLast ? '    ' : '│   '}   ${statusEmoji} ${status} | ${priority}`);

        // Process children (covers + parent-child через links)
        const coveredIssues = coversMap[issueKey] || [];
        const childIssues = parentMap[issueKey] || [];
        const allChildren = Array.from(new Set([...coveredIssues, ...childIssues]));
        
        if (allChildren.length > 0) {
          for (let i = 0; i < allChildren.length; i++) {
            const childKey = allChildren[i];
            const isLastChild = i === allChildren.length - 1;
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            const childLines = buildTreeLines(childKey, level + 1, childPrefix, isLastChild, visitedTree);
            lines.push(...childLines);
          }
        }

        return lines;
      };

      // Build output
      const rootIssue = issueMap[params.issueKey];
      if (!rootIssue) {
        return {
          content: [
            {
              type: 'text',
              text: `# ❌ Issue Not Found\n\nIssue **${params.issueKey}** not found or not accessible.`,
            },
          ],
        };
      }

      let output = `# 🌳 Иерархия задачи: ${params.issueKey}\n\n`;
      output += `**Корневая задача**: ${rootIssue.fields.summary}\n`;
      output += `**Всего задач в иерархии**: ${Object.keys(issueMap).length}\n`;
      output += `**Максимальная глубина**: ${maxDepth}\n\n`;

      const visitedTree = new Set<string>();
      const treeLines = buildTreeLines(params.issueKey, 0, '', true, visitedTree);
      output += treeLines.join('\n');

      output += `\n\n💡 **Статистика**:\n`;
      output += `- Всего задач: ${Object.keys(issueMap).length}\n`;
      output += `- Задач с Epic Link: ${Object.values(epicMap).reduce((sum: number, arr: string[]) => sum + arr.length, 0)}\n`;
      output += `- Задач с covers (Requirement): ${Object.values(coversMap).reduce((sum: number, arr: string[]) => sum + arr.length, 0)}\n`;
      output += `- Задач с parent-child (через Issue Links): ${Object.values(parentMap).reduce((sum: number, arr: string[]) => sum + arr.length, 0)}\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to build issue hierarchy from root ${params.issueKey}:`, error);
      throw new Error(
        `Failed to build issue hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getIssueLinks(params: { issueKey: string }): Promise<ToolResult> {
    try {
      this.logger.debug(`Fetching issue links for: ${params.issueKey}`);

      const issue = await this.apiClient.getIssue(params.issueKey, {
        fields: [
          'summary', 'status', 'issuetype', 'key',
          'customfield_10102', 'issuelinks'
        ],
      });

      const epicLink = issue.fields.customfield_10102;
      const issueLinks = issue.fields.issuelinks || [];

      // Categorize links
      const epicLinks: any[] = [];
      const coversLinks: any[] = [];
      const parentChildLinks: any[] = [];
      const otherLinks: any[] = [];

      // Epic Link
      if (epicLink) {
        const epicKey = typeof epicLink === 'string' ? epicLink : epicLink.key;
        epicLinks.push({
          key: epicKey,
          type: 'Epic Link',
          direction: 'outward',
          summary: typeof epicLink === 'object' ? epicLink.fields?.summary : undefined,
        });
      }

      // Process Issue Links
      for (const link of issueLinks) {
        const linkType = link.type || {};
        const linkId = linkType.id || '';
        const linkName = (linkType.name || '').toLowerCase();
        const inward = (linkType.inward || '').toLowerCase();
        const outward = (linkType.outward || '').toLowerCase();

        if (link.inwardIssue) {
          const relatedIssue = link.inwardIssue;
          const linkInfo = {
            key: relatedIssue.key,
            type: linkType.name || 'Unknown',
            direction: 'inward',
            description: inward,
            summary: relatedIssue.fields?.summary,
            status: relatedIssue.fields?.status?.name,
            issuetype: relatedIssue.fields?.issuetype?.name,
          };

          if (linkId === '10703' || linkName.includes('requirement')) {
            coversLinks.push(linkInfo);
          } else if (linkId === '10600' || linkName.includes('parent')) {
            parentChildLinks.push(linkInfo);
          } else {
            otherLinks.push(linkInfo);
          }
        }

        if (link.outwardIssue) {
          const relatedIssue = link.outwardIssue;
          const linkInfo = {
            key: relatedIssue.key,
            type: linkType.name || 'Unknown',
            direction: 'outward',
            description: outward,
            summary: relatedIssue.fields?.summary,
            status: relatedIssue.fields?.status?.name,
            issuetype: relatedIssue.fields?.issuetype?.name,
          };

          if (linkId === '10703' || linkName.includes('requirement')) {
            coversLinks.push(linkInfo);
          } else if (linkId === '10600' || linkName.includes('parent')) {
            parentChildLinks.push(linkInfo);
          } else {
            otherLinks.push(linkInfo);
          }
        }
      }

      let output = `# 🔗 Issue Links: ${params.issueKey}\n\n`;
      output += `**Issue**: ${issue.fields.summary}\n`;
      output += `**Status**: ${issue.fields.status.name}\n\n`;

      // Epic Links
      if (epicLinks.length > 0) {
        output += `## 📦 Epic Links\n\n`;
        epicLinks.forEach(epic => {
          output += `- **${epic.key}**: ${epic.summary || 'Epic'}\n`;
        });
        output += '\n';
      }

      // Covers/Requirement Links
      if (coversLinks.length > 0) {
        output += `## 🔗 Requirement Links (covers/covered by)\n\n`;
        coversLinks.forEach(link => {
          const direction = link.direction === 'inward' ? '←' : '→';
          output += `${direction} **${link.key}**: ${link.summary || 'No summary'}\n`;
          output += `   Type: ${link.type} | ${link.description} | Status: ${link.status || 'Unknown'}\n\n`;
        });
      }

      // Parent-Child Links
      if (parentChildLinks.length > 0) {
        output += `## 👨‍👩‍👧‍👦 Parent-Child Links\n\n`;
        parentChildLinks.forEach(link => {
          const direction = link.direction === 'inward' ? '← Parent' : '→ Child';
          output += `${direction} **${link.key}**: ${link.summary || 'No summary'}\n`;
          output += `   Type: ${link.type} | ${link.description} | Status: ${link.status || 'Unknown'}\n\n`;
        });
      }

      // Other Links
      if (otherLinks.length > 0) {
        output += `## 🔗 Other Links\n\n`;
        otherLinks.forEach(link => {
          const direction = link.direction === 'inward' ? '←' : '→';
          output += `${direction} **${link.key}**: ${link.summary || 'No summary'}\n`;
          output += `   Type: ${link.type} | ${link.description} | Status: ${link.status || 'Unknown'}\n\n`;
        });
      }

      if (epicLinks.length === 0 && coversLinks.length === 0 && parentChildLinks.length === 0 && otherLinks.length === 0) {
        output += `**No links found** for this issue.\n\n`;
      }

      output += `## 🧭 Navigation Actions\n\n`;
      output += `- Get issue details: Use \`get_issue_details\` with any issue key\n`;
      output += `- Navigate hierarchy: Use \`navigate_hierarchy\` with issue key and direction\n`;
      output += `- Get hierarchy from root: Use \`get_issue_hierarchy_from_root\` with issue key\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to get issue links for ${params.issueKey}:`, error);
      throw new Error(`Failed to retrieve issue links: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async navigateHierarchy(params: {
    issueKey: string;
    direction: 'parent' | 'children' | 'epic' | 'covers' | 'covered_by' | 'siblings';
  }): Promise<ToolResult> {
    try {
      this.logger.debug(`Navigating hierarchy for: ${params.issueKey}, direction: ${params.direction}`);

      const issue = await this.apiClient.getIssue(params.issueKey, {
        fields: [
          'summary', 'status', 'priority', 'issuetype', 'key',
          'customfield_10102', 'issuelinks'
        ],
      });

      const epicLink = issue.fields.customfield_10102;
      const issueLinks = issue.fields.issuelinks || [];

      let relatedIssues: any[] = [];
      let title = '';
      let description = '';

      switch (params.direction) {
        case 'epic':
          if (epicLink) {
            const epicKey = typeof epicLink === 'string' ? epicLink : epicLink.key;
            if (epicKey) {
              try {
                const epicIssue = await this.apiClient.getIssue(epicKey, {
                  fields: ['summary', 'status', 'priority', 'issuetype', 'key'],
                });
                relatedIssues.push({
                  key: epicIssue.key,
                  summary: epicIssue.fields.summary,
                  status: epicIssue.fields.status.name,
                  priority: epicIssue.fields.priority?.name,
                  issuetype: epicIssue.fields.issuetype.name,
                });
              } catch (error) {
                this.logger.warn(`Failed to fetch epic ${epicKey}:`, error);
              }
            }
          }
          title = '📦 Epic';
          description = 'Epic linked to this issue';
          break;

        case 'parent':
          for (const link of issueLinks) {
            const linkType = link.type || {};
            const linkId = linkType.id || '';
            const linkName = (linkType.name || '').toLowerCase();
            const inward = (linkType.inward || '').toLowerCase();

            if ((linkId === '10600' || linkName.includes('parent')) && link.inwardIssue && inward.includes('is child of')) {
              const parentIssue = link.inwardIssue;
              relatedIssues.push({
                key: parentIssue.key,
                summary: parentIssue.fields?.summary,
                status: parentIssue.fields?.status?.name,
                priority: parentIssue.fields?.priority?.name,
                issuetype: parentIssue.fields?.issuetype?.name,
              });
            }
          }
          title = '👨 Parent Issues';
          description = 'Parent issues (via parent-child links)';
          break;

        case 'children':
          for (const link of issueLinks) {
            const linkType = link.type || {};
            const linkId = linkType.id || '';
            const linkName = (linkType.name || '').toLowerCase();
            const outward = (linkType.outward || '').toLowerCase();

            if ((linkId === '10600' || linkName.includes('parent')) && link.outwardIssue && outward.includes('is parent of')) {
              const childIssue = link.outwardIssue;
              relatedIssues.push({
                key: childIssue.key,
                summary: childIssue.fields?.summary,
                status: childIssue.fields?.status?.name,
                priority: childIssue.fields?.priority?.name,
                issuetype: childIssue.fields?.issuetype?.name,
              });
            }
          }
          title = '👧 Child Issues';
          description = 'Child issues (via parent-child links)';
          break;

        case 'covers':
          for (const link of issueLinks) {
            const linkType = link.type || {};
            const linkId = linkType.id || '';
            const linkName = (linkType.name || '').toLowerCase();
            const outward = (linkType.outward || '').toLowerCase();

            if ((linkId === '10703' || linkName.includes('requirement')) && link.outwardIssue && outward.includes('covers')) {
              const coveredIssue = link.outwardIssue;
              relatedIssues.push({
                key: coveredIssue.key,
                summary: coveredIssue.fields?.summary,
                status: coveredIssue.fields?.status?.name,
                priority: coveredIssue.fields?.priority?.name,
                issuetype: coveredIssue.fields?.issuetype?.name,
              });
            }
          }
          title = '📋 Covered Issues';
          description = 'Issues covered by this requirement';
          break;

        case 'covered_by':
          for (const link of issueLinks) {
            const linkType = link.type || {};
            const linkId = linkType.id || '';
            const linkName = (linkType.name || '').toLowerCase();
            const inward = (linkType.inward || '').toLowerCase();

            if ((linkId === '10703' || linkName.includes('requirement')) && link.inwardIssue && inward.includes('covered by')) {
              const coversIssue = link.inwardIssue;
              relatedIssues.push({
                key: coversIssue.key,
                summary: coversIssue.fields?.summary,
                status: coversIssue.fields?.status?.name,
                priority: coversIssue.fields?.priority?.name,
                issuetype: coversIssue.fields?.issuetype?.name,
              });
            }
          }
          title = '🔗 Covering Requirements';
          description = 'Requirements that cover this issue';
          break;

        case 'siblings':
          // Get parent first
          let parentKey: string | null = null;
          for (const link of issueLinks) {
            const linkType = link.type || {};
            const linkId = linkType.id || '';
            const linkName = (linkType.name || '').toLowerCase();
            const inward = (linkType.inward || '').toLowerCase();

            if ((linkId === '10600' || linkName.includes('parent')) && link.inwardIssue && inward.includes('is child of')) {
              parentKey = link.inwardIssue.key;
              break;
            }
          }

          if (parentKey) {
            // Get all children of the parent
            try {
              const parentIssue = await this.apiClient.getIssue(parentKey, {
                fields: ['issuelinks'],
              });

              for (const link of parentIssue.fields.issuelinks || []) {
                const linkType = link.type || {};
                const linkId = linkType.id || '';
                const linkName = (linkType.name || '').toLowerCase();
                const outward = (linkType.outward || '').toLowerCase();

                if ((linkId === '10600' || linkName.includes('parent')) && link.outwardIssue && outward.includes('is parent of')) {
                  const siblingKey = link.outwardIssue.key;
                  if (siblingKey !== params.issueKey) {
                    try {
                      const siblingIssue = await this.apiClient.getIssue(siblingKey, {
                        fields: ['summary', 'status', 'priority', 'issuetype', 'key'],
                      });
                      relatedIssues.push({
                        key: siblingIssue.key,
                        summary: siblingIssue.fields.summary,
                        status: siblingIssue.fields.status.name,
                        priority: siblingIssue.fields.priority?.name,
                        issuetype: siblingIssue.fields.issuetype.name,
                      });
                    } catch (error) {
                      this.logger.warn(`Failed to fetch sibling ${siblingKey}:`, error);
                    }
                  }
                }
              }
            } catch (error) {
              this.logger.warn(`Failed to fetch parent ${parentKey}:`, error);
            }
          }
          title = '👥 Sibling Issues';
          description = 'Sibling issues (same parent)';
          break;
      }

      let output = `# 🧭 Navigation: ${title}\n\n`;
      output += `**From Issue**: ${params.issueKey} - ${issue.fields.summary}\n`;
      output += `**Direction**: ${description}\n\n`;

      if (relatedIssues.length === 0) {
        output += `**No related issues found** in this direction.\n\n`;
      } else {
        const tableData = relatedIssues.map(relIssue => [
          relIssue.key,
          (relIssue.summary || 'No summary').substring(0, 50) + ((relIssue.summary || '').length > 50 ? '...' : ''),
          relIssue.status || 'Unknown',
          relIssue.priority || 'None',
          relIssue.issuetype || 'Task',
        ]);

        const markdownTable = `| Issue Key | Summary | Status | Priority | Type |
|-----------|---------|--------|----------|------|
${tableData.map((row: string[]) => `| ${row.join(' | ')} |`).join('\n')}`;

        output += markdownTable;
      }

      output += `\n\n## 🧭 Next Steps\n\n`;
      output += `- Get details: Use \`get_issue_details\` with any issue key\n`;
      output += `- Navigate further: Use \`navigate_hierarchy\` with any issue key\n`;
      output += `- Get all links: Use \`get_issue_links\` with any issue key\n`;
      output += `- View hierarchy: Use \`get_issue_hierarchy_from_root\` with any issue key\n`;

      return {
        content: [
          {
            type: 'text',
            text: output,
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Failed to navigate hierarchy for ${params.issueKey}:`, error);
      throw new Error(`Failed to navigate hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}