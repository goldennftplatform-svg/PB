import React from 'react';
import { FeatureCardProps } from '@/components/types';

export const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, description }) => {
  return (
    <div className='bg-background border rounded-xl p-6 hover:shadow-md transition-shadow'>
      <div className='w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4'>
        {icon}
      </div>
      <h3 className='text-lg font-medium mb-2'>{title}</h3>
      <p className='text-muted-foreground'>{description}</p>
    </div>
  );
};

export default FeatureCard;
