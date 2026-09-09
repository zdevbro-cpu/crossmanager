
export interface HealthScore {
    projectId: string;
    projectName: string; // Joined from project
    calcDate: string;
    scoreTotal: number;
    scoreSchedule: number;
    scoreSafety: number;
    scoreCost: number;
    scoreResource: number;
    scoreQuality: number;
    grade: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
    forcedRed: boolean;
    topReasons: Array<{
        type: string;
        value: number;
        weight: number;
        message: string;
    }>;
    dataQuality: Record<string, 'ok' | 'partial' | 'missing'>;
}

export interface Risk {
    id: string;
    projectId: string;
    projectName?: string;
    riskType: 'safety' | 'schedule' | 'cost' | 'resource' | 'scrap';
    title: string;
    severity: 'info' | 'warn' | 'critical';
    metrics: Record<string, any>;
    createdAt: string;
}

export interface DashboardAlert {
    id: string;
    projectId: string;
    projectName?: string;
    alertType: 'approval_pending' | 'safety_nc' | 'loss_risk' | 'equipment_fault' | 'scrap_issue';
    title: string;
    detail: string;
    status: 'open' | 'ack' | 'closed';
    severity: 'warn' | 'critical';
    actionUrl?: string;
    createdAt: string;
}

export interface DashboardSummary {
    riskCount: number;
    delayCount: number;
    lossRiskCount: number;
    totalProjects: number;
    projectsByGrade: {
        GREEN: number;
        YELLOW: number;
        ORANGE: number;
        RED: number;
    };
}
