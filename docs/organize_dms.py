import os
import shutil
import re
import time
from datetime import datetime
from pathlib import Path

# ==========================================
# 1. 설정 (Configuration)
# ==========================================
SOURCE_DIR = r"C:\ProjectCode\Cross\Data\CrossDoc"  # 원본 폴더
TARGET_DIR = os.path.join(SOURCE_DIR, "StdFolder")  # 정리될 폴더

# 표준 폴더 구조 정의
FOLDER_MAP = {
    "00_공무_행정": ["계약", "사업자", "인력", "선임", "기성", "공무", "내역서"],
    "01_안전_보건": ["안전", "보건", "TBM", "교육", "위험성", "DSP", "점검", "보호구", "MSDS", "사고"],
    "02_공사_작업": ["계획서", "시방서", "도면", "작업", "일보", "철거", "시공", "지적", "NCR", "허가서"],
    "03_장비_공도구": ["장비", "공도구", "굴착기", "크레인", "지게차", "검사증", "등록증"],
    "04_기록_자료": ["사진", "전경", "영상", "참고", "회의록", "KOSHA", "jpg", "png", "jpeg"]
}

# 기본 분류가 안 될 경우 사용할 폴더
DEFAULT_FOLDER = "99_미분류"

# ==========================================
# 2. 헬퍼 함수 (Helper Functions)
# ==========================================

def get_file_date(file_path, filename):
    """
    파일명에서 날짜 추출 시도 -> 실패 시 파일 수정 날짜 반환 (A안 적용)
    """
    # 1. 파일명에서 날짜 패턴 찾기 (YYYYMMDD, YYMMDD, YY.MM.DD 등)
    patterns = [
        r"20\d{2}[-._]?\d{2}[-._]?\d{2}", # 20240101, 2024-01-01
        r"\d{2}년\s?\d{1,2}월",            # 24년 9월
        r"\(\d{6}\)",                      # (251219)
        r"_\d{6}_"                         # _251219_
    ]
    
    for pattern in patterns:
        match = re.search(pattern, filename)
        if match:
            date_str = match.group()
            # 숫자만 추출하여 포맷팅
            nums = re.findall(r"\d+", date_str)
            full_num = "".join(nums)
            
            if len(full_num) == 8: # 20250101
                return full_num
            elif len(full_num) == 6: # 250101 -> 20250101
                return "20" + full_num
            elif len(full_num) >= 3 and "년" in date_str: # 24년9월 -> 20240901
                 year = "20" + nums[0]
                 month = nums[1].zfill(2)
                 return f"{year}{month}01"

    # 2. 날짜가 없으면 파일 시스템의 수정 날짜 사용 (User Request A)
    mtime = os.path.getmtime(file_path)
    return datetime.fromtimestamp(mtime).strftime('%Y%m%d')

def determine_folder_and_type(filename):
    """
    파일명 키워드를 기반으로 폴더와 문서 유형 결정
    """
    for folder, keywords in FOLDER_MAP.items():
        for keyword in keywords:
            if keyword in filename:
                # 문서 유형은 키워드 그대로 사용하거나 좀 더 다듬을 수 있음
                doc_type = keyword 
                if keyword in ["jpg", "png", "jpeg"]:
                    doc_type = "사진"
                return folder, doc_type
    
    return DEFAULT_FOLDER, "일반문서"

def clean_filename(original_name):
    """
    파일명에서 불필요한 특수문자 제거 및 핵심 내용 추출
    """
    name_without_ext = Path(original_name).stem
    ext = Path(original_name).suffix
    
    # 앞쪽의 순번(00., 1.) 제거
    cleaned = re.sub(r"^[0-9]+[._\s]+", "", name_without_ext)
    # 괄호 안의 내용 중 버전 정보(REV) 등은 남기고 싶다면 로직 조정 필요. 일단 단순화.
    cleaned = cleaned.replace(" ", "_")
    return cleaned, ext

def get_author(root_path):
    """
    파일이 위치한 상위 폴더명을 작성자(업체명)로 간주
    """
    parent_folder = os.path.basename(root_path)
    if parent_folder in ["CrossDoc", "CrossData", "StdFolder"]:
        return "관리자" # 최상위에 있는 경우
    return parent_folder

# ==========================================
# 3. 메인 실행 로직 (Main Execution)
# ==========================================

def process_files():
    print(f"🚀 정리 시작: {SOURCE_DIR}")
    print(f"📂 목표 폴더: {TARGET_DIR}")
    
    if not os.path.exists(SOURCE_DIR):
        print("❌ 오류: 원본 폴더가 존재하지 않습니다.")
        return

    count = 0
    
    # 원본 폴더 순회 (walk)
    for root, dirs, files in os.walk(SOURCE_DIR):
        
        # 이미 생성된 정리 폴더는 건너뜀
        if "StdFolder" in root:
            continue
            
        for file in files:
            src_path = os.path.join(root, file)
            
            # 1. 정보 추출
            date_str = get_file_date(src_path, file)
            target_folder_name, doc_type = determine_folder_and_type(file)
            clean_name, ext = clean_filename(file)
            author = get_author(root) # 상위 폴더명을 업체명으로 사용
            
            # 2. 새 파일명 조합: [날짜]_[문서유형]_[원래내용]_[작성자].확장자
            # 중복된 정보 제거 (파일명에 이미 날짜나 유형이 있으면 제거하는 로직 추가 가능하나 안전을 위해 병기)
            new_filename = f"{date_str}_{doc_type}_{clean_name}_{author}{ext}"
            
            # 3. 타겟 경로 생성
            target_folder_path = os.path.join(TARGET_DIR, target_folder_name)
            
            # 하위 분류 (년도/월) 추가 제안을 반영한다면 여기에 os.path.join(target_folder_path, year, month) 추가 가능
            # 현재는 대분류 폴더까지만 이동
            
            if not os.path.exists(target_folder_path):
                os.makedirs(target_folder_path)
            
            dest_path = os.path.join(target_folder_path, new_filename)
            
            # 4. 중복 파일 처리 (덮어쓰기 방지)
            uniq_counter = 1
            while os.path.exists(dest_path):
                name_stem = Path(new_filename).stem
                dest_path = os.path.join(target_folder_path, f"{name_stem}_v{uniq_counter}{ext}")
                uniq_counter += 1
            
            # 5. 파일 복사 (Copy)
            try:
                shutil.copy2(src_path, dest_path)
                print(f"[복사완료] {file} -> {target_folder_name} / {os.path.basename(dest_path)}")
                count += 1
            except Exception as e:
                print(f"[오류] {file} 처리 중 문제 발생: {e}")

    print("-" * 50)
    print(f"✅ 총 {count}개 파일 정리 완료!")
    print(f"경로: {TARGET_DIR}")

if __name__ == "__main__":
    process_files()