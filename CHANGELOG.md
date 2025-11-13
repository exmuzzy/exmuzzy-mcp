# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CONTRIBUTING.md with development guidelines
- .env.example with environment variable examples
- Improved project structure with organized folders:
  - `scripts/` - build and deployment scripts
  - `config/` - configuration files
  - `test/` - test files and utilities
  - `docs/` - documentation files

### Changed
- Reorganized project structure for better maintainability
- Moved documentation files to `docs/` folder
- Moved test scripts to `test/` folder
- Moved configuration files to `config/` folder
- Moved build scripts to `scripts/` folder

## [1.0.8] - 2025-11-13

### Added
- Optimized issue retrieval with `get_my_issues_grouped()` function
- Enhanced error handling and logging
- New utility functions for issue tracking and resolution generation
- Improved API compatibility with Bearer tokens

### Changed
- Updated API endpoints to use v2 for Bearer token compatibility
- Improved authentication methods (Bearer token, session cookies)
- Enhanced TypeScript types and interfaces

### Fixed
- Cookie authentication issues
- API compatibility problems with different Jira instances

## [1.0.2] - 2025-10-28

### Added
- Initial MCP (Model Context Protocol) server implementation
- Jira integration with issue management capabilities
- Basic authentication support (email + API token)
- Project and board operations
- Worklog management
- User management features

### Changed
- Migrated from original jira-mcp-server fork
- Updated dependencies and build process

### Fixed
- Initial bug fixes and stability improvements
