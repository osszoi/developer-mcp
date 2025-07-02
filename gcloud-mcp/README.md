# GCloud MCP

A comprehensive Model Context Protocol (MCP) server for Google Cloud Platform tools.

## Features

This MCP server provides tools for interacting with various GCP services:

### Currently Implemented (Phase 1)

#### Kubernetes/GKE
- `gcloud_clusters_list` - List all GKE clusters
- `gcloud_cluster_describe` - Get detailed cluster information
- `gcloud_workloads_list` - List deployments, pods, and services
- `gcloud_workload_describe` - Get details about specific workloads
- `gcloud_workload_history` - View deployment history and rollout status

#### Artifact Registry
- `gcloud_artifacts_repositories_list` - List artifact repositories
- `gcloud_artifacts_list` - List artifacts/images in a repository
- `gcloud_artifact_versions` - List versions of an artifact
- `gcloud_artifact_describe` - Get artifact details and metadata

#### Cloud Storage
- `gcloud_buckets_list` - List all storage buckets
- `gcloud_bucket_describe` - Get bucket configuration details
- `gcloud_bucket_objects_list` - List objects in a bucket
- `gcloud_bucket_object_read` - Read object content
- `gcloud_bucket_object_metadata` - Get object metadata

#### Cloud Logging
- `gcloud_logs_read` - Read logs with various filters
- `gcloud_logs_tail` - Stream logs in real-time
- `gcloud_logs_query` - Execute advanced log queries
- `gcloud_logs_sinks_list` - List log routing destinations

## Prerequisites

1. **gcloud CLI**: Must be installed and in your PATH
   - Install from: https://cloud.google.com/sdk/docs/install

2. **Authentication**: Must be authenticated with gcloud
   ```bash
   gcloud auth login
   ```

3. **Project**: Must have a default project set
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

4. **kubectl**: Required for Kubernetes tools
   - Usually installed with gcloud: `gcloud components install kubectl`

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Add the server to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "gcloud-mcp": {
      "command": "node",
      "args": [
        "/absolute/path/to/gcloud-mcp/build/index.js"
      ]
    }
  }
}
```

## Usage Examples

### Kubernetes Workloads

**Q: When was the last example-app workload deployed in my-cluster?**
```
1. gcloud_clusters_list
2. gcloud_workload_history cluster: "my-cluster", deployment: "example-app"
```

### Artifact Registry

**Q: What is the latest version of my-service artifact?**
```
1. gcloud_artifacts_repositories_list
2. gcloud_artifact_versions repository: "my-repo", location: "us-central1", package: "my-service"
```

### Cloud Logging

**Q: What are the latest error logs from example-app in my-cluster?**
```
gcloud_logs_read resource: "k8s_container", severity: "ERROR", filter: "resource.labels.container_name='example-app' AND resource.labels.cluster_name='my-cluster'"
```

### Cloud Storage

**Q: List all objects in my-data-bucket**
```
gcloud_bucket_objects_list bucket: "my-data-bucket", recursive: true
```

## Error Handling

All tools include comprehensive error handling:

- **Not Installed**: Clear message if gcloud CLI is not found
- **Not Authenticated**: Instructions to run `gcloud auth login`
- **No Project**: Instructions to set a project
- **Permission Errors**: Clear messages about required permissions
- **Resource Not Found**: Helpful error messages with suggestions

## Tool Parameters

Most tools support these common parameters:
- `project`: Override the default project
- `limit`: Control the number of results
- `filter`: Apply filters to results

Kubernetes tools require:
- `cluster`: Name of the GKE cluster
- `zone` or `region`: Cluster location

## Development

### Adding New Tools

1. Create a new file in `src/tools/<category>/<tool-name>.ts`
2. Implement the `ToolDefinition` interface
3. Export as default
4. The tool will be automatically loaded with the `gcloud_` prefix

### Tool Structure
```typescript
import { z } from 'zod';
import { ToolDefinition } from '../../types.js';
import { executeGCloudCommand } from '../../utils/gcloud.js';

const inputSchema = z.object({
  // Define parameters
});

const gcloudToolNameTool: ToolDefinition = {
  name: 'tool_name',
  description: 'Tool description',
  category: 'category',
  subcategory: 'subcategory',
  version: '1.0.0',
  inputSchema,
  handler: async (input) => {
    // Implementation
  }
};

export default gcloudToolNameTool;
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) for planned features including:
- IAM & Security tools
- Secrets Manager integration  
- Cloud Run support
- Compute Engine management
- And many more GCP services

## License

MIT