import { createBrowserRouter, Navigate } from 'react-router';
import { PlanListPage } from '../features/plans/PlanListPage';
import { WizardLayout } from '../features/wizard/WizardLayout';
import { StepRouter } from './StepRouter';

export const router = createBrowserRouter([
  { path: '/', element: <PlanListPage /> },
  {
    path: '/plan/:planId',
    element: <WizardLayout />,
    children: [
      { index: true, element: <Navigate to="onderneming" replace /> },
      { path: ':slug', element: <StepRouter /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
