# Command Parser and Validator

This module provides command parsing and validation services for the Kiro-WhatsApp integration.

## Overview

The command system consists of three main services:

1. **CommandParserService** - Parses raw text messages into structured command objects
2. **CommandValidatorService** - Validates parsed commands against business rules
3. **CommandService** - Combines parsing and validation into a single interface

## Supported Commands

### FILE_READ
Read the contents of a file.

**Syntax:**
- `read <path>`
- `show <path>`
- `cat <path>`
- `file <path>`
- `open <path>`

**Example:**
```
read src/index.ts
show README.md
```

### FILE_LIST
List files in a directory.

**Syntax:**
- `list [directory]`
- `ls [directory]`
- `dir [directory]`
- `files [directory]`

**Example:**
```
list src
ls
dir backend/src
```

### SEARCH
Search for text in the workspace.

**Syntax:**
- `search <query>`
- `find <query>`
- `grep <query>`
- `search <query> in <pattern>`
- `find <query> pattern:<pattern>`

**Example:**
```
search TODO
find function in *.ts
grep error pattern:*.log
```

### STATUS
Get workspace status information.

**Syntax:**
- `status`
- `workspace`
- `info`

### HELP
Display help information.

**Syntax:**
- `help`
- `commands`
- `?`

## Usage

### Basic Usage (Combined Parsing and Validation)

```typescript
import { CommandService } from './services';

const commandService = new CommandService();

// Process a message
const result = commandService.process('read src/index.ts');

if (result.success && result.command) {
  console.log('Command type:', result.command.type);
  console.log('Command:', result.command);
} else {
  console.error('Error:', result.error);
  if (result.validationErrors) {
    console.error('Validation errors:', result.validationErrors);
  }
}
```

### Separate Parsing and Validation

```typescript
import { CommandService } from './services';

const commandService = new CommandService();

// Parse only
const parseResult = commandService.parse('search TODO');
if (parseResult.success && parseResult.command) {
  console.log('Parsed command:', parseResult.command);
  
  // Validate separately
  const validationResult = commandService.validate(parseResult.command);
  if (!validationResult.valid) {
    console.error('Validation errors:', validationResult.errors);
  }
}
```

## Validation Rules

### Path Validation (FILE_READ, FILE_LIST)
- Maximum length: 500 characters
- No absolute paths (e.g., `/path`, `C:\path`)
- No path traversal (e.g., `../`)
- No invalid characters (e.g., `<`, `>`, `:`, `|`, `?`, `*`)

### Search Query Validation (SEARCH)
- Minimum length: 2 characters
- Maximum length: 200 characters
- Pattern (if provided) must be valid regex
- Pattern maximum length: 200 characters

## Error Handling

The system provides detailed error messages for:
- Unknown commands
- Invalid syntax
- Validation failures
- Security violations (path traversal, absolute paths)

## Examples

### Valid Commands

```typescript
// File operations
commandService.process('read package.json');
commandService.process('list src');
commandService.process('show README.md');

// Search operations
commandService.process('search TODO');
commandService.process('find error in *.log');

// Status and help
commandService.process('status');
commandService.process('help');
```

### Invalid Commands

```typescript
// Path traversal - REJECTED
commandService.process('read ../../../etc/passwd');

// Absolute path - REJECTED
commandService.process('read /etc/passwd');
commandService.process('read C:\\Windows\\System32');

// Query too short - REJECTED
commandService.process('search a');

// Invalid regex pattern - REJECTED
commandService.process('search test pattern:[invalid(');
```

## Integration with WhatsApp Handler

```typescript
import { CommandService } from './services';

const commandService = new CommandService();

async function handleWhatsAppMessage(message: string, userId: string) {
  // Process the command
  const result = commandService.process(message);
  
  if (!result.success) {
    // Send error message back to user
    await sendWhatsAppMessage(userId, result.error || 'Invalid command');
    if (result.validationErrors) {
      await sendWhatsAppMessage(userId, result.validationErrors.join('\n'));
    }
    return;
  }
  
  // Execute the command
  const commandResult = await executeCommand(result.command);
  await sendWhatsAppMessage(userId, commandResult);
}
```
