# 네트워크 구성

## VPC
- dev VPC ID: `vpc-xxxxxxxxx`        (실값으로 교체)
- CIDR: `10.10.0.0/16`

## Subnet
- public-2a:  `subnet-xxxxxxx` (10.10.1.0/24)
- public-2c:  `subnet-xxxxxxx` (10.10.2.0/24)
- private-2a: `subnet-xxxxxxx` (10.10.11.0/24)
- private-2c: `subnet-xxxxxxx` (10.10.12.0/24)

## 라우팅
- public 서브넷 → IGW
- private 서브넷 → NAT Gateway (public-2a)

## 다른 환경
- staging VPC: `10.20.0.0/16` (TBD)
- prod VPC:    `10.30.0.0/16` (TBD)
