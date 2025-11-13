import { JiraApiClient } from './jiraApiClient.js';
import { ToolDefinition, ToolResult } from './types/index.js';
import { Logger } from './utils/logger.js';
import { 
  BoardService,
  IssueService,
  UserService,
  ProjectService,
  WorklogService,
  ServerService,
  StructureService
} from './services/index.js';

export class JiraToolRegistry {
  private logger: Logger;
  private boardService: BoardService;
  private issueService: IssueService;
  private userService: UserService;
  private projectService: ProjectService;
  private worklogService: WorklogService;
  private serverService: ServerService;
  private structureService: StructureService;

  constructor(private apiClient: JiraApiClient) {
    this.logger = new Logger('JiraToolRegistry');
    
    // Initialize services
    this.boardService = new BoardService(apiClient);
    this.issueService = new IssueService(apiClient);
    this.userService = new UserService(apiClient);
    this.projectService = new ProjectService(apiClient);
    this.worklogService = new WorklogService(apiClient);
    this.serverService = new ServerService(apiClient);
    this.structureService = new StructureService(apiClient);
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      // Board tools
      {
        name: 'get_boards',
        description: 'List all available Jira boards with optional filtering',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              description: 'Board type filter (scrum, kanban, simple)',
              enum: ['scrum', 'kanban', 'simple']
            },
            projectKey: {
              type: 'string',
              description: 'Filter boards by project key'
            }
          },
        },
      },
      {
        name: 'get_board_details',
        description: 'Get detailed information about a specific board',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'string',
              description: 'Board ID to get details for'
            }
          },
          required: ['boardId'],
        },
      },
      {
        name: 'get_board_issues',
        description: 'Get issues from a specific board with advanced filtering',
        inputSchema: {
          type: 'object',
          properties: {
            boardId: {
              type: 'string',
              description: 'Board ID to get issues from'
            },
            assigneeFilter: {
              type: 'string',
              description: 'Filter by assignee (currentUser, unassigned, or specific user)',
              enum: ['currentUser', 'unassigned', 'all']
            },
            statusFilter: {
              type: 'string',
              description: 'Filter by status category',
              enum: ['new', 'indeterminate', 'done', 'all']
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 50)',
              minimum: 1,
              maximum: 100
            }
          },
          required: ['boardId'],
        },
      },

      // Issue tools
      {
        name: 'get_my_issues_grouped',
        description: 'Get all your open issues grouped by status in a single optimized request. Use this for "/jira" command without parameters. Returns issues organized by status groups (Backlog, Сделать, Переоткрыт, В работе, For test, etc.) with direct links and quick actions. This is the MOST EFFICIENT way to get your tasks overview.',
        inputSchema: {
          type: 'object',
          properties: {
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 500)',
              minimum: 1,
              maximum: 1000
            },
            jql: {
              type: 'string',
              description: 'Optional custom JQL query (default: assignee = currentUser() AND statusCategory != Done)'
            }
          },
        },
      },
      {
        name: 'search_issues',
        description: 'Search for issues using JQL (Jira Query Language)',
        inputSchema: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'JQL query string'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results (default: 50)',
              minimum: 1,
              maximum: 100
            }
          },
          required: ['jql'],
        },
      },
      {
        name: 'get_issue_details',
        description: 'Get comprehensive details about a specific Jira issue. Use this when user mentions an issue key (e.g., "RIVER-2640", "PROJ-123", "show me RIVER-2640", "what is RIVER-2640", "покажи RIVER-2640", "информация о RIVER-2640"). Automatically extracts issue key from user input.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Jira issue key (e.g., RIVER-2640, PROJ-123) or ID. Can be extracted from user input when they mention an issue key.'
            },
            includeComments: {
              type: 'boolean',
              description: 'Include comments in the response (default: false)'
            },
            includeWorklogs: {
              type: 'boolean',
              description: 'Include worklogs in the response (default: false)'
            }
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'create_issue',
        description: 'Create a new Jira issue',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Project key where the issue will be created'
            },
            issueType: {
              type: 'string',
              description: 'Issue type (e.g., Task, Bug, Story)'
            },
            summary: {
              type: 'string',
              description: 'Issue summary/title'
            },
            description: {
              type: 'string',
              description: 'Issue description'
            },
            priority: {
              type: 'string',
              description: 'Issue priority (Highest, High, Medium, Low, Lowest)',
              enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest']
            },
            assignee: {
              type: 'string',
              description: 'Assignee account ID (optional)'
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Issue labels'
            }
          },
          required: ['projectKey', 'issueType', 'summary'],
        },
      },
      {
        name: 'update_issue',
        description: 'Update an existing issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to update'
            },
            summary: {
              type: 'string',
              description: 'New summary'
            },
            description: {
              type: 'string',
              description: 'New description'
            },
            priority: {
              type: 'string',
              description: 'New priority'
            },
            assignee: {
              type: 'string',
              description: 'New assignee account ID'
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'New labels'
            }
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'transition_issue',
        description: 'Transition an issue to a different status',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to transition'
            },
            transitionName: {
              type: 'string',
              description: 'Name of the transition (e.g., "In Progress", "Done")'
            },
            comment: {
              type: 'string',
              description: 'Optional comment to add during transition'
            }
          },
          required: ['issueKey', 'transitionName'],
        },
      },
      {
        name: 'add_comment',
        description: 'Add a comment to an issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to comment on'
            },
            comment: {
              type: 'string',
              description: 'Comment text'
            }
          },
          required: ['issueKey', 'comment'],
        },
      },
      {
        name: 'complete_issue',
        description: 'Close or complete a Jira issue by transitioning it to "Готово" (Done) status with AI-generated resolution. Use this when user asks to close, complete, or finish a task/issue. Accepts commands like "закрой задачу XXX", "закрой XXX", "закрой" (will use last viewed issue), "close task XXX", "complete XXX", "finish XXX", "заверши XXX". If issueKey is not provided, uses the last viewed issue and asks for confirmation. Automatically handles workflow transitions including Canceled → Закрыт → Готово. Works for issues in statuses: Сделать, Переоткрыт, Backlog, В работе, For test, Тестирование в процессе, Under Review, Canceled, Закрыт.',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Jira issue key to close/complete (e.g., RIVER-123, PROJ-456). Optional - if not provided, will use last viewed issue.'
            },
            customResolution: {
              type: 'string',
              description: 'Optional custom resolution text. If not provided, AI will generate resolution based on issue content'
            },
            confirm: {
              type: 'boolean',
              description: 'Confirmation flag. Set to true when user confirms closing the last viewed issue (e.g., after "да", "yes")'
            }
          },
          required: [],
        },
      },
      {
        name: 'get_issue_hierarchy',
        description: 'Get hierarchical structure of issues organized by Epic Link, covers/covered by (Requirement), and parent-child relationships',
        inputSchema: {
          type: 'object',
          properties: {
            jql: {
              type: 'string',
              description: 'JQL query to filter issues (default: assignee = currentUser() AND statusCategory != Done)'
            },
            assignee: {
              type: 'string',
              description: 'Filter by assignee (alternative to jql, uses currentUser() if not specified)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 200)',
              minimum: 1,
              maximum: 500
            }
          },
        },
      },
      {
        name: 'get_issue_hierarchy_from_root',
        description: 'Get hierarchical structure starting from a specific issue, recursively fetching all related issues (parent, subtasks, epic links, issue links)',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Root issue key to start hierarchy from'
            },
            maxDepth: {
              type: 'number',
              description: 'Maximum depth to traverse (default: 10)',
              minimum: 1,
              maximum: 20
            },
            includeEpic: {
              type: 'boolean',
              description: 'Include epic in hierarchy if issue is linked to one (default: false)'
            }
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'get_issue_links',
        description: 'Get all links for a specific issue, categorized by type (Epic Links, Requirement Links, Parent-Child Links, Other Links)',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to get links for'
            }
          },
          required: ['issueKey'],
        },
      },
      {
        name: 'navigate_hierarchy',
        description: 'Navigate through issue hierarchy in a specific direction (parent, children, epic, covers, covered_by, siblings)',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to navigate from'
            },
            direction: {
              type: 'string',
              description: 'Direction to navigate',
              enum: ['parent', 'children', 'epic', 'covers', 'covered_by', 'siblings']
            }
          },
          required: ['issueKey', 'direction'],
        },
      },

      // User tools
      {
        name: 'get_current_user',
        description: 'Get information about the currently authenticated user',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'search_users',
        description: 'Search for users by username, email, or display name',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query (username, email, or display name)'
            }
          },
          required: ['query'],
        },
      },
      {
        name: 'get_user_details',
        description: 'Get detailed information about a specific user',
        inputSchema: {
          type: 'object',
          properties: {
            accountId: {
              type: 'string',
              description: 'User account ID'
            }
          },
          required: ['accountId'],
        },
      },

      // Project tools
      {
        name: 'get_projects',
        description: 'List all accessible projects',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_project_details',
        description: 'Get detailed information about a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Project key or ID'
            }
          },
          required: ['projectKey'],
        },
      },
      {
        name: 'get_project_workflows',
        description: 'Get workflows and statuses for a specific project',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Project key to get workflows for'
            }
          },
          required: ['projectKey'],
        },
      },

      // Worklog tools
      {
        name: 'add_worklog',
        description: 'Add work log entry to an issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to log work against'
            },
            timeSpent: {
              type: 'string',
              description: 'Time spent (e.g., "2h 30m", "1d", "4h")'
            },
            comment: {
              type: 'string',
              description: 'Work description/comment'
            },
            startDate: {
              type: 'string',
              description: 'Start date (ISO format, optional - defaults to now)'
            }
          },
          required: ['issueKey', 'timeSpent'],
        },
      },
      {
        name: 'get_worklogs',
        description: 'Get work logs for an issue',
        inputSchema: {
          type: 'object',
          properties: {
            issueKey: {
              type: 'string',
              description: 'Issue key to get worklogs for'
            }
          },
          required: ['issueKey'],
        },
      },

      // Server tools
      {
        name: 'get_server_info',
        description: 'Get Jira server information and status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },

      // Structure tools
      {
        name: 'get_structures',
        description: 'List all available Jira Structure structures with optional project filtering',
        inputSchema: {
          type: 'object',
          properties: {
            projectKey: {
              type: 'string',
              description: 'Filter structures by project key'
            }
          },
        },
      },
      {
        name: 'get_structure_details',
        description: 'Get detailed information about a specific Structure structure',
        inputSchema: {
          type: 'object',
          properties: {
            structureId: {
              type: 'string',
              description: 'Structure ID to get details for'
            }
          },
          required: ['structureId'],
        },
      },
      {
        name: 'get_structure_hierarchy',
        description: 'Get hierarchical structure of issues from a Jira Structure, showing parent-child relationships',
        inputSchema: {
          type: 'object',
          properties: {
            structureId: {
              type: 'string',
              description: 'Structure ID to get hierarchy from'
            },
            issueKey: {
              type: 'string',
              description: 'Optional issue key to filter hierarchy (shows subtree starting from this issue)'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 500)',
              minimum: 1,
              maximum: 1000
            }
          },
          required: ['structureId'],
        },
      },
      {
        name: 'get_structure_elements',
        description: 'Get all elements from a Jira Structure as a flat list',
        inputSchema: {
          type: 'object',
          properties: {
            structureId: {
              type: 'string',
              description: 'Structure ID to get elements from'
            },
            issueKey: {
              type: 'string',
              description: 'Optional issue key to filter elements'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return (default: 100)',
              minimum: 1,
              maximum: 500
            }
          },
          required: ['structureId'],
        },
      },
      {
        name: 'get_release_folders',
        description: 'Get list of folders starting with a specific prefix (default: "Релиз ") in a Structure',
        inputSchema: {
          type: 'object',
          properties: {
            structureId: {
              type: 'string',
              description: 'Structure ID to search folders in'
            },
            prefix: {
              type: 'string',
              description: 'Prefix to search for (default: "Релиз ")'
            }
          },
          required: ['structureId'],
        },
      },
      {
        name: 'get_folder_hierarchy',
        description: 'Get hierarchical structure of tasks in a specific folder, with option to show only open issues',
        inputSchema: {
          type: 'object',
          properties: {
            structureId: {
              type: 'string',
              description: 'Structure ID containing the folder'
            },
            folderId: {
              type: 'string',
              description: 'Folder ID to get hierarchy from'
            },
            onlyOpen: {
              type: 'boolean',
              description: 'Show only open issues (default: false)'
            }
          },
          required: ['structureId', 'folderId'],
        },
      },
      {
        name: 'get_structure_hierarchy_by_assignee',
        description: 'Get hierarchical structure of active tasks for a specific assignee, organized by folders in Structures. Shows only active (non-Done) tasks in hierarchy starting from folders.',
        inputSchema: {
          type: 'object',
          properties: {
            assignee: {
              type: 'string',
              description: 'Assignee name (e.g., "Агафонов Александр")'
            },
            projectKey: {
              type: 'string',
              description: 'Optional project key to filter structures'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of issues to return (default: 500)',
              minimum: 1,
              maximum: 1000
            }
          },
          required: ['assignee'],
        },
      },
    ];
  }

  async executeTool(toolName: string, args: Record<string, any>): Promise<ToolResult> {
    this.logger.debug(`Executing tool: ${toolName}`, args);

    try {
      switch (toolName) {
        // Board tools
        case 'get_boards':
          return await this.boardService.getBoards(args);
        case 'get_board_details':
          return await this.boardService.getBoardDetails(args.boardId as string);
        case 'get_board_issues':
          return await this.boardService.getBoardIssues({
            boardId: args.boardId as string,
            assigneeFilter: args.assigneeFilter as 'currentUser' | 'unassigned' | 'all',
            statusFilter: args.statusFilter as 'new' | 'indeterminate' | 'done' | 'all',
            maxResults: args.maxResults as number,
          });

        // Issue tools
        case 'get_my_issues_grouped':
          return await this.issueService.getMyIssuesGroupedByStatus({
            maxResults: args.maxResults as number,
            jql: args.jql as string,
          });
        case 'search_issues':
          return await this.issueService.searchIssues({
            jql: args.jql as string,
            maxResults: args.maxResults as number,
            startAt: args.startAt as number,
            fields: args.fields as string[],
            expand: args.expand as string[],
          });
        case 'get_issue_details':
          return await this.issueService.getIssueDetails({
            issueKey: args.issueKey as string,
            includeComments: args.includeComments as boolean,
            includeWorklogs: args.includeWorklogs as boolean,
          });
        case 'create_issue':
          return await this.issueService.createIssue({
            projectKey: args.projectKey as string,
            issueType: args.issueType as string,
            summary: args.summary as string,
            description: args.description as string,
            priority: args.priority as string,
            assignee: args.assignee as string,
            labels: args.labels as string[],
            components: args.components as string[],
            fixVersions: args.fixVersions as string[],
            dueDate: args.dueDate as string,
            parentKey: args.parentKey as string,
          });
        case 'update_issue':
          return await this.issueService.updateIssue({
            issueKey: args.issueKey as string,
            summary: args.summary as string,
            description: args.description as string,
            priority: args.priority as string,
            assignee: args.assignee as string,
            labels: args.labels as string[],
            components: args.components as string[],
            fixVersions: args.fixVersions as string[],
            dueDate: args.dueDate as string,
          });
        case 'transition_issue':
          return await this.issueService.transitionIssue({
            issueKey: args.issueKey as string,
            transitionName: args.transitionName as string,
            comment: args.comment as string,
          });
        case 'add_comment':
          return await this.issueService.addComment({
            issueKey: args.issueKey as string,
            comment: args.comment as string,
          });
        case 'complete_issue': {
          const completeParams: { issueKey?: string; customResolution?: string; confirm?: boolean } = {};
          if (args.issueKey) completeParams.issueKey = args.issueKey as string;
          if (args.customResolution) completeParams.customResolution = args.customResolution as string;
          if (args.confirm !== undefined) completeParams.confirm = args.confirm as boolean;
          return await this.issueService.completeIssue(completeParams);
        }
        case 'get_issue_hierarchy':
          return await this.issueService.getIssueHierarchy({
            jql: args.jql as string,
            assignee: args.assignee as string,
            maxResults: args.maxResults as number,
          });
        case 'get_issue_hierarchy_from_root':
          return await this.issueService.getIssueHierarchyFromRoot({
            issueKey: args.issueKey as string,
            maxDepth: args.maxDepth as number,
            includeEpic: args.includeEpic as boolean,
          });
        case 'get_issue_links':
          return await this.issueService.getIssueLinks({
            issueKey: args.issueKey as string,
          });
        case 'navigate_hierarchy':
          return await this.issueService.navigateHierarchy({
            issueKey: args.issueKey as string,
            direction: args.direction as 'parent' | 'children' | 'epic' | 'covers' | 'covered_by' | 'siblings',
          });

        // User tools
        case 'get_current_user':
          return await this.userService.getCurrentUser();
        case 'search_users':
          return await this.userService.searchUsers(args.query as string);
        case 'get_user_details':
          return await this.userService.getUserDetails(args.accountId as string);

        // Project tools
        case 'get_projects':
          return await this.projectService.getProjects();
        case 'get_project_details':
          return await this.projectService.getProjectDetails(args.projectKey as string);
        case 'get_project_workflows':
          return await this.projectService.getProjectWorkflows(args.projectKey as string);

        // Worklog tools
        case 'add_worklog':
          return await this.worklogService.addWorklog({
            issueKey: args.issueKey as string,
            timeSpent: args.timeSpent as string,
            comment: args.comment as string,
            startDate: args.startDate as string,
          });
        case 'get_worklogs':
          return await this.worklogService.getWorklogs(args.issueKey as string);

        // Server tools
        case 'get_server_info':
          return await this.serverService.getServerInfo();

        // Structure tools
        case 'get_structures':
          return await this.structureService.getStructures({
            projectKey: args.projectKey as string,
          });
        case 'get_structure_details':
          return await this.structureService.getStructureDetails(args.structureId as string);
        case 'get_structure_hierarchy':
          return await this.structureService.getStructureHierarchy({
            structureId: args.structureId as string,
            issueKey: args.issueKey as string,
            maxResults: args.maxResults as number,
          });
        case 'get_structure_elements':
          return await this.structureService.getStructureElements({
            structureId: args.structureId as string,
            issueKey: args.issueKey as string,
            maxResults: args.maxResults as number,
          });
        case 'get_release_folders':
          return await this.structureService.getReleaseFolders({
            structureId: args.structureId as string,
            prefix: args.prefix as string,
          });
        case 'get_folder_hierarchy':
          return await this.structureService.getFolderHierarchy({
            structureId: args.structureId as string,
            folderId: args.folderId as string,
            onlyOpen: args.onlyOpen as boolean,
          });
        case 'get_structure_hierarchy_by_assignee':
          return await this.structureService.getStructureHierarchyByAssignee({
            assignee: args.assignee as string,
            projectKey: args.projectKey as string,
            maxResults: args.maxResults as number,
          });

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      this.logger.error(`Tool execution failed for ${toolName}:`, error);
      throw error;
    }
  }
}