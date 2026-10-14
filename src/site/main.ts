import '../styles/tokens.css';
import '../styles/base.css';
import './site.css';
import { BY_PIPELINE, FORMATS, PIPELINE_COPY } from '@/lib/formats';
import { dim } from '@/lib/format';
import { spreadLabels } from '@/lib/labels';
import { registerServiceWorker } from '@/pwa/register';
import type { Pipeline, RenderMode } from '@/types';

/**
 * The website. Plain TypeScript, no React: it is a document with one live
 * element in it, and that element is the app's own Engine, loaded after the
 * page has painted so the words never wait on three.js.
 *
 * Every number on the page that describes the product is computed here from
 * the same modules the app uses — the format count from the format registry,
 * the part's size from the Engine — so the page cannot advertise something the
 * app does not do.
 */

const $ = <T extends Element>(selector: string) => document.querySelector<T>(selector);

/* --- theme ---------------------------------------------------------------- */

function setTheme(theme: 'dark' | 'light') {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('caliper.theme', theme);
  } catch {
    /* storage can be off; the toggle still works for this visit */
  }
  window.dispatchEvent(new CustomEvent('caliper-theme', { detail: theme }));
}

$('#theme-toggle')?.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});

/* --- counts and the format table ------------------------------------------ */

const NAMED_IN_LEDE = 4; // STEP, STL, 3MF and IFC
document.querySelectorAll('[data-count]').forEach((node) => (node.textContent = String(FORMATS.length)));
document
  .querySelectorAll('[data-count-rest]')
  .forEach((node) => (node.textContent = String(FORMATS.length - NAMED_IN_LEDE)));

const formatList = $('#format-list');
if (formatList) {
  const order: Pipeline[] = ['mesh', 'cad', 'bim'];
  formatList.innerHTML = order
    .map(
      (pipeline) => `
      <div class="site-format" data-kind="${pipeline}">
        <h3>${PIPELINE_COPY[pipeline].title}</h3>
        <p>${PIPELINE_COPY[pipeline].note}</p>
        <ul>${BY_PIPELINE[pipeline].map((f) => `<li title="${f.label}">.${f.ext}</li>`).join('')}</ul>
      </div>`,
    )
    .join('');
}

/* --- the tool list -------------------------------------------------------- */

const TOOLS: { key: string; name: string; text: string; path: string }[] = [
  {
    key: 'R',
    name: 'Auto orient',
    text: 'Finds the largest flat face on the outside of the part and stands it on that.',
    path: '<path d="M15.6 8.2A5.8 5.8 0 0 0 4.9 6.1"/><path d="M4.4 2.9v3.4h3.4"/><path d="M3 17h14" opacity=".55"/><rect x="6.6" y="10.6" width="6.8" height="6.4" rx=".6"/>',
  },
  {
    key: 'F',
    name: 'Lay on face',
    text: 'Click a face and the part turns so that face rests on the plate.',
    path: '<path d="M6 3.4h8v6.4H6z"/><path d="M10 11.2v3.4M8.4 13 10 14.6 11.6 13"/><path d="M3 17.2h14" opacity=".55"/>',
  },
  {
    key: 'U',
    name: 'Distance',
    text: 'Two clicks, snapped to corners and edge midpoints, with the span split into X, Y and Z.',
    path: '<path d="M3.4 13.4 13.4 3.4l3.2 3.2-10 10z"/><path d="m6.2 10.6 1.4 1.4M8.6 8.2 10 9.6M11 5.8l1.4 1.4"/>',
  },
  {
    key: 'D',
    name: 'Diameter',
    text: 'Three clicks around a hole fit a circle through them, even after the file forgot it was round.',
    path: '<circle cx="10" cy="10" r="6.4"/><path d="m5.5 14.5 9-9"/>',
  },
  {
    key: 'A',
    name: 'Angle',
    text: 'An arm, the corner, the other arm. Reads chamfers, drafts and dovetails.',
    path: '<path d="M3.4 16.4h13.2M3.4 16.4l9-11.4"/><path d="M8.8 16.4a5.4 5.4 0 0 0-2.1-4.2"/>',
  },
  {
    key: 'X',
    name: 'Section view',
    text: 'Cut along X, Y or Z. The cut face is filled solid, so wall thickness reads at a glance.',
    path: '<path d="M5.4 6.8 10 4.2l4.6 2.6" opacity=".45"/><path d="M5.4 10.6v3.6l4.6 2.6 4.6-2.6v-3.6"/><path d="M2.6 10.6 10 7.6l7.4 3-7.4 3z"/>',
  },
  {
    key: 'Y',
    name: 'Assembly view',
    text: 'Pulls an assembly’s parts apart along lines from its centre, up to three times as far.',
    path: '<rect x="3" y="3" width="5" height="5" rx=".6"/><rect x="12" y="3" width="5" height="5" rx=".6"/><rect x="3" y="12" width="5" height="5" rx=".6"/><rect x="12" y="12" width="5" height="5" rx=".6"/>',
  },
  {
    key: 'O',
    name: 'Overhangs',
    text: 'Faces steeper than your overhang limit are painted red, wherever the part is turned.',
    path: '<path d="M3 16.8h14" opacity=".55"/><path d="M6.2 16.8V7.4H16v3.4H9.6v6"/><path d="M10.6 13.2l1.4 1.4M13.2 13.2l1.4 1.4" opacity=".75"/>',
  },
  {
    key: 'K',
    name: 'Orthographic',
    text: 'Parallel lines stay parallel and the back of the part is drawn at the same scale as the front.',
    path: '<rect x="3" y="5.6" width="5" height="8.8" rx=".6"/><path d="M8 5.6h9.2M8 14.4h9.2M17.2 5.6v8.8" opacity=".7"/>',
  },
];

