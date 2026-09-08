# Role

You are a Senior Cloud Native Backend Developer specializing in Google Cloud Platform (GCP).

# Goal

Design and implement the backend for 'Cross-DMS' directly on Google Cloud.
The system integrates documents from existing legacy modules (PMS, SMS, EMS, SWMS) using a **Cloud-First strategy**.

# Requirements

## 1. Database & Storage Architecture (GCP)

Use **Google Cloud SQL (PostgreSQL)** for metadata and **Google Cloud Storage (GCS)** for actual file storage.

### Key Tables (PostgreSQL DDL)

1. **TB_PROJECT, TB_CLIENT, TB_DMS_CATEGORY** (Same as standard DMS structure)
2. **TB_DMS_INDEX** (Core Metadata)
   - dms_uuid (PK, UUID)
   - project_id (FK)
   - category_code (FK)
   - doc_title (Varchar)
   - **gcs_file_path** (Varchar) -> Stores the object path in the bucket (e.g., 'pms/pj001/safety/report.pdf')
   - **gcs_public_url** (Varchar) -> Signed URL for download (optional)
   - is_client_submit (Boolean)
   - tags (JSONB)
   - created_at (Timestamp with Timezone)

## 2. Core Logic Implementation (Python)

### A. GCS File Handler (Crucial)

Implement a `StorageManager` class using `google-cloud-storage` library:

- **upload_file(file_obj, destination_path)**: Uploads file to GCS Bucket.
- **generate_download_link(blob_path)**: Generates a temporary Signed URL for secure viewing.
- **delete_file(blob_path)**: Deletes file from Bucket.

### B. Database Connection

- Use `SQLAlchemy` with `cloud-sql-python-connector` for secure connection to Cloud SQL.
- Ensure all timestamps are handled in UTC and converted to KST (Korea Standard Time) only for frontend display.

### C. Client Packaging Service (Stream Download)

- Function: `export_client_package(project_id, category)`
- Logic:
  1. Query DB for target files.
  2. Stream files directly from GCS to a ZIP archive in memory (do not save to local disk).
  3. Return the ZIP file as a response.

## 3. Output Request

Based on these requirements, please provide:

1. **PostgreSQL DDL** for Cloud SQL.
2. **Python Code** for `StorageManager` class (handling GCS uploads/downloads).
3. **Python Code** for DB Connection setup (using Cloud SQL Connector).
4. A brief guide on which **GCP Service Account roles** are needed (e.g., 'Storage Object Admin', 'Cloud SQL Client').
