import type { SampleAlert } from "../lib/types";

/**
 * Synthetic lab payloads modeled on GuardDuty / Wazuh finding structures.
 * All accounts, IPs (documentation ranges where possible), and IDs are fictional.
 */
export const SAMPLES: SampleAlert[] = [
  {
    id: "tor-egress",
    source: "GuardDuty",
    chip: "TOR EGRESS",
    title: "EC2 instance calling a Tor entry guard",
    vendorSeverity: "8 / High",
    json: `{
  "schemaVersion": "2.0",
  "id": "b7f7c3a8d9e1f2a3b4c5d6e7f8091a2b",
  "type": "UnauthorizedAccess:EC2/TorIPCaller",
  "title": "EC2 instance i-04a1b2c3d4e5f6789 is making connections to a Tor entry guard.",
  "description": "EC2 instance i-04a1b2c3d4e5f6789 is making outbound connections to a Tor entry guard node at 185.220.101.34.",
  "severity": 8,
  "region": "us-east-1",
  "accountId": "123456789012",
  "resource": {
    "resourceType": "Instance",
    "instanceDetails": {
      "instanceId": "i-04a1b2c3d4e5f6789",
      "instanceType": "t3.medium",
      "launchTime": "2026-02-11T09:14:02Z",
      "tags": [
        { "key": "Name", "value": "lab-worker-03" },
        { "key": "team", "value": "data-eng" }
      ],
      "networkInterfaces": [
        { "publicIp": "54.210.167.204", "privateIpAddress": "10.0.3.27" }
      ]
    }
  },
  "service": {
    "action": {
      "actionType": "NETWORK_CONNECTION",
      "networkConnectionAction": {
        "remoteIpDetails": { "ipAddressV4": "185.220.101.34" },
        "connectionDirection": "OUTBOUND",
        "remotePort": 9001,
        "localPort": 41032,
        "protocol": "TCP",
        "blocked": false
      }
    },
    "eventFirstSeen": "2026-02-12T02:41:17Z",
    "eventLastSeen": "2026-02-12T02:56:03Z",
    "count": 14
  }
}`,
  },
  {
    id: "ssh-probe",
    source: "GuardDuty",
    chip: "SSH PORT PROBE",
    title: "Port probe on unprotected SSH port",
    vendorSeverity: "2 / Low",
    json: `{
  "schemaVersion": "2.0",
  "id": "c9e2d4f6a8b0c2d4e6f8a0b2c4d6e8f0",
  "type": "Recon:EC2/PortProbeUnprotectedPort",
  "title": "i-0f9e8d7c6b5a49382 has an unprotected port which is being probed by a known malicious host.",
  "description": "Unprotected port 22 on EC2 instance i-0f9e8d7c6b5a49382 is being probed by 45.148.10.72. Port 22 is open to 0.0.0.0/0.",
  "severity": 2,
  "region": "eu-west-1",
  "accountId": "123456789012",
  "resource": {
    "resourceType": "Instance",
    "instanceDetails": {
      "instanceId": "i-0f9e8d7c6b5a49382",
      "instanceType": "m6i.large",
      "tags": [{ "key": "Name", "value": "edge-proxy-01" }]
    }
  },
  "service": {
    "action": {
      "actionType": "PORT_PROBE",
      "portProbeAction": {
        "portProbeDetails": [
          {
            "localPortDetails": { "port": 22, "portName": "SSH" },
            "localIpDetails": { "ipAddressV4": "10.0.1.14" },
            "remoteIpDetails": {
              "ipAddressV4": "45.148.10.72",
              "organization": { "asn": "60117", "asnOrg": "SPECTRE-HOSTING" }
            }
          }
        ],
        "blocked": false
      }
    },
    "eventFirstSeen": "2026-02-12T01:05:44Z",
    "eventLastSeen": "2026-02-12T03:22:10Z",
    "count": 238
  }
}`,
  },
  {
    id: "iam-anomaly",
    source: "GuardDuty",
    chip: "IAM ANOMALY",
    title: "Anomalous IAM API behavior — key creation + privilege attach",
    vendorSeverity: "8.5 / High",
    json: `{
  "schemaVersion": "2.0",
  "id": "d1a3b5c7e9f1a3b5c7e9f1a3b5c7e9f1",
  "type": "Persistence:IAMUser/AnomalousBehavior",
  "title": "API CreateAccessKey was invoked in an unusual manner by user svc-deploy.",
  "description": "User svc-deploy invoked CreateAccessKey and AttachUserPolicy (AdministratorAccess) from an IP address and user agent never previously observed for this principal.",
  "severity": 8.5,
  "region": "us-east-1",
  "accountId": "123456789012",
  "resource": {
    "resourceType": "AccessKey",
    "accessKeyDetails": {
      "accessKeyId": "AKIAIOSFODNN7LAB03X",
      "principalId": "AIDAI7Q3E5LABUSER01",
      "userType": "IAMUser",
      "userName": "svc-deploy"
    }
  },
  "service": {
    "action": {
      "actionType": "AWS_API_CALL",
      "awsApiCallAction": {
        "api": "CreateAccessKey",
        "serviceName": "iam.amazonaws.com",
        "callerType": "Remote IP",
        "remoteIpDetails": { "ipAddressV4": "203.0.113.9" },
        "userAgent": "aws-cli/2.15.8 Linux/6.1.0-13-amd64"
      }
    },
    "additionalInfo": {
      "anomalousAPIs": "AttachUserPolicy,CreateAccessKey,GetAccountAuthorizationDetails"
    },
    "eventFirstSeen": "2026-02-12T04:12:31Z",
    "eventLastSeen": "2026-02-12T04:19:02Z",
    "count": 6
  }
}`,
  },
  {
    id: "crypto-miner",
    source: "GuardDuty",
    chip: "CRYPTOMINING DNS",
    title: "Bitcoin/mining tool DNS queries from EC2",
    vendorSeverity: "8 / High",
    json: `{
  "schemaVersion": "2.0",
  "id": "e2b4c6d8f0a2b4c6d8f0a2b4c6d8f0a2",
  "type": "CryptoMining:EC2/BitcoinTool.B!DNS",
  "title": "EC2 instance i-0a1b2c3d4e5f60719 is querying a domain name related to a known cryptocurrency mining tool.",
  "description": "EC2 instance i-0a1b2c3d4e5f60719 is querying pool.stratum-xmr.examplemining.net, associated with Monero mining tooling.",
  "severity": 8,
  "region": "us-west-2",
  "accountId": "123456789012",
  "resource": {
    "resourceType": "Instance",
    "instanceDetails": {
      "instanceId": "i-0a1b2c3d4e5f60719",
      "instanceType": "c5.4xlarge",
      "launchTime": "2026-02-11T23:47:55Z",
      "tags": [{ "key": "Name", "value": "batch-runner-12" }]
    }
  },
  "service": {
    "action": {
      "actionType": "DNS_REQUEST",
      "dnsRequestAction": {
        "domain": "pool.stratum-xmr.examplemining.net",
        "protocol": "UDP",
        "blocked": false
      }
    },
    "evidence": [
      { "threatIntelligenceDetails": { "threatNames": ["CoinMiner:Stratum"] } }
    ],
    "eventFirstSeen": "2026-02-12T00:02:19Z",
    "eventLastSeen": "2026-02-12T05:44:51Z",
    "count": 1872
  }
}`,
  },
  {
    id: "s3-exposure",
    source: "GuardDuty",
    chip: "S3 BPA DISABLED",
    title: "S3 BlockPublicAccess disabled on finance bucket",
    vendorSeverity: "5 / Medium",
    json: `{
  "schemaVersion": "2.0",
  "id": "f3c5d7e9a1b3c5d7e9a1b3c5d7e9a1b3",
  "type": "Policy:S3/BucketBlockPublicAccessDisabled",
  "title": "S3 Block Public Access was disabled for bucket corp-finance-reports.",
  "description": "IAM principal contractor-rj disabled Block Public Access on S3 bucket corp-finance-reports, which contains quarterly finance exports.",
  "severity": 5,
  "region": "us-east-1",
  "accountId": "123456789012",
  "resource": {
    "resourceType": "Bucket",
    "bucketDetails": {
      "name": "corp-finance-reports",
      "arn": "arn:aws:s3:::corp-finance-reports",
      "publicAccess": {
        "effectivePermission": "PUBLIC_READABLE",
        "permissionConfiguration": { "accountLevelPermissions": { "blockPublicAccess": { "blockPublicAccessEnabled": false } } }
      }
    }
  },
  "service": {
    "action": {
      "actionType": "AWS_API_CALL",
      "awsApiCallAction": {
        "api": "DeleteBucketPublicAccessBlock",
        "serviceName": "s3.amazonaws.com",
        "remoteIpDetails": { "ipAddressV4": "198.51.100.23" },
        "userAgent": "console.amazonaws.com"
      }
    },
    "eventFirstSeen": "2026-02-11T16:31:08Z",
    "eventLastSeen": "2026-02-11T16:31:08Z",
    "count": 1
  }
}`,
  },
  {
    id: "ssh-bruteforce",
    source: "Wazuh",
    chip: "SSH BRUTE FORCE",
    title: "Multiple SSH authentication failures on bastion",
    vendorSeverity: "Level 10",
    json: `{
  "timestamp": "2026-02-12T03:12:44.182Z",
  "rule": {
    "level": 10,
    "description": "sshd: multiple authentication failures.",
    "id": "5712",
    "firedtimes": 41,
    "mail": false,
    "groups": ["syslog", "sshd", "authentication_failures"],
    "mitre": { "tactic": ["Credential Access"], "id": ["T1110"] }
  },
  "agent": { "id": "003", "name": "bastion-01", "ip": "10.0.0.8" },
  "manager": { "name": "wazuh-manager-01" },
  "data": { "srcip": "91.240.118.172", "srcuser": "root", "dstuser": "root" },
  "decoder": { "name": "sshd" },
  "full_log": "Feb 12 03:12:41 bastion-01 sshd[2214]: Failed password for root from 91.240.118.172 port 51822 ssh2",
  "predecoder": { "hostname": "bastion-01", "program_name": "sshd" }
}`,
  },
];
