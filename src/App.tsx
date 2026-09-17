import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './app/routes';
import { useSession } from './features/auth/session';

export function App() {
  const start = useSession((state) => state.start);

  useEffect(() => {
    start();
  }, [start]);

  return <RouterProvider router={router} />;
}
