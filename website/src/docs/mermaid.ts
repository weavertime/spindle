// Mermaid is heavy, so it's imported on demand; only the first doc page that
// actually contains a diagram pulls it in, as its own async chunk.
type MermaidApi = typeof import('mermaid')['default'];

let ready: Promise<MermaidApi> | null = null;

// Colours drawn from the site's light linen/brass/indigo tokens so diagrams
// sit in the theme rather than shipping mermaid's default palette.
const themeVariables = {
  background: '#ffffff',
  primaryColor: '#f7f5f0',
  primaryTextColor: '#1b1e33',
  primaryBorderColor: '#c0821e',
  secondaryColor: '#efece4',
  secondaryBorderColor: '#d9d5cc',
  tertiaryColor: '#ffffff',
  tertiaryBorderColor: '#e8e5dd',
  lineColor: '#565a70',
  textColor: '#1b1e33',
  fontSize: '13px',
};

function load(): Promise<MermaidApi> {
  if (!ready) {
    ready = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'base',
        themeVariables,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      });
      return mermaid;
    });
  }
  return ready;
}

// Turn every not-yet-processed `.mermaid` block inside `container` into an SVG.
export async function renderMermaid(container: HTMLElement): Promise<void> {
  const nodes = Array.from(
    container.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])'),
  );
  if (nodes.length === 0) return;
  const mermaid = await load();
  await mermaid.run({ nodes });
}
