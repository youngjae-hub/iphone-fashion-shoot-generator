#!/usr/bin/env python3
"""
포즈 스켈레톤 추출 스크립트 (DWPose 기반)

참고 이미지에서 DWPose 스켈레톤을 추출하여 ControlNet용 이미지 생성

사용법:
python3 scripts/extract-pose-skeletons.py
"""

import os
import sys
from pathlib import Path

# Output directory
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "pose-skeletons"

# Pose reference images (분석 결과 기반 선정)
POSE_REFERENCE_IMAGES = {
    # 정면 스탠딩 - 손 연출
    "front-standing": "/Users/hwiminhan/Downloads/보정/모델컷/QU25WDW004/P20251202_102809537_63A9AAE3-CE09-462B-B590-78FC6DED8AC0.JPG",

    # 3/4 측면 (소파에 앉기)
    "side-quarter": "/Users/hwiminhan/Downloads/보정/모델컷/QU25WZU003/(메인) P20251202_130712132_7144214A-008C-4C32-85DC-0AEB639D1F14.JPG",

    # 뒷면 (고개 살짝 돌림)
    "back-view": "/Users/hwiminhan/Downloads/보정/모델컷/QU25WNT016/P20251202_111033421_86AA65BF-9103-4504-9141-B558EB7CC02B.JPG",

    # 측면 프로필 (3/4 턴, 창가)
    "side-profile": "/Users/hwiminhan/Downloads/촬영 원본/1/IMG_3450.jpg",

    # 전신 스탠딩 (하의 포커스)
    "fullbody": "/Users/hwiminhan/Downloads/보정/모델컷/QU25WSK009/P20251202_121609895_1C827D19-27BA-4836-82E9-8531F0E2D4A1.JPG",

    # 연출 (옷 만지기)
    "styled": "/Users/hwiminhan/Downloads/보정/모델컷/QU25WNT016/(메인) P20251202_140550997_77D4A5EC-FD15-4BE8-9595-1F75F4472B1A.JPG",
}


def extract_with_dwpose():
    """DWPose를 사용한 스켈레톤 추출"""
    print("🔧 Using DWPose for skeleton extraction...")

    try:
        from easy_dwpose import DWposeDetector
        import cv2
        import numpy as np
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Please run: pip3 install easy_dwpose opencv-python")
        return False

    # Initialize DWPose detector
    print("🔄 Initializing DWPose detector (first run may download models)...")
    detector = DWposeDetector()

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {OUTPUT_DIR}")

    success_count = 0

    for pose_name, image_path in POSE_REFERENCE_IMAGES.items():
        print(f"\n📸 Processing: {pose_name}")
        print(f"   Source: {os.path.basename(image_path)}")

        # Check if file exists
        if not os.path.exists(image_path):
            print(f"   ⚠️ File not found, skipping...")
            continue

        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                print(f"   ❌ Failed to read image")
                continue

            # Convert BGR to RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Detect pose and get skeleton image
            print("   🔄 Detecting pose...")
            skeleton_image = detector(image_rgb)

            # Save skeleton image
            output_path = OUTPUT_DIR / f"{pose_name}.png"

            # Handle different output formats
            if isinstance(skeleton_image, np.ndarray):
                # Convert RGB back to BGR for saving
                skeleton_bgr = cv2.cvtColor(skeleton_image, cv2.COLOR_RGB2BGR)
                cv2.imwrite(str(output_path), skeleton_bgr)
                print(f"   ✅ Saved: {output_path}")
                success_count += 1
            elif hasattr(skeleton_image, 'save'):
                # PIL Image
                skeleton_image.save(str(output_path))
                print(f"   ✅ Saved: {output_path}")
                success_count += 1
            else:
                print(f"   ⚠️ Unexpected output format: {type(skeleton_image)}")

        except Exception as e:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()

    return success_count


def extract_with_mediapipe():
    """MediaPipe를 사용한 대체 스켈레톤 추출"""
    print("🔧 Using MediaPipe for skeleton extraction...")

    try:
        import cv2
        import mediapipe as mp
        import numpy as np
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Please run: pip3 install mediapipe opencv-python")
        return 0

    # Initialize MediaPipe Pose
    mp_pose = mp.solutions.pose
    mp_drawing = mp.solutions.drawing_utils
    mp_drawing_styles = mp.solutions.drawing_styles

    pose = mp_pose.Pose(
        static_image_mode=True,
        model_complexity=2,
        enable_segmentation=False,
        min_detection_confidence=0.5
    )

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📁 Output directory: {OUTPUT_DIR}")

    success_count = 0

    for pose_name, image_path in POSE_REFERENCE_IMAGES.items():
        print(f"\n📸 Processing: {pose_name}")
        print(f"   Source: {os.path.basename(image_path)}")

        # Check if file exists
        if not os.path.exists(image_path):
            print(f"   ⚠️ File not found, skipping...")
            continue

        try:
            # Read image
            image = cv2.imread(image_path)
            if image is None:
                print(f"   ❌ Failed to read image")
                continue

            height, width = image.shape[:2]

            # Convert BGR to RGB
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

            # Process with MediaPipe
            print("   🔄 Detecting pose...")
            results = pose.process(image_rgb)

            if not results.pose_landmarks:
                print(f"   ⚠️ No pose detected")
                continue

            # Create black background
            skeleton_image = np.zeros((height, width, 3), dtype=np.uint8)

            # Draw pose landmarks
            mp_drawing.draw_landmarks(
                skeleton_image,
                results.pose_landmarks,
                mp_pose.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style()
            )

            # Save skeleton image
            output_path = OUTPUT_DIR / f"{pose_name}.png"
            cv2.imwrite(str(output_path), skeleton_image)
            print(f"   ✅ Saved: {output_path}")
            success_count += 1

        except Exception as e:
            print(f"   ❌ Error: {e}")
            import traceback
            traceback.print_exc()

    pose.close()
    return success_count


def main():
    print("🦴 Pose Skeleton Extraction Script")
    print("=" * 40)

    # Try DWPose first (better quality)
    success_count = 0

    try:
        success_count = extract_with_dwpose()
    except Exception as e:
        print(f"\n⚠️ DWPose failed: {e}")
        print("   Falling back to MediaPipe...")
        success_count = extract_with_mediapipe()

    # Summary
    print("\n\n📊 Summary")
    print("=" * 40)
    print(f"Total: {success_count}/{len(POSE_REFERENCE_IMAGES)} succeeded")

    if success_count > 0:
        print("\n📝 Next steps:")
        print("1. Check generated skeletons in public/pose-skeletons/")
        print("2. Update POSE_SKELETONS in src/lib/providers/controlnet.ts")
        print("3. Implement ControlNet API integration")


if __name__ == "__main__":
    main()
