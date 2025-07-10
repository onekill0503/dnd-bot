# Code Organization Improvements

This document outlines the improvements made to organize the D&D Bot codebase for better maintainability, type safety, and code reusability.

## 🏗️ New File Structure

### Types Organization
- **`src/types/enums.ts`** - All application enums
- **`src/types/elevenlabs.ts`** - ElevenLabs-specific types and interfaces
- **`src/types/index.ts`** - Main types with re-exports from other type files

### Constants Organization
- **`src/constants/app.ts`** - General application constants
- **`src/constants/elevenlabs.ts`** - ElevenLabs-specific constants
- **`src/constants/index.ts`** - Re-exports all constants

### Utilities Organization
- **`src/utils/commonUtils.ts`** - Common utility functions used across the app
- **`src/utils/elevenlabsUtils.ts`** - ElevenLabs-specific utility functions
- **`src/utils/index.ts`** - Re-exports all utilities

## 🔧 Key Improvements

### 1. Enum Usage
Replaced string literals with proper enums for better type safety:

```typescript
// Before
status: 'alive' | 'dead' | 'unconscious'
status: 'character_creation' | 'active' | 'ended'

// After
status: PlayerStatus.ALIVE | PlayerStatus.DEAD | PlayerStatus.UNCONSCIOUS
status: SessionStatus.CHARACTER_CREATION | SessionStatus.ACTIVE | SessionStatus.ENDED
```

### 2. Type Separation
- Moved ElevenLabs types to dedicated file
- Created proper interfaces for all service parameters
- Removed duplicate type definitions

### 3. Constants Centralization
- Moved hardcoded values to constants files
- Created reusable constants for common values
- Organized constants by domain (app, elevenlabs)

### 4. Utility Functions
- Extracted common functions to `commonUtils.ts`
- Created domain-specific utilities in `elevenlabsUtils.ts`
- Removed repetitive code across services

### 5. Import Organization
- Used type-only imports where appropriate
- Organized imports by category (types, constants, utilities)
- Created index files for clean re-exports

## 📁 File Changes

### New Files Created
- `src/types/enums.ts` - Application enums
- `src/types/elevenlabs.ts` - ElevenLabs types
- `src/constants/app.ts` - App constants
- `src/constants/elevenlabs.ts` - ElevenLabs constants
- `src/utils/commonUtils.ts` - Common utilities
- `src/utils/elevenlabsUtils.ts` - ElevenLabs utilities
- `src/constants/index.ts` - Constants re-exports
- `src/utils/index.ts` - Utilities re-exports

### Files Updated
- `src/types/index.ts` - Updated to use enums and re-export types
- `src/config/config.ts` - Updated to use constants and enums
- `src/services/elevenLabsTts.ts` - Refactored to use new types and utilities
- `src/services/ttsAi.ts` - Updated to use new types
- `src/services/openai.ts` - Updated to use enums and utilities
- `src/services/sessionManager.ts` - Updated to use enums

### Files Removed
- `src/utils/languageUtils.ts` - Functionality moved to `elevenlabsUtils.ts`

## 🎯 Benefits

1. **Type Safety**: Proper enums prevent invalid string values
2. **Maintainability**: Centralized constants and types are easier to update
3. **Reusability**: Common utilities can be used across the application
4. **Organization**: Clear separation of concerns with dedicated files
5. **Consistency**: Standardized patterns across all services
6. **Documentation**: Better code structure makes it easier to understand

## 🔄 Migration Notes

- All string literals for status values now use enums
- Hardcoded values moved to constants
- Duplicate functions consolidated into utilities
- Type imports use `import type` for better performance
- Services now use organized imports from index files

## 📋 Usage Examples

### Using Enums
```typescript
import { PlayerStatus, SessionStatus } from '../types/enums';

// Instead of 'alive'
character.status = PlayerStatus.ALIVE;

// Instead of 'active'
session.status = SessionStatus.ACTIVE;
```

### Using Constants
```typescript
import { DEFAULT_LANGUAGE, EXPRESSION_TAGS } from '../constants';

// Instead of hardcoded values
const language = DEFAULT_LANGUAGE;
const tags = EXPRESSION_TAGS;
```

### Using Utilities
```typescript
import { randomInt, calculateModifier, formatCurrency } from '../utils';

// Common functions now available
const roll = randomInt(1, 20);
const modifier = calculateModifier(16);
const display = formatCurrency(currency);
```

This organization makes the codebase more maintainable, type-safe, and easier to extend with new features. 