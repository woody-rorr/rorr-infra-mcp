# Amazon MSK (Kafka) 생성 가이드

## 참고 파일
- `resources/aws-conventions.md`
- `resources/network-topology.md`
- `resources/security-policy.md`
- `resources/cost-policy.md`

## 생성 시 체크리스트
- [ ] 네이밍 규칙: `{env}-{service}-msk`
- [ ] 필수 태그 부착
- [ ] private subnet 배치 (`broker_node_group_info.client_subnets`)
- [ ] 보안그룹: producer/consumer SG에서만 9092/9094/9098 inbound
- [ ] 암호화: `encryption_info.encryption_at_rest_kms_key_arn` 지정, `encryption_in_transit` TLS
- [ ] 인증: IAM Auth (`client_authentication.sasl.iam = true`) 권장
- [ ] CloudWatch Logs 활성화

## variables.tf 권장
```hcl
variable "cluster_name"
variable "environment"
variable "kafka_version"        # "3.6.0" 등
variable "number_of_broker_nodes"  # AZ 수의 배수 (보통 3 또는 6)
variable "instance_type"        # dev: kafka.t3.small, prod: kafka.m5.large+
variable "ebs_volume_size"      # GB
variable "subnet_ids"           # private, AZ 수와 일치
variable "vpc_id"
variable "client_security_group_ids"
variable "kms_key_arn"
```

## 토픽 (이 프로젝트)
- `dc.live.raw`
- `lol.live.processed`
- `lol.llm.result`

## 비용 가드
- dev: `kafka.t3.small`, 3 brokers, 100GB EBS
- staging: `kafka.m5.large`, 3 brokers
- prod: `kafka.m5.large` 이상, 6 brokers, Multi-AZ
- 사용 안 할 때 `count = 0` 또는 별도 토글 변수