const toolList = $('#tool-list');
if (toolList) {
  toolList.innerHTML = TOOLS.map(
    (tool) => `
    <li class="tool-card">
      <span class="tool-icon"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${tool.path}</svg></span>
      <span class="tool-text"><b>${tool.name}</b>${tool.text}</span>
      <kbd>${tool.key}</kbd>
    </li>`,
  ).join('');
}

/* --- install -------------------------------------------------------------- */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

const installButton = $<HTMLButtonElement>('#install-button');
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  if (!installButton) return;
  installButton.hidden = false;
  installButton.onclick = () => {
    installButton.hidden = true;
    void (event as InstallPromptEvent).prompt();
  };
});
window.addEventListener('appinstalled', () => {
  if (installButton) installButton.hidden = true;
  const note = $('#install-note');
  if (note) note.textContent = 'Installed. Caliper is in your apps list, and model files can be opened with it.';
});

registerServiceWorker();

/* --- the live hero -------------------------------------------------------- */

async function startHero() {
  const canvas = $<HTMLCanvasElement>('#hero-canvas');
  const stage = $<HTMLElement>('#hero-stage');
  const tags = $<HTMLElement>('#hero-tags');
  if (!canvas || !stage || !tags) return;

  const { hasWebGL } = await import('@/lib/webgl');
  if (!hasWebGL()) {
    stage.classList.add('is-static');
    $<HTMLImageElement>('.hero-fallback')?.removeAttribute('hidden');
    return;
  }

  const [{ Engine }, sample, THREE] = await Promise.all([
    import('@/viewer/Engine'),
    import('@/lib/sample'),
    import('three'),
  ]);

  const engine = new Engine(canvas);
  // The orbit controls claim every touch; on a page that scrolls, a vertical
  // swipe over the hero has to scroll the page instead. Sideways still turns it.
  canvas.style.touchAction = 'pan-y';
  const theme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  engine.setTheme(theme());
  window.addEventListener('caliper-theme', () => engine.setTheme(theme()));

  const mesh = new THREE.Mesh(sample.gearGeometry(), new THREE.MeshStandardMaterial());
  mesh.name = 'Spur gear';
  engine.setFilament('#00ae42', false);
  engine.setModel(mesh, false);
  engine.setPlate(null, 1);
  engine.setRenderMode('shaded');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  engine.configureControls({ zoom: false, autoRotate: reduced ? 0 : 1.1 });

  const d = engine.dimensions();
  for (const axis of ['x', 'y', 'z'] as const) {
    const node = document.querySelector(`[data-dim="${axis}"]`);
    if (node) node.textContent = dim(d[axis], 'mm');
  }

  const points = sample.gearReferencePoints();
  const measured = [
    engine.addMeasurement('diameter', points.tips),
    engine.addMeasurement('distance', points.thickness),
  ].filter((m) => m !== null);

  tags.innerHTML = measured
    .map(
      (m) =>
        `<span class="hero-tag num" data-id="${m.id}">${m.tool === 'diameter' ? 'Ø ' : ''}${dim(m.value, 'mm')}</span>`,
    )
    .join('');
  const nodes = new Map<number, HTMLElement>();
  tags.querySelectorAll<HTMLElement>('[data-id]').forEach((n) => nodes.set(Number(n.dataset.id), n));
  engine.setLabelSink((anchors) => {
    for (const anchor of spreadLabels(anchors)) {
      const node = nodes.get(anchor.id);
      if (!node) continue;
      node.style.transform = `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`;
      node.style.visibility = anchor.behind ? 'hidden' : 'visible';
    }
  });

  const resize = () => engine.resize();
  new ResizeObserver(resize).observe(stage);
  resize();
  engine.setView('iso');

  // The demo toolbar drives the real engine, one switch per button.
  const toolbar = stage.querySelector('.hero-toolbar');
  toolbar?.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      engine.setRenderMode(button.dataset.mode as RenderMode);
      toolbar
        .querySelectorAll<HTMLButtonElement>('[data-mode]')
        .forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    });
  });
  toolbar?.querySelector<HTMLButtonElement>('[data-toggle="section"]')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    engine.setClip(on ? { axis: 'z', at: 0.5, flip: false } : null);
  });
  toolbar?.querySelector<HTMLButtonElement>('[data-toggle="ortho"]')?.addEventListener('click', (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    engine.setProjection(on ? 'orthographic' : 'perspective');
  });

  // Off screen, the hero stops drawing.
  new IntersectionObserver(([entry]) => engine.setPaused(!entry.isIntersecting)).observe(stage);
  stage.classList.add('is-live');
}

// After first paint, so the words are never held up by three.js.
if ('requestIdleCallback' in window) window.requestIdleCallback(() => void startHero(), { timeout: 1200 });
else setTimeout(() => void startHero(), 200);
