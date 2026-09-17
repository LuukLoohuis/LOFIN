import { RouterProvider } from 'react-router';
import { router } from './app/routes';

export function App() {
  return <RouterProvider router={router} />;
}
