// 직원 샘플 데이터 정의
// 이 데이터는 pms/src/data/personnel.ts에 반영되어 있습니다.

const personnelData = [
    // 경영자 2명
    { name: '김대표', role: 'CEO', qualifications: ['건설기술인', '안전보건관리자'], security_clearance: 'S등급' },
    { name: '박이사', role: 'EXECUTIVE', qualifications: ['건축기사', '안전관리자'], security_clearance: 'S등급' },

    // PM 3명
    { name: '이PM', role: 'PM', qualifications: ['건설안전기사', 'PMP'], security_clearance: 'A등급' },
    { name: '최PM', role: 'PM', qualifications: ['산업안전기사', '건축기사'], security_clearance: 'A등급' },
    { name: '정PM', role: 'PM', qualifications: ['건설안전기사'], security_clearance: 'A등급' },

    // PL 3명
    { name: '강PL', role: 'PL', qualifications: ['건설기계기사', '안전관리자'], security_clearance: 'B등급' },
    { name: '조PL', role: 'PL', qualifications: ['산업안전기사'], security_clearance: 'B등급' },
    { name: '윤PL', role: 'PL', qualifications: ['건축기사'], security_clearance: 'B등급' },

    // 현장근무 20명
    { name: '김기사1', role: 'OPERATOR', qualifications: ['굴삭기운전기능사', '대형면허'], security_clearance: 'C등급' },
    { name: '김기사2', role: 'OPERATOR', qualifications: ['지게차운전기능사'], security_clearance: 'C등급' },
    { name: '김기사3', role: 'OPERATOR', qualifications: ['크레인운전기능사'], security_clearance: 'C등급' },
    { name: '이기사1', role: 'OPERATOR', qualifications: ['굴삭기운전기능사'], security_clearance: 'C등급' },
    { name: '이기사2', role: 'OPERATOR', qualifications: ['덤프운전기능사', '대형면허'], security_clearance: 'C등급' },

    { name: '박반장1', role: 'WORKER', qualifications: ['용접기능사'], security_clearance: 'C등급' },
    { name: '박반장2', role: 'WORKER', qualifications: ['철근기능사'], security_clearance: 'C등급' },
    { name: '최반장1', role: 'WORKER', qualifications: ['비계기능사'], security_clearance: 'C등급' },
    { name: '최반장2', role: 'WORKER', qualifications: ['콘크리트기능사'], security_clearance: 'C등급' },
    { name: '정반장', role: 'WORKER', qualifications: ['용접기능사'], security_clearance: 'C등급' },

    { name: '강작업자1', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '강작업자2', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '조작업자1', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '조작업자2', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '윤작업자1', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '윤작업자2', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '서작업자1', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '서작업자2', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '한작업자1', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
    { name: '한작업자2', role: 'WORKER', qualifications: [], security_clearance: 'C등급' },
];

console.log('===================================');
console.log('직원 샘플 데이터 현황');
console.log('===================================\n');

console.log(`총 ${personnelData.length}명의 직원 데이터\n`);

const roleCounts = {};
personnelData.forEach(p => {
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
});

const roleNames = {
    'CEO': '경영자',
    'EXECUTIVE': '경영자',
    'PM': 'PM',
    'PL': 'PL',
    'OPERATOR': '기사',
    'WORKER': '작업자'
};

console.log('직원 현황:');
Object.entries(roleCounts).forEach(([role, count]) => {
    console.log(`  ${roleNames[role] || role}: ${count}명`);
});

console.log('\n===================================');
console.log('✅ Mock 데이터 위치');
console.log('===================================');
console.log('파일: pms/src/data/personnel.ts');
console.log('함수: getPMPersonnel() - PM/PL 선택용\n');

console.log('💡 프론트엔드에서 사용 중:');
console.log('   - Projects 페이지의 PM 선택 드롭다운');
console.log('   - 경영자(CEO, EXECUTIVE), PM, PL만 표시\n');
