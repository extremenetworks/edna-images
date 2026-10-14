import React from 'react';
import ReactDOM from 'react-dom/client';
import './editorPanel';
import App from './App';
import './styles.css';

const rootEl = document.getElementById('root')!;
let root = ReactDOM.createRoot(rootEl);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Chrome can discard iframe rendering when the iframe is resized very small.
// Detect when our content disappears and re-mount the React tree.
function checkAlive() {
  if (rootEl.childElementCount === 0) {
    root = ReactDOM.createRoot(rootEl);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) checkAlive();
});
window.addEventListener('resize', checkAlive);
window.addEventListener('pageshow', checkAlive);
setInterval(checkAlive, 2000);
