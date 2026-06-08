import { AuthProvider } from './context/AuthProvider';
import AppRouter from './router';

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
