# CI/CD Pipeline Documentation

This document explains the Continuous Integration/Continuous Deployment (CI/CD) pipeline setup for the D&D Bot project.

## 🚀 Overview

The CI/CD pipeline automatically runs when code is pushed to the `master` or `main` branch, or when pull requests are created. It ensures code quality, security, and proper formatting.

## 📋 Pipeline Steps

### 1. Code Quality Check
- **TypeScript Compilation**: Ensures all TypeScript code compiles without errors
- **ESLint**: Checks for code style, unused imports, and potential issues
- **Prettier**: Verifies code formatting consistency
- **Security Audit**: Checks for known vulnerabilities in dependencies
- **Build Process**: Ensures the project builds successfully

### 2. Docker Build (Optional)
- **Docker Build**: Builds Docker image if Dockerfile exists
- **Docker Test**: Tests the built Docker image

### 3. Status Summary
- Provides a comprehensive summary of all checks
- Shows which checks passed or failed

## 🛠️ Local Development

### Prerequisites
```bash
# Install dependencies
bun install

# Install dev dependencies for linting
bun add -D @eslint/js @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint eslint-plugin-unused-imports prettier
```

### Available Scripts

#### Code Quality
```bash
# TypeScript type checking
bun run type-check

# ESLint checking
bun run lint

# ESLint with auto-fix
bun run lint:fix

# Prettier formatting
bun run format

# Prettier format checking
bun run format:check

# Security audit
bun run audit
```

#### Build and Test
```bash
# Build the project
bun run build

# Run tests (placeholder)
bun run test

# Run tests in watch mode (placeholder)
bun run test:watch

# Generate coverage (placeholder)
bun run coverage
```

#### Combined Checks
```bash
# Run all CI checks locally
bun run ci

# Clean build artifacts
bun run clean
```

## 📁 Configuration Files

### ESLint Configuration (`eslint.config.js`)
- TypeScript-specific rules
- Unused imports detection
- Code quality rules
- Import ordering

### Prettier Configuration (`.prettierrc`)
- Consistent code formatting
- 80 character line width
- Single quotes
- Trailing commas

### GitHub Actions (`.github/workflows/ci.yml`)
- Automated CI/CD pipeline
- Runs on push to master/main
- Runs on pull requests
- Multiple parallel jobs

## 🔧 Customization

### Adding New Checks

1. **Add ESLint Rules**: Edit `eslint.config.js`
2. **Add Prettier Rules**: Edit `.prettierrc`
3. **Add GitHub Actions Steps**: Edit `.github/workflows/ci.yml`
4. **Add Package Scripts**: Edit `package.json` scripts section

### Example: Adding a New Lint Rule

```javascript
// In eslint.config.js
rules: {
  // Add your custom rule
  'your-custom-rule': 'error',
}
```

### Example: Adding a New GitHub Action Step

```yaml
# In .github/workflows/ci.yml
- name: Your Custom Check
  run: your-custom-command
```

## 🚨 Troubleshooting

### Common Issues

1. **ESLint Errors**
   ```bash
   # Fix auto-fixable issues
   bun run lint:fix
   
   # Check specific file
   bunx eslint src/your-file.ts
   ```

2. **Prettier Issues**
   ```bash
   # Format all files
   bun run format
   
   # Check formatting
   bun run format:check
   ```

3. **TypeScript Errors**
   ```bash
   # Check TypeScript compilation
   bun run type-check
   ```

4. **Security Issues**
   ```bash
   # Check for vulnerabilities
   bun run audit
   ```

### GitHub Actions Debugging

1. **Check Workflow Logs**: Go to Actions tab in GitHub
2. **Re-run Failed Jobs**: Use "Re-run jobs" button
3. **Local Testing**: Run `bun run ci` locally first

## 📊 Monitoring

### GitHub Actions Dashboard
- View all workflow runs
- Check individual job logs
- Monitor build times
- Track success/failure rates

### Code Quality Metrics
- TypeScript compilation success
- ESLint rule violations
- Prettier formatting issues
- Security vulnerabilities

## 🔄 Workflow Triggers

The pipeline runs automatically on:
- ✅ Push to `master` branch
- ✅ Push to `main` branch
- ✅ Pull requests to `master` branch
- ✅ Pull requests to `main` branch

## 📈 Benefits

1. **Code Quality**: Ensures consistent code style and quality
2. **Early Detection**: Catches issues before they reach production
3. **Automation**: Reduces manual review burden
4. **Security**: Identifies vulnerabilities in dependencies
5. **Documentation**: Provides clear feedback on code issues

## 🎯 Best Practices

1. **Run Locally First**: Always run `bun run ci` before pushing
2. **Fix Issues Early**: Address linting and formatting issues promptly
3. **Keep Dependencies Updated**: Regularly run `bun run audit`
4. **Monitor Build Times**: Optimize if builds become too slow
5. **Document Changes**: Update this README when adding new checks

## 📞 Support

If you encounter issues with the CI/CD pipeline:

1. Check the GitHub Actions logs
2. Run the checks locally first
3. Review the configuration files
4. Update dependencies if needed
5. Contact the development team

---

**Note**: This pipeline is designed to be lightweight and fast while ensuring code quality. It can be extended with additional checks as needed. 