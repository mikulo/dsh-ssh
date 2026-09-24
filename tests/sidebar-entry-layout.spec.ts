import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('../src/client/panel/panel.module.css', import.meta.url), 'utf8')
const source = readFileSync(new URL('../src/client/sidebar-entry.ts', import.meta.url), 'utf8')

// The entry row keeps the geometry baseline copied from the shell's own panel
// rows. (The cross-package sibling sweep of the former dsh-web monorepo
// (#1535) is gone: this repository now ships the ssh plugin alone.)

describe('SSH sidebar entry layout (#872)', () => {
  it('user sees the entry row box match the shell panel rows', () => {
    // Given the ssh entry row stylesheet and its glyph markup
    const entry = css.match(/(?:^|\n)\.entry\s*\{([^}]*)\}/s)?.[1] ?? ''

    // When the row renders beside an official panel row
    // Then its box, type, ink and glyph are the shell panel row's own values
    expect(source).toContain('width="16" height="16"')
    expect(entry).toContain('min-height: 36px')
    expect(entry).toContain('padding: 7px 8px')
    expect(entry).toContain('margin: 0 2px')
    expect(entry).toContain('border-radius: 12px')
    expect(entry).toContain('font-size: 14px')
    expect(entry).toContain('line-height: 22px')
    expect(entry).toContain('var(--dsw-alias-label-primary)')
    expect(css).toMatch(/\.entryIcon\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s)
    expect(css).toMatch(/\.entryIcon svg\s*\{[^}]*width:\s*16px;[^}]*height:\s*16px;/s)
    expect(css).toMatch(/\.entry:hover\s*\{[^}]*var\(--dsw-alias-interactive-bg-hover\)/s)
    expect(css).toMatch(/\.entry\[data-active\]\s*\{[^}]*var\(--dsw-alias-interactive-bg-active\)/s)
  })

  it('user sees the row keep the shell rows 8px icon-to-label gap (#1535)', () => {
    // Given the ssh entry rule
    // When its icon-to-label gap is read
    // Then the glyph and the label are spaced by 8px
    expect(css).toMatch(/\.entry\s*\{[^}]*gap:\s*8px;/s)
  })

  it('user collapsing the sidebar sees the row become a shell-shaped rail target', () => {
    // Given the collapsed rail styles
    // When the rail rules apply
    // Then the target is a centered 36px box with the panel rows' rounding
    expect(css).toContain(':global([data-sidebar-collapsed]) .entry')
    expect(css).toContain(':global([data-dsh-frame][data-sidebar-collapsed]) .entry')
    const collapsed = css.match(/:global\([^)]*\[data-sidebar-collapsed\][^)]*\) \.entry\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(collapsed).toContain('width: 36px')
    expect(collapsed).toContain('min-height: 36px')
    expect(collapsed).toContain('margin: 0 auto 12px')
    expect(collapsed).toContain('border-radius: 12px')
    const collapsedIcon = css.match(/:global\([^)]*\[data-sidebar-collapsed\][^)]*\) \.entryIcon svg\s*\{([^}]*)\}/s)?.[1] ?? ''
    expect(collapsedIcon).toContain('width: 18px')
    expect(collapsedIcon).toContain('height: 18px')
  })
})
