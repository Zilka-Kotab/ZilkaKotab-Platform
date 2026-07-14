import React from 'react';
import { renderToString } from 'react-dom/server';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import Home from '@/pages/Home';
import About from '@/pages/About';
import Services from '@/pages/Services';
import Team from '@/pages/Team';
import TeamMember from '@/pages/TeamMember';
import Contact from '@/pages/Contact';

export function render(url: string, helmetContext: Record<string, unknown>) {
  const queryClient = new QueryClient();

  // Static location hook — tells Wouter to treat this render as the given path
  const useStaticLocation = () => [url, () => {}] as [string, (...args: unknown[]) => void];

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter hook={useStaticLocation}>
            <div className="flex min-h-[100dvh] flex-col">
              <Navbar />
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/about" component={About} />
                <Route path="/services" component={Services} />
                <Route path="/team" component={Team} />
                <Route path="/team/:slug" component={TeamMember} />
                <Route path="/contact" component={Contact} />
              </Switch>
              <Footer />
            </div>
          </WouterRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>,
  );

  return html;
}
