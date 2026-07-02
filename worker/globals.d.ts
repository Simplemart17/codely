// Text-module imports (bundled by the wrangler `Text` rule in wrangler.jsonc).
declare module '*.html' {
  const content: string;
  export default content;
}
