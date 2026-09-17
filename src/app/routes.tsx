import { createBrowserRouter, Navigate } from 'react-router';
import { AccountPage } from '../features/auth/AccountPage';
import { SignInPage } from '../features/auth/SignInPage';
import { CookiePage, PrivacyPage } from '../features/legal/LegalPages';
import { PlanListPage } from '../features/plans/PlanListPage';
import { WizardLayout } from '../features/wizard/WizardLayout';
import { StepRouter } from './StepRouter';

export const router = createBrowserRouter([
  { path: '/', element: <PlanListPage /> },
  { path: '/inloggen', element: <SignInPage /> },
  { path: '/account', element: <AccountPage /> },
  { path: '/privacy', element: <PrivacyPage /> },
  { path: '/cookies', element: <CookiePage /> },
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
