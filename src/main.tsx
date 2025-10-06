import { init } from '@contentful/app-sdk';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppConfig from './app-config/AppConfig';

const root = createRoot(document.getElementById('root')!);

init((sdk) => {
  if (sdk.location.is('app-config')) {
    root.render(<AppConfig sdk={sdk as any} />);
  } else {
    // default to your page UI
    root.render(<App />);
  }
});