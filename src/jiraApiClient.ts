import { JiraConfig, ApiResponse, JiraError } from './types/index.js';
import { Logger } from './utils/logger.js';
import { RateLimiter } from './utils/rateLimiter.js';

export class JiraApiClient {
  private config: JiraConfig;
  private logger: Logger;
  private rateLimiter: RateLimiter;
  private authHeader: string;
  private sessionCookies: string | null = null;
  private sessionInitialized: boolean = false;

  constructor() {
    this.config = this.getJiraConfig();
    this.logger = new Logger('JiraApiClient');
    this.rateLimiter = new RateLimiter();
    
    // Support Bearer token authentication if JIRA_BEARER_TOKEN is set
    // Otherwise use Basic auth with email:token
    const bearerToken = process.env.JIRA_BEARER_TOKEN;
    if (bearerToken) {
      this.authHeader = `Bearer ${bearerToken}`;
    } else {
      this.authHeader = `Basic ${Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64')}`;
    }
  }

  private getJiraConfig(): JiraConfig {
    const baseUrl = process.env.JIRA_BASE_URL;
    const bearerToken = process.env.JIRA_BEARER_TOKEN;
    
    // If Bearer token is used, email and apiToken are optional
    if (bearerToken) {
      if (!baseUrl) {
        throw new Error(
          'Missing Jira configuration. Please set JIRA_BASE_URL and JIRA_BEARER_TOKEN environment variables.'
        );
      }
      const cleanBaseUrl = baseUrl.replace(/\/$/, '');
      return { baseUrl: cleanBaseUrl, email: '', apiToken: '' };
    }
    
    // Otherwise require email and apiToken for Basic auth
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;

    if (!baseUrl || !email || !apiToken) {
      throw new Error(
        'Missing Jira configuration. Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables, or use JIRA_BEARER_TOKEN for Bearer authentication.'
      );
    }

    // Ensure baseUrl doesn't end with slash
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');

    return { baseUrl: cleanBaseUrl, email, apiToken };
  }

  async testConnection(): Promise<void> {
    try {
      // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
      await this.makeRequest('/myself', { useV3Api: false });
      this.logger.info('Jira connection test successful');
    } catch (error) {
      this.logger.error('Jira connection test failed:', error);
      throw new Error('Failed to connect to Jira. Please check your credentials and network connection.');
    }
  }

