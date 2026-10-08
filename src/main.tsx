import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p';
import '@fontsource-variable/nunito';
import '@fontsource-variable/nunito/wght-italic.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './ui/App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
