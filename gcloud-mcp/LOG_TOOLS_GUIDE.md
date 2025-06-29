# GCloud MCP - Kubernetes Log Tools Guide

This guide explains the new Kubernetes log tools that make it easy to get logs from your workloads.

## Available Log Tools

### 1. `gcloud_logs_simple` - Quick Pod Logs
The simplest way to get logs from a pod.

**Example:**
```
{
  "pod": "content-api",
  "cluster": "dev-cluster",
  "namespace": "default",
  "lines": 50
}
```

**Features:**
- Works with partial pod names
- Uses Cloud Logging (no kubectl required)
- Optional grep filter
- Shows timestamps

### 2. `gcloud_deployment_logs` - Deployment Logs
Gets aggregated logs from all pods in a deployment.

**Example:**
```
{
  "deployment": "content-api",
  "cluster": "dev-cluster", 
  "namespace": "default",
  "lines": 20,
  "since": "30m",
  "severity": "ERROR"
}
```

**Features:**
- Shows logs from all pods in the deployment
- Filters by severity level
- Configurable time range
- Table format with pod identifiers

### 3. `gcloud_workload_logs` - Advanced Workload Logs
Most flexible tool that tries kubectl first, then falls back to Cloud Logging.

**Example:**
```
{
  "workload": "content-api",
  "cluster": "dev-cluster",
  "namespace": "default",
  "type": "deployment",
  "lines": 100,
  "since": "1h",
  "follow": false
}
```

**Features:**
- Auto-detects workload type
- Supports kubectl features (follow, previous)
- Container selection for multi-container pods
- Best performance when kubectl is available

## Quick Examples

### Get recent errors from content-api:
```
Use gcloud_logs_simple with:
- pod: "content-api"
- cluster: "dev-cluster"  
- grep: "ERROR"
```

### See what's happening in a deployment:
```
Use gcloud_deployment_logs with:
- deployment: "backend-api"
- cluster: "dev-cluster"
- since: "10m"
```

### Follow logs in real-time (requires kubectl):
```
Use gcloud_workload_logs with:
- workload: "async-control"
- cluster: "dev-cluster"
- follow: true
```

## Tips

1. **Performance**: `logs_simple` is fastest for quick checks
2. **Debugging**: `deployment_logs` shows logs from all pods at once
3. **Real-time**: `workload_logs` with follow=true for live logs (kubectl required)
4. **Time ranges**: Use formats like "5m", "1h", "2d" for the `since` parameter
5. **Filtering**: Add grep parameter to filter specific text

## Troubleshooting

If logs aren't showing:
1. Verify the pod/deployment name with `gcloud_workloads_list`
2. Check the namespace (defaults to "default")
3. Increase the time range (since: "1h" or "6h")
4. For kubectl-based tools, ensure gke-gcloud-auth-plugin is installed