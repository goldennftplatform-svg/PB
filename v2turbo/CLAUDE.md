# Poof V2.1 Template

React 19 + Vite 6 + TypeScript frontend (src/), Hono + PartyServer backend (partyserver/).
Frontend and backend communicate via auto-generated TypeScript SDK. All API responses use 5 status codes: 200, 400, 401, 404, 500.

## KEY CONSTRAINTS

1. **Homepage First** - Add features to homepage unless user explicitly asks for new page
2. **No New Hooks** - Use existing hooks only. Creating hook files BREAKS the app
3. **5 Status Codes Only** - 200, 400, 401, 404, 500. No other HTTP status codes allowed
4. **Package Management** - Use the package-manager MCP tool (not package.json edits or bash commands)
5. **Flat Component Structure** - All components in src/components/, no nested folders

## CSS LAYERS

1. src/globals.css - Theme colors, editable
2. src/styles/base.css - Base styles
3. src/poof-styling.css - **NEVER EDIT** (Poof platform owned)

## CODE STYLE

- Optional chaining for property access, nullish coalescing for defaults
- Use @/ imports: import { X } from @/components/ui
- Sonner for toasts: toast.success(), toast.error()
- Lucide React for icons
- Zod for validation

## DO / DON'T

**DO:** Tailwind CSS, Shadcn/UI, Lucide icons, Sonner toasts, @/ imports, flat structure, TypeScript strict mode, register routes in /partyserver/src/routes/index.ts, run bun generate-sdk after route changes

**DON'T:** Edit Shadcn UI components manually, create custom CSS files, use any type, hardcode URLs, create new hook files

## OAuth (Social Login)

**IMPORTANT: When a user asks for OAuth, social login, or connecting social accounts (Twitter, Google, Discord, GitHub, Farcaster), you MUST read and follow `.claude/skills/oauth/SKILL.md` before making any changes.** The template includes a complete pre-built OAuth implementation that just needs to be enabled — do NOT build OAuth from scratch.