  /**
   * Create a Jira session and store cookies for cookie-based authentication
   * Required for Structure API endpoints that don't support Bearer tokens
   */
  private async initializeSession(): Promise<void> {
    if (this.sessionInitialized && this.sessionCookies) {
      return; // Session already initialized
    }

    // Check if cookies are provided manually via environment variable
    const manualCookies = process.env.JIRA_SESSION_COOKIES;
    if (manualCookies) {
      this.sessionCookies = manualCookies.trim();
      this.sessionInitialized = true;
      this.logger.debug('Using manually provided session cookies from JIRA_SESSION_COOKIES');
      return;
    }

    try {
      this.logger.debug('Initializing Jira session for cookie-based authentication');

      // Try alternative method: get cookies from a Structure API request with Bearer token
      // Some Jira instances return cookies even with Bearer token authentication
      const bearerToken = process.env.JIRA_BEARER_TOKEN;
      if (bearerToken) {
        try {
          this.logger.debug('Attempting to get cookies from Structure API request with Bearer token');
          // Try multiple endpoints to get cookies
          // First try /tree endpoint as it returns cookies even with Bearer token
          const testUrls = [
            `${this.config.baseUrl}/rest/structure/1/structure/138/tree`, // Try /tree endpoint first
            `${this.config.baseUrl}/rest/structure/2.0/structure`,
          ];
          
          for (const testUrl of testUrls) {
            const response = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Authorization': this.authHeader,
                'Accept': 'application/json',
              },
              redirect: 'manual', // Don't follow redirects, we want to see the response
            });

            // Check if we got cookies from the response (even if it's a redirect or HTML)
            const setCookieHeader = response.headers.get('set-cookie');
            if (setCookieHeader) {
              // Parse all cookies properly
              const cookieArray: string[] = [];
              const cookieStrings = setCookieHeader.split(',').map(c => c.trim());
              
              for (let i = 0; i < cookieStrings.length; i++) {
                let cookie = cookieStrings[i];
                // Handle cookies that might be split incorrectly
                // Check if this looks like a continuation (starts with space or doesn't have =)
                if (i > 0 && !cookie.includes('=')) {
                  // This might be a continuation, skip it
                  continue;
                }
                // Extract cookie name=value part (before semicolon)
                const cookiePart = cookie.split(';')[0].trim();
                if (cookiePart.includes('=')) {
                  cookieArray.push(cookiePart);
                }
              }
              
              const cookies = cookieArray.join('; ');
              
              if (cookies) {
                this.sessionCookies = cookies;
                this.sessionInitialized = true;
                this.logger.debug(`Successfully obtained cookies from ${testUrl}`);
                this.logger.debug(`Cookies: ${cookies.substring(0, 100)}...`);
                return;
              }
            }
          }
        } catch (error) {
          this.logger.debug('Failed to get cookies from Structure API request, trying session creation');
        }
      }

      // Fallback to standard session creation
      // Jira authentication API endpoint
      const authUrl = `${this.config.baseUrl}/rest/auth/1/session`;

      // Prepare credentials for session creation
      // Session creation requires username (email) and password (API token)
      // Even if using Bearer token, we need email and apiToken for session creation
      let username: string;
      let password: string;

      if (bearerToken) {
        // When using Bearer token, try to extract credentials or use alternative method
        const email = process.env.JIRA_EMAIL;
        const apiToken = process.env.JIRA_API_TOKEN;
        
        if (email && apiToken) {
          // Use provided credentials
          username = email;
          password = apiToken;
        } else {
          // Try to get email from current user info and use Bearer token as password
          try {
            this.logger.debug('Attempting to get user email from /myself endpoint');
            const userInfo = await fetch(`${this.config.baseUrl}/rest/api/2/myself`, {
              headers: {
                'Authorization': this.authHeader,
                'Accept': 'application/json',
              },
            });
            
            if (userInfo.ok) {
              const userData = await userInfo.json() as any;
              const userEmail = userData.emailAddress || userData.name;
              
              if (userEmail) {
                username = userEmail;
                // Try using Bearer token itself as password (some Jira instances support this)
                // Or try to extract API token from Bearer token if it's base64 encoded
                if (apiToken) {
                  password = apiToken;
                } else {
                  // Try to decode Bearer token to extract credentials
                  try {
                    const decoded = Buffer.from(bearerToken, 'base64').toString('utf-8');
                    const parts = decoded.split(':');
                    if (parts.length === 2) {
                      // Bearer token is base64(email:apiToken)
                      username = parts[0];
                      password = parts[1];
                      this.logger.debug('Extracted credentials from Bearer token');
                    } else {
                      // Use email from /myself and Bearer token as password
                      password = bearerToken;
                      this.logger.debug(`Using email from user info: ${userEmail}, Bearer token as password`);
                    }
                  } catch {
                    // If decoding fails, use Bearer token as password
                    password = bearerToken;
                    this.logger.debug(`Using email from user info: ${userEmail}, Bearer token as password`);
                  }
                }
              } else {
                throw new Error('Failed to get user email from /myself endpoint');
              }
            } else {
              throw new Error('Failed to get user info');
            }
          } catch (error: any) {
            throw new Error(
              `Cannot create session: ${error.message || 'Failed to initialize session. '}` +
              'When using JIRA_BEARER_TOKEN, you can either: ' +
              '1. Set JIRA_EMAIL and JIRA_API_TOKEN, or ' +
              '2. Ensure Bearer token is base64(email:apiToken) format.'
            );
          }
        }
      } else {
        // Using Basic auth - we already have email and apiToken
        username = this.config.email;
        password = this.config.apiToken;
      }

      if (!username || !password) {
        throw new Error('Cannot create session: Missing credentials. Please set JIRA_EMAIL and JIRA_API_TOKEN.');
      }

      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Failed to create session: ${response.status} ${response.statusText}`);
        this.logger.error(`Error: ${errorText}`);
        throw new Error(`Failed to create Jira session: ${response.status} ${response.statusText}`);
      }

      // Extract cookies from Set-Cookie header
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        // Parse cookies and store them
        const cookies = setCookieHeader.split(',').map(cookie => {
          // Extract cookie name=value part (before semicolon)
          return cookie.split(';')[0].trim();
        }).join('; ');
        
        this.sessionCookies = cookies;
        this.sessionInitialized = true;
        this.logger.debug('Jira session initialized successfully');
      } else {
        // Try to get cookies from response
        const allHeaders = Object.fromEntries(response.headers.entries());
        this.logger.debug('Response headers:', JSON.stringify(allHeaders));
        throw new Error('No cookies received from session creation');
      }
    } catch (error) {
      this.logger.error('Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * Ensure session is initialized before making Structure API requests
   */
  private async ensureSession(): Promise<void> {
    if (!this.sessionInitialized || !this.sessionCookies) {
      await this.initializeSession();
    }
  }

  async makeRequest<T = any>(
    endpoint: string,
    options: {
      method?: string;
      body?: any;
      useV3Api?: boolean;
      useAgileApi?: boolean;
      useStructureApi?: boolean;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      body,
      useV3Api = false,
      useAgileApi = false,
      useStructureApi = false,
      headers = {},
    } = options;

    // Apply rate limiting
    await this.rateLimiter.waitForSlot();

    // For Structure API, ensure session is initialized for cookie-based auth
    if (useStructureApi) {
      await this.ensureSession();
    }

    const apiPath = useStructureApi 
      ? '/rest/structure/2.0' 
      : useAgileApi 
        ? '/rest/agile/1.0' 
        : useV3Api 
          ? '/rest/api/3' 
          : '/rest/api/2';
    const url = `${this.config.baseUrl}${apiPath}${endpoint}`;

    const requestHeaders: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Enhanced-Jira-MCP-Server/2.0.0',
      ...headers,
    };

    // For Structure API, use cookies with Authorization header (some endpoints need both)
    if (useStructureApi) {
      if (this.sessionCookies) {
        requestHeaders['Cookie'] = this.sessionCookies;
      }
      // Also include Authorization header - some Structure endpoints may need both
      requestHeaders['Authorization'] = this.authHeader;
    } else {
      // For other APIs, use Authorization header
      requestHeaders['Authorization'] = this.authHeader;
    }

    this.logger.debug(`Making ${method} request to: ${url}`);
    if (body !== undefined) {
      this.logger.debug(`Request body:`, body);
    }

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: requestHeaders,
        redirect: 'follow', // Follow redirects automatically
      };

      // Only add body if it exists
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      
      this.logger.debug(`Response status: ${response.status} ${response.statusText}`);

      // Handle redirects (302) - might indicate need for session
      if (response.status === 302 || response.status === 401) {
        if (useStructureApi && !this.sessionInitialized) {
          // Try to initialize session and retry
          this.logger.debug('Received 302/401, attempting to initialize session and retry');
          await this.initializeSession();
          
          if (this.sessionCookies) {
            // Retry with cookies
            requestHeaders['Cookie'] = this.sessionCookies;
            delete requestHeaders['Authorization'];
            
            const retryResponse = await fetch(url, {
              ...fetchOptions,
              headers: requestHeaders,
            });
            
            if (retryResponse.ok) {
              const responseText = await retryResponse.text();
              if (!responseText) {
                return {} as T;
              }
              return JSON.parse(responseText) as T;
            }
          }
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage: string;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.errorMessages?.join(', ') || errorJson.message || errorText;
        } catch {
          errorMessage = errorText;
        }

        // Log detailed error information for debugging
        this.logger.error(`API request failed: ${method} ${url}`);
        this.logger.error(`Status: ${response.status} ${response.statusText}`);
        this.logger.error(`Error response: ${errorMessage}`);

        throw new JiraError(
          `Jira API error: ${response.status} ${response.statusText}`,
          response.status,
          errorMessage
        );
      }

      const responseText = await response.text();
      if (!responseText) {
        this.logger.debug(`Empty response body`);
        return {} as T;
      }
      
      const parsedResponse = JSON.parse(responseText) as T;
      
      // Log response summary (limit to avoid huge logs)
      if (typeof parsedResponse === 'object' && parsedResponse !== null) {
        const summary: any = {};
        if ('total' in parsedResponse) summary.total = (parsedResponse as any).total;
        if ('issues' in parsedResponse) summary.issuesCount = (parsedResponse as any).issues?.length;
        if ('maxResults' in parsedResponse) summary.maxResults = (parsedResponse as any).maxResults;
        if ('startAt' in parsedResponse) summary.startAt = (parsedResponse as any).startAt;
        if (Object.keys(summary).length > 0) {
          this.logger.debug(`Response summary:`, summary);
        }
      }
      
      return parsedResponse;
    } catch (error) {
      this.logger.error(`API request failed for ${url}:`, error);
      
      if (error instanceof JiraError) {
        throw error;
      }
      
      throw new JiraError(
        'Network error occurred while making API request',
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // Board-related methods
  async getBoards(params: { type?: string; projectKeyOrId?: string } = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.type) queryParams.append('type', params.type);
    if (params.projectKeyOrId) queryParams.append('projectKeyOrId', params.projectKeyOrId);
    
    const endpoint = `/board${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(endpoint, { useAgileApi: true });
  }

  async getBoard(boardId: string): Promise<any> {
    return this.makeRequest(`/board/${boardId}`, { useAgileApi: true });
  }

  async getBoardIssues(boardId: string, params: {
    jql?: string;
    maxResults?: number;
    startAt?: number;
    fields?: string[];
  } = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    if (params.jql) queryParams.append('jql', params.jql);
    if (params.maxResults) queryParams.append('maxResults', params.maxResults.toString());
    if (params.startAt) queryParams.append('startAt', params.startAt.toString());
    if (params.fields) queryParams.append('fields', params.fields.join(','));
    
    const endpoint = `/board/${boardId}/issue${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(endpoint, { useAgileApi: true });
  }

  // Issue-related methods
  async searchIssues(jql: string, params: {
    maxResults?: number;
    startAt?: number;
    fields?: string[];
    expand?: string[];
  } = {}): Promise<ApiResponse<any>> {
    const queryParams = new URLSearchParams();
    queryParams.append('jql', jql);
    if (params.maxResults) queryParams.append('maxResults', params.maxResults.toString());
    if (params.startAt) queryParams.append('startAt', params.startAt.toString());
    if (params.fields) queryParams.append('fields', params.fields.join(','));
    if (params.expand) queryParams.append('expand', params.expand.join(','));
    
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/search?${queryParams}`, { useV3Api: false });
  }

  async getIssue(issueIdOrKey: string, params: {
    fields?: string[];
    expand?: string[];
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.fields) queryParams.append('fields', params.fields.join(','));
    if (params.expand) queryParams.append('expand', params.expand.join(','));
    
    const endpoint = `/issue/${issueIdOrKey}${queryParams.toString() ? `?${queryParams}` : ''}`;
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(endpoint, { useV3Api: false });
  }

  async addComment(issueIdOrKey: string, comment: string): Promise<any> {
    // Use API v2 format (simple text body instead of ADF)
    const body = {
      body: comment,
    };

    return this.makeRequest(`/issue/${issueIdOrKey}/comment`, {
      method: 'POST',
      body: body,
      useV3Api: false,
    });
  }

  async updateIssue(issueIdOrKey: string, updateData: any): Promise<void> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    await this.makeRequest(`/issue/${issueIdOrKey}`, {
      method: 'PUT',
      body: updateData,
      useV3Api: false,
    });
  }

  async createIssue(issueData: any): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest('/issue', {
      method: 'POST',
      body: issueData,
      useV3Api: false,
    });
  }

  async transitionIssue(issueIdOrKey: string, transitionId: string, comment?: string, resolution?: { name: string }): Promise<void> {
    const body: any = {
      transition: { id: transitionId }
    };

    // Add resolution if provided
    if (resolution) {
      body.fields = {
        resolution: resolution
      };
    }

    if (comment) {
      // Use API v2 format (simple text comment instead of ADF)
      if (!body.update) {
        body.update = {};
      }
      body.update.comment = [{
        add: {
          body: comment
        }
      }];
    }

    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    await this.makeRequest(`/issue/${issueIdOrKey}/transitions`, {
      method: 'POST',
      body,
      useV3Api: false,
    });
  }

  async getIssueTransitions(issueIdOrKey: string, expandFields?: boolean): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    const endpoint = expandFields 
      ? `/issue/${issueIdOrKey}/transitions?expand=transitions.fields`
      : `/issue/${issueIdOrKey}/transitions`;
    return this.makeRequest(endpoint, { useV3Api: false });
  }

  // User-related methods
  async getCurrentUser(): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest('/myself', { useV3Api: false });
  }

  async searchUsers(query: string): Promise<any[]> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/user/search?query=${encodeURIComponent(query)}`, { useV3Api: false });
  }

  async getUser(accountId: string): Promise<any> {
    // Use API v2 - use username instead of accountId for v2
    // Note: v2 uses username parameter, not accountId
    return this.makeRequest(`/user?username=${encodeURIComponent(accountId)}`, { useV3Api: false });
  }

  // Project-related methods
  async getProjects(): Promise<any[]> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest('/project', { useV3Api: false });
  }

  async getProject(projectIdOrKey: string): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/project/${projectIdOrKey}`, { useV3Api: false });
  }

  async getProjectStatuses(projectIdOrKey: string): Promise<any[]> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/project/${projectIdOrKey}/statuses`, { useV3Api: false });
  }

  async getWorkflows(): Promise<any[]> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest('/workflow', { useV3Api: false });
  }

  async getWorkflow(workflowName: string): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/workflow?workflowName=${encodeURIComponent(workflowName)}`, { useV3Api: false });
  }

  // Server info
  async getServerInfo(): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest('/serverInfo', { useV3Api: false });
  }

  // Worklog methods
  async addWorklog(issueIdOrKey: string, timeSpent: string, comment?: string, startedDate?: string): Promise<any> {
    const body: any = {
      timeSpent,
      started: startedDate || new Date().toISOString(),
    };

    if (comment) {
      // Use API v2 format (simple text comment instead of ADF)
      body.comment = comment;
    }

    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/issue/${issueIdOrKey}/worklog`, {
      method: 'POST',
      body,
      useV3Api: false,
    });
  }

  async getWorklogs(issueIdOrKey: string): Promise<any> {
    // Use API v2 as v3 doesn't work with Bearer tokens on this Jira instance
    return this.makeRequest(`/issue/${issueIdOrKey}/worklog`, { useV3Api: false });
  }

  // Structure-related methods
  async getStructures(params: { projectKey?: string } = {}): Promise<any[]> {
    const queryParams = new URLSearchParams();
    if (params.projectKey) queryParams.append('projectKey', params.projectKey);
    
    const endpoint = `/structure${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await this.makeRequest(endpoint, { useStructureApi: true });
    
    // API returns { structures: [...] } format, not array directly
    if (response && Array.isArray(response.structures)) {
      return response.structures;
    }
    if (Array.isArray(response)) {
      return response;
    }
    return [];
  }

  async getStructure(structureId: string): Promise<any> {
    return this.makeRequest(`/structure/${structureId}`, { useStructureApi: true });
  }

  async getStructureElements(structureId: string, params: {
    issueKey?: string;
    maxResults?: number;
    startAt?: number;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.issueKey) queryParams.append('issueKey', params.issueKey);
    if (params.maxResults) queryParams.append('maxResults', params.maxResults.toString());
    if (params.startAt) queryParams.append('startAt', params.startAt.toString());
    
    const endpoint = `/structure/${structureId}/element${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.makeRequest(endpoint, { useStructureApi: true });
  }

  async getStructureHierarchy(structureId: string, params: {
    issueKey?: string;
    maxResults?: number;
    startAt?: number;
  } = {}): Promise<any> {
    const queryParams = new URLSearchParams();
    if (params.issueKey) queryParams.append('issueKey', params.issueKey);
    if (params.maxResults) queryParams.append('maxResults', params.maxResults.toString());
    if (params.startAt) queryParams.append('startAt', params.startAt.toString());
    
    // According to Structure API documentation, endpoints should follow the pattern:
    // GET /rest/structure/2.0/structure/{id}/hierarchy
    // GET /rest/structure/2.0/structure/{id}/element
    // 
    // However, /tree endpoint exists in version 1.0: /rest/structure/1/structure/{id}/tree
    // Let's try different endpoints and versions
    
    // First, try /tree endpoint with version 1 (without .0) - as found in user's curl command
    const endpoints = [
      { path: `/structure/${structureId}/tree`, version: 'latest' },    // Tree endpoint (latest version, like structure list)
      { path: `/structure/${structureId}/tree`, version: '1' },        // Tree endpoint (version 1, as in curl)
      { path: `/structure/${structureId}/tree`, version: '1.0' },      // Tree endpoint (version 1.0)
      { path: `/structure/${structureId}/tree`, version: '2.0' },       // Tree endpoint (version 2.0)
      { path: `/structure/${structureId}/hierarchy`, version: 'latest' },  // Standard hierarchy endpoint (latest)
      { path: `/structure/${structureId}/hierarchy`, version: '2.0' },  // Standard hierarchy endpoint
      { path: `/structure/${structureId}/element`, version: 'latest' },    // Standard element endpoint (latest)
      { path: `/structure/${structureId}/element`, version: '2.0' },    // Standard element endpoint  
      { path: `/structure/${structureId}/hierarchy?flat=false`, version: 'latest' },  // With flat parameter (latest)
      { path: `/structure/${structureId}/hierarchy?flat=false`, version: '2.0' },  // With flat parameter
      { path: `/structure/${structureId}/element?flat=false`, version: 'latest' },    // With flat parameter (latest)
      { path: `/structure/${structureId}/element?flat=false`, version: '2.0' },    // With flat parameter
    ];
    
    let lastError: any = null;
    
    for (const endpointInfo of endpoints) {
      const endpoint = endpointInfo.path.includes('?') 
        ? endpointInfo.path + (queryParams.toString() ? `&${queryParams}` : '')
        : `${endpointInfo.path}${queryParams.toString() ? `?${queryParams}` : ''}`;
      
      try {
        this.logger.debug(`Trying Structure API endpoint: /rest/structure/${endpointInfo.version}${endpoint}`);
        
        // For different versions, use appropriate base path
        let apiPath: string;
        if (endpointInfo.version === 'latest') {
          apiPath = '/rest/structure/latest';
        } else if (endpointInfo.version === '1') {
          apiPath = '/rest/structure/1';
        } else if (endpointInfo.version === '1.0') {
          apiPath = '/rest/structure/1.0';
        } else {
          apiPath = '/rest/structure/2.0';
        }
        const url = `${this.config.baseUrl}${apiPath}${endpoint}`;
        
        // Ensure session is initialized for cookie-based auth
        await this.ensureSession();
        
        const requestHeaders: Record<string, string> = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Enhanced-Jira-MCP-Server/2.0.0',
        };
        
        // Check if cookies are manually provided (session cookies mode)
        const usingManualCookies = !!process.env.JIRA_SESSION_COOKIES;

        // For /tree endpoint
        if (endpoint.includes('/tree')) {
          if (usingManualCookies) {
            // When using manual session cookies, only use cookies (no Bearer token)
            if (this.sessionCookies) {
              requestHeaders['Cookie'] = this.sessionCookies;

              // Extract CSRF token from cookies and add it to headers
              const csrfToken = this.extractCsrfToken(this.sessionCookies);
              if (csrfToken) {
                requestHeaders['X-Atlassian-Token'] = 'no-check';
                requestHeaders['X-XSRF-TOKEN'] = csrfToken;
                requestHeaders['X-Requested-With'] = 'XMLHttpRequest';
                this.logger.debug(`Using manual session cookies + CSRF token + AJAX headers for /tree endpoint`);
              } else {
                requestHeaders['X-Requested-With'] = 'XMLHttpRequest';
                this.logger.debug(`Using manual session cookies + AJAX headers for /tree endpoint (no CSRF token found)`);
              }
            }
          } else {
            // Use Bearer token + cookies (cookies were obtained from /tree with Bearer token)
            requestHeaders['Authorization'] = this.authHeader;
            if (this.sessionCookies) {
              requestHeaders['Cookie'] = this.sessionCookies;
              this.logger.debug(`Using Bearer token + cookies for /tree endpoint`);
            } else {
              this.logger.debug(`Using Bearer token only for /tree endpoint (no cookies available)`);
            }
          }
        } else {
          // For other endpoints, use Bearer token or cookies
          if (this.sessionCookies) {
            requestHeaders['Cookie'] = this.sessionCookies;
          }
          requestHeaders['Authorization'] = this.authHeader;
        }
        
        await this.rateLimiter.waitForSlot();
        
        // For /tree endpoint, use 'manual' redirect like during session initialization
        // This helps with cookie handling and redirects
        const redirectMode = endpoint.includes('/tree') ? 'manual' as const : 'follow' as const;
        
        let response = await fetch(url, {
          method: 'GET',
          headers: requestHeaders,
          redirect: redirectMode,
        });
        
        // Handle manual redirects for /tree endpoint
        if (redirectMode === 'manual' && response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          
          // Update cookies if set in redirect response
          const setCookieHeader = response.headers.get('set-cookie');
          if (setCookieHeader) {
            // Parse and merge new cookies with existing ones
            const cookieArray: string[] = [];
            const cookieStrings = setCookieHeader.split(',').map(c => c.trim());
            
            for (let i = 0; i < cookieStrings.length; i++) {
              let cookie = cookieStrings[i];
              if (i > 0 && !cookie.includes('=')) {
                continue;
              }
              const cookiePart = cookie.split(';')[0].trim();
              if (cookiePart.includes('=')) {
                cookieArray.push(cookiePart);
              }
            }
            
            if (cookieArray.length > 0) {
              const newCookies = cookieArray.join('; ');
              if (this.sessionCookies) {
                // Merge with existing cookies
                const existingCookies = this.sessionCookies.split('; ').map(c => c.trim());
                const allCookies = [...existingCookies, ...newCookies];
                this.sessionCookies = allCookies.join('; ');
              } else {
                this.sessionCookies = newCookies;
              }
              requestHeaders['Cookie'] = this.sessionCookies;
              this.logger.debug(`Updated cookies from redirect response`);
            }
          }
          
          // If redirect is to login page, this endpoint doesn't work with current auth
          if (location && location.includes('login.jsp')) {
            this.logger.debug(`Redirect to login page detected - trying next endpoint`);
            lastError = new Error('Redirect to login page');
            continue;
          }
          
          if (location) {
            // Resolve relative URLs
            const redirectUrl = location.startsWith('http') 
              ? location 
              : `${this.config.baseUrl}${location}`;
            this.logger.debug(`Following redirect to: ${redirectUrl}`);
            
            // Follow redirect with updated cookies
            response = await fetch(redirectUrl, {
              method: 'GET',
              headers: requestHeaders,
              redirect: 'follow',
            });
          }
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          // Check if it's HTML (might be a redirect page)
          if (errorText.trim().startsWith('<')) {
            this.logger.debug(`Received HTML response (likely redirect), status: ${response.status} - trying next endpoint`);
            // Try to follow redirect or check Location header
            const location = response.headers.get('location');
            if (location) {
              this.logger.debug(`Redirect location: ${location}`);
            }
            // Treat HTML response as endpoint failure, try next endpoint
            lastError = new Error(`Received HTML instead of JSON (status: ${response.status})`);
            continue;
          }
          // For non-HTML errors, check if it's 404 (try next endpoint) or throw
          if (response.status === 404) {
            this.logger.debug(`404 error from ${endpointInfo.version}${endpoint} - trying next endpoint`);
            lastError = new Error(`404 Not Found`);
            continue;
          }
          throw new JiraError(
            `Jira API error: ${response.status} ${response.statusText}`,
            response.status,
            errorText
          );
        }
        
        const responseText = await response.text();
        if (!responseText) {
          return { elements: [] };
        }
        
        // Check if response is JSON
        if (responseText.trim().startsWith('<')) {
          this.logger.debug(`Received HTML instead of JSON from ${endpointInfo.version}${endpoint} - trying next endpoint`);
          // Treat HTML response as endpoint failure, try next endpoint
          lastError = new Error('Received HTML instead of JSON');
          continue;
        }
        
        const result = JSON.parse(responseText);
        this.logger.debug(`Successfully got result from /rest/structure/${endpointInfo.version}${endpoint}`);
        return result;
      } catch (error: any) {
        lastError = error;
        this.logger.debug(`Endpoint /rest/structure/${endpointInfo.version}${endpoint} failed: ${error?.statusCode || error?.message}`);
        // If it's a 404 or HTML response, try next endpoint
        if (error?.statusCode === 404 || 
            error?.message?.includes('404') || 
            error?.message?.includes('Not Found') ||
            error?.message?.includes('HTML instead of JSON') ||
            error?.message?.includes('Received HTML')) {
          continue;
        }
        // For other errors, throw immediately (real error, not endpoint issue)
        throw error;
      }
    }
    
    // All endpoints returned 404 - structure might not exist, be empty, or require different access
    // Return empty result instead of throwing error (404 is handled as "no data")
    this.logger.debug(`All endpoints returned 404 for structure ${structureId}, returning empty result`);
    return { elements: [] };
  }

  private extractCsrfToken(cookies: string): string | null {
    // Extract CSRF token from atlassian.xsrf.token cookie
    const match = cookies.match(/atlassian\.xsrf\.token=([^;]+)/);
    return match ? match[1] : null;
  }
}