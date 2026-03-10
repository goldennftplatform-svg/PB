import HomePage from '@/components/HomePage';
import FaqPage from '@/components/FaqPage';
import { Toaster } from '@/components/ui/sonner';
import { PhantomFallbackProvider } from '@/contexts/PhantomFallbackContext';
import { TokenPriceProvider } from '@/contexts/TokenPriceContext';
// import { OAuthProvider } from '@/contexts/OAuthContext';
import { AnimatePresence } from 'framer-motion';
import { JSX } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';

function App(): JSX.Element {
  const location = useLocation();

  return (
    <>
      {/* NOTE: UI Generator - Uncomment OAuthProvider wrapper below if OAuth functionality is needed.
          See .claude/skills/oauth/docs/implementation-guide.md for OAuth implementation guide. */}
      {/* <OAuthProvider> */}
      <PhantomFallbackProvider>
      <TokenPriceProvider>
        <div
          id='app-container'
          className='relative min-h-screen flex flex-col bg-background bg-grid-pattern'
        >
          <main id='app-main' className='flex-1'>
            <AnimatePresence mode='wait'>
              <Routes location={location} key={location.pathname}>
                <Route path='/' element={<HomePage />} />
                <Route path='/more/faq' element={<FaqPage />} />
              </Routes>
            </AnimatePresence>
          </main>

          <Toaster />
        </div>
      </TokenPriceProvider>
      </PhantomFallbackProvider>
      {/* </OAuthProvider> */}
    </>
  );
}

export default App;
