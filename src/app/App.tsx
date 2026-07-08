import { BrowserRouter } from 'react-router';
import { AppProviders } from '@/providers/AppProviders';
import { AppRouter } from '@/routes/AppRouter';

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AppProviders>
  );
}
