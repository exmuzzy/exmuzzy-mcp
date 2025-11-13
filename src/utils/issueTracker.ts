import { Logger } from './logger.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class IssueTracker {
  private logger: Logger;
  private readonly trackerFile: string;

  constructor() {
    this.logger = new Logger('IssueTracker');
    // Store tracker file in user's home directory or temp directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    this.trackerFile = path.join(homeDir, '.jira-mcp-last-issue.json');
  }

  /**
   * Track an issue as the last viewed issue
   */
  trackIssue(issueKey: string): void {
    try {
      const data = {
        issueKey,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(this.trackerFile, JSON.stringify(data, null, 2), 'utf-8');
      this.logger.debug(`Tracked issue: ${issueKey}`);
    } catch (error) {
      this.logger.error(`Failed to track issue ${issueKey}:`, error);
    }
  }

  /**
   * Get the last viewed issue
   */
  getLastIssue(): string | null {
    try {
      if (!fs.existsSync(this.trackerFile)) {
        return null;
      }

      const data = JSON.parse(fs.readFileSync(this.trackerFile, 'utf-8'));
      return data.issueKey || null;
    } catch (error) {
      this.logger.error('Failed to read last issue:', error);
      return null;
    }
  }

  /**
   * Clear the tracked issue
   */
  clearLastIssue(): void {
    try {
      if (fs.existsSync(this.trackerFile)) {
        fs.unlinkSync(this.trackerFile);
      }
    } catch (error) {
      this.logger.error('Failed to clear last issue:', error);
    }
  }
}





















