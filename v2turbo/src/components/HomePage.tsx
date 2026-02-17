import WalletButton from '@/components/WalletButton';
import React from 'react';

export const HomePage: React.FC = () => {
  return (
    <div className='container mx-auto px-4 py-6'>
      {/* Header with wallet connection */}
      <header className='flex justify-end mb-8'>
        <WalletButton />
      </header>

      <section>
        {/*
            Use this section to show-case the app's main functionality or a CTA to the main functionality
            AND
            Use another section below to show discoverable features of the app if applicable
          */}
      </section>
    </div>
  );
};

export default HomePage;
