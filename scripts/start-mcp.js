#!/usr/bin/env node
// Node.js wrapper to start @exmuzzy/jira-mcp via npx
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';

const NPX_DIR = path.join(os.homedir(), '.npm', '_npx');

// Try to find installed package
function findPackage() {
  try {
    const files = execSync(`find "${NPX_DIR}" -path "*/@exmuzzy/jira-mcp/bin/jira-mcp.js" 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (files) {
      const packagePath = files.split('\n')[0];
      if (fs.existsSync(packagePath)) {
        return packagePath;
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return null;
}

// Main function
async function main() {
  // Try to find package first
  let packagePath = findPackage();
  
  if (packagePath) {
    // Package found, import it
    await import('file://' + packagePath);
  } else {
    // Package not found, install it
    try {
      execSync('npx -y @exmuzzy/jira-mcp', { stdio: 'ignore' });
      // Wait a bit for installation
      await new Promise(resolve => setTimeout(resolve, 2000));
      packagePath = findPackage();
      
      if (packagePath) {
        await import('file://' + packagePath);
      } else {
        // Fallback: try to run via npx directly
        const proc = spawn('npx', ['-y', '@exmuzzy/jira-mcp'], { stdio: 'inherit' });
        proc.on('exit', (code) => process.exit(code || 0));
      }
    } catch (e) {
      // Fallback: try to run via npx directly
      const proc = spawn('npx', ['-y', '@exmuzzy/jira-mcp'], { stdio: 'inherit' });
      proc.on('exit', (code) => process.exit(code || 0));
    }
  }
}

main().catch((error) => {
  console.error('Error starting MCP server:', error);
  process.exit(1);
});
