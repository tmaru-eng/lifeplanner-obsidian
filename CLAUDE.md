# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LifePlanner is an Obsidian plugin for life planning and management, implementing the 7 Habits framework. It provides a comprehensive UI for managing weekly plans, goals, action plans, exercises, and various life planning components.

## Architecture

### High-Level Structure

```
LifePlannerPlugin (main.ts)
├── UI Layer (src/ui/)
│   ├── DashboardView - Main dashboard with multiple sections
│   ├── WeeklyPlanView - Weekly planning interface
│   ├── GoalsView - Goal management with nesting
│   ├── GoalTaskView - Task management linked to goals
│   ├── ExercisesView - Exercise sheets management
│   ├── InboxView - Inbox items management
│   ├── IssuesView - Issues tracking
│   ├── SimpleSectionView - Simple text sections (Mission, etc.)
│   └── TableSectionView - Table-based sections (Values, Have/Do/Be, Promise)
├── Services Layer (src/services/)
│   ├── *Service classes for each view type
│   ├── Template handling
│   ├── Markdown I/O operations
│   └── Data processing
├── Models Layer (src/models/)
│   └── Data models (Goal, Task, WeeklyPlan, etc.)
└── Storage & Settings
```

### Key Components

1. **Main Plugin Class**: `LifePlannerPlugin` in `src/main.ts`
   - Extends Obsidian's `Plugin` class
   - Registers all view types
   - Manages plugin lifecycle
   - Handles settings

2. **View Types System**: `src/ui/view_types.ts`
   - Defines all view type constants
   - Type-safe view type union

3. **UI Components**:
   - DashboardView: Main entry point with configurable sections
   - WeeklyPlanView: Complex weekly planning interface
   - GoalsView: Hierarchical goal management
   - Various specialized views for different 7 Habits components

4. **Service Layer**:
   - Follows separation of concerns pattern
   - Each view has corresponding service
   - Handles data processing and business logic
   - Markdown I/O operations for persistence

5. **Data Models**:
   - Simple TypeScript interfaces
   - Represent domain entities (Goal, Task, etc.)

## Build System

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Deploy (build + copy to Obsidian plugins directory)
./scripts/build-deploy.sh
```

## Development Commands

- `npm run build`: Compiles TypeScript using esbuild
- `npm run deploy`: Builds and deploys to Obsidian plugins directory
- Manual testing in Obsidian after deployment

## Important Files

1. **Entry Point**: `src/main.ts` - Plugin initialization and view registration
2. **Configuration**: `src/settings.ts` - Settings management and defaults
3. **UI Core**: `src/ui/dashboard_view.ts` - Main dashboard implementation
4. **Weekly Planning**: `src/ui/weekly_plan_view.ts` - Complex weekly plan interface
5. **Goal Management**: `src/ui/goals_view.ts` - Hierarchical goal system

## View Registration Pattern

The plugin uses a consistent pattern for view registration:

```typescript
// Simple view registration
this.registerView(VIEW_TYPE, (leaf) => new ViewClass(leaf, this));

// Table-based view registration with column configuration
this.registerView(
  VIEW_TYPE,
  (leaf) => new TableSectionView(leaf, this, VIEW_TYPE, "Title", "Japanese Title", [
    { label: "Column 1", type: "text", width: "minmax(160px, 1.2fr)" },
    { label: "Column 2", type: "text", width: "minmax(220px, 2.8fr)", multiline: true }
  ])
);
```

## Settings Management

- Default settings defined in `DEFAULT_SETTINGS`
- Settings migration logic in `loadSettings()`
- Dashboard section configuration is validated against allowed view types
- Backward compatibility maintained for deprecated settings

## Development Notes

1. **View Types**: All view types are centrally defined in `src/ui/view_types.ts`
2. **Internationalization**: Views support both English and Japanese titles
3. **State Management**: Uses Obsidian's workspace leaf system
4. **Persistence**: Data stored as Markdown files with frontmatter
5. **Styling**: Global styles in `styles.css`

## Testing

- Manual testing in Obsidian environment
- No automated test suite currently configured
- Test data can be created through UI interaction

## Release Process

1. Build the plugin
2. Create zip package
3. Update version in manifest.json
4. Create GitHub release with assets