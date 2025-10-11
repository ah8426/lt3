#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Dependency Audit Script
 * Identifies potentially unused dependencies in the project
 */

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

// Common patterns to search for
const searchPatterns = [
  // Import patterns
  /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Dynamic imports
  /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // TypeScript imports
  /import\s+type\s+.*\s+from\s+['"]([^'"]+)['"]/g,
];

// Directories to search
const searchDirs = [
  'app',
  'components',
  'lib',
  'hooks',
  'types',
  'tests',
  'scripts',
];

// Files to exclude
const excludePatterns = [
  /node_modules/,
  /\.git/,
  /\.next/,
  /dist/,
  /build/,
];

// Dependencies that are commonly used but hard to detect
const commonDependencies = [
  'react',
  'react-dom',
  'next',
  'typescript',
  'eslint',
  'prettier',
  'tailwindcss',
  'postcss',
  'autoprefixer',
];

// Dependencies that are used in config files
const configDependencies = [
  'next',
  'typescript',
  'eslint',
  'prettier',
  'tailwindcss',
  'postcss',
  'autoprefixer',
  'vitest',
  'playwright',
  '@playwright/test',
  '@vitest/ui',
  'prisma',
  '@prisma/client',
];

function getAllFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!excludePatterns.some(pattern => pattern.test(fullPath))) {
        getAllFiles(fullPath, files);
      }
    } else if (stat.isFile()) {
      if (item.endsWith('.ts') || item.endsWith('.tsx') || item.endsWith('.js') || item.endsWith('.jsx') || item.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

function findImports(content) {
  const imports = new Set();
  
  for (const pattern of searchPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      
      // Extract package name from import path
      const packageName = importPath.split('/')[0];
      
      // Handle scoped packages
      if (packageName.startsWith('@')) {
        const parts = importPath.split('/');
        if (parts.length >= 2) {
          imports.add(`${parts[0]}/${parts[1]}`);
        }
      } else {
        imports.add(packageName);
      }
    }
  }
  
  return imports;
}

function auditDependencies() {
  console.log('🔍 Auditing dependencies...\n');
  
  const allFiles = [];
  for (const dir of searchDirs) {
    if (fs.existsSync(dir)) {
      getAllFiles(dir, allFiles);
    }
  }
  
  console.log(`📁 Found ${allFiles.length} files to analyze\n`);
  
  const usedDependencies = new Set();
  
  // Add common dependencies that are always used
  commonDependencies.forEach(dep => usedDependencies.add(dep));
  
  // Add config dependencies
  configDependencies.forEach(dep => usedDependencies.add(dep));
  
  // Analyze each file
  for (const file of allFiles) {
    try {
      const content = fs.readFileSync(file, 'utf8');
      const imports = findImports(content);
      
      imports.forEach(imp => usedDependencies.add(imp));
    } catch (error) {
      console.warn(`⚠️  Could not read file: ${file}`);
    }
  }
  
  // Find unused dependencies
  const unusedDependencies = [];
  const potentiallyUnused = [];
  
  for (const [depName, version] of Object.entries(dependencies)) {
    if (!usedDependencies.has(depName)) {
      // Check if it's a dev dependency that might be used in scripts
      if (packageJson.devDependencies && packageJson.devDependencies[depName]) {
        potentiallyUnused.push({ name: depName, version, type: 'dev' });
      } else {
        unusedDependencies.push({ name: depName, version, type: 'prod' });
      }
    }
  }
  
  // Report results
  console.log('📊 Audit Results:\n');
  
  if (unusedDependencies.length === 0 && potentiallyUnused.length === 0) {
    console.log('✅ All dependencies appear to be used!');
    return;
  }
  
  if (unusedDependencies.length > 0) {
    console.log('🚨 Potentially Unused Production Dependencies:');
    unusedDependencies.forEach(dep => {
      console.log(`   - ${dep.name}@${dep.version}`);
    });
    console.log();
  }
  
  if (potentiallyUnused.length > 0) {
    console.log('⚠️  Potentially Unused Dev Dependencies:');
    potentiallyUnused.forEach(dep => {
      console.log(`   - ${dep.name}@${dep.version}`);
    });
    console.log();
  }
  
  // Generate removal commands
  if (unusedDependencies.length > 0) {
    console.log('🗑️  Commands to remove unused dependencies:');
    console.log('npm uninstall ' + unusedDependencies.map(dep => dep.name).join(' '));
    console.log();
  }
  
  if (potentiallyUnused.length > 0) {
    console.log('🗑️  Commands to remove potentially unused dev dependencies:');
    console.log('npm uninstall ' + potentiallyUnused.map(dep => dep.name).join(' '));
    console.log();
  }
  
  // Summary
  console.log('📈 Summary:');
  console.log(`   Total dependencies: ${Object.keys(dependencies).length}`);
  console.log(`   Used dependencies: ${usedDependencies.size}`);
  console.log(`   Unused production: ${unusedDependencies.length}`);
  console.log(`   Potentially unused dev: ${potentiallyUnused.length}`);
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  console.log('1. Review the unused dependencies before removing them');
  console.log('2. Some dependencies might be used in ways not detected by this script');
  console.log('3. Test thoroughly after removing dependencies');
  console.log('4. Consider using tools like "depcheck" for more comprehensive analysis');
}

// Run the audit
auditDependencies();
