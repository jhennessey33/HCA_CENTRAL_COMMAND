Data Ingestion Design
Wells Fargo Data
Wells reports should become the official source for positions, trades, and past positions.
MVP Ingestion
Manual upload of files through an admin interface.
Production Ingestion
Automated SFTP retrieval.
Ingestion Pipeline

Retrieve → Store Raw → Validate → Parse → Normalize → Reconcile → Load → Audit → Alert

Failure Handling
If ingestion fails:

- Previous successful data remains active.
- Ingestion run marked as failed.
- Error message stored.
- Admin alert generated.
- Failed rows captured when possible.
  Bloomberg Data
  Bloomberg should power market/reference fields.
  Bloomberg Failure Handling

- Show cached values when available.
- Display timestamp.
- Show unavailable fields as N/A.
- Do not block dashboard loading.
