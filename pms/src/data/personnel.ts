// Mock Personnel Data for PM/PL selection
export const mockPersonnel = [
    // 경영자 2명
    { id: 'p1', name: '김대표', role: 'CEO' },
    { id: 'p2', name: '박이사', role: 'EXECUTIVE' },

    // PM 3명
    { id: 'p3', name: '이PM', role: 'PM' },
    { id: 'p4', name: '최PM', role: 'PM' },
    { id: 'p5', name: '정PM', role: 'PM' },

    // PL 3명
    { id: 'p6', name: '강PL', role: 'PL' },
    { id: 'p7', name: '조PL', role: 'PL' },
    { id: 'p8', name: '윤PL', role: 'PL' },
];

// Get PM/PL personnel (경영자, PM, PL만)
export const getPMPersonnel = () => {
    return mockPersonnel.filter(p => ['CEO', 'EXECUTIVE', 'PM', 'PL'].includes(p.role));
};
