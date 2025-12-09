// API를 통한 장비 데이터 삽입
const equipmentData = [
    {
        equipmentId: 'EQ-2024-001',
        name: '굴삭기 20톤',
        category: '굴삭기',
        model: 'DX225LC',
        manufacturer: '두산',
        manufactureYear: 2023,
        specifications: '20톤급',
        serialNumber: 'DS2023-001-KR',
        acquisitionDate: '2023-03-15',
        equipmentStatus: '신품',
        assignedSite: '서울 강남 재개발 현장'
    },
    {
        equipmentId: 'EQ-2024-002',
        name: '굴삭기 15톤',
        category: '굴삭기',
        model: 'R140LC-9',
        manufacturer: '현대',
        manufactureYear: 2022,
        specifications: '15톤급',
        serialNumber: 'HD2022-045-KR',
        acquisitionDate: '2022-08-20',
        equipmentStatus: '중고',
        assignedSite: '인천 송도 신도시'
    },
    {
        equipmentId: 'EQ-2024-003',
        name: '지게차 3톤',
        category: '지게차',
        model: '30D-9',
        manufacturer: '두산',
        manufactureYear: 2024,
        specifications: '3톤급',
        serialNumber: 'DS2024-012-KR',
        acquisitionDate: '2024-01-10',
        equipmentStatus: '신품',
        assignedSite: '부산 신항만 물류센터'
    },
    {
        equipmentId: 'EQ-2024-004',
        name: '덤프트럭 25톤',
        category: '덤프트럭',
        model: 'Xcient',
        manufacturer: '현대',
        manufactureYear: 2021,
        specifications: '25톤급',
        serialNumber: 'HD2021-089-KR',
        acquisitionDate: '2021-06-05',
        equipmentStatus: '중고',
        assignedSite: '경기 평택 산업단지'
    },
    {
        equipmentId: 'EQ-2024-005',
        name: '타워크레인 10톤',
        category: '타워크레인',
        model: 'TC-6013',
        manufacturer: '극동',
        manufactureYear: 2023,
        specifications: '10톤급',
        serialNumber: 'KD2023-007-KR',
        acquisitionDate: '2023-09-12',
        equipmentStatus: '신품',
        assignedSite: '대전 둔산 아파트 건설'
    },
    {
        equipmentId: 'EQ-2024-006',
        name: '콘크리트 펌프카 42M',
        category: '펌프카',
        model: 'PX42',
        manufacturer: '에버다임',
        manufactureYear: 2022,
        specifications: '42M급',
        serialNumber: 'EV2022-034-KR',
        acquisitionDate: '2022-11-28',
        equipmentStatus: '중고',
        assignedSite: '광주 첨단지구 공장'
    },
    {
        equipmentId: 'EQ-2024-007',
        name: '휠로더 5톤',
        category: '로더',
        model: 'HL960',
        manufacturer: '현대',
        manufactureYear: 2024,
        specifications: '5톤급',
        serialNumber: 'HD2024-003-KR',
        acquisitionDate: '2024-02-14',
        equipmentStatus: '신품',
        assignedSite: '강원 춘천 도로공사'
    },
    {
        equipmentId: 'EQ-2024-008',
        name: '불도저 30톤',
        category: '불도저',
        model: 'D85EX-18',
        manufacturer: '두산',
        manufactureYear: 2020,
        specifications: '30톤급',
        serialNumber: 'DS2020-056-KR',
        acquisitionDate: '2020-04-22',
        equipmentStatus: '정비중',
        assignedSite: '정비센터'
    },
    {
        equipmentId: 'EQ-2024-009',
        name: '모터그레이더 140HP',
        category: '그레이더',
        model: 'GD655-5',
        manufacturer: '두산',
        manufactureYear: 2023,
        specifications: '140HP',
        serialNumber: 'DS2023-019-KR',
        acquisitionDate: '2023-07-30',
        equipmentStatus: '신품',
        assignedSite: '충남 천안 도로정비'
    },
    {
        equipmentId: 'EQ-2024-010',
        name: '진동롤러 10톤',
        category: '롤러',
        model: 'DV210',
        manufacturer: '볼보',
        manufactureYear: 2021,
        specifications: '10톤급',
        serialNumber: 'VV2021-078-KR',
        acquisitionDate: '2021-10-18',
        equipmentStatus: '중고',
        assignedSite: '경북 포항 항만공사'
    }
];

async function seedViaAPI() {
    console.log('API를 통한 장비 데이터 삽입 시작...\n');

    for (const eq of equipmentData) {
        try {
            const response = await fetch('http://localhost:3000/api/equipment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eq)
            });

            if (response.ok) {
                console.log(`✓ ${eq.name} 삽입 완료`);
            } else {
                const error = await response.json();
                console.log(`✗ ${eq.name} 실패:`, error.error);
            }
        } catch (err) {
            console.error(`✗ ${eq.name} 오류:`, err.message);
        }
    }

    console.log(`\n완료! 총 ${equipmentData.length}개 장비 등록 시도`);
}

seedViaAPI();
