import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';
import './styles/demos.css';
import './styles/practice.css';

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<App />);
}
