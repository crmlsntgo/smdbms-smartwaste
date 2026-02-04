const fs = require('fs');
const path = require('path');

// Simple usage: node convert.js <inputFile> <outputFile> <ComponentName>
const [,, inputFile, outputFile, ComponentName] = process.argv;

if (!inputFile || !outputFile || !ComponentName) {
  console.log('Usage: node convert.js <inputFile> <outputFile> <ComponentName>');
  process.exit(1);
}

const html = fs.readFileSync(inputFile, 'utf8');

// 1. Extract content: Try to find 'dashboard-content' or fallback to body
let content = '';
const contentMatch = html.match(/<div class=["']dashboard-content["']>([\s\S]*?)<\/div>\s*<\/main>/);
// If main content wrapper found, use it. Else fallback to body
if (contentMatch) {
    content = '<div className="dashboard-content">\n' + contentMatch[1] + '\n</div>';
} else {
    // try body
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    content = bodyMatch ? bodyMatch[1] : html;
}

// 2. JSX Replacements

// Replace class -> className
content = content.replace(/\bclass=/g, 'className=');

// Close self-closing tags
const selfClosing = ['input', 'img', 'br', 'hr', 'link', 'meta'];
selfClosing.forEach(tag => {
    // Regex to find <tag ... > (without /)
    const regex = new RegExp(`<${tag}([^>]*?)(?<!/)>`, 'gi');
    content = content.replace(regex, `<${tag}$1 />`);
});

// Style tag handling: style="width: 10px; color: red" -> style={{width: '10px', color: 'red'}}
// This is hard to do perfectly with regex but we can do a best effort or just warn.
// For now, simpler: style="...". Update: React style expects object.
// We'll leave style="..." and add a comment that it needs manual fix, or try to fix simple cases.
content = content.replace(/style="([^"]*)"/g, (match, items) => {
    // naive parse
    const objInner = items.split(';').map(s => {
        const [k, v] = s.split(':');
        if (!k || !v) return '';
        const camelK = k.trim().replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        return `${camelK}: '${v.trim()}'`;
    }).filter(x=>x).join(', ');
    return `style={{${objInner}}}`;
});


// Comments <!-- --> to {/* */}
content = content.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');

// Remove script tags (we don't want them in JSX usually, or we comment them out)
content = content.replace(/<script[\s\S]*?<\/script>/g, '{/* Script removed: logic requires React hook migration */}');

// 3. Wrap in Component
const template = `import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'

export default function ${ComponentName}() {
  useEffect(() => {
    // TODO: Migrate page specific logic here
  }, [])

  return (
    <div>
      <Header />
      <div className="dashboard-wrapper">
        <Sidebar />
        <main className="main-content">
          ${content}
        </main>
      </div>
    </div>
  )
}
`;

// Ensure output dir exists
const outDir = path.dirname(outputFile);
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outputFile, template);

console.log(`Converted ${inputFile} to ${outputFile}`);
console.log(`Note: Review the generated JSX. Styles and event listeners need manual verification.`);
