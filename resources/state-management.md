# State 관리

## 백엔드
- S3 버킷: `rorr-tfstate-239460481239-us-east-1`
- DynamoDB Lock 테이블: `rorr-tfstate-lock`
- State key: `<env>/terraform.tfstate`

## 환경별 분리
환경마다 별도 state 파일. 한 환경의 plan/apply가 다른 환경 영향 X.

## 금지
- `backend.tf` 변경 금지 (`global/tfstate-backend/` 부트스트랩 외)
- `terraform state rm`, `terraform taint`는 사람만 (MCP 자동 실행 X)
- `.tfstate` 파일 커밋 금지

## 백업
- S3 버킷에 버전 관리 활성화 (state 변경 이력 보존)
