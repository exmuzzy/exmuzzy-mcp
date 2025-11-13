# Contributing to Jira MCP Server

Thank you for your interest in contributing to the Jira MCP Server! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn
- Git

### Installation

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/exmuzzy-mcp.git
   cd exmuzzy-mcp
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Jira credentials
   ```

5. Build the project:
   ```bash
   npm run build
   ```

### Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards
3. Test your changes:
   ```bash
   npm run build
   npm start
   ```

4. Commit your changes:
   ```bash
   git add .
   git commit -m "feat: description of your changes"
   ```

5. Push and create a pull request

## Coding Standards

### Code Style

- Use TypeScript for all new code
- Follow ESLint and Prettier configurations
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Commit Messages

Follow conventional commit format:
- `feat:` - new features
- `fix:` - bug fixes
- `docs:` - documentation changes
- `refactor:` - code refactoring
- `test:` - test additions/modifications
- `chore:` - maintenance tasks

### Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test both unit and integration functionality

## Project Structure

```
├── src/                    # Source code
│   ├── services/          # Business logic services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   └── index.ts           # Main entry point
├── test/                  # Test files and utilities
├── scripts/               # Build and deployment scripts
├── config/                # Configuration files
├── docs/                  # Documentation
└── dist/                  # Compiled output
```

## API Design Guidelines

### Services

- Each service should have a single responsibility
- Use dependency injection where appropriate
- Handle errors gracefully with proper logging

### Types

- Define interfaces for all data structures
- Use union types for variant data
- Export types that may be used by consumers

### Error Handling

- Use custom error classes for specific error types
- Provide meaningful error messages
- Log errors appropriately

## Pull Request Process

1. Ensure your code follows the coding standards
2. Update documentation if needed
3. Add tests for new functionality
4. Ensure CI passes
5. Request review from maintainers

## Getting Help

- Check existing issues and documentation
- Create an issue for bugs or feature requests
- Join discussions in GitHub discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
