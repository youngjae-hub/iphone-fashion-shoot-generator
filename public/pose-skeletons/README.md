# Pose Skeleton Images for ControlNet

이 디렉토리에 OpenPose 스켈레톤 이미지를 추가해야 합니다.

## 필요한 이미지

| 파일명 | 포즈 | 설명 |
|--------|------|------|
| `front.png` | 정면 | 카메라를 향해 서있는 자세 |
| `back.png` | 뒷면 | **카메라에서 등을 돌린 자세** (핵심!) |
| `side.png` | 측면 | 3/4 각도로 서있는 자세 |
| `styled.png` | 연출 | 손으로 머리 만지는 등 동적 자세 |
| `sitting.png` | 앉은 | 의자에 앉은 자세 |
| `fullbody.png` | 전신 | 머리부터 발끝까지 보이는 자세 |

## 이미지 규격

- **해상도**: 512x768 또는 768x1024 권장
- **형식**: PNG (투명 배경)
- **색상**: 흰색 배경에 검은색 스켈레톤

## 스켈레톤 생성 방법

1. **기존 이미지에서 추출**: OpenPose 또는 DWPose 모델로 기존 모델 사진에서 스켈레톤 추출
2. **직접 그리기**: Blender 또는 포토샵으로 스켈레톤 직접 제작
3. **온라인 생성기**: posemy.art 등의 서비스 활용

## 참고 자료

- OpenPose: https://github.com/CMU-Perceptual-Computing-Lab/openpose
- ControlNet: https://github.com/lllyasviel/ControlNet
- Replicate ControlNet: https://replicate.com/jagilley/controlnet-pose
