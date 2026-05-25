# ===========================================================================
# VPC Module — HookMate Networking Layer
# ===========================================================================
# Mirrors the VPC created in HookMateAppStack (infrastructure/lib/hookmate-app-stack.ts).
#
# CDK equivalent:
#   new Vpc(this, 'HookMateVPC', {
#     ipAddresses: IpAddresses.cidr('10.0.0.0/16'),
#     maxAzs: 2,
#     subnetConfiguration: [
#       { name: 'Public', subnetType: SubnetType.PUBLIC, cidrMask: 24 },
#       { name: 'Private', subnetType: SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
#     ],
#     natGateways: 1,
#   });
# ===========================================================================

data "aws_availability_zones" "available" {
  state = "available"
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------
# /16 network providing 65,536 IP addresses. 2 AZs for basic HA within cost
# constraints (same as CDK: maxAzs: 2).
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

# ---------------------------------------------------------------------------
# Internet Gateway
# ---------------------------------------------------------------------------
# Needed for public subnets and the NAT Gateway to reach the internet.
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

# ---------------------------------------------------------------------------
# Elastic IP for NAT Gateway
# ---------------------------------------------------------------------------
# Single EIP for the single NAT Gateway (cost optimization — same as CDK).
resource "aws_eip" "nat" {
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-nat-eip"
  }
}

# ---------------------------------------------------------------------------
# NAT Gateway
# ---------------------------------------------------------------------------
# Placed in the first public subnet. Lambda functions in private subnets use
# this for internet access (e.g., Processor Lambda delivering webhooks to
# external destinations, AI Lambda calling OpenAI API).
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name = "${var.project_name}-nat-gateway"
  }
}

# ---------------------------------------------------------------------------
# Public Subnets
# ---------------------------------------------------------------------------
# 2 public subnets (/24 each), one per AZ. These host the NAT Gateway and
# any public-facing resources. map_public_ip_on_launch is true so instances
# get public IPs automatically.
resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-${data.aws_availability_zones.available.names[count.index]}"
  }
}

# ---------------------------------------------------------------------------
# Private Subnets
# ---------------------------------------------------------------------------
# 2 private subnets (/24 each), one per AZ. RDS, ElastiCache, and Lambda
# functions run in these subnets. Private subnets use the NAT Gateway for
# outbound internet (SubnetType.PRIVATE_WITH_EGRESS in CDK terms).
resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-private-${data.aws_availability_zones.available.names[count.index]}"
  }
}

# ---------------------------------------------------------------------------
# Public Route Table
# ---------------------------------------------------------------------------
# Routes 0.0.0.0/0 through the Internet Gateway. Associated with public subnets.
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Private Route Table
# ---------------------------------------------------------------------------
# Routes 0.0.0.0/0 through the NAT Gateway. Associated with private subnets.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-private-rt"
  }
}

resource "aws_route_table_association" "private" {
  count = 2

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
