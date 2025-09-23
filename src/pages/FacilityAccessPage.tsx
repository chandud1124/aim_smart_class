import React from 'react';
import { ClassroomAccessManager } from '@/components/ClassroomAccessManager';
import { RoleGuard } from '@/components/RoleGuard';

const FacilityAccessPage: React.FC = () => {
    return (
    <RoleGuard roles={['super-admin', 'admin', 'faculty', 'teacher', 'security']}>
            <div className="container mx-auto p-6">
                <ClassroomAccessManager />
            </div>
        </RoleGuard>
    );
};

export default FacilityAccessPage;