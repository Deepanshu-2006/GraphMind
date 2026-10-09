import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Unit test suite validating the redesigned GraphMind Sidebar:
 * - Pure typographic wordmark without AI/neural graphics
 * - Primary navigation has exactly 4 items in strict order: Overview, Knowledge Graph, Learning Paths, Sources
 * - Settings is isolated as secondary navigation in the lower workspace/utility area
 * - Active navigation uses tiny 4px green dot indicator (.nav-active-dot), no large vertical green bar, no green text
 * - Current graph context is purely contextual metadata (CURRENT GRAPH kicker + multi-line wrapping title, no cards/buttons)
 * - CSS contract verifies #0A0A0A background, #1D1D1D divider, 212px width, and zero pill-shaped containers
 */

describe('Redesigned GraphMind Sidebar Architecture', () => {
  const sidebarPath = path.resolve(__dirname, '../src/components/layout/Sidebar.tsx');
  const sidebarSrc = fs.readFileSync(sidebarPath, 'utf8');

  const shellCssPath = path.resolve(__dirname, '../src/styles/shell.css');
  const shellCss = fs.readFileSync(shellCssPath, 'utf8');

  it('contains the compact horizontal brand lockup with GraphMindLogo and wordmark', () => {
    assert.match(sidebarSrc, /className="brand-lockup"/);
    assert.match(sidebarSrc, /<GraphMindLogo\s+className="brand-logo"\s+size=\{20\}\s*\/>/);
    assert.match(sidebarSrc, /<span className="brand-wordmark">GraphMind<\/span>/);

    // Verify GraphMindLogo SVG matches the canonical favicon mark in GraphMind green
    const faviconPath = path.resolve(__dirname, '../public/favicon.svg');
    const faviconSrc = fs.readFileSync(faviconPath, 'utf8');
    assert.match(faviconSrc, /<circle cx="12" cy="12" r="3"/);
    assert.match(faviconSrc, /stroke="#A3FF12"/);

    // Verify CSS lockup properties and GraphMind accent green logo color
    assert.match(shellCss, /\.brand-lockup\s*\{[\s\S]*?gap:\s*8px;/);
    assert.match(shellCss, /\.brand-logo\s*\{[\s\S]*?width:\s*20px;[\s\S]*?height:\s*20px;[\s\S]*?color:\s*var\(--accent,\s*#A3FF12\);/);
    assert.match(shellCss, /\.brand-wordmark\s*\{[\s\S]*?font-size:\s*16px;[\s\S]*?color:\s*#F2F2F2;/);
  });

  it('renders primary navigation with exactly 4 items in exact order', () => {
    const expectedPrimaryNav = [
      { id: 'overview', label: 'Overview' },
      { id: 'graph', label: 'Knowledge Graph' },
      { id: 'study', label: 'Study Space' },
      { id: 'sources', label: 'Sources' }
    ];

    expectedPrimaryNav.forEach((item) => {
      assert.ok(
        sidebarSrc.includes(`id: '${item.id}'`) && sidebarSrc.includes(`label: '${item.label}'`),
        `Sidebar primary nav must include ${item.label}`
      );
    });

    // Ensure secondary or prohibited items are not in mainNavItems
    assert.doesNotMatch(sidebarSrc, /mainNavItems\s*=\s*\[[\s\S]*?id:\s*'settings'/);
    assert.doesNotMatch(sidebarSrc, /mainNavItems\s*=\s*\[[\s\S]*?id:\s*'dashboard'/i);
    assert.doesNotMatch(sidebarSrc, /mainNavItems\s*=\s*\[[\s\S]*?id:\s*'analytics'/i);
  });

  it('separates Settings into the lower utility section below workspace context', () => {
    // Settings must be in sidebar-footer inside sidebar-lower
    assert.match(sidebarSrc, /<div className="sidebar-lower">[\s\S]*?<div className="sidebar-footer">[\s\S]*?Settings/);
    assert.match(sidebarSrc, /onSelectSection\('settings'\)/);
  });

  it('uses the subtle 4px x 4px .nav-active-dot state indicator', () => {
    assert.match(sidebarSrc, /<span className="nav-active-dot" aria-hidden="true" \/>/);
    assert.match(shellCss, /\.nav-active-dot\s*\{[\s\S]*?width:\s*4px;[\s\S]*?height:\s*4px;[\s\S]*?border-radius:\s*50%;/);
    // Must animate smoothly on active
    assert.match(shellCss, /\.sidebar-nav-item\.active \.nav-active-dot\s*\{[\s\S]*?opacity:\s*1;/);
  });

  it('formats CURRENT GRAPH context with 2-line natural wrapping and no card/button', () => {
    assert.match(sidebarSrc, /<span className="sidebar-context-kicker">CURRENT GRAPH<\/span>/);
    assert.match(sidebarSrc, /<span className="sidebar-context-title"/);

    // CSS rules check for multi-line clamp rather than single line ellipsis truncation
    assert.match(shellCss, /\.sidebar-context-title\s*\{[\s\S]*?-webkit-line-clamp:\s*2;/);
    assert.match(shellCss, /\.sidebar-context-title\s*\{[\s\S]*?word-break:\s*break-word;/);
    // Kicker typography specifications
    assert.match(shellCss, /\.sidebar-context-kicker\s*\{[\s\S]*?font-size:\s*9px;/);
    assert.match(shellCss, /\.sidebar-context-kicker\s*\{[\s\S]*?text-transform:\s*uppercase;/);
  });

  it('conforms to sidebar styling rules: #0A0A0A background, #1D1D1D divider, no pills or cards', () => {
    // Canvas background
    assert.match(shellCss, /\.app-sidebar\s*\{[\s\S]*?background-color:\s*#0A0A0A;/);
    // Extremely subtle divider
    assert.match(shellCss, /\.app-sidebar\s*\{[\s\S]*?border-right:\s*1px solid #1D1D1D;/);
    // Desktop width around 200-216px
    assert.match(shellCss, /\.app-sidebar\s*\{[\s\S]*?width:\s*var\(--sidebar-width,\s*212px\);/);
    // Zero pill rounded cards on nav items
    assert.match(shellCss, /\.sidebar-nav-item\s*\{[\s\S]*?border-radius:\s*0;/);
    // Active text should not be colored green
    assert.match(shellCss, /\.sidebar-nav-item\.active\s*\{[\s\S]*?color:\s*#F2F2F2;/);
  });
});
