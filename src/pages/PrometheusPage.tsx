import React from 'react';

const PrometheusPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-primary">Prometheus Metrics</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="mb-4">Prometheus metrics monitoring and alerting dashboard.</p>
        <div className="border rounded-lg p-4 bg-gray-50">
          <p className="text-sm text-gray-600 mb-2">Prometheus Dashboard</p>
          <iframe
            src="http://localhost:9090" // Adjust Prometheus URL
            width="100%"
            height="600"
            frameBorder="0"
            title="Prometheus Dashboard"
          ></iframe>
        </div>
      </div>
    </div>
  );
};

export default PrometheusPage;