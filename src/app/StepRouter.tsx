import type { ComponentType } from 'react';
import { Navigate, useParams } from 'react-router';
import { StepAannames } from '../features/wizard/steps/StepAannames';
import { StepBehoefte } from '../features/wizard/steps/StepBehoefte';
import { StepFinanciering } from '../features/wizard/steps/StepFinanciering';
import { StepHistorie } from '../features/wizard/steps/StepHistorie';
import { StepOnderneming } from '../features/wizard/steps/StepOnderneming';
import { StepToelichting } from '../features/wizard/steps/StepToelichting';
import { ResultPage } from '../features/dashboard/ResultPage';

const PAGES: Partial<Record<string, ComponentType>> = {
  onderneming: StepOnderneming,
  financieringsbehoefte: StepBehoefte,
  historie: StepHistorie,
  aannames: StepAannames,
  financiering: StepFinanciering,
  toelichting: StepToelichting,
  resultaat: ResultPage,
};

export function StepRouter() {
  const { slug } = useParams();
  const Page = PAGES[slug ?? ''];
  return Page === undefined ? <Navigate to="../onderneming" replace /> : <Page />;
}
