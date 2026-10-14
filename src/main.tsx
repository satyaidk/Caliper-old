import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary, NoWebGL, hasWebGL } from './components/Fallback';
import { registerServiceWorker } from './pwa/register';
import { useViewer } from './store/useViewer';
import './styles/tokens.css';
import './styles/base.css';
import './styles/app.css';

const root = createRoot(document.getElementById('root')!);

// Probe before mounting: a viewer with no GPU context has nothing to say, and
// a plain explanation beats a blank canvas and a console error.
root.render(
  <StrictMode>
    <ErrorBoundary>{hasWebGL() ? <App /> : <NoWebGL />}</ErrorBoundary>
  </StrictMode>,
);

registerServiceWorker((apply) =>
  useViewer.getState().toast({
    tone: 'info',
    title: 'A new version of Caliper is ready',
    text: 'Reload to switch to it. Anything you have measured will be cleared.',
    action: { label: 'Reload now', run: apply },
  }),
);
