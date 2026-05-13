import { z } from "zod";
import { EC2Client, DescribeSecurityGroupsCommand, DescribeSubnetsCommand, DescribeVpcsCommand } from "@aws-sdk/client-ec2";
import { ECSClient, DescribeServicesCommand, DescribeTasksCommand, ListTasksCommand, DescribeTaskDefinitionCommand } from "@aws-sdk/client-ecs";
import { ElasticLoadBalancingV2Client, DescribeTargetHealthCommand, DescribeLoadBalancersCommand, DescribeTargetGroupsCommand, DescribeListenersCommand } from "@aws-sdk/client-elastic-load-balancing-v2";
import { CloudWatchLogsClient, GetLogEventsCommand, DescribeLogStreamsCommand } from "@aws-sdk/client-cloudwatch-logs";

const region = process.env.AWS_REGION || "us-east-1";
const ec2 = new EC2Client({ region });
const ecs = new ECSClient({ region });
const elb = new ElasticLoadBalancingV2Client({ region });
const logs = new CloudWatchLogsClient({ region });

const text = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2).slice(0, 60000) }] });
const err = (e) => ({ content: [{ type: "text", text: `Error: ${e.message}` }] });

export function registerAwsDescribe(server) {
  server.tool(
    "aws_describe_security_group",
    "지정한 SG의 인바운드/아웃바운드 룰을 조회합니다.",
    { group_ids: z.array(z.string()).optional(), group_names: z.array(z.string()).optional() },
    async ({ group_ids, group_names }) => {
      try {
        const r = await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: group_ids, GroupNames: group_names }));
        return text(r.SecurityGroups);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_vpc",
    "VPC 정보 조회 (ID 또는 태그).",
    { vpc_ids: z.array(z.string()).optional() },
    async ({ vpc_ids }) => {
      try {
        const r = await ec2.send(new DescribeVpcsCommand({ VpcIds: vpc_ids }));
        return text(r.Vpcs);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_subnets",
    "서브넷 정보 조회.",
    { subnet_ids: z.array(z.string()).optional(), vpc_id: z.string().optional() },
    async ({ subnet_ids, vpc_id }) => {
      try {
        const filters = vpc_id ? [{ Name: "vpc-id", Values: [vpc_id] }] : undefined;
        const r = await ec2.send(new DescribeSubnetsCommand({ SubnetIds: subnet_ids, Filters: filters }));
        return text(r.Subnets);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_ecs_service",
    "ECS 서비스 상태(태스크 수, deployment 상태 등) 조회.",
    { cluster: z.string(), services: z.array(z.string()) },
    async ({ cluster, services }) => {
      try {
        const r = await ecs.send(new DescribeServicesCommand({ cluster, services }));
        return text(r.services);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_ecs_tasks",
    "ECS 서비스의 실행 중인 태스크 상세 조회.",
    { cluster: z.string(), service: z.string() },
    async ({ cluster, service }) => {
      try {
        const list = await ecs.send(new ListTasksCommand({ cluster, serviceName: service }));
        if (!list.taskArns?.length) return text({ tasks: [], message: "no running tasks" });
        const r = await ecs.send(new DescribeTasksCommand({ cluster, tasks: list.taskArns }));
        return text(r.tasks);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_task_definition",
    "ECS Task Definition 상세(컨테이너 정의, env, secrets) 조회.",
    { task_definition: z.string() },
    async ({ task_definition }) => {
      try {
        const r = await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: task_definition }));
        return text(r.taskDefinition);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_load_balancer",
    "ALB/NLB 정보 + DNS + ARN 조회.",
    { names: z.array(z.string()).optional(), arns: z.array(z.string()).optional() },
    async ({ names, arns }) => {
      try {
        const r = await elb.send(new DescribeLoadBalancersCommand({ Names: names, LoadBalancerArns: arns }));
        return text(r.LoadBalancers);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_target_health",
    "ALB Target Group의 대상 헬스 상태(healthy/unhealthy + 사유) 조회.",
    { target_group_arn: z.string().optional(), target_group_name: z.string().optional() },
    async ({ target_group_arn, target_group_name }) => {
      try {
        let arn = target_group_arn;
        if (!arn && target_group_name) {
          const tg = await elb.send(new DescribeTargetGroupsCommand({ Names: [target_group_name] }));
          arn = tg.TargetGroups?.[0]?.TargetGroupArn;
        }
        if (!arn) return err(new Error("target_group_arn 또는 target_group_name 필수"));
        const r = await elb.send(new DescribeTargetHealthCommand({ TargetGroupArn: arn }));
        return text(r.TargetHealthDescriptions);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_describe_listeners",
    "ALB 리스너 목록 + 라우팅 규칙.",
    { load_balancer_arn: z.string() },
    async ({ load_balancer_arn }) => {
      try {
        const r = await elb.send(new DescribeListenersCommand({ LoadBalancerArn: load_balancer_arn }));
        return text(r.Listeners);
      } catch (e) { return err(e); }
    }
  );

  server.tool(
    "aws_logs_tail",
    "CloudWatch 로그 그룹의 최근 로그를 조회.",
    {
      log_group: z.string().describe("예: /ecs/rorr-mcp-orchestrator"),
      limit: z.number().int().min(1).max(500).default(100),
    },
    async ({ log_group, limit }) => {
      try {
        const streams = await logs.send(new DescribeLogStreamsCommand({
          logGroupName: log_group,
          orderBy: "LastEventTime",
          descending: true,
          limit: 3,
        }));
        if (!streams.logStreams?.length) return text({ message: "no log streams" });
        const out = [];
        for (const s of streams.logStreams) {
          const ev = await logs.send(new GetLogEventsCommand({
            logGroupName: log_group,
            logStreamName: s.logStreamName,
            limit,
            startFromHead: false,
          }));
          out.push({ stream: s.logStreamName, events: (ev.events ?? []).map((e) => ({ t: e.timestamp, m: e.message })) });
        }
        return text(out);
      } catch (e) { return err(e); }
    }
  );
}
