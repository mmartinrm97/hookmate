import { CfnOutput, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { type IVpc, Peer, Port, SecurityGroup } from 'aws-cdk-lib/aws-ec2';
import { CfnCacheCluster, CfnSubnetGroup } from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface CacheStackProps extends StackProps {
  /** VPC created by the app orchestrator stack */
  readonly vpc: IVpc;
}

export class CacheStack extends Stack {
  /** The ElastiCache Redis CfnCacheCluster */
  public readonly cacheCluster: CfnCacheCluster;

  /** Security group allowing Redis access from private subnets */
  public readonly cacheSecurityGroup: SecurityGroup;

  /** Redis endpoint hostname */
  public readonly redisEndpoint: string;

  /** Redis endpoint port */
  public readonly redisPort: number;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    const { vpc } = props;

    // --- Security Group ---
    // Only allow Redis traffic (6379) from within the VPC's private subnets.
    this.cacheSecurityGroup = new SecurityGroup(this, 'CacheSecurityGroup', {
      vpc,
      description: 'Allow Redis access from private subnets only',
      allowAllOutbound: false,
    });

    this.cacheSecurityGroup.addIngressRule(
      Peer.ipv4(vpc.vpcCidrBlock),
      Port.tcp(6379),
      'Allow Redis from VPC private subnets',
    );

    // --- Subnet Group ---
    // ElastiCache requires a subnet group to place the cluster in private subnets.
    const subnetGroup = new CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for HookMate ElastiCache Redis',
      subnetIds: vpc.privateSubnets.map((s) => s.subnetId),
    });

    // --- Redis Cluster ---
    // Single-node Redis 7 cluster (t3.micro, cost constraint).
    // For production, use a replication group with Multi-AZ.
    this.cacheCluster = new CfnCacheCluster(this, 'HookMateRedis', {
      engine: 'redis',
      cacheNodeType: 'cache.t3.micro',
      numCacheNodes: 1,
      engineVersion: '7.0',
      vpcSecurityGroupIds: [this.cacheSecurityGroup.securityGroupId],
      cacheSubnetGroupName: subnetGroup.ref,
      autoMinorVersionUpgrade: true,
    });

    // Apply removal policy via the underlying CloudFormation resource
    this.cacheCluster.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Derive the endpoint attribute (CDK L1 exposes this via getAtt)
    this.redisEndpoint = this.cacheCluster.attrRedisEndpointAddress;
    this.redisPort = Number(this.cacheCluster.attrRedisEndpointPort);

    // --- Outputs ---
    new CfnOutput(this, 'RedisEndpoint', {
      value: this.redisEndpoint,
      description: 'ElastiCache Redis primary endpoint',
    });

    new CfnOutput(this, 'RedisPort', {
      value: String(this.redisPort),
      description: 'ElastiCache Redis port',
    });

    new CfnOutput(this, 'RedisUrl', {
      value: `redis://${this.redisEndpoint}:${this.redisPort}`,
      description: 'Redis connection URL',
    });
  }
}
