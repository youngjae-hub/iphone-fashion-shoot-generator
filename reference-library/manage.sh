#!/bin/bash

# 참고 이미지 라이브러리 관리 스크립트

LIBRARY_DIR="$(cd "$(dirname "$0")" && pwd)"

# 색상 코드
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function show_menu() {
    echo ""
    echo "======================================"
    echo "  📚 참고 이미지 라이브러리 관리"
    echo "======================================"
    echo ""
    echo "1. 📊 현재 상태 확인"
    echo "2. 🖼️  이미지 미리보기"
    echo "3. ➕ 새 이미지 추가"
    echo "4. 🗑️  이미지 삭제"
    echo "5. 📋 카테고리별 목록"
    echo "6. 🔍 이미지 검색"
    echo "0. 종료"
    echo ""
    read -p "선택: " choice
    echo ""

    case $choice in
        1) show_status ;;
        2) preview_images ;;
        3) add_image ;;
        4) delete_image ;;
        5) list_by_category ;;
        6) search_images ;;
        0) exit 0 ;;
        *) echo "잘못된 선택입니다." ;;
    esac

    show_menu
}

function show_status() {
    echo -e "${BLUE}📊 라이브러리 현황${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    for brand in "$LIBRARY_DIR"/*/ ; do
        if [ -d "$brand" ]; then
            brand_name=$(basename "$brand")
            echo ""
            echo -e "${GREEN}🏷️  $brand_name${NC}"

            for category in dress top bottom outer; do
                cat_dir="$brand/$category"
                if [ -d "$cat_dir" ]; then
                    count=$(ls -1 "$cat_dir" 2>/dev/null | wc -l | tr -d ' ')
                    echo "  - $category: $count개"
                fi
            done
        fi
    done
    echo ""
}

function preview_images() {
    echo -e "${BLUE}🖼️  이미지 미리보기${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. 전체 보기"
    echo "2. 카테고리별 보기"
    read -p "선택: " preview_choice

    if [ "$preview_choice" == "1" ]; then
        open "$LIBRARY_DIR"
    elif [ "$preview_choice" == "2" ]; then
        echo ""
        echo "카테고리 선택:"
        echo "1. dress  2. top  3. bottom  4. outer"
        read -p "선택: " cat_choice

        case $cat_choice in
            1) open "$LIBRARY_DIR"/*/dress/ ;;
            2) open "$LIBRARY_DIR"/*/top/ ;;
            3) open "$LIBRARY_DIR"/*/bottom/ ;;
            4) open "$LIBRARY_DIR"/*/outer/ ;;
        esac
    fi
}

function add_image() {
    echo -e "${BLUE}➕ 새 이미지 추가${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    read -p "브랜드명 (예: lusida): " brand
    echo ""
    echo "카테고리:"
    echo "1. dress (원피스)  2. top (상의)  3. bottom (하의)  4. outer (아우터)"
    read -p "선택: " cat_choice

    case $cat_choice in
        1) category="dress" ;;
        2) category="top" ;;
        3) category="bottom" ;;
        4) category="outer" ;;
        *) echo "잘못된 선택"; return ;;
    esac

    read -p "설명 (예: short_sleeve): " desc
    read -p "이미지 파일 경로: " filepath

    if [ ! -f "$filepath" ]; then
        echo "❌ 파일을 찾을 수 없습니다: $filepath"
        return
    fi

    # 디렉토리 생성
    target_dir="$LIBRARY_DIR/$brand/$category"
    mkdir -p "$target_dir"

    # 파일 번호 자동 생성
    count=$(ls -1 "$target_dir" 2>/dev/null | wc -l | tr -d ' ')
    num=$(printf "%03d" $((count + 1)))

    # 파일 확장자 추출
    ext="${filepath##*.}"

    # 파일명 생성
    filename="${brand}_${category}_${num}_${desc}.${ext}"
    target_path="$target_dir/$filename"

    # 복사
    cp "$filepath" "$target_path"
    echo -e "${GREEN}✅ 추가 완료: $filename${NC}"
}

function delete_image() {
    echo -e "${BLUE}🗑️  이미지 삭제${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    read -p "삭제할 파일 경로: " filepath

    if [ ! -f "$filepath" ]; then
        echo "❌ 파일을 찾을 수 없습니다"
        return
    fi

    echo "정말 삭제하시겠습니까? (y/n)"
    read -p "> " confirm

    if [ "$confirm" == "y" ]; then
        rm "$filepath"
        echo -e "${GREEN}✅ 삭제 완료${NC}"
    else
        echo "취소되었습니다"
    fi
}

function list_by_category() {
    echo -e "${BLUE}📋 카테고리별 목록${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    for category in dress top bottom outer; do
        echo -e "${GREEN}📁 $category${NC}"
        find "$LIBRARY_DIR" -type f -path "*/$category/*" | while read file; do
            echo "  - $(basename "$file")"
        done
        echo ""
    done
}

function search_images() {
    echo -e "${BLUE}🔍 이미지 검색${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    read -p "검색어: " keyword

    echo ""
    find "$LIBRARY_DIR" -type f -iname "*$keyword*" | while read file; do
        echo -e "${GREEN}✓${NC} $file"
    done
}

# 메인 실행
clear
show_menu
