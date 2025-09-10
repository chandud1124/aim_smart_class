import React from 'react';
import { FacilityAccessManager } from '@/components/FacilityAccessManager';
import { RoleGuard } from '@/components/RoleGuard';

const FacilityAccessPage: React.FC = () => {
    return (
        <RoleGuard roles={['admin', 'manager', 'supervisor', 'technician']}>
            <div className="container mx-auto p-6">
                <FacilityAccessManager />
            </div>
        </RoleGuard>
    );
};

export default FacilityAccessPage;