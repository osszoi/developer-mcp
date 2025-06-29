# GCloud MCP Tools Roadmap

## Phase 1: Core Tools (Priority: HIGH) ✅

### 1. Kubernetes/Workloads
- [x] `gcloud_clusters_list` - List all GKE clusters
- [x] `gcloud_cluster_describe` - Get cluster details
- [x] `gcloud_workloads_list` - List workloads in a cluster
- [x] `gcloud_workload_describe` - Get workload details (deployments, pods, services)
- [x] `gcloud_workload_history` - Get deployment history/rollout status

### 2. Artifact Registry
- [x] `gcloud_artifacts_repositories_list` - List artifact repositories
- [x] `gcloud_artifacts_list` - List artifacts/images in a repository
- [x] `gcloud_artifact_versions` - List versions of an artifact
- [x] `gcloud_artifact_describe` - Get artifact details/metadata

### 3. Cloud Storage
- [x] `gcloud_buckets_list` - List all storage buckets
- [x] `gcloud_bucket_describe` - Get bucket details
- [x] `gcloud_bucket_objects_list` - List objects in a bucket
- [x] `gcloud_bucket_object_read` - Read object content
- [x] `gcloud_bucket_object_metadata` - Get object metadata

### 4. Cloud Logging
- [x] `gcloud_logs_read` - Read logs with filters
- [x] `gcloud_logs_tail` - Tail logs in real-time
- [x] `gcloud_logs_query` - Advanced log queries
- [x] `gcloud_logs_sinks_list` - List log sinks

## Phase 2: Essential Services (Priority: MEDIUM)

### 5. IAM & Security
- [ ] `gcloud_iam_roles_list` - List IAM roles
- [ ] `gcloud_iam_policy_get` - Get IAM policy for a resource
- [ ] `gcloud_service_accounts_list` - List service accounts
- [ ] `gcloud_service_account_keys_list` - List service account keys

### 6. Secrets Manager
- [ ] `gcloud_secrets_list` - List secrets
- [ ] `gcloud_secret_versions_list` - List secret versions
- [ ] `gcloud_secret_get` - Get secret value (with proper security warnings)

### 7. Cloud Run
- [ ] `gcloud_run_services_list` - List Cloud Run services
- [ ] `gcloud_run_service_describe` - Get service details
- [ ] `gcloud_run_revisions_list` - List service revisions
- [ ] `gcloud_run_logs` - Get Cloud Run logs

### 8. Compute Engine
- [ ] `gcloud_compute_instances_list` - List VM instances
- [ ] `gcloud_compute_instance_describe` - Get instance details
- [ ] `gcloud_compute_disks_list` - List disks
- [ ] `gcloud_compute_networks_list` - List networks

## Phase 3: Additional Services (Priority: LOW)

### 9. Cloud SQL
- [ ] `gcloud_sql_instances_list` - List Cloud SQL instances
- [ ] `gcloud_sql_instance_describe` - Get instance details
- [ ] `gcloud_sql_databases_list` - List databases
- [ ] `gcloud_sql_backups_list` - List backups

### 10. Pub/Sub
- [ ] `gcloud_pubsub_topics_list` - List topics
- [ ] `gcloud_pubsub_subscriptions_list` - List subscriptions
- [ ] `gcloud_pubsub_topic_describe` - Get topic details

### 11. Cloud Functions
- [ ] `gcloud_functions_list` - List functions
- [ ] `gcloud_function_describe` - Get function details
- [ ] `gcloud_function_logs` - Get function logs

### 12. Monitoring
- [ ] `gcloud_monitoring_metrics_list` - List available metrics
- [ ] `gcloud_monitoring_alerts_list` - List alert policies
- [ ] `gcloud_monitoring_dashboards_list` - List dashboards

### 13. Networking
- [ ] `gcloud_vpc_list` - List VPCs
- [ ] `gcloud_subnets_list` - List subnets
- [ ] `gcloud_firewall_rules_list` - List firewall rules
- [ ] `gcloud_load_balancers_list` - List load balancers

### 14. BigQuery
- [ ] `gcloud_bigquery_datasets_list` - List datasets
- [ ] `gcloud_bigquery_tables_list` - List tables
- [ ] `gcloud_bigquery_query` - Run queries

### 15. APIs & Services
- [ ] `gcloud_apis_list` - List enabled APIs
- [ ] `gcloud_api_keys_list` - List API keys
- [ ] `gcloud_quotas_list` - List quotas

## Implementation Notes

1. **Authentication**: All tools must check for:
   - gcloud CLI installation
   - Active authentication (`gcloud auth list`)
   - Current project set (`gcloud config get-value project`)

2. **Error Handling**: Provide clear error messages for:
   - Missing gcloud CLI
   - Not authenticated
   - Insufficient permissions
   - Resource not found

3. **Output Format**: 
   - Use JSON output from gcloud where available
   - Parse and format for human readability
   - Include relevant timestamps and metadata

4. **Performance**: 
   - Implement pagination for list operations
   - Add reasonable limits by default
   - Support filtering where applicable