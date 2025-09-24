import React from 'react';
import AnalyticsPanel from '../components/AnalyticsPanel';

const AnalyticsPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-primary">Analytics & Monitoring</h1>
      <AnalyticsPanel />
    </div>
  );
};

export default AnalyticsPage;
